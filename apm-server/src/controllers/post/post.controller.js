// src/controllers/post.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');
const { deleteUploadedFile } = require('../../middleware/upload.middleware');
const { cloudflareR2Service } = require('../../services/cloudflare-r2.service');
const { getTenantFilter, getTenantData, withTenant } = require('../../utils/tenant.util');

// Create new post
const createPost = async (req, res) => {
  const { 
    title, 
    body, 
    category, 
    linkedEventId, 
    tags,
    allowComments = true,  // New field with default
    allowLikes = true      // New field with default
  } = req.body;
  
  // Validation
  if (!title || !body || !category) {
    return errorResponse(res, 'Title, body, and category are required', 400);
  }
  
  // Validate category
  const validCategories = ['MOM', 'STORY', 'POST', 'NOTICE', 'ANNOUNCEMENT'];
  if (!validCategories.includes(category)) {
    return errorResponse(res, 'Invalid post category', 400);
  }
  
  try {
    // Check if Cloudflare R2 is configured
    if (req.files && Object.keys(req.files).length > 0 && !cloudflareR2Service.isConfigured()) {
      return errorResponse(res, 'File storage (Cloudflare R2) is not configured. Please contact administrator.', 500);
    }

    // Handle uploaded files with R2
    let heroImage = null;
    let images = [];

    // Get tenant code from tenant middleware (preferred) or header (fallback)
    // Priority: 1) tenant middleware, 2) header, 3) user's organization from DB
    let tenantCode = req.tenant?.tenantCode || req.headers['x-tenant-code'] || null;

    // Fallback: If no tenant code from middleware/header, get from user's organization
    // This handles cases where multipart/form-data requests don't include the header
    if (!tenantCode) {
      const userWithOrg = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          organization: {
            select: { tenantCode: true }
          }
        }
      });
      tenantCode = userWithOrg?.organization?.tenantCode || null;
    }

    console.log('📁 Post image upload - Tenant debug:', {
      fromMiddleware: req.tenant?.tenantCode,
      fromHeader: req.headers['x-tenant-code'],
      final: tenantCode,
      userId: req.user.id
    });

    if (req.files) {
      // Upload hero image to R2 (tenant-aware)
      if (req.files.heroImage && req.files.heroImage[0]) {
        const heroFile = req.files.heroImage[0];
        const validation = cloudflareR2Service.validatePostImage(heroFile);
        if (!validation.valid) {
          return errorResponse(res, validation.error, 400);
        }

        const heroUploadResult = await cloudflareR2Service.uploadPostImage(heroFile, 'hero', tenantCode);
        if (!heroUploadResult.success) {
          return errorResponse(res, heroUploadResult.error, 500);
        }
        heroImage = heroUploadResult.url;
      }

      // Upload additional images to R2 (tenant-aware)
      if (req.files.images && req.files.images.length > 0) {
        const imageUploadPromises = req.files.images.map(async (file) => {
          const validation = cloudflareR2Service.validatePostImage(file);
          if (!validation.valid) {
            throw new Error(`Image ${file.originalname}: ${validation.error}`);
          }

          const uploadResult = await cloudflareR2Service.uploadPostImage(file, 'gallery', tenantCode);
          if (!uploadResult.success) {
            throw new Error(`Failed to upload ${file.originalname}: ${uploadResult.error}`);
          }
          return uploadResult.url;
        });
        
        try {
          images = await Promise.all(imageUploadPromises);
        } catch (uploadError) {
          // Clean up hero image if it was uploaded
          if (heroImage) {
            try {
              const heroKey = cloudflareR2Service.extractKeyFromUrl(heroImage);
              await cloudflareR2Service.deleteFile(heroKey);
            } catch (cleanupError) {
              console.error('Failed to cleanup hero image after upload failure:', cleanupError);
            }
          }
          return errorResponse(res, uploadError.message, 500);
        }
      }
    }
    
    // Determine if post needs approval
    const needsApproval = req.user.role !== 'SUPER_ADMIN';
    
    // Parse tags (array of user IDs)
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (error) {
        parsedTags = [];
      }
    }
    
    // Get tenant data for multi-tenant support
    const tenantData = getTenantData(req);

    // Create post with interaction controls
    const post = await prisma.post.create({
      data: {
        title,
        body,
        category,
        heroImage,
        images,
        createdBy: req.user.id,
        linkedEventId: linkedEventId || null,
        tags: parsedTags,
        allowComments: Boolean(allowComments),  // New field
        allowLikes: Boolean(allowLikes),        // New field
        isPublished: !needsApproval, // Super Admin posts are published immediately
        approvedBy: needsApproval ? null : req.user.id,
        // Multi-tenant support
        ...tenantData,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        linkedEvent: {
          select: {
            id: true,
            title: true,
            eventDate: true,
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
    });
    
    // Log post creation
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'post_create',
        details: {
          postId: post.id,
          category: post.category,
          title: post.title,
          allowComments: post.allowComments,
          allowLikes: post.allowLikes,
          needsApproval,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    // Create notifications for mentioned users
    if (parsedTags.length > 0) {
      try {
        const { NotificationService, NOTIFICATION_TYPES } = require('../../services/notification.service');
        
        await NotificationService.createAndSendNotification({
          recipientIds: parsedTags,
          type: NOTIFICATION_TYPES.MENTION,
          title: 'You were mentioned in a post',
          message: `${req.user.fullName} mentioned you in "${title}"`,
          data: {
            postId: post.id,
            authorId: req.user.id,
            authorName: req.user.fullName,
            postTitle: title,
            postCategory: category,
          },
          priority: 'MEDIUM',
          channels: ['PUSH', 'IN_APP'],
          relatedEntityType: 'Post',
          relatedEntityId: post.id
        });
        
        console.log(`✅ Mention notifications sent to ${parsedTags.length} users for post: ${title}`);
      } catch (notificationError) {
        console.error('Failed to send mention notifications:', notificationError);
        // Don't fail the post creation if notifications fail
      }
    }
    
    const message = needsApproval 
      ? 'Post created successfully and sent for approval'
      : 'Post created and published successfully';
    
    return successResponse(res, { post }, message, 201);
    
  } catch (error) {
    console.error('Create post error:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        deleteUploadedFile(file.path);
      });
    }
    
    return errorResponse(res, 'Failed to create post', 500);
  }
};

