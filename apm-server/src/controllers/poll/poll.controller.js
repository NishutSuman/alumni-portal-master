// src/controllers/poll.controller.js
const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../../utils/response');
const { CacheService } = require('../../config/redis');

const prisma = new PrismaClient();

// ============================================
// HELPER FUNCTIONS
// ============================================

// Format poll data for response
const formatPollData = (poll, includeResults = true) => {
  const formatted = {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    isActive: poll.isActive,
    allowMultiple: poll.allowMultiple,
    expiresAt: poll.expiresAt,
    isAnonymous: poll.isAnonymous,
    isExpired: poll.expiresAt ? new Date() > new Date(poll.expiresAt) : false,
    createdBy: poll.createdBy,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    totalVotes: poll._count?.votes || 0
  };

  if (poll.options) {
    const totalVotes = poll._count?.votes || 0;
    formatted.options = poll.options.map(option => {
      const voteCount = option._count?.votes || 0;
      const percentage = totalVotes > 0 ? parseFloat(((voteCount / totalVotes) * 100).toFixed(1)) : 0;
      
      return {
        id: option.id,
        text: option.text,
        displayOrder: option.displayOrder,
        voteCount,
        percentage
      };
    });
  }

  if (includeResults && poll.votes && !poll.isAnonymous) {
    formatted.recentVoters = poll.votes
      .slice(0, 5)
      .map(vote => ({
        user: {
          id: vote.user.id,
          fullName: vote.user.fullName,
          profileImage: vote.user.profileImage
        },
        votedAt: vote.createdAt,
        optionId: vote.optionId
      }));
  }

  if (poll.creator) {
    formatted.creator = {
      id: poll.creator.id,
      fullName: poll.creator.fullName
    };
  }

  return formatted;
};

// Calculate poll results
const calculatePollResults = (poll) => {
  const totalVotes = poll._count?.votes || 0;
  
  const results = poll.options?.map(option => {
    const voteCount = option._count?.votes || 0;
    const percentage = totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : '0.0';
    
    return {
      optionId: option.id,
      text: option.text,
      voteCount,
      percentage: parseFloat(percentage)
    };
  }) || [];

  return {
    totalVotes,
    results: results.sort((a, b) => b.voteCount - a.voteCount)
  };
};

// ============================================
// POLL MANAGEMENT CONTROLLERS
// ============================================

/**
 * Get all polls with filtering and pagination
 * GET /api/polls
 * Access: Public (with different data based on auth)
 */
