// src/controllers/comment.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');
const { getTenantFilter } = require('../../utils/tenant.util');

// Create a comment on a post
const createComment = async (req, res) => {
  const { postId } = req.params;
  const { content, mentions = [] } = req.body;
  
  if (!content || content.trim().length === 0) {
    return errorResponse(res, 'Comment content is required', 400);
  }
  
  if (content.length > 1000) {
    return errorResponse(res, 'Comment content must be less than 1000 characters', 400);
  }
  
  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // Check if post exists and allows comments (with tenant isolation)
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: {
        id: true,
        allowComments: true,
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
      return errorResponse(res, 'Cannot comment on this post', 400);
    }

    if (!post.allowComments) {
      return errorResponse(res, 'Comments are disabled for this post', 400);
    }

    // Validate mentions (ensure mentioned users exist)
    let validMentions = [];
    if (mentions && mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          id: { in: mentions },
          isActive: true,
        },
        select: { id: true, fullName: true },
      });
      validMentions = mentionedUsers.map(user => user.id);
    }
    
    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        createdBy: req.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            batch: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            createdBy: true,
          },
        },
      },
    });
    
    // Create notifications
    const notifications = [];
    
    // Notify post author (if not commenting on own post)
    if (post.createdBy !== req.user.id) {
      notifications.push({
        userId: post.createdBy,
        type: 'COMMENT_REPLY',
        title: 'New comment on your post',
        message: `${req.user.fullName} commented on your post "${post.title}"`,
        payload: {
          postId: post.id,
          commentId: comment.id,
          commentedBy: req.user.id,
          commenterName: req.user.fullName,
          action: 'post_comment',
        },
      });
    }
    
    // Notify mentioned users
    validMentions.forEach(mentionedUserId => {
      if (mentionedUserId !== req.user.id && mentionedUserId !== post.createdBy) {
        notifications.push({
          userId: mentionedUserId,
          type: 'MENTION',
          title: 'You were mentioned in a comment',
          message: `${req.user.fullName} mentioned you in a comment on "${post.title}"`,
          payload: {
            postId: post.id,
            commentId: comment.id,
            mentionedBy: req.user.id,
            mentionerName: req.user.fullName,
            action: 'comment_mention',
          },
        });
      }
    });
    
    // Create notifications in batch
    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      });
    }
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'comment_create',
        details: {
          postId: post.id,
          commentId: comment.id,
          mentions: validMentions,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { comment }, 'Comment created successfully', 201);
    
  } catch (error) {
    console.error('Create comment error:', error);
    return errorResponse(res, 'Failed to create comment', 500);
  }
};