// Get posts with filters and pagination
const getPosts = async (req, res) => {
  const { 
    category, 
    search, 
    authorId,
    author, // Support both authorId and author
    status,
    isPublished,
    isArchived,
    dateFrom,
    dateTo,
    tags,
    sortBy = 'createdAt',
    sortOrder = 'desc' 
  } = req.query;
  
  const { page, limit, skip } = getPaginationParams(req.query, 10);

  try {
    // Build where clause with tenant filter for multi-tenant support
    const tenantFilter = getTenantFilter(req);
    const whereClause = { ...tenantFilter };

    // Handle isArchived parameter from frontend
    if (isArchived !== undefined) {
      whereClause.isArchived = isArchived === 'true';
    } else {
      whereClause.isArchived = false; // Default to not archived
    }
    
    // Handle isPublished parameter from frontend
    if (isPublished !== undefined) {
      whereClause.isPublished = isPublished === 'true';
    } else if (status) {
      // Legacy status parameter support
      if (status === 'published') {
        whereClause.isPublished = true;
      } else if (status === 'pending') {
        whereClause.isPublished = false;
        // Only show pending posts to the author or super admins
        if (req.user?.role !== 'SUPER_ADMIN') {
          whereClause.createdBy = req.user?.id;
        }
      } else if (status === 'all') {
        // Only super admins can see all posts
        if (req.user?.role !== 'SUPER_ADMIN') {
          whereClause.OR = [
            { isPublished: true },
            { createdBy: req.user?.id },
          ];
        }
      }
    } else {
      // Default to published posts only
      whereClause.isPublished = true;
    }
    
    // Category filter
    if (category) {
      whereClause.category = category;
    }
    
    // Author filter (support both authorId and author parameters)
    if (authorId || author) {
      whereClause.createdBy = authorId || author;
    }
    
    // Search filter (handle separately to avoid conflicts with other OR clauses)
    let searchFilter = null;
    if (search) {
      searchFilter = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { 
            author: { 
              fullName: { contains: search, mode: 'insensitive' } 
            } 
          },
        ]
      };
    }

    // Date range filters
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add end of day to include the entire dateTo day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = endDate;
      }
    }

    // Tags filter (search in the tags array)
    if (tags) {
      let tagsArray;
      if (typeof tags === 'string') {
        // Handle comma-separated string
        tagsArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
      
      if (tagsArray && tagsArray.length > 0) {
        whereClause.tags = {
          hasSome: tagsArray
        };
      }
    }
    
    // Combine search filter with other filters
    let finalWhereClause = whereClause;
    if (searchFilter) {
      finalWhereClause = {
        AND: [
          whereClause,
          searchFilter
        ]
      };
    }
    
    // Valid sort fields
    const validSortFields = ['createdAt', 'updatedAt', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    
    // Get total count
    const total = await prisma.post.count({ where: finalWhereClause });
    
    // Get posts (now including interaction controls)
    const posts = await prisma.post.findMany({
      where: finalWhereClause,
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        heroImage: true,
        images: true,
        allowComments: true,  // Include interaction controls
        allowLikes: true,     // Include interaction controls
        isPublished: true,
        isArchived: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        // Reaction count fields
        likeCount: true,
        loveCount: true,
        celebrateCount: true,
        supportCount: true,
        funnyCount: true,
        wowCount: true,
        angryCount: true,
        sadCount: true,
        totalReactions: true,
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
            batch: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        linkedEvent: {
          select: {
            id: true,
            title: true,
            eventDate: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
        // Get recent reactions with user details for LinkedIn-style display
        likes: {
          select: {
            reactionType: true,
            userId: true,
            user: {
              select: {
                id: true,
                fullName: true,
                profileImage: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 3, // Get last 3 reactions for display
        },
      },
      orderBy: { [sortField]: order },
      skip,
      take: limit,
    });
    
    // Debug the raw posts data
    console.log('🔍 Raw posts data:', posts.map(p => ({ 
      id: p.id, 
      title: p.title?.substring(0, 20), 
      likes: p.likes,
      likesCount: p.likes?.length 
    })));
    
    // Transform posts to include reaction counts (now from Post model fields)
    const transformedPosts = posts.map(post => {
      // Debug logging for count fields
      console.log('🔍 Post transformation debug:', {
        postId: post.id,
        countFields: {
          likeCount: post.likeCount,
          loveCount: post.loveCount,
          celebrateCount: post.celebrateCount,
          supportCount: post.supportCount,
          funnyCount: post.funnyCount,
          wowCount: post.wowCount,
          angryCount: post.angryCount,
          sadCount: post.sadCount,
          totalReactions: post.totalReactions
        },
        likesArray: post.likes,
        likesLength: post.likes?.length
      });
      
      // Use reaction counts directly from Post model (much faster!)
      const reactionCounts = {
        LIKE: post.likeCount,
        LOVE: post.loveCount,
        CELEBRATE: post.celebrateCount,
        SUPPORT: post.supportCount,
        FUNNY: post.funnyCount,
        WOW: post.wowCount,
        ANGRY: post.angryCount,
        SAD: post.sadCount,
      };
      
      const totalReactions = post.totalReactions;
      
      // Get user's reactions for this post (if authenticated)
      let userReactions = [];
      if (req.user) {
        userReactions = post.likes
          .filter(reaction => reaction.userId === req.user.id)
          .map(reaction => reaction.reactionType);
      }
      
      return {
        ...post,
        reactionCounts,
        totalReactions,
        userReactions,
        // Legacy compatibility
        likeCount: reactionCounts.LIKE,
        isLikedByUser: userReactions.includes('LIKE'),
        recentReactions: post.likes || [], // Include recent reactions with user details
        likes: undefined, // Remove raw likes data
      };
    });
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, transformedPosts, pagination, 'Posts retrieved successfully');
    
  } catch (error) {
    console.error('Get posts error:', error);
    return errorResponse(res, 'Failed to retrieve posts', 500);
  }
};

// Get single post by ID
const getPostById = async (req, res) => {
  const { postId } = req.params;

  try {
    // Build where clause with tenant filter for multi-tenant support
    const tenantFilter = getTenantFilter(req);

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
            batch: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        linkedEvent: {
          select: {
            id: true,
            title: true,
            eventDate: true,
            venue: true,
          },
        },
        comments: {
          where: { parentId: null }, // Top-level comments only
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                profileImage: true,
              },
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    fullName: true,
                    profileImage: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Limit initial comments load
        },
        reactions: {
          select: {
            reactionType: true,
            userId: true,
            user: {
              select: {
                fullName: true,
                profileImage: true,
              },
            },
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });
    
    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }
    
    // Check visibility permissions
    if (!post.isPublished) {
      if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.id !== post.createdBy)) {
        return errorResponse(res, 'Post not found', 404);
      }
    }
    
    if (post.isArchived && req.user?.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Post not found', 404);
    }
    
    // Transform reactions to counts similar to getPosts
    const reactionCounts = {
      LIKE: 0,
      LOVE: 0,
      CELEBRATE: 0,
      SUPPORT: 0,
      FUNNY: 0,
      WOW: 0,
      ANGRY: 0,
      SAD: 0,
    };
    
    post.reactions.forEach(reaction => {
      reactionCounts[reaction.reactionType]++;
    });
    
    const totalReactions = Object.values(reactionCounts).reduce((sum, count) => sum + count, 0);
    
    // Get user's reactions for this post (if authenticated)
    let userReactions = [];
    if (req.user) {
      userReactions = post.reactions
        .filter(reaction => reaction.userId === req.user.id)
        .map(reaction => reaction.reactionType);
    }
    
    // Transform the post response
    const transformedPost = {
      ...post,
      reactionCounts,
      totalReactions,
      userReactions,
      // Legacy compatibility
      likeCount: reactionCounts.LIKE,
      isLikedByUser: userReactions.includes('LIKE'),
      // Keep reaction users for displaying who reacted
      reactionUsers: post.reactions,
      reactions: undefined, // Remove raw reactions from response
    };
    
    return successResponse(res, { post: transformedPost }, 'Post retrieved successfully');
    
  } catch (error) {
    console.error('Get post by ID error:', error);
    return errorResponse(res, 'Failed to retrieve post', 500);
  }
};