const getPolls = async (req, res) => {
  try {
    const {
      isActive,
      createdBy,
      hasExpired,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build where clause
    const where = {};
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (createdBy) {
      where.createdBy = createdBy;
    }
    
    // Handle expired polls filter
    if (hasExpired !== undefined) {
      const now = new Date();
      if (hasExpired === 'true') {
        where.expiresAt = { lt: now };
      } else {
        where.OR = [
          { expiresAt: null },
          { expiresAt: { gte: now } }
        ];
      }
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Build order clause
    const orderBy = {};
    if (sortBy === 'voteCount') {
      orderBy.votes = { _count: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build include clause
    const include = {
      creator: {
        select: {
          id: true,
          fullName: true
        }
      },
      options: {
        select: {
          id: true,
          text: true,
          displayOrder: true,
          _count: {
            select: { votes: true }
          }
        },
        orderBy: { displayOrder: 'asc' }
      },
      _count: {
        select: { votes: true }
      }
    };

    // Execute queries
    const [polls, totalCount] = await Promise.all([
      prisma.poll.findMany({
        where,
        include,
        orderBy,
        skip,
        take: parseInt(limit)
      }),
      prisma.poll.count({ where })
    ]);

    // Get user votes for all polls if user is authenticated
    const userId = req.user?.id;
    let userVotes = [];
    if (userId) {
      userVotes = await prisma.pollVote.findMany({
        where: {
          userId,
          pollId: { in: polls.map(poll => poll.id) }
        },
        select: {
          pollId: true,
          optionId: true
        }
      });
    }

    // Format polls with user voting data
    const formattedPolls = polls.map(poll => {
      const pollUserVotes = userVotes.filter(vote => vote.pollId === poll.id);
      const hasVoted = pollUserVotes.length > 0;
      const userVoteOptionIds = pollUserVotes.map(vote => vote.optionId);

      return {
        ...formatPollData(poll, true),
        hasVoted,
        userVote: hasVoted ? userVoteOptionIds : null
      };
    });

    const responseData = {
      polls: formattedPolls,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: parseInt(page) * parseInt(limit) < totalCount,
        hasPrev: parseInt(page) > 1
      },
      filters: {
        isActive,
        createdBy,
        hasExpired,
        search,
        sortBy,
        sortOrder
      }
    };

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, responseData, 'Polls retrieved successfully');
  } catch (error) {
    console.error('Get polls error:', error);
    return errorResponse(res, 'Failed to retrieve polls', 500);
  }
};

/**
 * Get single poll with details and results
 * GET /api/polls/:pollId
 * Access: Public (with different data based on auth)
 */
const getPoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { includeResults = 'true' } = req.query;
    const userId = req.user?.id;

    const include = {
      creator: {
        select: {
          id: true,
          fullName: true
        }
      },
      options: {
        select: {
          id: true,
          text: true,
          displayOrder: true,
          _count: {
            select: { votes: true }
          }
        },
        orderBy: { displayOrder: 'asc' }
      },
      _count: {
        select: { votes: true }
      }
    };

    // Include recent voters if not anonymous and results requested
    if (includeResults === 'true') {
      include.votes = {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10 // Limit recent voters
      };
    }

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include
    });

    if (!poll) {
      return errorResponse(res, 'Poll not found', 404);
    }

    // Check if user has voted (if authenticated)
    let userVote = null;
    if (userId) {
      userVote = await prisma.pollVote.findFirst({
        where: {
          pollId,
          userId
        },
        select: {
          optionId: true,
          createdAt: true
        }
      });
    }

    const responseData = {
      ...formatPollData(poll, includeResults === 'true'),
      results: calculatePollResults(poll),
      userVote: userVote ? {
        optionId: userVote.optionId,
        votedAt: userVote.createdAt,
        hasVoted: true
      } : { hasVoted: false }
    };

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, responseData, 'Poll retrieved successfully');
  } catch (error) {
    console.error('Get poll error:', error);
    return errorResponse(res, 'Failed to retrieve poll', 500);
  }
};

/**
 * Create new poll
 * POST /api/polls
 * Access: SUPER_ADMIN
 */
