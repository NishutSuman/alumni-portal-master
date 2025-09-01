// src/controllers/like.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');

// Toggle like on a post
const toggleLike = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  
  try {
    // Check if post exists and allows likes
    const post = await prisma.post.findUnique({
      where: { id: postId },
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
    
    // Check if user already liked the post
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });
    
    let action;
    let likeCount;
    
    if (existingLike) {
      // Unlike the post
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      action = 'unliked';
      
      // Get updated like count
      likeCount = await prisma.like.count({
        where: { postId },
      });
      
    } else {
      // Like the post
      await prisma.like.create({
        data: {
          postId,
          userId,
        },
      });
      action = 'liked';
      
      // Get updated like count
      likeCount = await prisma.like.count({
        where: { postId },
      });
      
      // Create notification for post author (if not liking own post)
      if (post.createdBy !== userId) {
        await prisma.notification.create({
          data: {
            userId: post.createdBy,
            type: 'GENERAL',
            title: 'Someone liked your post',
            message: `${req.user.fullName} liked your post "${post.title}"`,
            payload: {
              postId: post.id,
              likedBy: userId,
              likerName: req.user.fullName,
              action: 'post_like',
            },
          },
        });
      }
    }
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: `post_${action}`,
        details: {
          postId: post.id,
          postTitle: post.title,
          authorId: post.createdBy,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, {
      action,
      likeCount,
      isLiked: action === 'liked',
    }, `Post ${action} successfully`);
    
  } catch (error) {
    console.error('Toggle like error:', error);
    return errorResponse(res, 'Failed to toggle like', 500);
  }
};

// Get users who liked a post
const getPostLikes = async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  
  try {
    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
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

module.exports = {
  toggleLike,
  getPostLikes,
  checkUserLike,
};