// Update post
const updatePost = async (req, res) => {
  const { postId } = req.params;
  const {
    title,
    body,
    category,
    linkedEventId,
    tags,
    allowComments,  // New field
    allowLikes      // New field
  } = req.body;

  try {
    // Build where clause with tenant filter for multi-tenant support
    const tenantFilter = getTenantFilter(req);

    // Get existing post with tenant filter
    const existingPost = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: {
        id: true,
        createdBy: true,
        isPublished: true,
        heroImage: true,
        images: true,
        allowComments: true,
        allowLikes: true,
      },
    });

    if (!existingPost) {
      return errorResponse(res, 'Post not found', 404);
    }
    
    // Check permissions
    const canEdit = req.user.role === 'SUPER_ADMIN' || req.user.id === existingPost.createdBy;
    if (!canEdit) {
      return errorResponse(res, 'You do not have permission to edit this post', 403);
    }
    
    // Handle file uploads with R2 storage and selective image management
    let heroImage = existingPost.heroImage;
    let images = existingPost.images;
    
    // Get existing images that should be kept (from frontend)
    let existingImagesToKeep = [];
    if (req.body.existingImages) {
      try {
        existingImagesToKeep = JSON.parse(req.body.existingImages);
        console.log('🖼️ Existing images to keep:', existingImagesToKeep);
      } catch (error) {
        console.error('Failed to parse existingImages:', error);
        existingImagesToKeep = existingPost.images; // Fallback to keep all
      }
    } else {
      // If no existingImages specified, keep all existing images
      existingImagesToKeep = existingPost.images;
    }
    
    // Handle hero image upload
    if (req.files && req.files.heroImage && req.files.heroImage[0]) {
      // Delete old hero image from R2 if exists
      if (existingPost.heroImage) {
        try {
          const cloudflareR2Service = require('../../services/cloudflare-r2.service');
          const heroKey = cloudflareR2Service.extractKeyFromUrl(existingPost.heroImage);
          if (heroKey) {
            await cloudflareR2Service.deleteFile(heroKey);
            console.log('🗑️ Deleted old hero image from R2:', heroKey);
          }
        } catch (r2Error) {
          console.warn('Failed to delete old hero image from R2:', r2Error);
        }
      }
      
      // Upload new hero image to R2
      try {
        const cloudflareR2Service = require('../../services/cloudflare-r2.service');
        const heroImageUrl = await cloudflareR2Service.uploadFile(
          req.files.heroImage[0].buffer,
          `posts/hero-${Date.now()}-${req.files.heroImage[0].originalname}`,
          req.files.heroImage[0].mimetype
        );
        heroImage = heroImageUrl;
        console.log('📤 Uploaded new hero image to R2:', heroImageUrl);
      } catch (uploadError) {
        console.error('Failed to upload hero image to R2:', uploadError);
        throw new Error('Failed to upload hero image');
      }
    }
    
    // Handle additional images
    if (req.files && req.files.images) {
      // Upload new images to R2
      const newImageUrls = [];
      for (const file of req.files.images) {
        try {
          const cloudflareR2Service = require('../../services/cloudflare-r2.service');
          const imageUrl = await cloudflareR2Service.uploadFile(
            file.buffer,
            `posts/image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${file.originalname}`,
            file.mimetype
          );
          newImageUrls.push(imageUrl);
          console.log('📤 Uploaded new image to R2:', imageUrl);
        } catch (uploadError) {
          console.error('Failed to upload image to R2:', uploadError);
          // Continue with other images even if one fails
        }
      }
      
      // Combine existing images to keep with new images
      images = [...existingImagesToKeep, ...newImageUrls];
      console.log('🖼️ Final images array:', images);
    } else {
      // No new images uploaded, just use existing images to keep
      images = existingImagesToKeep;
    }
    
    // Delete removed images from R2
    const imagesToDelete = existingPost.images.filter(img => !existingImagesToKeep.includes(img));
    if (imagesToDelete.length > 0) {
      console.log('🗑️ Images to delete from R2:', imagesToDelete);
      for (const imageUrl of imagesToDelete) {
        try {
          const cloudflareR2Service = require('../../services/cloudflare-r2.service');
          const imageKey = cloudflareR2Service.extractKeyFromUrl(imageUrl);
          if (imageKey) {
            await cloudflareR2Service.deleteFile(imageKey);
            console.log('🗑️ Deleted image from R2:', imageKey);
          }
        } catch (r2Error) {
          console.warn('Failed to delete image from R2:', r2Error);
        }
      }
    }
    
    // Parse tags
    let parsedTags = existingPost.tags || [];
    if (tags !== undefined) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (error) {
        parsedTags = [];
      }
    }
    
    // If content is being changed and user is not super admin, reset approval
    const contentChanged = title || body || category;
    const needsReapproval = contentChanged && req.user.role !== 'SUPER_ADMIN' && existingPost.isPublished;
    
    // Update post (including interaction controls)
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(title && { title }),
        ...(body && { body }),
        ...(category && { category }),
        ...(linkedEventId !== undefined && { linkedEventId }),
        ...(allowComments !== undefined && { allowComments: Boolean(allowComments) }),
        ...(allowLikes !== undefined && { allowLikes: Boolean(allowLikes) }),
        heroImage,
        images,
        tags: parsedTags,
        ...(needsReapproval && { 
          isPublished: false, 
          approvedBy: null 
        }),
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            role: true,
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
    });
    
    // Log post update
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'post_update',
        details: {
          postId: updatedPost.id,
          changes: Object.keys(req.body),
          needsReapproval,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    const message = needsReapproval 
      ? 'Post updated successfully and sent for re-approval'
      : 'Post updated successfully';
    
    return successResponse(res, { post: updatedPost }, message);
    
  } catch (error) {
    console.error('Update post error:', error);
    
    // Clean up new uploaded files on error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        deleteUploadedFile(file.path);
      });
    }
    
    return errorResponse(res, 'Failed to update post', 500);
  }
};