const createPoll = async (req, res) => {
  try {
    console.log('Create poll request body:', req.body);
    console.log('User:', req.user);
    const { title, description, options, allowMultiple, expiresAt, isAnonymous } = req.body;
    const userId = req.user.id;

    // Create poll with options in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create poll
      const poll = await tx.poll.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          allowMultiple: allowMultiple || false,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isAnonymous: isAnonymous || false,
          createdBy: userId
        }
      });

      // Create poll options
      const pollOptions = await Promise.all(
        options.map((optionText, index) =>
          tx.pollOption.create({
            data: {
              text: optionText.trim(),
              displayOrder: index,
              pollId: poll.id
            }
          })
        )
      );

      return { poll, options: pollOptions };
    });

    // Log activity (will be updated with notification stats later)
    const activityLog = await prisma.activityLog.create({
      data: {
        userId,
        action: 'poll_create',
        details: {
          pollId: result.poll.id,
          pollTitle: result.poll.title,
          optionsCount: options.length,
          allowMultiple,
          hasExpiry: !!expiresAt,
          isAnonymous
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Send notifications to all users about new poll
    try {
      console.log('📢 Sending poll creation notifications to all users');
      
      // Get all active users (excluding the poll creator)
      const allUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: userId } // Exclude the poll creator
        },
        select: {
          id: true,
          fullName: true,
          email: true
        }
      });

      console.log(`📨 Found ${allUsers.length} users to notify`);

      // Get push notification service
      const pushNotificationService = require('../../utils/push-notification.util');

      // Create in-app notifications for all users (batch operation for efficiency)
      const notificationData = allUsers.map(user => ({
        userId: user.id,
        type: 'GENERAL',
        title: 'New Poll Available',
        message: `A new poll "${result.poll.title}" has been created. Cast your vote now!`,
        payload: {
          pollId: result.poll.id,
          pollTitle: result.poll.title,
          createdBy: req.user.fullName || 'Admin',
          type: 'poll_created',
          expiresAt: result.poll.expiresAt
        }
      }));

      // Batch create in-app notifications
      await prisma.notification.createMany({
        data: notificationData
      });

      console.log(`✅ Created ${notificationData.length} in-app notifications`);

      // Send push notifications
      if (pushNotificationService.initialized) {
        // Send topic-based notification for better performance
        try {
          await pushNotificationService.sendToTopic({
            topic: 'all_users',
            title: 'New Poll Available',
            body: `A new poll "${result.poll.title}" has been created. Cast your vote now!`,
            data: {
              type: 'poll_created',
              pollId: result.poll.id,
              pollTitle: result.poll.title,
              createdBy: req.user.fullName || 'Admin'
            },
            priority: 'normal'
          });
          console.log('✅ Topic-based push notification sent');
        } catch (topicError) {
          console.log('📱 Topic notification failed, sending individual notifications');
          
          // Fallback to individual notifications
          for (const user of allUsers.slice(0, 10)) { // Limit to first 10 for demo
            try {
              const mockToken = `mock_token_${user.id}`;
              await pushNotificationService.sendToToken({
                token: mockToken,
                title: 'New Poll Available',
                body: `A new poll "${result.poll.title}" has been created. Cast your vote now!`,
                data: {
                  type: 'poll_created',
                  pollId: result.poll.id,
                  pollTitle: result.poll.title,
                  createdBy: req.user.fullName || 'Admin'
                },
                priority: 'normal'
              });
              console.log(`✅ Push notification sent to: ${user.fullName}`);
            } catch (notifError) {
              console.error(`❌ Failed to send notification to user ${user.id}:`, notifError.message);
            }
          }
        }
      }

      // Update activity log with notification stats
      await prisma.activityLog.update({
        where: { id: activityLog.id },
        data: {
          details: {
            ...activityLog.details,
            notificationsStarted: true,
            usersNotified: allUsers.length,
            notificationsSent: true
          }
        }
      });

      console.log('📢 Poll creation notifications completed');
    } catch (notificationError) {
      console.error('Failed to send poll creation notifications:', notificationError);
      
      // Update activity log with error info
      try {
        await prisma.activityLog.update({
          where: { id: activityLog.id },
          data: {
            details: {
              ...activityLog.details,
              notificationsStarted: true,
              notificationError: notificationError.message,
              notificationsSent: false
            }
          }
        });
      } catch (logError) {
        console.error('Failed to update activity log:', logError);
      }
      // Don't fail poll creation if notifications fail
    }

    // Fetch complete poll data for response
    const createdPoll = await prisma.poll.findUnique({
      where: { id: result.poll.id },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true
          }
        },
        options: {
          select: {
            id: true,
            text: true,
            displayOrder: true,
            _count: {
              select: { votes: true }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: { votes: true }
        }
      }
    });

    const responseData = formatPollData(createdPoll, true);

    return successResponse(
      res,
      responseData,
      'Poll created successfully',
      201
    );
  } catch (error) {
    console.error('Create poll error:', error);
    return errorResponse(res, 'Failed to create poll', 500);
  }
};

/**
 * Update poll
 * PUT /api/polls/:pollId
 * Access: SUPER_ADMIN or poll creator
 */
const updatePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { title, description, isActive, allowMultiple, expiresAt, isAnonymous, addOptions, removeOptionIds } = req.body;
    const userId = req.user.id;

    console.log('🔍 Update poll request:', {
      pollId,
      body: req.body,
      userId,
      userRole: req.user.role,
      hasAddOptions: !!addOptions,
      addOptionsLength: addOptions?.length,
      addOptionsData: addOptions
    });

    // Check if poll has votes (some fields cannot be changed)
    const voteCount = await prisma.pollVote.count({
      where: { pollId }
    });

    // Build update data
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // These fields can only be changed if no votes exist OR user is SUPER_ADMIN
    const isAdmin = req.user.role === 'SUPER_ADMIN';
    
    if (voteCount === 0 || isAdmin) {
      if (allowMultiple !== undefined) updateData.allowMultiple = allowMultiple;
      if (isAnonymous !== undefined) updateData.isAnonymous = isAnonymous;
    } else {
      // If votes exist and these fields are being changed by non-admin, warn user
      if (allowMultiple !== undefined || isAnonymous !== undefined) {
        return errorResponse(res, 'Cannot change voting type or anonymity settings after votes have been cast', 400, {
          voteCount
        });
      }
    }
    
    // Expiry can always be updated
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    // Handle adding new options (admin only)
    console.log('🔍 Adding options debug:', { addOptions, isAdmin, userId: req.user.id, userRole: req.user.role });
    if (addOptions && addOptions.length > 0 && isAdmin) {
      console.log('✅ Adding new options:', addOptions);
      const currentOptions = await prisma.pollOption.findMany({
        where: { pollId },
        select: { displayOrder: true },
        orderBy: { displayOrder: 'desc' },
        take: 1
      });
      
      const nextDisplayOrder = currentOptions.length > 0 ? currentOptions[0].displayOrder + 1 : 1;
      
      for (let i = 0; i < addOptions.length; i++) {
        const newOption = await prisma.pollOption.create({
          data: {
            pollId,
            text: addOptions[i].trim(),
            displayOrder: nextDisplayOrder + i
          }
        });
        console.log('✅ Created new option:', newOption);
      }
    } else {
      console.log('❌ Not adding options:', { hasOptions: !!addOptions && addOptions.length > 0, isAdmin });
    }

    // Handle removing options (admin only)
    if (removeOptionIds && removeOptionIds.length > 0 && isAdmin) {
      // First remove all votes for these options
      await prisma.pollVote.deleteMany({
        where: {
          pollId,
          optionId: { in: removeOptionIds }
        }
      });
      
      // Then remove the options
      await prisma.pollOption.deleteMany({
        where: {
          pollId,
          id: { in: removeOptionIds }
        }
      });
    }

    // Update poll
    const poll = await prisma.poll.update({
      where: { id: pollId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            fullName: true
          }
        },
        options: {
          select: {
            id: true,
            text: true,
            displayOrder: true,
            _count: {
              select: { votes: true }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: { votes: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'poll_update',
        details: {
          pollId: poll.id,
          pollTitle: poll.title,
          updatedFields: Object.keys(updateData),
          voteCount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Send push notifications to existing voters if poll was updated
    if (voteCount > 0) {
      try {
        // Get all unique voters for this poll
        const existingVoters = await prisma.pollVote.findMany({
          where: { pollId },
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                fullName: true
              }
            }
          },
          distinct: ['userId']
        });

        console.log('📨 Sending notifications to', existingVoters.length, 'voters');
        
        // Get push notification service
        const pushNotificationService = require('../../utils/push-notification.util');
        
        for (const voter of existingVoters) {
          // Skip notification to the user who updated the poll
          if (voter.userId === userId) continue;

          console.log('📱 Processing notification for voter:', voter.userId, voter.user.fullName);

          // Create an in-app notification
          await prisma.notification.create({
            data: {
              userId: voter.userId,
              type: 'GENERAL',
              title: 'Poll Updated',
              message: `The poll "${poll.title}" you voted on has been updated by an admin`,
              payload: {
                pollId: poll.id,
                pollTitle: poll.title,
                updatedBy: req.user.fullName || 'Admin',
                type: 'poll_updated'
              }
            }
          });

          // Send push notification (will be mocked in development)
          try {
            // Note: In real implementation, you would fetch user's FCM tokens from database
            // For now, using mock tokens to demonstrate the functionality
            const mockToken = `mock_token_${voter.userId}`;
            
            await pushNotificationService.sendToToken({
              token: mockToken,
              title: 'Poll Updated',
              body: `The poll "${poll.title}" you voted on has been updated by an admin`,
              data: {
                type: 'poll_updated',
                pollId: poll.id,
                pollTitle: poll.title,
                updatedBy: req.user.fullName || 'Admin'
              },
              priority: 'normal'
            });

            console.log('✅ Push notification sent to:', voter.user.fullName);
          } catch (pushError) {
            console.error('❌ Push notification failed for user:', voter.userId, pushError.message);
          }
        }
      } catch (notificationError) {
        console.error('Failed to send poll update notifications:', notificationError);
        // Don't fail the update if notifications fail
      }
    }

    const responseData = formatPollData(poll, true);

    return successResponse(res, responseData, 'Poll updated successfully');
  } catch (error) {
    console.error('Update poll error:', error);
    return errorResponse(res, 'Failed to update poll', 500);
  }
};

/**
 * Delete poll
 * DELETE /api/polls/:pollId
 * Access: SUPER_ADMIN or poll creator
 */
const deletePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const userId = req.user.id;

    // Get poll details for logging (including counts for audit)
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        title: true,
        createdBy: true,
        _count: {
          select: { 
            votes: true,
            options: true 
          }
        }
      }
    });

    if (!poll) {
      return errorResponse(res, 'Poll not found', 404);
    }

    console.log('🗑️ Deleting poll:', {
      pollId: poll.id,
      title: poll.title,
      voteCount: poll._count.votes,
      optionCount: poll._count.options
    });

    // Delete poll (CASCADE will automatically handle:)
    // - All PollOptions (via onDelete: Cascade)
    // - All PollVotes (via onDelete: Cascade from both Poll and PollOption)
    await prisma.poll.delete({
      where: { id: pollId }
    });

    console.log('✅ Poll deleted successfully with all related data');

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'poll_delete',
        details: {
          pollId: poll.id,
          pollTitle: poll.title,
          voteCount: poll._count.votes,
          optionCount: poll._count.options
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(
      res,
      { 
        deletedPoll: { 
          id: poll.id, 
          title: poll.title,
          voteCount: poll._count.votes,
          optionCount: poll._count.options
        }
      },
      'Poll deleted successfully'
    );
  } catch (error) {
    console.error('Delete poll error:', error);
    return errorResponse(res, 'Failed to delete poll', 500);
  }
};

