// src/services/post.service.js
const { prisma } = require('../config/database');

/**
 * Get post statistics for dashboard
 */
const getPostStats = async (userId = null, role = 'USER') => {
  try {
    const stats = {};
    
    if (role === 'SUPER_ADMIN') {
      // Super admin sees all stats
      const [totalPosts, publishedPosts, pendingPosts, categoryStats] = await Promise.all([
        prisma.post.count({ where: { isArchived: false } }),
        prisma.post.count({ where: { isPublished: true, isArchived: false } }),
        prisma.post.count({ where: { isPublished: false, isArchived: false } }),
        prisma.post.groupBy({
          by: ['category'],
          where: { isArchived: false },
          _count: true,
        }),
      ]);
      
      stats.totalPosts = totalPosts;
      stats.publishedPosts = publishedPosts;
      stats.pendingPosts = pendingPosts;
      stats.categoryDistribution = categoryStats.map(stat => ({
        category: stat.category,
        count: stat._count,
      }));
      
    } else if (userId) {
      // User/Admin sees their own stats
      const [userPosts, publishedUserPosts, pendingUserPosts] = await Promise.all([
        prisma.post.count({ where: { createdBy: userId, isArchived: false } }),
        prisma.post.count({ where: { createdBy: userId, isPublished: true, isArchived: false } }),
        prisma.post.count({ where: { createdBy: userId, isPublished: false, isArchived: false } }),
      ]);
      
      stats.myPosts = userPosts;
      stats.myPublishedPosts = publishedUserPosts;
      stats.myPendingPosts = pendingUserPosts;
    }
    
    return stats;
    
  } catch (error) {
    console.error('Get post stats error:', error);
    throw error;
  }
};

/**
 * Get featured posts (pinned or most liked)
 */
const getFeaturedPosts = async (limit = 5) => {
  try {
    const featuredPosts = await prisma.post.findMany({
      where: {
        isPublished: true,
        isArchived: false,
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
            comments: true,
          },
        },
        likes: {
          select: {
            reactionType: true,
            userId: true,
          },
        },
      },
      orderBy: [
        { likes: { _count: 'desc' } }, // Most liked first
        { createdAt: 'desc' }, // Then most recent
      ],
      take: limit,
    });
    
    // Transform posts to include reaction counts
    const transformedPosts = featuredPosts.map(post => {
      const reactions = {};
      const totalReactions = post.likes?.length || 0;
      
      // Count reactions by type
      post.likes?.forEach(like => {
        reactions[like.reactionType] = (reactions[like.reactionType] || 0) + 1;
      });
      
      return {
        ...post,
        reactions,
        totalReactions,
        userReactions: post.likes || [],
      };
    });
    
    return transformedPosts;
    
  } catch (error) {
    console.error('Get featured posts error:', error);
    throw error;
  }
};

/**
 * Get recent posts by category
 */
const getRecentPostsByCategory = async (category, limit = 10) => {
  try {
    const posts = await prisma.post.findMany({
      where: {
        category,
        isPublished: true,
        isArchived: false,
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
            comments: true,
          },
        },
        likes: {
          select: {
            reactionType: true,
            userId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    
    // Transform posts to include reaction counts
    const transformedPosts = posts.map(post => {
      const reactions = {};
      const totalReactions = post.likes?.length || 0;
      
      // Count reactions by type
      post.likes?.forEach(like => {
        reactions[like.reactionType] = (reactions[like.reactionType] || 0) + 1;
      });
      
      return {
        ...post,
        reactions,
        totalReactions,
        userReactions: post.likes || [],
      };
    });
    
    return transformedPosts;
    
  } catch (error) {
    console.error('Get recent posts by category error:', error);
    throw error;
  }
};

/**
 * Search posts with advanced filters
 */
const searchPosts = async (searchParams) => {
  const {
    query,
    category,
    authorId,
    batchYear,
    dateFrom,
    dateTo,
    hasImages,
    sortBy = 'relevance',
    page = 1,
    limit = 10
  } = searchParams;
  
  try {
    const skip = (page - 1) * limit;
    const whereClause = {
      isPublished: true,
      isArchived: false,
    };
    
    // Text search
    if (query) {
      whereClause.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
      ];
    }
    
    // Category filter
    if (category) {
      whereClause.category = category;
    }
    
    // Author filter
    if (authorId) {
      whereClause.createdBy = authorId;
    }
    
    // Batch year filter
    if (batchYear) {
      whereClause.author = {
        batch: parseInt(batchYear)
      };
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
      if (dateTo) whereClause.createdAt.lte = new Date(dateTo);
    }
    
    // Has images filter
    if (hasImages) {
      whereClause.OR = [
        { heroImage: { not: null } },
        { images: { not: { equals: [] } } },
      ];
    }
    
    // Determine sorting
    let orderBy;
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'most_liked':
        orderBy = { likes: { _count: 'desc' } };
        break;
      case 'most_commented':
        orderBy = { comments: { _count: 'desc' } };
        break;
      default: // relevance
        orderBy = { createdAt: 'desc' };
    }
    
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
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
              comments: true,
            },
          },
          likes: {
            select: {
              reactionType: true,
              userId: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.post.count({ where: whereClause })
    ]);
    
    // Transform posts to include reaction counts
    const transformedPosts = posts.map(post => {
      const reactions = {};
      const totalReactions = post.likes?.length || 0;
      
      // Count reactions by type
      post.likes?.forEach(like => {
        reactions[like.reactionType] = (reactions[like.reactionType] || 0) + 1;
      });
      
      return {
        ...post,
        reactions,
        totalReactions,
        userReactions: post.likes || [],
      };
    });
    
    return {
      posts: transformedPosts,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
    
  } catch (error) {
    console.error('Search posts error:', error);
    throw error;
  }
};