// Approve/Reject post (Super Admin only)
const approvePost = async (req, res) => {
  const { postId } = req.params;
  const { action, reason } = req.body; // action: 'approve' or 'reject'

  if (req.user.role !== 'SUPER_ADMIN') {
    return errorResponse(res, 'Only Super Admins can approve posts', 403);
  }

  if (!['approve', 'reject'].includes(action)) {
    return errorResponse(res, 'Action must be "approve" or "reject"', 400);
  }

  try {
    // Build where clause with tenant filter for multi-tenant support
    const tenantFilter = getTenantFilter(req);

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      include: {
        author: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }
    
    if (post.isPublished && action === 'approve') {
      return errorResponse(res, 'Post is already approved', 400);
    }
    
    // Update post approval status
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        isPublished: action === 'approve',
        approvedBy: action === 'approve' ? req.user.id : null,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
    
    // Create notification for post author using NotificationService (sends push too)
    try {
      const { NotificationService: PostNotificationService } = require('../../services/notification.service');
      await PostNotificationService.createAndSendNotification({
        recipientIds: [post.author.id],
        type: 'POST_APPROVED',
        title: `Post ${action}d`,
        message: `Your post "${post.title}" has been ${action}d by ${req.user.fullName}${reason ? `: ${reason}` : ''}`,
        data: {
          postId: post.id,
          action,
          reason,
          approvedBy: req.user.id,
        },
        tenantCode: req.tenantCode,
        organizationId: req.organizationId
      });
    } catch (notificationError) {
      console.error('Failed to send post approval notification:', notificationError);
      // Don't fail the main request if notification fails
    }

    // Send mention notifications when post is approved
    if (action === 'approve' && post.tags && post.tags.length > 0) {
      try {
        const { NotificationService, NOTIFICATION_TYPES } = require('../../services/notification.service');
        
        await NotificationService.createAndSendNotification({
          recipientIds: post.tags,
          type: NOTIFICATION_TYPES.MENTION,
          title: 'You were mentioned in a post',
          message: `${post.author.fullName} mentioned you in "${post.title}"`,
          data: {
            postId: post.id,
            authorId: post.author.id,
            authorName: post.author.fullName,
            postTitle: post.title,
            postCategory: post.category,
          },
          priority: 'MEDIUM',
          channels: ['PUSH', 'IN_APP'],
          relatedEntityType: 'Post',
          relatedEntityId: post.id
        });
        
        console.log(`✅ Mention notifications sent to ${post.tags.length} users for approved post: ${post.title}`);
      } catch (notificationError) {
        console.error('Failed to send mention notifications for approved post:', notificationError);
        // Don't fail the approval if notifications fail
      }
    }
    
    // Log approval action
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: `post_${action}`,
        entityType: 'Post',
        entityId: postId,
        oldValues: { isPublished: post.isPublished },
        newValues: { isPublished: action === 'approve' },
        reason,
      },
    });
    
    return successResponse(res, { post: updatedPost }, `Post ${action}d successfully`);
    
  } catch (error) {
    console.error('Approve post error:', error);
    return errorResponse(res, `Failed to ${action} post`, 500);
  }
};