// ============================================
// VOTING CONTROLLERS
// ============================================

/**
 * Vote in poll
 * POST /api/polls/:pollId/vote
 * Access: Authenticated users
 */
const votePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { optionIds } = req.body;
    const userId = req.user.id;

    // Get poll details
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        title: true,
        allowMultiple: true
      }
    });

    // Remove existing votes for this user in this poll
    await prisma.pollVote.deleteMany({
      where: {
        pollId,
        userId
      }
    });

    // Create new votes
    const votes = await Promise.all(
      optionIds.map(optionId =>
        prisma.pollVote.create({
          data: {
            pollId,
            optionId,
            userId
          },
          include: {
            option: {
              select: {
                id: true,
                text: true
              }
            }
          }
        })
      )
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'poll_vote',
        details: {
          pollId,
          pollTitle: poll.title,
          optionIds,
          optionsCount: optionIds.length
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const responseData = {
      pollId,
      votes: votes.map(vote => ({
        optionId: vote.optionId,
        optionText: vote.option.text,
        votedAt: vote.createdAt
      })),
      message: `Vote${votes.length > 1 ? 's' : ''} recorded successfully`
    };

    return successResponse(
      res,
      responseData,
      'Vote recorded successfully',
      201
    );
  } catch (error) {
    console.error('Vote poll error:', error);
    return errorResponse(res, 'Failed to record vote', 500);
  }
};

/**
 * Get poll results
 * GET /api/polls/:pollId/results
 * Access: Public
 */
const getPollResults = async (req, res) => {
  try {
    const { pollId } = req.params;

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          select: {
            id: true,
            text: true,
            displayOrder: true,
            _count: {
              select: { votes: true }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: { votes: true }
        }
      }
    });

    if (!poll) {
      return errorResponse(res, 'Poll not found', 404);
    }

    const results = calculatePollResults(poll);

    const responseData = {
      pollId: poll.id,
      title: poll.title,
      isActive: poll.isActive,
      isExpired: poll.expiresAt ? new Date() > new Date(poll.expiresAt) : false,
      ...results,
      lastUpdated: new Date().toISOString()
    };

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, responseData, 'Poll results retrieved successfully');
  } catch (error) {
    console.error('Get poll results error:', error);
    return errorResponse(res, 'Failed to retrieve poll results', 500);
  }
};

// ============================================
// USER-SPECIFIC CONTROLLERS
// ============================================

