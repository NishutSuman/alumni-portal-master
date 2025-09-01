// src/controllers/comment.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');

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
    // Check if post exists and allows comments
    const post = await prisma.post.findUnique({
      where: { id: postId },
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
    // Check if post and parent comment exist
    const [post, parentComment] = await Promise.all([
      prisma.post.findUnique({
        where: { id: postId },
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
    
    // Create reply
    const reply = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        createdBy: req.user.id,
        parentId: commentId,
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
  
  try {
    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, isPublished: true, isArchived: true },
    });
    
    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }
    
    // Get total count of top-level comments
    const total = await prisma.comment.count({
      where: {
        postId,
        parentId: null,
      },
    });
    
    // Get top-level comments with replies
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
        replies: {
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
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, comments, pagination, 'Comments retrieved successfully');
    
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

module.exports = {
  createComment,
  createReply,
  getPostComments,
  updateComment,
  deleteComment,
};