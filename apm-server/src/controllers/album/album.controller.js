// src/controllers/album.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams } = require('../../utils/response');
const PhotoService = require('../../services/PhotoService');
const { generatePhotoUrl, cleanupUploadedFiles } = require('../../middleware/upload.middleware');

// ============================================
// ALBUM MANAGEMENT CONTROLLERS
// ============================================

/**
 * Get all albums with pagination and filtering
 * GET /api/albums
 * Access: Admin only
 */
const getAlbums = async (req, res) => {
  try {
    const { 
      page, 
      limit, 
      search,
      isArchived = 'false',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const { skip, take } = getPaginationParams(page, limit);

    // Build filters
    const whereClause = {
      isArchived: isArchived === 'true'
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Valid sort fields
    const validSortFields = ['name', 'createdAt', 'updatedAt'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const finalSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [albums, totalCount] = await Promise.all([
      prisma.album.findMany({
        where: whereClause,
        include: {
          creator: {
            select: { id: true, fullName: true }
          },
          _count: {
            select: { photos: true }
          }
        },
        skip,
        take,
        orderBy: { [finalSortBy]: finalSortOrder }
      }),
      prisma.album.count({ where: whereClause })
    ]);

    // Get photo stats for each album
    const albumsWithStats = await Promise.all(
      albums.map(async (album) => {
        const stats = await PhotoService.getAlbumPhotoStats(album.id);
        
        return {
          id: album.id,
          name: album.name,
          description: album.description,
          coverImage: album.coverImage,
          isArchived: album.isArchived,
          creator: album.creator,
          photoCount: album._count.photos,
          totalSize: stats.totalSize,
          totalSizeFormatted: stats.totalSizeFormatted,
          createdAt: album.createdAt,
          updatedAt: album.updatedAt
        };
      })
    );

    return paginatedResponse(
      res,
      { albums: albumsWithStats },
      totalCount,
      page,
      limit,
      'Albums retrieved successfully'
    );
  } catch (error) {
    console.error('Get albums error:', error);
    return errorResponse(res, 'Failed to retrieve albums', 500);
  }
};

/**
 * Get single album with photos
 * GET /api/albums/:albumId
 * Access: Admin only
 */
const getAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { includePhotos = 'true', photoPage = 1, photoLimit = 20 } = req.query;

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        creator: {
          select: { id: true, fullName: true }
        },
        _count: {
          select: { photos: true }
        }
      }
    });

    if (!album) {
      return errorResponse(res, 'Album not found', 404);
    }

    let photos = [];
    let photosPagination = null;

    if (includePhotos === 'true') {
      const { skip: photoSkip, take: photoTake } = getPaginationParams(photoPage, photoLimit);

      const [albumPhotos, photosCount] = await Promise.all([
        prisma.photo.findMany({
          where: { albumId },
          include: {
            uploader: {
              select: { id: true, fullName: true }
            }
          },
          skip: photoSkip,
          take: photoTake,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.photo.count({ where: { albumId } })
      ]);

      photos = albumPhotos.map(photo => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        tags: photo.tags,
        metadata: photo.metadata,
        uploader: photo.uploader,
        createdAt: photo.createdAt,
        updatedAt: photo.updatedAt
      }));

      photosPagination = {
        page: parseInt(photoPage),
        limit: parseInt(photoLimit),
        total: photosCount,
        pages: Math.ceil(photosCount / parseInt(photoLimit))
      };
    }

    // Get album stats
    const stats = await PhotoService.getAlbumPhotoStats(albumId);

    const albumData = {
      id: album.id,
      name: album.name,
      description: album.description,
      coverImage: album.coverImage,
      isArchived: album.isArchived,
      creator: album.creator,
      stats: {
        photoCount: album._count.photos,
        totalSize: stats.totalSize,
        totalSizeFormatted: stats.totalSizeFormatted
      },
      photos: includePhotos === 'true' ? photos : undefined,
      photosPagination: includePhotos === 'true' ? photosPagination : undefined,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt
    };

    return successResponse(res, { album: albumData }, 'Album retrieved successfully');
  } catch (error) {
    console.error('Get album error:', error);
    return errorResponse(res, 'Failed to retrieve album', 500);
  }
};