// Archive/Unarchive post
const archivePost = async (req, res) => {
  const { postId } = req.params;
  const { isArchived } = req.body; // Allow toggling archive status

  try {
    // Build where clause with tenant filter for multi-tenant support
    const tenantFilter = getTenantFilter(req);

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: {
        id: true,
        createdBy: true,
        isArchived: true,
        title: true,
      },
    });

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }
    
    // Check permissions
    const canArchive = req.user.role === 'SUPER_ADMIN' || req.user.id === post.createdBy;
    if (!canArchive) {
      return errorResponse(res, 'You do not have permission to modify this post', 403);
    }
    
    // Determine new archive status
    const newArchiveStatus = isArchived !== undefined ? isArchived : !post.isArchived;
    
    if (post.isArchived === newArchiveStatus) {
      return errorResponse(res, `Post is already ${newArchiveStatus ? 'archived' : 'unarchived'}`, 400);
    }
    
    // Update post archive status
    await prisma.post.update({
      where: { id: postId },
      data: { isArchived: newArchiveStatus },
    });
    
    // Log archive/unarchive action
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: newArchiveStatus ? 'post_archive' : 'post_unarchive',
        details: {
          postId: post.id,
          title: post.title,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, `Post ${newArchiveStatus ? 'archived' : 'unarchived'} successfully`);
    
  } catch (error) {
    console.error('Archive post error:', error);
    return errorResponse(res, 'Failed to modify post archive status', 500);
  }
};