// Create a reply to a comment
const createReply = async (req, res) => {
  const { postId, commentId } = req.params;
  const { content, mentions = [] } = req.body;
  
  if (!content || content.trim().length === 0) {
    return errorResponse(res, 'Reply content is required', 400);
  }
  
  if (content.length > 1000) {
    return errorResponse(res, 'Reply content must be less than 1000 characters', 400);
  }
  
  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // Check if post and parent comment exist (with tenant isolation)
    const [post, parentComment] = await Promise.all([
      prisma.post.findFirst({
        where: {
          id: postId,
          ...tenantFilter, // Multi-tenant isolation
        },
        select: {
          id: true,
          allowComments: true,
          isPublished: true,
          isArchived: true,
          title: true,
        },
      }),
      prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
    ]);

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }

    if (!parentComment) {
      return errorResponse(res, 'Comment not found', 404);
    }

    if (parentComment.postId !== postId) {
      return errorResponse(res, 'Comment does not belong to this post', 400);
    }

    if (!post.isPublished || post.isArchived) {
      return errorResponse(res, 'Cannot reply to this comment', 400);
    }

    if (!post.allowComments) {
      return errorResponse(res, 'Comments are disabled for this post', 400);
    }
    
    // Validate mentions
    let validMentions = [];
    if (mentions && mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          id: { in: mentions },
          isActive: true,
        },
        select: { id: true, fullName: true },
      });
      validMentions = mentionedUsers.map(user => user.id);
    }
    
    // Find the root parent comment (if parentComment itself has a parent, use that root parent)
    const rootParentId = parentComment.parentId || commentId;
    
    // Create reply (always reference the root parent comment)
    const reply = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        createdBy: req.user.id,
        parentId: rootParentId,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            batch: true,
          },
        },
        parent: {
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });
    
    // Create notifications
    const notifications = [];
    
    // Notify parent comment author (if not replying to own comment)
    if (parentComment.createdBy !== req.user.id) {
      notifications.push({
        userId: parentComment.createdBy,
        type: 'COMMENT_REPLY',
        title: 'Someone replied to your comment',
        message: `${req.user.fullName} replied to your comment on "${post.title}"`,
        payload: {
          postId: post.id,
          commentId: parentComment.id,
          replyId: reply.id,
          repliedBy: req.user.id,
          replierName: req.user.fullName,
          action: 'comment_reply',
        },
      });
    }
    
    // Notify mentioned users
    validMentions.forEach(mentionedUserId => {
      if (mentionedUserId !== req.user.id && mentionedUserId !== parentComment.createdBy) {
        notifications.push({
          userId: mentionedUserId,
          type: 'MENTION',
          title: 'You were mentioned in a reply',
          message: `${req.user.fullName} mentioned you in a reply on "${post.title}"`,
          payload: {
            postId: post.id,
            commentId: parentComment.id,
            replyId: reply.id,
            mentionedBy: req.user.id,
            mentionerName: req.user.fullName,
            action: 'reply_mention',
          },
        });
      }
    });
    
    // Create notifications in batch
    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      });
    }
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'comment_reply',
        details: {
          postId: post.id,
          parentCommentId: commentId,
          replyId: reply.id,
          mentions: validMentions,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { reply }, 'Reply created successfully', 201);
    
  } catch (error) {
    console.error('Create reply error:', error);
    return errorResponse(res, 'Failed to create reply', 500);
  }
};