/**
 * Create new album
 * POST /api/albums
 * Access: Admin only
 */
const createAlbum = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;
    
    // Handle cover image if uploaded
    let coverImageUrl = null;
    if (req.file) {
      coverImageUrl = generatePhotoUrl(req, req.file);
    }

    const album = await prisma.album.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        coverImage: coverImageUrl,
        createdBy: userId
      },
      include: {
        creator: {
          select: { id: true, fullName: true }
        },
        _count: {
          select: { photos: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'album_create',
        details: {
          albumId: album.id,
          albumName: album.name,
          hasCoverImage: !!coverImageUrl
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const albumData = {
      id: album.id,
      name: album.name,
      description: album.description,
      coverImage: album.coverImage,
      isArchived: album.isArchived,
      creator: album.creator,
      photoCount: album._count.photos,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt
    };

    return successResponse(res, { album: albumData }, 'Album created successfully', 201);
  } catch (error) {
    console.error('Create album error:', error);
    
    // Cleanup uploaded file on error
    if (req.file) {
      cleanupUploadedFiles(req.file);
    }
    
    return errorResponse(res, 'Failed to create album', 500);
  }
};

/**
 * Update album
 * PUT /api/albums/:albumId
 * Access: Admin only
 */
const updateAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { name, description, isArchived } = req.body;
    const userId = req.user.id;

    // Prepare update data
    const updateData = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    // Handle cover image update
    if (req.file) {
      // Get old cover image URL for cleanup
      const oldAlbum = await prisma.album.findUnique({
        where: { id: albumId },
        select: { coverImage: true }
      });

      updateData.coverImage = generatePhotoUrl(req, req.file);
      
      // Clean up old cover image file (optional)
      if (oldAlbum?.coverImage) {
        // Could implement cleanup of old cover image here
      }
    }

    const updatedAlbum = await prisma.album.update({
      where: { id: albumId },
      data: updateData,
      include: {
        creator: {
          select: { id: true, fullName: true }
        },
        _count: {
          select: { photos: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'album_update',
        details: {
          albumId,
          albumName: updatedAlbum.name,
          updatedFields: Object.keys(updateData),
          isArchived: updatedAlbum.isArchived
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Get album stats
    const stats = await PhotoService.getAlbumPhotoStats(albumId);

    const albumData = {
      id: updatedAlbum.id,
      name: updatedAlbum.name,
      description: updatedAlbum.description,
      coverImage: updatedAlbum.coverImage,
      isArchived: updatedAlbum.isArchived,
      creator: updatedAlbum.creator,
      photoCount: updatedAlbum._count.photos,
      totalSize: stats.totalSize,
      totalSizeFormatted: stats.totalSizeFormatted,
      createdAt: updatedAlbum.createdAt,
      updatedAt: updatedAlbum.updatedAt
    };

    return successResponse(res, { album: albumData }, 'Album updated successfully');
  } catch (error) {
    console.error('Update album error:', error);
    
    // Cleanup uploaded file on error
    if (req.file) {
      cleanupUploadedFiles(req.file);
    }
    
    return errorResponse(res, 'Failed to update album', 500);
  }
};

/**
 * Delete album (and all its photos)
 * DELETE /api/albums/:albumId
 * Access: Admin only
 */
const deleteAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const userId = req.user.id;

    // Get album with photos for cleanup
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        photos: {
          select: { id: true, url: true, metadata: true }
        }
      }
    });

    if (!album) {
      return errorResponse(res, 'Album not found', 404);
    }

    const photoCount = album.photos.length;

    // Delete all photos in the album (this will also clean up files)
    if (photoCount > 0) {
      const photoIds = album.photos.map(photo => photo.id);
      await PhotoService.bulkDeletePhotos(photoIds, userId);
    }

    // Delete the album
    await prisma.album.delete({
      where: { id: albumId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'album_delete',
        details: {
          albumId,
          albumName: album.name,
          deletedPhotos: photoCount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(
      res,
      {
        deletedAlbum: {
          id: album.id,
          name: album.name,
          deletedPhotos: photoCount
        }
      },
      'Album and all photos deleted successfully'
    );
  } catch (error) {
    console.error('Delete album error:', error);
    return errorResponse(res, 'Failed to delete album', 500);
  }
};

/**
 * Set album cover from existing photo
 * POST /api/albums/:albumId/cover
 * Access: Admin only
 */
const setAlbumCover = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { photoId } = req.body;
    const userId = req.user.id;

    const updatedAlbum = await PhotoService.setAlbumCover(albumId, photoId, userId);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'album_cover_set',
        details: {
          albumId,
          photoId,
          albumName: updatedAlbum.name || 'Unknown'
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const albumData = {
      id: updatedAlbum.id,
      name: updatedAlbum.name,
      coverImage: updatedAlbum.coverImage,
      photoCount: updatedAlbum._count.photos
    };

    return successResponse(res, { album: albumData }, 'Album cover updated successfully');
  } catch (error) {
    console.error('Set album cover error:', error);
    return errorResponse(res, error.message || 'Failed to set album cover', 500);
  }
};

/**
 * Archive/Unarchive album
 * POST /api/albums/:albumId/archive
 * Access: Admin only
 */
const toggleArchiveAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const userId = req.user.id;

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, name: true, isArchived: true }
    });

    if (!album) {
      return errorResponse(res, 'Album not found', 404);
    }

    const newArchivedStatus = !album.isArchived;

    const updatedAlbum = await prisma.album.update({
      where: { id: albumId },
      data: { isArchived: newArchivedStatus },
      include: {
        creator: {
          select: { id: true, fullName: true }
        },
        _count: {
          select: { photos: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: newArchivedStatus ? 'album_archive' : 'album_unarchive',
        details: {
          albumId,
          albumName: album.name
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const albumData = {
      id: updatedAlbum.id,
      name: updatedAlbum.name,
      description: updatedAlbum.description,
      coverImage: updatedAlbum.coverImage,
      isArchived: updatedAlbum.isArchived,
      creator: updatedAlbum.creator,
      photoCount: updatedAlbum._count.photos,
      createdAt: updatedAlbum.createdAt,
      updatedAt: updatedAlbum.updatedAt
    };

    const message = newArchivedStatus ? 'Album archived successfully' : 'Album unarchived successfully';
    
    return successResponse(res, { album: albumData }, message);
  } catch (error) {
    console.error('Toggle archive album error:', error);
    return errorResponse(res, 'Failed to update album archive status', 500);
  }
};

/**
 * Get album statistics
 * GET /api/albums/:albumId/stats
 * Access: Admin only
 */
const getAlbumStats = async (req, res) => {
  try {
    const { albumId } = req.params;

    const [album, stats, recentPhotos] = await Promise.all([
      prisma.album.findUnique({
        where: { id: albumId },
        select: { id: true, name: true, createdAt: true }
      }),
      PhotoService.getAlbumPhotoStats(albumId),
      prisma.photo.findMany({
        where: { albumId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: {
            select: { id: true, fullName: true }
          }
        }
      })
    ]);

    if (!album) {
      return errorResponse(res, 'Album not found', 404);
    }

    const albumStats = {
      album: {
        id: album.id,
        name: album.name,
        createdAt: album.createdAt
      },
      statistics: stats,
      recentPhotos: recentPhotos.map(photo => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        uploader: photo.uploader,
        createdAt: photo.createdAt
      }))
    };

    return successResponse(res, { albumStats }, 'Album statistics retrieved successfully');
  } catch (error) {
    console.error('Get album stats error:', error);
    return errorResponse(res, 'Failed to retrieve album statistics', 500);
  }
};

module.exports = {
  getAlbums,
  getAlbum,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  setAlbumCover,
  toggleArchiveAlbum,
  getAlbumStats
};