// Delete post (Super Admin only)
const deletePost = async (req, res) => {
  const { postId } = req.params;

  try {
    // Build where clause with tenant filter for multi-tenant support
    const tenantFilter = getTenantFilter(req);

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...tenantFilter, // Multi-tenant isolation
      },
      select: {
        id: true,
        title: true,
        heroImage: true,
        images: true,
        createdBy: true,
      },
    });

    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }
    
    // Check permissions: only post author or super admin can delete
    if (req.user.id !== post.createdBy && req.user.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'You can only delete your own posts', 403);
    }
    
    // Delete associated files from R2 storage
    if (post.heroImage) {
      try {
        const heroKey = cloudflareR2Service.extractKeyFromUrl(post.heroImage);
        if (heroKey) {
          await cloudflareR2Service.deleteFile(heroKey);
        }
      } catch (r2Error) {
        console.warn('Failed to delete hero image from R2:', r2Error);
        // Continue with deletion even if R2 cleanup fails
      }
    }
    
    if (post.images && post.images.length > 0) {
      for (const imagePath of post.images) {
        try {
          const imageKey = cloudflareR2Service.extractKeyFromUrl(imagePath);
          if (imageKey) {
            await cloudflareR2Service.deleteFile(imageKey);
          }
        } catch (r2Error) {
          console.warn('Failed to delete image from R2:', r2Error);
          // Continue with deletion even if R2 cleanup fails
        }
      }
    }
    
    // Delete post (cascade will handle comments, likes, etc.)
    await prisma.post.delete({
      where: { id: postId },
    });
    
    // Log deletion
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'post_delete',
        entityType: 'Post',
        entityId: postId,
        oldValues: { title: post.title },
        newValues: null,
      },
    });
    
    return successResponse(res, null, 'Post deleted successfully');
    
  } catch (error) {
    console.error('Delete post error:', error);
    return errorResponse(res, 'Failed to delete post', 500);
  }
};