// Get comments for a post (with pagination)
const getPostComments = async (req, res) => {
  const { postId } = req.params;
  const { page, limit, skip } = getPaginationParams(req.query, 10);
  const sortOrder = req.query.sortOrder || 'desc';

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
    
    // Get total count of top-level comments (for pagination)
    const totalParents = await prisma.comment.count({
      where: {
        postId,
        parentId: null,
      },
    });

    // Get total count of all comments (parent + replies) for display
    const totalAllComments = await prisma.comment.count({
      where: {
        postId,
      },
    });
    
    // Get top-level comments
    const comments = await prisma.comment.findMany({
      where: {
        postId,
        parentId: null,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            batch: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: { createdAt: sortOrder },
      skip,
      take: limit,
    });

    // Get all replies for these parent comments (flattened)
    // This will include both direct replies and replies to replies
    const parentCommentIds = comments.map(c => c.id);
    const allReplies = await prisma.comment.findMany({
      where: {
        postId,
        parentId: { not: null }, // All non-parent comments
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            batch: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group replies by their root parent comment
    const repliesMap = new Map();
    
    // Helper function to find the root parent of a comment
    const findRootParent = (comment) => {
      // Start with all replies to build a parent-child relationship map
      const parentMap = new Map();
      allReplies.forEach(reply => {
        parentMap.set(reply.id, reply.parentId);
      });
      
      let currentId = comment.parentId;
      while (currentId && parentMap.has(currentId)) {
        currentId = parentMap.get(currentId);
      }
      return currentId || comment.parentId; // Return the root parent ID
    };

    // Group all replies by their root parent
    allReplies.forEach(reply => {
      const rootParentId = findRootParent(reply);
      if (!repliesMap.has(rootParentId)) {
        repliesMap.set(rootParentId, []);
      }
      repliesMap.get(rootParentId).push(reply);
    });

    // Attach flattened replies to parent comments
    comments.forEach(comment => {
      comment.replies = repliesMap.get(comment.id) || [];
      // Update the count to reflect all nested replies
      comment._count.replies = comment.replies.length;
    });
    
    // Enrich comments with reaction data and user reactions
    const enrichedComments = await enrichCommentsWithReactions(comments, req.user?.id);
    
    const pagination = calculatePagination(totalParents, page, limit);
    
    // Add total comment count (including replies) to pagination for frontend display
    pagination.totalAllComments = totalAllComments;
    
    
    return paginatedResponse(res, enrichedComments, pagination, 'Comments retrieved successfully');
    
  } catch (error) {
    console.error('Get post comments error:', error);
    return errorResponse(res, 'Failed to retrieve comments', 500);
  }
};

// Update a comment
const updateComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    return errorResponse(res, 'Comment content is required', 400);
  }

  if (content.length > 1000) {
    return errorResponse(res, 'Comment content must be less than 1000 characters', 400);
  }

  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // First verify the post belongs to this tenant
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: { id: true },
    });

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }

    // Get existing comment
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          select: {
            id: true,
            allowComments: true,
            isArchived: true,
          },
        },
      },
    });

    if (!existingComment) {
      return errorResponse(res, 'Comment not found', 404);
    }

    if (existingComment.postId !== postId) {
      return errorResponse(res, 'Comment does not belong to this post', 400);
    }
    
    // Check permissions
    const canEdit = req.user.role === 'SUPER_ADMIN' || 
                   req.user.id === existingComment.createdBy;
    
    if (!canEdit) {
      return errorResponse(res, 'You do not have permission to edit this comment', 403);
    }
    
    if (existingComment.post.isArchived) {
      return errorResponse(res, 'Cannot edit comments on archived posts', 400);
    }
    
    // Update comment
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
        isEdited: true,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            batch: true,
          },
        },
      },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'comment_update',
        details: {
          postId,
          commentId,
          editedBy: req.user.id,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { comment: updatedComment }, 'Comment updated successfully');
    
  } catch (error) {
    console.error('Update comment error:', error);
    return errorResponse(res, 'Failed to update comment', 500);
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  const { postId, commentId } = req.params;

  try {
    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // First verify the post belongs to this tenant
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: { id: true },
    });

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }

    // Get existing comment with replies count
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    if (!existingComment) {
      return errorResponse(res, 'Comment not found', 404);
    }

    if (existingComment.postId !== postId) {
      return errorResponse(res, 'Comment does not belong to this post', 400);
    }
    
    // Check permissions
    const canDelete = req.user.role === 'SUPER_ADMIN' || 
                     req.user.id === existingComment.createdBy;
    
    if (!canDelete) {
      return errorResponse(res, 'You do not have permission to delete this comment', 403);
    }
    
    // Delete comment (cascade will handle replies)
    await prisma.comment.delete({
      where: { id: commentId },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'comment_delete',
        details: {
          postId,
          commentId,
          deletedBy: req.user.id,
          hadReplies: existingComment._count.replies > 0,
          repliesCount: existingComment._count.replies,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Comment deleted successfully');
    
  } catch (error) {
    console.error('Delete comment error:', error);
    return errorResponse(res, 'Failed to delete comment', 500);
  }
};

// Helper function to enrich comments with reaction data
const enrichCommentsWithReactions = async (comments, userId) => {
  if (!comments || comments.length === 0) return comments;

  // Get all comment IDs (including replies)
  const commentIds = [];
  comments.forEach(comment => {
    commentIds.push(comment.id);
    if (comment.replies) {
      comment.replies.forEach(reply => commentIds.push(reply.id));
    }
  });

  // Get user reactions for all comments if user is authenticated
  let userReactionsMap = {};
  if (userId) {
    const userReactions = await prisma.commentLike.findMany({
      where: {
        commentId: { in: commentIds },
        userId,
      },
      select: {
        commentId: true,
        reactionType: true,
      },
    });
    
    userReactionsMap = userReactions.reduce((acc, reaction) => {
      acc[reaction.commentId] = reaction.reactionType;
      return acc;
    }, {});
  }

  // Enrich comments with reaction data
  const enrichComment = (comment) => {
    const reactions = {
      LIKE: comment.likeCount || 0,
      LOVE: comment.loveCount || 0,
      CELEBRATE: comment.celebrateCount || 0,
      SUPPORT: comment.supportCount || 0,
      FUNNY: comment.funnyCount || 0,
      WOW: comment.wowCount || 0,
      ANGRY: comment.angryCount || 0,
      SAD: comment.sadCount || 0,
    };

    return {
      ...comment,
      reactions,
      totalReactions: comment.totalReactions || 0,
      userReaction: userReactionsMap[comment.id] || null,
      replies: comment.replies ? comment.replies.map(enrichComment) : [],
    };
  };

  return comments.map(enrichComment);
};

module.exports = {
  createComment,
  createReply,
  getPostComments,
  updateComment,
  deleteComment,
};