/**
 * Get posts by user with privacy considerations
 */
const getUserPosts = async (userId, viewerId = null, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;
    
    // Check if viewer can see all posts or only published ones
    const whereClause = {
      createdBy: userId,
      isArchived: false,
    };
    
    // If viewing own posts or is super admin, show all
    if (userId !== viewerId && viewerId !== 'SUPER_ADMIN') {
      whereClause.isPublished = true;
    }
    
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
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
              comments: true,
            },
          },
          likes: {
            select: {
              reactionType: true,
              userId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where: whereClause })
    ]);
    
    // Transform posts to include reaction counts
    const transformedPosts = posts.map(post => {
      const reactions = {};
      const totalReactions = post.likes?.length || 0;
      
      // Count reactions by type
      post.likes?.forEach(like => {
        reactions[like.reactionType] = (reactions[like.reactionType] || 0) + 1;
      });
      
      return {
        ...post,
        reactions,
        totalReactions,
        userReactions: post.likes || [],
      };
    });
    
    return {
      posts: transformedPosts,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
    
  } catch (error) {
    console.error('Get user posts error:', error);
    throw error;
  }
};

/**
 * Get trending posts (based on recent engagement)
 */
const getTrendingPosts = async (days = 7, limit = 10) => {
  try {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    
    const trendingPosts = await prisma.post.findMany({
      where: {
        isPublished: true,
        isArchived: false,
        createdAt: {
          gte: dateThreshold,
        },
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
            comments: true,
          },
        },
        likes: {
          select: {
            reactionType: true,
            userId: true,
          },
        },
      },
      orderBy: [
        { likes: { _count: 'desc' } },
        { comments: { _count: 'desc' } },
        { createdAt: 'desc' },
      ],
      take: limit,
    });
    
    return trendingPosts;
    
  } catch (error) {
    console.error('Get trending posts error:', error);
    throw error;
  }
};

/**
 * Validate post data
 */
const validatePostData = (postData) => {
  const errors = [];
  
  if (!postData.title || postData.title.trim().length === 0) {
    errors.push('Title is required');
  }
  
  if (postData.title && postData.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }
  
  if (!postData.body || postData.body.trim().length === 0) {
    errors.push('Body content is required');
  }
  
  if (postData.body && postData.body.length > 50000) {
    errors.push('Body content must be less than 50,000 characters');
  }
  
  const validCategories = ['MOM', 'STORY', 'POST', 'NOTICE', 'ANNOUNCEMENT'];
  if (!postData.category || !validCategories.includes(postData.category)) {
    errors.push('Valid category is required (MOM, STORY, POST, NOTICE, ANNOUNCEMENT)');
  }
  
  return errors;
};

module.exports = {
  getPostStats,
  getFeaturedPosts,
  getRecentPostsByCategory,
  searchPosts,
  getUserPosts,
  getTrendingPosts,
  validatePostData,
};