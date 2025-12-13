// src/controllers/like.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { getTenantFilter } = require('../../utils/tenant.util');
const { NotificationService } = require('../../services/notification.service');

// Toggle reaction on a post
const toggleReaction = async (req, res) => {
  const { postId } = req.params;
  const { reactionType = 'LIKE' } = req.body; // Default to LIKE for backward compatibility
  const userId = req.user.id;
  
  // Validate reaction type
  const validReactions = ['LIKE', 'LOVE', 'CELEBRATE', 'SUPPORT', 'FUNNY', 'WOW', 'ANGRY', 'SAD'];
  if (!validReactions.includes(reactionType)) {
    return errorResponse(res, 'Invalid reaction type', 400);
  }
  
  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // Check if post exists and allows likes (with tenant isolation)
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: {
        id: true,
        allowLikes: true,
        isPublished: true,
        isArchived: true,
        createdBy: true,
        title: true,
        author: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }
    
    if (!post.isPublished || post.isArchived) {
      return errorResponse(res, 'Cannot like this post', 400);
    }
    
    if (!post.allowLikes) {
      return errorResponse(res, 'Likes are disabled for this post', 400);
    }
    
    // Check if user already has ANY reaction on the post (only one reaction allowed per user)
    const existingReaction = await prisma.like.findFirst({
      where: {
        postId,
        userId,
      },
    });
    
    let action;
    let reactions;
    
    if (existingReaction) {
      if (existingReaction.reactionType === reactionType) {
        // Same reaction - remove it (decrease count)
        await prisma.$transaction(async (prisma) => {
          await prisma.like.delete({
            where: { id: existingReaction.id },
          });
          
          // Update post reaction counts
          const countField = `${reactionType.toLowerCase()}Count`;
          await prisma.post.update({
            where: { id: postId },
            data: {
              [countField]: { decrement: 1 },
              totalReactions: { decrement: 1 },
            },
          });
        });
        action = 'removed';
      } else {
        // Different reaction - update to new reaction type (count stays same)
        await prisma.$transaction(async (prisma) => {
          await prisma.like.update({
            where: { id: existingReaction.id },
            data: { reactionType },
          });
          
          // Update post reaction counts (decrease old, increase new)
          const oldCountField = `${existingReaction.reactionType.toLowerCase()}Count`;
          const newCountField = `${reactionType.toLowerCase()}Count`;
          
          await prisma.post.update({
            where: { id: postId },
            data: {
              [oldCountField]: { decrement: 1 },
              [newCountField]: { increment: 1 },
              // totalReactions stays the same
            },
          });
        });
        action = 'updated';
      }
    } else {
      // No existing reaction - add new one (increase count)
      await prisma.$transaction(async (prisma) => {
        await prisma.like.create({
          data: {
            postId,
            userId,
            reactionType,
          },
        });
        
        // Update post reaction counts
        const countField = `${reactionType.toLowerCase()}Count`;
        await prisma.post.update({
          where: { id: postId },
          data: {
            [countField]: { increment: 1 },
            totalReactions: { increment: 1 },
          },
        });
      });
      action = 'added';
    }
    
    // Create notification for post author (if not reacting to own post and action is added or updated)
    if (post.createdBy !== userId && (action === 'added' || action === 'updated')) {
      const reactionEmojis = {
        LIKE: '👍',
        LOVE: '❤️',
        CELEBRATE: '🎉',
        SUPPORT: '🙌',
        FUNNY: '😂',
        WOW: '😮',
        ANGRY: '😠',
        SAD: '😢'
      };

      const actionText = action === 'added' ? 'reacted' : 'changed their reaction';

      // Use NotificationService to create notification AND send push notification
      try {
        await NotificationService.createAndSendNotification({
          recipientIds: [post.createdBy],
          type: 'GENERAL',
          title: 'Someone reacted to your post',
          message: `${req.user.fullName} ${actionText} ${reactionEmojis[reactionType]} to your post "${post.title}"`,
          data: {
            postId: post.id,
            reactedBy: userId,
            reactorName: req.user.fullName,
            reactionType,
            action: 'post_reaction',
          },
          tenantCode: req.tenantCode,
          organizationId: req.organizationId
        });
      } catch (notificationError) {
        console.error('Failed to send reaction notification:', notificationError);
        // Don't fail the main request if notification fails
      }
    }
    
    // Get updated reaction counts from the Post model (much faster)
    const postWithCounts = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        likeCount: true,
        loveCount: true,
        celebrateCount: true,
        supportCount: true,
        funnyCount: true,
        wowCount: true,
        angryCount: true,
        sadCount: true,
        totalReactions: true,
      },
    });
    
    // Format reaction counts
    reactions = {
      LIKE: postWithCounts.likeCount,
      LOVE: postWithCounts.loveCount,
      CELEBRATE: postWithCounts.celebrateCount,
      SUPPORT: postWithCounts.supportCount,
      FUNNY: postWithCounts.funnyCount,
      WOW: postWithCounts.wowCount,
      ANGRY: postWithCounts.angryCount,
      SAD: postWithCounts.sadCount,
    };
    
    // Get user's current reactions for this post
    const userReactions = await prisma.like.findMany({
      where: { postId, userId },
      select: { reactionType: true },
    });
    
    const userReactionTypes = userReactions.map(r => r.reactionType);
    
    // Total reaction count from Post model
    const totalReactions = postWithCounts.totalReactions;
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: `post_reaction_${action}`,
        details: {
          postId: post.id,
          postTitle: post.title,
          authorId: post.createdBy,
          reactionType,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, {
      action,
      reactionType,
      reactions,
      userReactions: userReactionTypes,
      totalReactions,
      // Legacy fields for backward compatibility
      likeCount: reactions.LIKE,
      isLiked: userReactionTypes.includes('LIKE'),
    }, `Reaction ${action} successfully`);
    
  } catch (error) {
    console.error('Toggle reaction error:', error);
    return errorResponse(res, 'Failed to toggle reaction', 500);
  }
};