// Get posts pending approval (Super Admin only)
const getPendingPosts = async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return errorResponse(res, 'Only Super Admins can view pending posts', 403);
  }
  
  const { page, limit, skip } = getPaginationParams(req.query, 10);

  try {
    // Build where clause with tenant filter for multi-tenant support
    const tenantFilter = getTenantFilter(req);
    const whereClause = {
      ...tenantFilter,
      isPublished: false,
      isArchived: false,
    };

    const total = await prisma.post.count({ where: whereClause });
    
    const posts = await prisma.post.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        heroImage: true,
        images: true,
        allowComments: true,
        allowLikes: true,
        isPublished: true,
        isArchived: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        // Reaction count fields
        likeCount: true,
        loveCount: true,
        celebrateCount: true,
        supportCount: true,
        funnyCount: true,
        wowCount: true,
        angryCount: true,
        sadCount: true,
        totalReactions: true,
        author: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
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
      orderBy: { createdAt: 'asc' }, // Oldest first for approval queue
      skip,
      take: limit,
    });
    
    // Transform posts to include reaction counts (using Post model fields)
    const transformedPosts = posts.map(post => {
      // Use reaction counts directly from Post model (much faster!)
      const reactionCounts = {
        LIKE: post.likeCount,
        LOVE: post.loveCount,
        CELEBRATE: post.celebrateCount,
        SUPPORT: post.supportCount,
        FUNNY: post.funnyCount,
        WOW: post.wowCount,
        ANGRY: post.angryCount,
        SAD: post.sadCount,
      };
      
      const totalReactions = post.totalReactions;
      
      // Get user's reactions for this post (if authenticated)
      let userReactions = [];
      if (req.user) {
        userReactions = post.likes
          .filter(reaction => reaction.userId === req.user.id)
          .map(reaction => reaction.reactionType);
      }
      
      return {
        ...post,
        reactionCounts,
        totalReactions,
        userReactions,
        // Legacy compatibility
        likeCount: reactionCounts.LIKE,
        isLikedByUser: userReactions.includes('LIKE'),
        recentReactions: post.likes || [], // Include recent reactions with user details
        likes: undefined, // Remove raw likes data
      };
    });
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, transformedPosts, pagination, 'Pending posts retrieved successfully');
    
  } catch (error) {
    console.error('Get pending posts error:', error);
    return errorResponse(res, 'Failed to retrieve pending posts', 500);
  }
};

module.exports = {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  approvePost,
  archivePost,
  deletePost,
  getPendingPosts,
};