// src/controllers/photo.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams } = require('../../utils/response');
const PhotoService = require('../../services/PhotoService');
const { generatePhotoUrl, cleanupUploadedFiles, extractPhotoMetadata } = require('../../middleware/upload.middleware');
const { cloudflareR2Service } = require('../../services/cloudflare-r2.service');

// ============================================
// PHOTO MANAGEMENT CONTROLLERS
// ============================================

/**
 * Get all photos with pagination and filtering
 * GET /api/photos
 * Access: Admin only
 */
const getPhotos = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      uploadedBy
    } = req.query;

    // Get albumId from URL params (when route is /albums/:albumId/photos)
    // or from query params (when route is /photos?albumId=xxx)
    const albumId = req.params.albumId || req.query.albumId;

    const { skip, take } = getPaginationParams(page, limit);

    // Build filters
    const whereClause = {};

    if (albumId) whereClause.albumId = albumId;
    if (uploadedBy) whereClause.uploadedBy = uploadedBy;

    if (search) {
      whereClause.OR = [
        { caption: { contains: search, mode: 'insensitive' } },
        { album: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Valid sort fields
    const validSortFields = ['createdAt', 'updatedAt'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const finalSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [photos, totalCount] = await Promise.all([
      prisma.photo.findMany({
        where: whereClause,
        include: {
          album: {
            select: { id: true, name: true, isArchived: true }
          },
          uploader: {
            select: { id: true, fullName: true }
          }
        },
        skip,
        take,
        orderBy: { [finalSortBy]: finalSortOrder }
      }),
      prisma.photo.count({ where: whereClause })
    ]);

    const photosData = photos.map(photo => ({
      id: photo.id,
      url: photo.url,
      caption: photo.caption,
      tags: photo.tags,
      metadata: photo.metadata,
      album: photo.album,
      uploader: photo.uploader,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt
    }));

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1
    };

    return paginatedResponse(
      res,
      { photos: photosData },
      pagination,
      'Photos retrieved successfully'
    );
  } catch (error) {
    console.error('Get photos error:', error);
    return errorResponse(res, 'Failed to retrieve photos', 500);
  }
};

/**
 * Get single photo with details
 * GET /api/photos/:photoId
 * Access: Admin only
 */
const getPhoto = async (req, res) => {
  try {
    const { photoId } = req.params;

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: {
        album: {
          select: { id: true, name: true, isArchived: true }
        },
        uploader: {
          select: { id: true, fullName: true }
        }
      }
    });

    if (!photo) {
      return errorResponse(res, 'Photo not found', 404);
    }

    // Get tagged users info if tags exist
    let taggedUsers = [];
    if (photo.tags && photo.tags.length > 0) {
      taggedUsers = await prisma.user.findMany({
        where: {
          id: { in: photo.tags },
          isActive: true
        },
        select: { id: true, fullName: true }
      });
    }

    const photoData = {
      id: photo.id,
      url: photo.url,
      caption: photo.caption,
      tags: photo.tags,
      taggedUsers,
      metadata: photo.metadata,
      album: photo.album,
      uploader: photo.uploader,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt
    };

    return successResponse(res, { photo: photoData }, 'Photo retrieved successfully');
  } catch (error) {
    console.error('Get photo error:', error);
    return errorResponse(res, 'Failed to retrieve photo', 500);
  }
};

/**
 * Upload single photo to album
 * POST /api/albums/:albumId/photos
 * Access: Admin only
 */
const uploadPhotoToAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { caption, tags } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return errorResponse(res, 'No photo file uploaded', 400);
    }

    // Verify album exists
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, name: true, isArchived: true }
    });

    if (!album) {
      cleanupUploadedFiles(req.file);
      return errorResponse(res, 'Album not found', 404);
    }

    if (album.isArchived) {
      cleanupUploadedFiles(req.file);
      return errorResponse(res, 'Cannot upload photos to archived album', 400);
    }

    // Validate and process tags
    let processedTags = [];
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []);
      const tagValidation = await PhotoService.validateUserTags(tagArray);
      
      if (tagValidation.invalid.length > 0) {
        cleanupUploadedFiles(req.file);
        return errorResponse(res, `Invalid user IDs in tags: ${tagValidation.invalid.join(', ')}`, 400);
      }
      
      processedTags = tagValidation.valid;
    }

    // Process photo upload
    const result = await PhotoService.processPhotoUpload(
      req.file,
      albumId,
      userId,
      caption,
      processedTags
    );

    if (!result.success) {
      return errorResponse(res, result.error, 500);
    }

    // Log activity (async - don't block response)
    setImmediate(async () => {
      try {
        await prisma.activityLog.create({
          data: {
            userId,
            action: 'photo_upload',
            details: {
              photoId: result.photo.id,
              albumId,
              albumName: album.name,
              hasCaption: !!caption,
              tagCount: processedTags.length
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
      } catch (error) {
        console.error('Failed to log photo upload activity:', error);
      }
    });

    const photoData = {
      id: result.photo.id,
      url: result.photo.url,
      caption: result.photo.caption,
      tags: result.photo.tags,
      metadata: result.photo.metadata,
      album: result.photo.album,
      uploader: result.photo.uploader,
      createdAt: result.photo.createdAt
    };

    return successResponse(res, { photo: photoData }, 'Photo uploaded successfully', 201);
  } catch (error) {
    console.error('Upload photo error:', error);
    
    // Cleanup uploaded file on error
    if (req.file) {
      cleanupUploadedFiles(req.file);
    }
    
    return errorResponse(res, 'Failed to upload photo', 500);
  }
};

/**
 * Bulk upload photos to album
 * POST /api/albums/:albumId/photos/bulk
 * Access: Admin only
 */
const bulkUploadPhotos = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { bulkCaption } = req.body;
    const userId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 'No photo files uploaded', 400);
    }

    // Verify album exists
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, name: true, isArchived: true }
    });

    if (!album) {
      cleanupUploadedFiles(req.files);
      return errorResponse(res, 'Album not found', 404);
    }

    if (album.isArchived) {
      cleanupUploadedFiles(req.files);
      return errorResponse(res, 'Cannot upload photos to archived album', 400);
    }

    // Process bulk upload
    const results = await PhotoService.processBulkPhotoUpload(
      req.files,
      albumId,
      userId,
      bulkCaption
    );

    // Log activity (async - don't block response)
    setImmediate(async () => {
      try {
        await prisma.activityLog.create({
          data: {
            userId,
            action: 'photos_bulk_upload',
            details: {
              albumId,
              albumName: album.name,
              totalFiles: req.files.length,
              successful: results.totalUploaded,
              failed: results.totalFailed
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
      } catch (error) {
        console.error('Failed to log bulk upload activity:', error);
      }
    });

    const message = `Bulk upload completed: ${results.totalUploaded} successful, ${results.totalFailed} failed`;

    // Match frontend expected format: { uploaded: [...], failed: [...] }
    return successResponse(res, {
      uploaded: results.successful,
      failed: results.failed
    }, message, 201);
  } catch (error) {
    console.error('Bulk upload photos error:', error);
    
    // Cleanup uploaded files on error
    if (req.files) {
      cleanupUploadedFiles(req.files);
    }
    
    return errorResponse(res, 'Failed to upload photos', 500);
  }
};

/**
 * Update photo details
 * PUT /api/photos/:photoId
 * Access: Admin only
 */
const updatePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const { caption, tags } = req.body;
    const userId = req.user.id;

    // Validate and process tags if provided
    let processedTags;
    if (tags !== undefined) {
      const tagArray = Array.isArray(tags) ? tags : [];
      const tagValidation = await PhotoService.validateUserTags(tagArray);
      
      if (tagValidation.invalid.length > 0) {
        return errorResponse(res, `Invalid user IDs in tags: ${tagValidation.invalid.join(', ')}`, 400);
      }
      
      processedTags = tagValidation.valid;
    }

    // Update photo
    const updatedPhoto = await PhotoService.updatePhoto(
      photoId,
      { caption, tags: processedTags },
      userId
    );

    // Get tagged users info for response
    let taggedUsers = [];
    if (updatedPhoto.tags && updatedPhoto.tags.length > 0) {
      taggedUsers = await prisma.user.findMany({
        where: {
          id: { in: updatedPhoto.tags },
          isActive: true
        },
        select: { id: true, fullName: true }
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'photo_update',
        details: {
          photoId,
          updatedCaption: caption !== undefined,
          updatedTags: tags !== undefined,
          tagCount: processedTags?.length || 0
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const photoData = {
      id: updatedPhoto.id,
      url: updatedPhoto.url,
      caption: updatedPhoto.caption,
      tags: updatedPhoto.tags,
      taggedUsers,
      metadata: updatedPhoto.metadata,
      album: updatedPhoto.album,
      uploader: updatedPhoto.uploader,
      createdAt: updatedPhoto.createdAt,
      updatedAt: updatedPhoto.updatedAt
    };

    return successResponse(res, { photo: photoData }, 'Photo updated successfully');
  } catch (error) {
    console.error('Update photo error:', error);
    return errorResponse(res, error.message || 'Failed to update photo', 500);
  }
};

/**
 * Delete photo
 * DELETE /api/photos/:photoId
 * Access: Admin only
 */
const deletePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;

    const result = await PhotoService.deletePhoto(photoId, userId);

    if (!result.success) {
      return errorResponse(res, 'Failed to delete photo', 500);
    }

    // Log activity (async - don't block response)
    setImmediate(async () => {
      try {
        await prisma.activityLog.create({
          data: {
            userId,
            action: 'photo_delete',
            details: {
              photoId,
              filename: result.deletedPhoto.filename
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
      } catch (error) {
        console.error('Failed to log photo delete activity:', error);
      }
    });

    return successResponse(res, { deletedPhoto: result.deletedPhoto }, 'Photo deleted successfully');
  } catch (error) {
    console.error('Delete photo error:', error);
    return errorResponse(res, error.message || 'Failed to delete photo', 500);
  }
};

/**
 * Bulk delete photos
 * POST /api/photos/bulk-delete
 * Access: Admin only
 */
const bulkDeletePhotos = async (req, res) => {
  try {
    const { photoIds } = req.body;
    const userId = req.user.id;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return errorResponse(res, 'No photo IDs provided', 400);
    }

    const results = await PhotoService.bulkDeletePhotos(photoIds, userId);

    // Log activity (async - don't block response)
    setImmediate(async () => {
      try {
        await prisma.activityLog.create({
          data: {
            userId,
            action: 'photos_bulk_delete',
            details: {
              requestedCount: photoIds.length,
              deletedCount: results.totalDeleted,
              failedCount: results.totalFailed,
              photoIds
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
      } catch (error) {
        console.error('Failed to log bulk delete activity:', error);
      }
    });

    const message = `Bulk delete completed: ${results.totalDeleted} deleted, ${results.totalFailed} failed`;

    // Match frontend expected format: { deleted: number, failed: number }
    return successResponse(res, {
      deleted: results.totalDeleted,
      failed: results.totalFailed
    }, message);
  } catch (error) {
    console.error('Bulk delete photos error:', error);
    return errorResponse(res, 'Failed to delete photos', 500);
  }
};

/**
 * Move photos to different album
 * POST /api/photos/move
 * Access: Admin only
 */
const movePhotos = async (req, res) => {
  try {
    const { photoIds, targetAlbumId } = req.body;
    const userId = req.user.id;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return errorResponse(res, 'No photo IDs provided', 400);
    }

    const result = await PhotoService.movePhotosToAlbum(photoIds, targetAlbumId, userId);

    // Manually invalidate cache for BOTH source and target albums
    const { CacheService } = require('../../config/redis');

    // Invalidate target album caches
    await CacheService.deletePattern(`photos:album:${targetAlbumId}:*`);
    console.log(`🗑️ Invalidated cache for target album: ${targetAlbumId}`);

    // Invalidate source album caches
    if (result.sourceAlbumIds && result.sourceAlbumIds.length > 0) {
      for (const sourceAlbumId of result.sourceAlbumIds) {
        await CacheService.deletePattern(`photos:album:${sourceAlbumId}:*`);
        console.log(`🗑️ Invalidated cache for source album: ${sourceAlbumId}`);
      }
    }

    // Invalidate general album lists
    await CacheService.deletePattern('photos:albums:list');
    await CacheService.deletePattern('photos:admin:albums');
    await CacheService.deletePattern('photos:recent');

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'photos_move',
        details: {
          photoIds,
          targetAlbumId,
          sourceAlbumIds: result.sourceAlbumIds,
          targetAlbumName: result.targetAlbum,
          movedCount: result.movedCount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, { moveResult: result }, 'Photos moved successfully');
  } catch (error) {
    console.error('Move photos error:', error);
    return errorResponse(res, error.message || 'Failed to move photos', 500);
  }
};

/**
 * Search photos across all albums
 * GET /api/photos/search
 * Access: Admin only
 */
const searchPhotos = async (req, res) => {
  try {
    const { 
      query, 
      albumId, 
      tags,
      uploadedBy,
      page, 
      limit,
      dateFrom,
      dateTo 
    } = req.query;

    const { skip, take } = getPaginationParams(page, limit);

    // Build search filters
    const whereClause = {};

    if (query) {
      whereClause.OR = [
        { caption: { contains: query, mode: 'insensitive' } },
        { album: { name: { contains: query, mode: 'insensitive' } } }
      ];
    }

    if (albumId) whereClause.albumId = albumId;
    if (uploadedBy) whereClause.uploadedBy = uploadedBy;

    // Tag search (user mentions)
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      whereClause.tags = {
        hasSome: tagArray
      };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
      if (dateTo) whereClause.createdAt.lte = new Date(dateTo);
    }

    const [photos, totalCount] = await Promise.all([
      prisma.photo.findMany({
        where: whereClause,
        include: {
          album: {
            select: { id: true, name: true }
          },
          uploader: {
            select: { id: true, fullName: true }
          }
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.photo.count({ where: whereClause })
    ]);

    const searchResults = photos.map(photo => ({
      id: photo.id,
      url: photo.url,
      caption: photo.caption,
      tags: photo.tags,
      metadata: photo.metadata,
      album: photo.album,
      uploader: photo.uploader,
      createdAt: photo.createdAt
    }));

    return paginatedResponse(
      res,
      { 
        photos: searchResults,
        searchQuery: {
          query,
          albumId,
          tags,
          uploadedBy,
          dateFrom,
          dateTo
        }
      },
      totalCount,
      page,
      limit,
      'Photo search completed successfully'
    );
  } catch (error) {
    console.error('Search photos error:', error);
    return errorResponse(res, 'Failed to search photos', 500);
  }
};

/**
 * Get recent photos across all albums
 * GET /api/photos/recent
 * Access: Admin only
 */
const getRecentPhotos = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const limitInt = Math.min(parseInt(limit) || 20, 100); // Max 100 photos

    const recentPhotos = await prisma.photo.findMany({
      include: {
        album: {
          select: { id: true, name: true }
        },
        uploader: {
          select: { id: true, fullName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limitInt
    });

    const photosData = recentPhotos.map(photo => ({
      id: photo.id,
      url: photo.url,
      caption: photo.caption,
      tags: photo.tags,
      metadata: photo.metadata,
      album: photo.album,
      uploader: photo.uploader,
      createdAt: photo.createdAt
    }));

    return successResponse(
      res,
      { photos: photosData, totalReturned: photosData.length },
      'Recent photos retrieved successfully'
    );
  } catch (error) {
    console.error('Get recent photos error:', error);
    return errorResponse(res, 'Failed to retrieve recent photos', 500);
  }
};

/**
 * Serve photo from R2
 * GET /api/albums/photo/:filename
 * Access: Public (proxy for R2 private bucket)
 */
const servePhoto = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).send('Filename is required');
    }

    console.log('Fetching photo from R2:', filename);

    // Photos are stored in alumni-portal/album-photos/ directory
    const key = `alumni-portal/album-photos/${filename}`;
    console.log('Fetching photo with key:', key);

    // Get file from R2
    const result = await cloudflareR2Service.getFile(key);

    if (!result.success) {
      console.error('Failed to fetch photo from R2:', result.error);
      return res.status(404).send('Image not found');
    }

    // Set content type and cache headers
    res.set({
      'Content-Type': result.contentType,
      'Content-Length': result.size,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'ETag': `"${filename}"`,
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });

    // Send the image buffer
    return res.send(result.data);
  } catch (error) {
    console.error('Serve photo error:', error);
    return res.status(500).send('Error serving image');
  }
};

module.exports = {
  getPhotos,
  getPhoto,
  uploadPhotoToAlbum,
  bulkUploadPhotos,
  updatePhoto,
  deletePhoto,
  bulkDeletePhotos,
  movePhotos,
  searchPhotos,
  getRecentPhotos,
  servePhoto
};