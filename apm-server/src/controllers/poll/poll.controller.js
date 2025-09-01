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
    formatted.options = poll.options.map(option => ({
      id: option.id,
      text: option.text,
      displayOrder: option.displayOrder,
      voteCount: option._count?.votes || 0
    }));
  }

  if (includeResults && poll.votes && !poll.isAnonymous) {
    formatted.recentVoters = poll.votes
      .slice(0, 5)
      .map(vote => ({
        user: {
          id: vote.user.id,
          firstName: vote.user.firstName,
          lastName: vote.user.lastName,
          profilePhoto: vote.user.profilePhoto
        },
        votedAt: vote.createdAt,
        optionId: vote.optionId
      }));
  }

  if (poll.creator) {
    formatted.creator = {
      id: poll.creator.id,
      firstName: poll.creator.firstName,
      lastName: poll.creator.lastName
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
          firstName: true,
          lastName: true
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

    // Format response data
    const formattedPolls = polls.map(poll => formatPollData(poll, true));

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
          firstName: true,
          lastName: true
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
              firstName: true,
              lastName: true,
              profilePhoto: true
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

    // Log activity
    await prisma.activityLog.create({
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

    // Fetch complete poll data for response
    const createdPoll = await prisma.poll.findUnique({
      where: { id: result.poll.id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
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
    const { title, description, isActive, allowMultiple, expiresAt, isAnonymous } = req.body;
    const userId = req.user.id;

    // Check if poll has votes (some fields cannot be changed)
    const voteCount = await prisma.pollVote.count({
      where: { pollId }
    });

    // Build update data
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // These fields can only be changed if no votes exist
    if (voteCount === 0) {
      if (allowMultiple !== undefined) updateData.allowMultiple = allowMultiple;
      if (isAnonymous !== undefined) updateData.isAnonymous = isAnonymous;
    } else {
      // If votes exist and these fields are being changed, warn user
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

    // Update poll
    const poll = await prisma.poll.update({
      where: { id: pollId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
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

    // Get poll details for logging
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        title: true,
        createdBy: true,
        _count: {
          select: { votes: true }
        }
      }
    });

    if (!poll) {
      return errorResponse(res, 'Poll not found', 404);
    }

    // Delete poll (cascade will handle options and votes)
    await prisma.poll.delete({
      where: { id: pollId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'poll_delete',
        details: {
          pollId: poll.id,
          pollTitle: poll.title,
          voteCount: poll._count.votes
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
          voteCount: poll._count.votes
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
 * Get active polls for quick access
 * GET /api/polls/active
 * Access: Public
 */
const getActivePolls = async (req, res) => {
  try {
    const now = new Date();
    
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
            firstName: true,
            lastName: true
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

    const responseData = {
      activePolls: polls.map(poll => formatPollData(poll, true)),
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

  // User-specific
  getUserVotes,

  // Statistics and utilities
  getPollStatistics,
  getActivePolls
};