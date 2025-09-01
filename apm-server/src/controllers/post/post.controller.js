// src/controllers/post.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');
const { deleteUploadedFile } = require('../../middleware/upload.middleware');

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
    // Handle uploaded files
    let heroImage = null;
    let images = [];
    
    if (req.files) {
      if (req.files.heroImage && req.files.heroImage[0]) {
        heroImage = `/uploads/posts/${req.files.heroImage[0].filename}`;
      }
      
      if (req.files.images) {
        images = req.files.images.map(file => `/uploads/posts/${file.filename}`);
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
            likes: true,
            comments: true,
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
      const notifications = parsedTags.map(userId => ({
        userId,
        type: 'MENTION',
        title: 'You were mentioned in a post',
        message: `${req.user.fullName} mentioned you in "${title}"`,
        payload: {
          postId: post.id,
          authorId: req.user.id,
          authorName: req.user.fullName,
        },
      }));
      
      await prisma.notification.createMany({
        data: notifications,
      });
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
    status = 'published', // published, pending, all
    sortBy = 'createdAt',
    sortOrder = 'desc' 
  } = req.query;
  
  const { page, limit, skip } = getPaginationParams(req.query, 10);
  
  try {
    // Build where clause
    const whereClause = {
      isArchived: false,
    };
    
    // Filter by visibility based on user role and status
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
    
    // Category filter
    if (category) {
      whereClause.category = category;
    }
    
    // Author filter
    if (authorId) {
      whereClause.createdBy = authorId;
    }
    
    // Search filter
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
        { author: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    
    // Valid sort fields
    const validSortFields = ['createdAt', 'updatedAt', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    
    // Get total count
    const total = await prisma.post.count({ where: whereClause });
    
    // Get posts (now including interaction controls)
    const posts = await prisma.post.findMany({
      where: whereClause,
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
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: { [sortField]: order },
      skip,
      take: limit,
    });
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, posts, pagination, 'Posts retrieved successfully');
    
  } catch (error) {
    console.error('Get posts error:', error);
    return errorResponse(res, 'Failed to retrieve posts', 500);
  }
};

// Get single post by ID
const getPostById = async (req, res) => {
  const { postId } = req.params;
  
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
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
        likes: {
          select: {
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
            likes: true,
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
    
    return successResponse(res, { post }, 'Post retrieved successfully');
    
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
    // Get existing post
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
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
    
    // Handle file uploads (same as before)
    let heroImage = existingPost.heroImage;
    let images = existingPost.images;
    
    if (req.files) {
      if (req.files.heroImage && req.files.heroImage[0]) {
        // Delete old hero image if exists
        if (existingPost.heroImage) {
          const oldFileName = existingPost.heroImage.split('/').pop();
          deleteUploadedFile(`./public/uploads/posts/${oldFileName}`);
        }
        heroImage = `/uploads/posts/${req.files.heroImage[0].filename}`;
      }
      
      if (req.files.images) {
        // Delete old images if new ones are uploaded
        if (existingPost.images && existingPost.images.length > 0) {
          existingPost.images.forEach(imagePath => {
            const fileName = imagePath.split('/').pop();
            deleteUploadedFile(`./public/uploads/posts/${fileName}`);
          });
        }
        images = req.files.images.map(file => `/uploads/posts/${file.filename}`);
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
            likes: true,
            comments: true,
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
    const post = await prisma.post.findUnique({
      where: { id: postId },
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
    
    // Create notification for post author
    await prisma.notification.create({
      data: {
        userId: post.author.id,
        type: 'POST_APPROVED',
        title: `Post ${action}d`,
        message: `Your post "${post.title}" has been ${action}d by ${req.user.fullName}${reason ? `: ${reason}` : ''}`,
        payload: {
          postId: post.id,
          action,
          reason,
          approvedBy: req.user.id,
        },
      },
    });
    
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

// Archive post
const archivePost = async (req, res) => {
  const { postId } = req.params;
  
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
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
      return errorResponse(res, 'You do not have permission to archive this post', 403);
    }
    
    if (post.isArchived) {
      return errorResponse(res, 'Post is already archived', 400);
    }
    
    // Archive post
    await prisma.post.update({
      where: { id: postId },
      data: { isArchived: true },
    });
    
    // Log archive action
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'post_archive',
        details: {
          postId: post.id,
          title: post.title,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Post archived successfully');
    
  } catch (error) {
    console.error('Archive post error:', error);
    return errorResponse(res, 'Failed to archive post', 500);
  }
};

// Delete post (Super Admin only)
const deletePost = async (req, res) => {
  const { postId } = req.params;
  
  if (req.user.role !== 'SUPER_ADMIN') {
    return errorResponse(res, 'Only Super Admins can delete posts', 403);
  }
  
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        heroImage: true,
        images: true,
      },
    });
    
    if (!post) {
      return errorResponse(res, 'Post not found', 404);
    }
    
    // Delete associated files
    if (post.heroImage) {
      const fileName = post.heroImage.split('/').pop();
      deleteUploadedFile(`./public/uploads/posts/${fileName}`);
    }
    
    if (post.images && post.images.length > 0) {
      post.images.forEach(imagePath => {
        const fileName = imagePath.split('/').pop();
        deleteUploadedFile(`./public/uploads/posts/${fileName}`);
      });
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
    const whereClause = {
      isPublished: false,
      isArchived: false,
    };
    
    const total = await prisma.post.count({ where: whereClause });
    
    const posts = await prisma.post.findMany({
      where: whereClause,
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
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // Oldest first for approval queue
      skip,
      take: limit,
    });
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, posts, pagination, 'Pending posts retrieved successfully');
    
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