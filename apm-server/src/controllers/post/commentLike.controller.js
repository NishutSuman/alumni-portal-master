// src/controllers/commentLike.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { getTenantFilter } = require('../../utils/tenant.util');

// Toggle reaction on a comment
const toggleCommentReaction = async (req, res) => {
  const { commentId } = req.params;
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

    // Check if comment exists and verify the post belongs to this tenant
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        content: true,
        createdBy: true,
        postId: true,
        author: {
          select: {
            id: true,
            fullName: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            allowComments: true,
            isPublished: true,
            isArchived: true,
            organizationId: true, // For tenant verification
          },
        },
      },
    });

    if (!comment) {
      return errorResponse(res, 'Comment not found', 404);
    }

    // Verify post belongs to the tenant (multi-tenant isolation)
    if (tenantFilter.organizationId && comment.post.organizationId !== tenantFilter.organizationId) {
      return errorResponse(res, 'Comment not found', 404);
    }

    if (!comment.post.isPublished || comment.post.isArchived || !comment.post.allowComments) {
      return errorResponse(res, 'Cannot react to this comment', 400);
    }
    
    // Check if user already has a reaction on the comment (only one reaction allowed per user)
    const existingReaction = await prisma.commentLike.findFirst({
      where: {
        commentId,
        userId,
      },
    });
    
    let action;
    let reactions;
    
    if (existingReaction) {
      if (existingReaction.reactionType === reactionType) {
        // Same reaction - remove it (decrease count)
        await prisma.$transaction(async (prisma) => {
          await prisma.commentLike.delete({
            where: { id: existingReaction.id },
          });
          
          // Update comment reaction counts
          const countField = `${reactionType.toLowerCase()}Count`;
          await prisma.comment.update({
            where: { id: commentId },
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
          await prisma.commentLike.update({
            where: { id: existingReaction.id },
            data: { reactionType },
          });
          
          // Update comment reaction counts (decrease old, increase new)
          const oldCountField = `${existingReaction.reactionType.toLowerCase()}Count`;
          const newCountField = `${reactionType.toLowerCase()}Count`;
          
          await prisma.comment.update({
            where: { id: commentId },
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
        await prisma.commentLike.create({
          data: {
            commentId,
            userId,
            reactionType,
          },
        });
        
        // Update comment reaction counts
        const countField = `${reactionType.toLowerCase()}Count`;
        await prisma.comment.update({
          where: { id: commentId },
          data: {
            [countField]: { increment: 1 },
            totalReactions: { increment: 1 },
          },
        });
      });
      action = 'added';
    }
    
    // Create notification for comment author (if not reacting to own comment and action is added or updated)
    if (comment.createdBy !== userId && (action === 'added' || action === 'updated')) {
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
      
      await prisma.notification.create({
        data: {
          userId: comment.createdBy,
          type: 'GENERAL',
          title: 'Someone reacted to your comment',
          message: `${req.user.fullName} ${actionText} ${reactionEmojis[reactionType]} to your comment on "${comment.post.title}"`,
          payload: {
            commentId: comment.id,
            postId: comment.postId,
            reactedBy: userId,
            reactorName: req.user.fullName,
            reactionType,
            action: 'comment_reaction',
          },
        },
      });
    }
    
    // Get updated reaction counts from the Comment model (much faster)
    const commentWithCounts = await prisma.comment.findUnique({
      where: { id: commentId },
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
      LIKE: commentWithCounts.likeCount,
      LOVE: commentWithCounts.loveCount,
      CELEBRATE: commentWithCounts.celebrateCount,
      SUPPORT: commentWithCounts.supportCount,
      FUNNY: commentWithCounts.funnyCount,
      WOW: commentWithCounts.wowCount,
      ANGRY: commentWithCounts.angryCount,
      SAD: commentWithCounts.sadCount,
    };
    
    // Get user's current reactions for this comment
    const userReactions = await prisma.commentLike.findMany({
      where: { commentId, userId },
      select: { reactionType: true },
    });
    
    const userReactionTypes = userReactions.map(r => r.reactionType);
    
    // Total reaction count from Comment model
    const totalReactions = commentWithCounts.totalReactions;
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: `comment_reaction_${action}`,
        details: {
          commentId: comment.id,
          postId: comment.postId,
          postTitle: comment.post.title,
          authorId: comment.createdBy,
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
    }, `Comment reaction ${action} successfully`);
    
  } catch (error) {
    console.error('Toggle comment reaction error:', error);
    return errorResponse(res, 'Failed to toggle comment reaction', 500);
  }
};

// Get comment reactions with counts and user reactions
const getCommentReactions = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.id;

  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // Check if comment exists with tenant verification
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        post: {
          select: {
            isPublished: true,
            isArchived: true,
            organizationId: true, // For tenant verification
          },
        },
      },
    });

    if (!comment) {
      return errorResponse(res, 'Comment not found', 404);
    }

    // Verify post belongs to the tenant (multi-tenant isolation)
    if (tenantFilter.organizationId && comment.post.organizationId !== tenantFilter.organizationId) {
      return errorResponse(res, 'Comment not found', 404);
    }

    if (!comment.post.isPublished || comment.post.isArchived) {
      return errorResponse(res, 'Cannot view reactions for this comment', 400);
    }
    
    // Get reaction counts from Comment model (much faster)
    const commentWithCounts = await prisma.comment.findUnique({
      where: { id: commentId },
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
      LIKE: commentWithCounts.likeCount,
      LOVE: commentWithCounts.loveCount,
      CELEBRATE: commentWithCounts.celebrateCount,
      SUPPORT: commentWithCounts.supportCount,
      FUNNY: commentWithCounts.funnyCount,
      WOW: commentWithCounts.wowCount,
      ANGRY: commentWithCounts.angryCount,
      SAD: commentWithCounts.sadCount,
    };
    
    const totalReactions = commentWithCounts.totalReactions;
    
    // Get user's reactions if authenticated
    let userReactions = [];
    if (userId) {
      const userReactionData = await prisma.commentLike.findMany({
        where: { commentId, userId },
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
    }, 'Comment reactions retrieved successfully');
    
  } catch (error) {
    console.error('Get comment reactions error:', error);
    return errorResponse(res, 'Failed to retrieve comment reactions', 500);
  }
};

