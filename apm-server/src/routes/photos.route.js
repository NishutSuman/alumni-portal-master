// src/routes/photos.route.js
const express = require('express');
const router = express.Router();

// ============================================
// MIDDLEWARE IMPORTS
// ============================================
const { 
  authenticateToken, 
  requireRole 
} = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/response');

// Photo-specific middleware
const {
  uploadSinglePhoto,
  handleUploadError
} = require('../middleware/upload.middleware');

const {
  validateUpdatePhoto,
  validateBulkDeletePhotos,
  validateMovePhotos,
  validatePhotoIdParam,
  validatePhotoAccess,
  validatePhotoUpload
} = require('../middleware/photo.validation.middleware');

const {
  cachePhotoDetails,
  cacheRecentPhotos,
  cachePhotoSearch,
  cachePhotosStats,
  cacheUserPhotoStats,
  cacheAdminPhotosList,
  autoInvalidatePhotoCaches
} = require('../middleware/photo.cache.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================
const photoController = require('../controllers/photo.controller');

// ============================================
// ADMIN-ONLY MIDDLEWARE
// All photo routes require SUPER_ADMIN access
// ============================================
router.use(authenticateToken);
router.use(requireRole('SUPER_ADMIN'));

// ============================================
// DIRECT PHOTO MANAGEMENT ROUTES
// ============================================

/**
 * Get all photos with advanced filtering
 * GET /api/photos
 */
router.get('/',
  [
    cacheAdminPhotosList
  ],
  asyncHandler(photoController.getPhotos)
);

/**
 * Get single photo with full details
 * GET /api/photos/:photoId
 */
router.get('/:photoId',
  [
    validatePhotoIdParam,
    validatePhotoAccess,
    cachePhotoDetails
  ],
  asyncHandler(photoController.getPhoto)
);

/**
 * Update photo details (caption, tags)
 * PUT /api/photos/:photoId
 */
router.put('/:photoId',
  [
    validatePhotoIdParam,
    validatePhotoAccess,
    validateUpdatePhoto,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.updatePhoto)
);

/**
 * Delete photo
 * DELETE /api/photos/:photoId
 */
router.delete('/:photoId',
  [
    validatePhotoIdParam,
    validatePhotoAccess,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.deletePhoto)
);

// ============================================
// PHOTO SEARCH & DISCOVERY ROUTES
// ============================================

/**
 * Advanced photo search across all albums
 * GET /api/photos/search
 */
router.get('/search',
  [
    cachePhotoSearch
  ],
  asyncHandler(photoController.searchPhotos)
);

/**
 * Get recent photos across all albums
 * GET /api/photos/recent
 */
router.get('/recent',
  [
    cacheRecentPhotos
  ],
  asyncHandler(photoController.getRecentPhotos)
);

// ============================================
// BULK PHOTO OPERATIONS
// ============================================

/**
 * Bulk delete photos (across albums)
 * POST /api/photos/bulk-delete
 */
router.post('/bulk-delete',
  [
    validateBulkDeletePhotos,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.bulkDeletePhotos)
);

/**
 * Move photos between albums
 * POST /api/photos/move
 */
router.post('/move',
  [
    validateMovePhotos,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.movePhotos)
);

// ============================================
// PHOTO STATISTICS ROUTES
// ============================================

/**
 * Get overall photo statistics
 * GET /api/photos/stats
 */
router.get('/stats',
  [
    cachePhotosStats
  ],
  asyncHandler(async (req, res) => {
    try {
      const [
        totalPhotos,
        totalAlbums,
        totalSize,
        recentUploads,
        tagStats
      ] = await Promise.all([
        // Total photos count
        prisma.photo.count(),
        
        // Total albums count
        prisma.album.count({ where: { isArchived: false } }),
        
        // Total size calculation
        prisma.$queryRaw`
          SELECT COALESCE(SUM(CAST(metadata->>'size' AS INTEGER)), 0) as total_size
          FROM photos 
          WHERE metadata->>'size' IS NOT NULL
        `,
        
        // Recent uploads (last 7 days)
        prisma.photo.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        
        // Tag usage statistics
        prisma.$queryRaw`
          SELECT 
            COUNT(*) as photos_with_tags,
            AVG(array_length(tags, 1)) as avg_tags_per_photo
          FROM photos 
          WHERE array_length(tags, 1) > 0
        `
      ]);

      const stats = {
        overview: {
          totalPhotos,
          totalAlbums,
          totalSize: totalSize[0]?.total_size || 0,
          totalSizeFormatted: formatFileSize(parseInt(totalSize[0]?.total_size || 0))
        },
        activity: {
          recentUploads,
          uploadsThisWeek: recentUploads
        },
        tagging: {
          photosWithTags: parseInt(tagStats[0]?.photos_with_tags || 0),
          averageTagsPerPhoto: parseFloat(tagStats[0]?.avg_tags_per_photo || 0)
        },
        generatedAt: new Date().toISOString()
      };

      // Helper function for file size formatting
      function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      }

      return res.json({
        success: true,
        data: { stats },
        message: 'Photo statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Photo stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve photo statistics'
      });
    }
  })
);

/**
 * Get user-specific photo statistics
 * GET /api/photos/stats/user/:userId
 */