// Legacy function for backward compatibility
const toggleLike = async (req, res) => {
  // Forward to toggleReaction with LIKE type
  req.body = { reactionType: 'LIKE' };
  return toggleReaction(req, res);
};

// Get users who liked a post
const getPostLikes = async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // Check if post exists (with tenant isolation)
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: { id: true, isPublished: true, isArchived: true },
    });

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }

    if (!post.isPublished || post.isArchived) {
      return errorResponse(res, 'Cannot view likes for this post', 400);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get likes with user information
    const [likes, total] = await Promise.all([
      prisma.like.findMany({
        where: { postId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
              batch: true,
              employmentStatus: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.like.count({ where: { postId } }),
    ]);
    
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
      hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
      hasPrev: parseInt(page) > 1,
    };
    
    return successResponse(res, {
      likes: likes.map(like => ({
        id: like.id,
        user: like.user,
        likedAt: like.createdAt,
      })),
      pagination,
    }, 'Post likes retrieved successfully');
    
  } catch (error) {
    console.error('Get post likes error:', error);
    return errorResponse(res, 'Failed to retrieve post likes', 500);
  }
};

// Check if current user liked a post
const checkUserLike = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  
  try {
    const like = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });
    
    return successResponse(res, {
      isLiked: !!like,
      likedAt: like?.createdAt || null,
    }, 'User like status retrieved successfully');
    
  } catch (error) {
    console.error('Check user like error:', error);
    return errorResponse(res, 'Failed to check like status', 500);
  }
};

// Get post reactions with counts and user reactions
const getPostReactions = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user?.id;

  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // Check if post exists (with tenant isolation)
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: { id: true, isPublished: true, isArchived: true },
    });

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }

    if (!post.isPublished || post.isArchived) {
      return errorResponse(res, 'Cannot view reactions for this post', 400);
    }
    
    // Get reaction counts from Post model (much faster)
    const postWithCounts = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        likeCount: true,
        loveCount: true,
        celebrateCount: true,
        supportCount: true,
        funnyCount: true,
        wowCount: true,
        angryCount: true,
        sadCount: true,
        totalReactions: true,
      },
    });
    
    // Format reaction counts
    const reactions = {
      LIKE: postWithCounts.likeCount,
      LOVE: postWithCounts.loveCount,
      CELEBRATE: postWithCounts.celebrateCount,
      SUPPORT: postWithCounts.supportCount,
      FUNNY: postWithCounts.funnyCount,
      WOW: postWithCounts.wowCount,
      ANGRY: postWithCounts.angryCount,
      SAD: postWithCounts.sadCount,
    };
    
    const totalReactions = postWithCounts.totalReactions;
    
    // Get user's reactions if authenticated
    let userReactions = [];
    if (userId) {
      const userReactionData = await prisma.like.findMany({
        where: { postId, userId },
        select: { reactionType: true },
      });
      userReactions = userReactionData.map(r => r.reactionType);
    }
    
    return successResponse(res, {
      reactions,
      totalReactions,
      userReactions,
      // Legacy compatibility
      likeCount: reactions.LIKE,
      isLiked: userReactions.includes('LIKE'),
    }, 'Post reactions retrieved successfully');
    
  } catch (error) {
    console.error('Get post reactions error:', error);
    return errorResponse(res, 'Failed to retrieve post reactions', 500);
  }
};

// Get detailed reaction users for modal (LinkedIn-style)
const getPostReactionUsers = async (req, res) => {
  const { postId } = req.params;
  const { reactionType, page = 1, limit = 20 } = req.query;

  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // Check if post exists (with tenant isolation)
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: { id: true, isPublished: true, isArchived: true },
    });

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }

    if (!post.isPublished || post.isArchived) {
      return errorResponse(res, 'Cannot view reactions for this post', 400);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const whereClause = { postId };
    if (reactionType && reactionType !== 'ALL') {
      whereClause.reactionType = reactionType;
    }
    
    // Get reactions with user details
    const [reactions, total] = await Promise.all([
      prisma.like.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
              batch: true,
              employmentStatus: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' }, // Most recent first
        skip,
        take: parseInt(limit),
      }),
      prisma.like.count({ where: whereClause }),
    ]);
    
    // Get counts by reaction type for tabs
    const reactionCounts = await prisma.like.groupBy({
      by: ['reactionType'],
      where: { postId },
      _count: { _all: true },
    });
    
    const countsByType = reactionCounts.reduce((acc, item) => {
      acc[item.reactionType] = item._count._all;
      return acc;
    }, {});
    
    // Add total count
    const totalCount = await prisma.like.count({ where: { postId } });
    countsByType.ALL = totalCount;
    
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
      hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
      hasPrev: parseInt(page) > 1,
    };
    
    return successResponse(res, {
      reactions: reactions.map(reaction => ({
        id: reaction.id,
        reactionType: reaction.reactionType,
        createdAt: reaction.createdAt,
        user: reaction.user,
      })),
      reactionCounts: countsByType,
      pagination,
    }, 'Post reaction users retrieved successfully');
    
  } catch (error) {
    console.error('Get post reaction users error:', error);
    return errorResponse(res, 'Failed to retrieve reaction users', 500);
  }
};

module.exports = {
  toggleReaction,
  toggleLike, // Legacy compatibility
  getPostLikes,
  getPostReactions,
  getPostReactionUsers, // New endpoint
  checkUserLike,
};