// Get detailed comment reaction users for modal (LinkedIn-style)
const getCommentReactionUsers = async (req, res) => {
  const { commentId } = req.params;
  const { reactionType, page = 1, limit = 20 } = req.query;

  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // Check if comment exists with tenant verification
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        post: {
          select: {
            isPublished: true,
            isArchived: true,
            organizationId: true, // For tenant verification
          },
        },
      },
    });

    if (!comment) {
      return errorResponse(res, 'Comment not found', 404);
    }

    // Verify post belongs to the tenant (multi-tenant isolation)
    if (tenantFilter.organizationId && comment.post.organizationId !== tenantFilter.organizationId) {
      return errorResponse(res, 'Comment not found', 404);
    }

    if (!comment.post.isPublished || comment.post.isArchived) {
      return errorResponse(res, 'Cannot view reactions for this comment', 400);
    }
    
    // Build where condition
    const whereCondition = { commentId };
    if (reactionType && reactionType !== 'ALL') {
      whereCondition.reactionType = reactionType;
    }
    
    // Get total count for pagination
    const totalCount = await prisma.commentLike.count({
      where: whereCondition,
    });
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const totalPages = Math.ceil(totalCount / limitNum);
    
    // Get reactions with user data
    const reactions = await prisma.commentLike.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            batch: true,
            employmentStatus: true,
            workHistory: {
              where: { isCurrentJob: true },
              select: {
                companyName: true,
                jobRole: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    });
    
    // Get reaction counts for all types
    const reactionCounts = await prisma.commentLike.groupBy({
      by: ['reactionType'],
      where: { commentId },
      _count: { reactionType: true },
    });
    
    const formattedReactionCounts = reactionCounts.reduce((acc, item) => {
      acc[item.reactionType] = item._count.reactionType;
      return acc;
    }, {});
    
    // Pagination info
    const pagination = {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      pages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    };
    
    return successResponse(res, {
      reactions,
      reactionCounts: formattedReactionCounts,
      pagination,
    }, 'Comment reaction users retrieved successfully');
    
  } catch (error) {
    console.error('Get comment reaction users error:', error);
    return errorResponse(res, 'Failed to retrieve comment reaction users', 500);
  }
};

module.exports = {
  toggleCommentReaction,
  getCommentReactions,
  getCommentReactionUsers,
};