router.get('/stats/user/:userId',
  [
    cacheUserPhotoStats
  ],
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const [
        photosUploaded,
        albumsCreated,
        totalSize,
        taggedInPhotos
      ] = await Promise.all([
        // Photos uploaded by user
        prisma.photo.count({
          where: { uploadedBy: userId }
        }),
        
        // Albums created by user
        prisma.album.count({
          where: { createdBy: userId, isArchived: false }
        }),
        
        // Total size of user's photos
        prisma.$queryRaw`
          SELECT COALESCE(SUM(CAST(metadata->>'size' AS INTEGER)), 0) as total_size
          FROM photos 
          WHERE uploaded_by = ${userId} AND metadata->>'size' IS NOT NULL
        `,
        
        // Photos where user is tagged
        prisma.photo.count({
          where: {
            tags: {
              has: userId
            }
          }
        })
      ]);

      function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      }

      const userStats = {
        user,
        contributions: {
          photosUploaded,
          albumsCreated,
          totalSize: totalSize[0]?.total_size || 0,
          totalSizeFormatted: formatFileSize(parseInt(totalSize[0]?.total_size || 0))
        },
        engagement: {
          taggedInPhotos
        },
        generatedAt: new Date().toISOString()
      };

      return res.json({
        success: true,
        data: { userStats },
        message: 'User photo statistics retrieved successfully'
      });
    } catch (error) {
      console.error('User photo stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve user photo statistics'
      });
    }
  })
);

// ============================================
// PHOTO METADATA ROUTES
// ============================================

/**
 * Get photo metadata analysis
 * GET /api/photos/metadata/analysis
 */
router.get('/metadata/analysis',
  [
    cachePhotosStats
  ],
  asyncHandler(async (req, res) => {
    try {
      // Get metadata analysis
      const metadataStats = await prisma.$queryRaw`
        SELECT 
          metadata->>'format' as format,
          COUNT(*) as count,
          AVG(CAST(metadata->>'size' AS INTEGER)) as avg_size,
          SUM(CAST(metadata->>'size' AS INTEGER)) as total_size
        FROM photos 
        WHERE metadata IS NOT NULL
        GROUP BY metadata->>'format'
        ORDER BY count DESC
      `;

      const analysis = {
        formatBreakdown: metadataStats.map(stat => ({
          format: stat.format,
          count: parseInt(stat.count),
          averageSize: parseInt(stat.avg_size || 0),
          totalSize: parseInt(stat.total_size || 0),
          averageSizeFormatted: formatFileSize(parseInt(stat.avg_size || 0)),
          totalSizeFormatted: formatFileSize(parseInt(stat.total_size || 0))
        })),
        summary: {
          totalFormats: metadataStats.length,
          totalPhotosWithMetadata: metadataStats.reduce((sum, stat) => sum + parseInt(stat.count), 0)
        },
        generatedAt: new Date().toISOString()
      };

      function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      }

      return res.json({
        success: true,
        data: { analysis },
        message: 'Photo metadata analysis retrieved successfully'
      });
    } catch (error) {
      console.error('Photo metadata analysis error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve photo metadata analysis'
      });
    }
  })
);

// ============================================
// ROUTE ERROR HANDLING
// ============================================

// Handle undefined photo routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Photo route not found: ${req.method} ${req.baseUrl}${req.path}`,
    availableRoutes: {
      allPhotos: 'GET /api/photos',
      photoDetails: 'GET /api/photos/:photoId',
      updatePhoto: 'PUT /api/photos/:photoId',
      deletePhoto: 'DELETE /api/photos/:photoId',
      searchPhotos: 'GET /api/photos/search',
      recentPhotos: 'GET /api/photos/recent',
      bulkDelete: 'POST /api/photos/bulk-delete',
      movePhotos: 'POST /api/photos/move',
      photoStats: 'GET /api/photos/stats'
    }
  });
});

module.exports = router;


// ============================================
// ROUTE DOCUMENTATION SUMMARY
// ============================================

/**
 * Photos Management API Routes - Direct Photo Operations
 * 
 * Base URL: /api/photos
 * Access: SUPER_ADMIN only
 * Total Endpoints: 12
 * 
 * DIRECT PHOTO MANAGEMENT (4 endpoints):
 * - GET /api/photos                                 - List all photos with filters
 * - GET /api/photos/:photoId                        - Get photo details
 * - PUT /api/photos/:photoId                        - Update photo
 * - DELETE /api/photos/:photoId                     - Delete photo
 * 
 * PHOTO SEARCH & DISCOVERY (2 endpoints):
 * - GET /api/photos/search                          - Advanced photo search
 * - GET /api/photos/recent                          - Get recent photos
 * 
 * BULK OPERATIONS (2 endpoints):
 * - POST /api/photos/bulk-delete                    - Bulk delete photos
 * - POST /api/photos/move                           - Move photos between albums
 * 
 * STATISTICS & ANALYTICS (3 endpoints):
 * - GET /api/photos/stats                           - Overall photo statistics
 * - GET /api/photos/stats/user/:userId              - User-specific statistics
 * - GET /api/photos/metadata/analysis               - Photo metadata analysis
 * 
 * Features:
 * - Direct photo management without album context
 * - Advanced search capabilities
 * - Comprehensive statistics and analytics
 * - User contribution tracking
 * - Metadata analysis
 * - Bulk operations support
 * - Full caching implementation
 * - Admin-only access control
 */