/**
 * Get user's vote history
 * GET /api/polls/my-votes
 * Access: Authenticated users
 */
const getUserVotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build order clause
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute queries
    const [votes, totalCount] = await Promise.all([
      prisma.pollVote.findMany({
        where: { userId },
        include: {
          poll: {
            select: {
              id: true,
              title: true,
              isActive: true,
              expiresAt: true
            }
          },
          option: {
            select: {
              id: true,
              text: true
            }
          }
        },
        orderBy,
        skip,
        take: parseInt(limit),
        distinct: ['pollId'] // Get unique polls user voted in
      }),
      prisma.pollVote.count({
        where: { userId },
        distinct: ['pollId']
      })
    ]);

    const responseData = {
      votes: votes.map(vote => ({
        pollId: vote.poll.id,
        pollTitle: vote.poll.title,
        optionId: vote.option.id,
        optionText: vote.option.text,
        votedAt: vote.createdAt,
        pollStatus: {
          isActive: vote.poll.isActive,
          isExpired: vote.poll.expiresAt ? new Date() > new Date(vote.poll.expiresAt) : false
        }
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: parseInt(page) * parseInt(limit) < totalCount,
        hasPrev: parseInt(page) > 1
      }
    };

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, responseData, 'User votes retrieved successfully');
  } catch (error) {
    console.error('Get user votes error:', error);
    return errorResponse(res, 'Failed to retrieve user votes', 500);
  }
};

// ============================================
// STATISTICS CONTROLLERS
// ============================================

/**
 * Get poll statistics
 * GET /api/polls/statistics
 * Access: SUPER_ADMIN
 */
const getPollStatistics = async (req, res) => {
  try {
    const [
      totalPolls,
      activePolls,
      expiredPolls,
      totalVotes,
      averageVotesPerPoll,
      mostVotedPoll,
      recentPolls
    ] = await Promise.all([
      prisma.poll.count(),
      prisma.poll.count({ 
        where: { 
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } }
          ]
        } 
      }),
      prisma.poll.count({ 
        where: { 
          expiresAt: { lt: new Date() }
        } 
      }),
      prisma.pollVote.count(),
      prisma.poll.findMany({
        select: {
          _count: {
            select: { votes: true }
          }
        }
      }),
      prisma.poll.findFirst({
        include: {
          _count: {
            select: { votes: true }
          }
        },
        orderBy: {
          votes: {
            _count: 'desc'
          }
        }
      }),
      prisma.poll.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          createdAt: true,
          _count: {
            select: { votes: true }
          }
        }
      })
    ]);

    // Calculate average votes per poll
    const avgVotes = averageVotesPerPoll.length > 0 
      ? (averageVotesPerPoll.reduce((sum, poll) => sum + poll._count.votes, 0) / averageVotesPerPoll.length).toFixed(1)
      : 0;

    const responseData = {
      polls: {
        total: totalPolls,
        active: activePolls,
        inactive: totalPolls - activePolls,
        expired: expiredPolls
      },
      votes: {
        total: totalVotes,
        averagePerPoll: parseFloat(avgVotes)
      },
      mostVotedPoll: mostVotedPoll ? {
        id: mostVotedPoll.id,
        title: mostVotedPoll.title,
        voteCount: mostVotedPoll._count.votes
      } : null,
      recentPolls,
      generatedAt: new Date().toISOString()
    };

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, responseData, 'Poll statistics retrieved successfully');
  } catch (error) {
    console.error('Get poll statistics error:', error);
    return errorResponse(res, 'Failed to retrieve poll statistics', 500);
  }
};

/**
 * Get detailed poll statistics with voter information
 * GET /api/polls/:pollId/stats
 * Access: Public (respects anonymity settings)
 */
const getPollStats = async (req, res) => {
  try {
    const { pollId } = req.params;
    
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true
          }
        },
        options: {
          select: {
            id: true,
            text: true,
            displayOrder: true,
            votes: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    batch: true,
                    profileImage: true
                  }
                }
              },
              orderBy: { createdAt: 'desc' }
            },
            _count: {
              select: { votes: true }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: { votes: true }
        }
      }
    });

    if (!poll) {
      return errorResponse(res, 'Poll not found', 404);
    }

    const totalVotes = poll._count?.votes || 0;

    // Calculate detailed statistics
    const optionsStats = poll.options.map(option => {
      const voteCount = option._count?.votes || 0;
      const percentage = totalVotes > 0 ? parseFloat(((voteCount / totalVotes) * 100).toFixed(1)) : 0;
      
      // Include voter information only if poll is not anonymous
      const voters = poll.isAnonymous ? [] : option.votes.map(vote => ({
        id: vote.user.id,
        fullName: vote.user.fullName,
        batch: vote.user.batch,
        profileImage: vote.user.profileImage,
        votedAt: vote.createdAt
      }));

      return {
        id: option.id,
        text: option.text,
        voteCount,
        percentage,
        voters: voters
      };
    });

    // Get all unique voters
    const allVoters = poll.isAnonymous ? [] : poll.options.flatMap(option => 
      option.votes.map(vote => ({
        id: vote.user.id,
        fullName: vote.user.fullName,
        batch: vote.user.batch,
        profileImage: vote.user.profileImage,
        votedAt: vote.createdAt,
        optionId: option.id,
        optionText: option.text
      }))
    );

    // Remove duplicates for multiple choice polls
    const uniqueVoters = allVoters.reduce((acc, voter) => {
      const existingVoter = acc.find(v => v.id === voter.id);
      if (existingVoter) {
        existingVoter.options = existingVoter.options || [];
        existingVoter.options.push({
          id: voter.optionId,
          text: voter.optionText
        });
      } else {
        acc.push({
          ...voter,
          options: [{
            id: voter.optionId,
            text: voter.optionText
          }]
        });
      }
      return acc;
    }, []);

    const statsData = {
      poll: {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        isActive: poll.isActive,
        allowMultiple: poll.allowMultiple,
        isAnonymous: poll.isAnonymous,
        expiresAt: poll.expiresAt,
        createdAt: poll.createdAt,
        creator: poll.creator
      },
      totalVotes,
      totalVoters: uniqueVoters.length,
      options: optionsStats,
      voters: uniqueVoters.sort((a, b) => new Date(b.votedAt) - new Date(a.votedAt))
    };

    return successResponse(res, statsData, 'Poll statistics retrieved successfully');
  } catch (error) {
    console.error('Get poll stats error:', error);
    return errorResponse(res, 'Failed to retrieve poll statistics', 500);
  }
};

/**
 * Get active polls for quick access
 * GET /api/polls/active
 * Access: Public
 */
const getActivePolls = async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user?.id;
    
    const polls = await prisma.poll.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } }
        ]
      },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true
          }
        },
        options: {
          select: {
            id: true,
            text: true,
            displayOrder: true,
            _count: {
              select: { votes: true }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: { votes: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get user votes for all polls if user is authenticated
    let userVotes = [];
    if (userId) {
      userVotes = await prisma.pollVote.findMany({
        where: {
          userId,
          pollId: { in: polls.map(poll => poll.id) }
        },
        select: {
          pollId: true,
          optionId: true
        }
      });
    }

    // Format polls with user voting data
    const formattedPolls = polls.map(poll => {
      const pollUserVotes = userVotes.filter(vote => vote.pollId === poll.id);
      const hasVoted = pollUserVotes.length > 0;
      const userVoteOptionIds = pollUserVotes.map(vote => vote.optionId);

      return {
        ...formatPollData(poll, true),
        hasVoted,
        userVote: hasVoted ? userVoteOptionIds : null
      };
    });

    const responseData = {
      activePolls: formattedPolls,
      count: polls.length,
      lastUpdated: new Date().toISOString()
    };

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, responseData, 'Active polls retrieved successfully');
  } catch (error) {
    console.error('Get active polls error:', error);
    return errorResponse(res, 'Failed to retrieve active polls', 500);
  }
};

// ============================================
// EXPORTED CONTROLLERS
// ============================================

module.exports = {
  // Poll management
  getPolls,
  getPoll,
  createPoll,
  updatePoll,
  deletePoll,

  // Voting
  votePoll,
  getPollResults,
  getPollStats,

  // User-specific
  getUserVotes,

  // Statistics and utilities
  getPollStatistics,
  getActivePolls
};