// src/routes/albums.route.js
const express = require('express');
const router = express.Router();

// ============================================
// MIDDLEWARE IMPORTS
// ============================================
const {
  authenticateToken,
  requireRole,
  optionalAuth
} = require('../middleware/auth/auth.middleware');
const { asyncHandler } = require('../utils/response');

// Photo-specific middleware
const {
  uploadAlbumCover,
  uploadAlbumPhotos,
  uploadSinglePhoto,
  handleUploadError
} = require('../middleware/upload.middleware');

const {
  validateCreateAlbum,
  validateUpdateAlbum,
  validateUpdatePhoto,
  validateBulkUploadPhotos,
  validateBulkDeletePhotos,
  validateMovePhotos,
  validateSetCover,
  validateAlbumIdParam,
  validatePhotoIdParam,
  validateAlbumAccess,
  validatePhotoAccess,
  validateAlbumNameUnique,
  validatePhotoUpload
} = require('../middleware/validation/photo.validation.middleware');

const {
  cacheAlbumsList,
  cacheAlbumDetails,
  cacheAlbumPhotos,
  cacheAlbumStats,
  cachePhotoDetails,
  cacheRecentPhotos,
  cachePhotoSearch,
  autoInvalidateAlbumCaches,
  autoInvalidatePhotoCaches
} = require('../middleware/cache/photo.cache.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================
const albumController = require('../controllers/album/album.controller');
const photoController = require('../controllers/album/photo.controller');

// ============================================
// ALBUM MANAGEMENT ROUTES
// ============================================

/**
 * Get all albums with pagination and filtering (Public - all users can view)
 * GET /api/albums
 */
router.get('/',
  optionalAuth,
  cacheAlbumsList,
  asyncHandler(albumController.getAlbums)
);

/**
 * Get single album with photos (Public - all users can view)
 * GET /api/albums/:albumId
 */
router.get('/:albumId',
  optionalAuth,
  validateAlbumIdParam,
  cacheAlbumDetails,
  asyncHandler(albumController.getAlbum)
);

/**
 * Get album statistics (Public - all users can view)
 * GET /api/albums/:albumId/stats
 */
router.get('/:albumId/stats',
  optionalAuth,
  validateAlbumIdParam,
  cacheAlbumStats,
  asyncHandler(albumController.getAlbumStats)
);

/**
 * Create new album (ADMIN ONLY - with optional cover image)
 * POST /api/albums
 */
router.post('/',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  uploadAlbumCover,
  handleUploadError,
  validateCreateAlbum,
  validateAlbumNameUnique,
  autoInvalidateAlbumCaches,
  asyncHandler(albumController.createAlbum)
);

/**
 * Update album details (ADMIN ONLY - with optional cover image)
 * PUT /api/albums/:albumId
 */
router.put('/:albumId',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  uploadAlbumCover,
  handleUploadError,
  validateUpdateAlbum,
  validateAlbumNameUnique,
  autoInvalidateAlbumCaches,
  asyncHandler(albumController.updateAlbum)
);

/**
 * Delete album and all its photos (ADMIN ONLY)
 * DELETE /api/albums/:albumId
 */
router.delete('/:albumId',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  autoInvalidateAlbumCaches,
  autoInvalidatePhotoCaches,
  asyncHandler(albumController.deleteAlbum)
);

/**
 * Archive/Unarchive album (ADMIN ONLY)
 * POST /api/albums/:albumId/archive
 */
router.post('/:albumId/archive',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  autoInvalidateAlbumCaches,
  asyncHandler(albumController.toggleArchiveAlbum)
);

/**
 * Set album cover from existing photo (ADMIN ONLY)
 * POST /api/albums/:albumId/cover
 */
router.post('/:albumId/cover',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  validateSetCover,
  autoInvalidateAlbumCaches,
  asyncHandler(albumController.setAlbumCover)
);

// ============================================
// ALBUM PHOTOS MANAGEMENT ROUTES
// ============================================

/**
 * Get photos in album with pagination (Public - all users can view)
 * GET /api/albums/:albumId/photos
 */
router.get('/:albumId/photos',
  optionalAuth,
  validateAlbumIdParam,
  cacheAlbumPhotos,
  asyncHandler(photoController.getPhotos)
);

/**
 * Upload single photo to album (ADMIN ONLY)
 * POST /api/albums/:albumId/photos
 */
router.post('/:albumId/photos',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  uploadSinglePhoto,
  handleUploadError,
  validatePhotoUpload,
  autoInvalidateAlbumCaches,
  autoInvalidatePhotoCaches,
  asyncHandler(photoController.uploadPhotoToAlbum)
);

/**
 * Bulk upload photos to album (ADMIN ONLY)
 * POST /api/albums/:albumId/photos/bulk
 */
router.post('/:albumId/photos/bulk',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  uploadAlbumPhotos,
  handleUploadError,
  validateBulkUploadPhotos,
  validatePhotoUpload,
  autoInvalidateAlbumCaches,
  autoInvalidatePhotoCaches,
  asyncHandler(photoController.bulkUploadPhotos)
);

// ============================================
// INDIVIDUAL PHOTO ROUTES (within album context)
// ============================================

/**
 * Get specific photo in album (Public - all users can view)
 * GET /api/albums/:albumId/photos/:photoId
 */
router.get('/:albumId/photos/:photoId',
  optionalAuth,
  validateAlbumIdParam,
  validatePhotoIdParam,
  cachePhotoDetails,
  asyncHandler(photoController.getPhoto)
);

/**
 * Update photo details - caption, tags (ADMIN ONLY)
 * PUT /api/albums/:albumId/photos/:photoId
 */
router.put('/:albumId/photos/:photoId',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  validatePhotoIdParam,
  validateUpdatePhoto,
  autoInvalidatePhotoCaches,
  asyncHandler(photoController.updatePhoto)
);

/**
 * Delete specific photo from album (ADMIN ONLY)
 * DELETE /api/albums/:albumId/photos/:photoId
 */
router.delete('/:albumId/photos/:photoId',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  validatePhotoIdParam,
  autoInvalidateAlbumCaches,
  autoInvalidatePhotoCaches,
  asyncHandler(photoController.deletePhoto)
);

// ============================================
// BULK PHOTO OPERATIONS (ADMIN ONLY)
// ============================================

/**
 * Bulk delete photos from album (ADMIN ONLY)
 * POST /api/albums/:albumId/photos/bulk-delete
 */
router.post('/:albumId/photos/bulk-delete',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  validateBulkDeletePhotos,
  autoInvalidateAlbumCaches,
  autoInvalidatePhotoCaches,
  asyncHandler(photoController.bulkDeletePhotos)
);

/**
 * Move photos to different album (ADMIN ONLY)
 * POST /api/albums/:albumId/photos/move
 */
router.post('/:albumId/photos/move',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateAlbumIdParam,
  validateMovePhotos,
  autoInvalidateAlbumCaches,
  autoInvalidatePhotoCaches,
  asyncHandler(photoController.movePhotos)
);

// ============================================
// GLOBAL PHOTO ROUTES (across all albums)
// ============================================

/**
 * Search photos across all albums (Public - all users can view)
 * GET /api/albums/photos/search
 */
router.get('/photos/search',
  optionalAuth,
  cachePhotoSearch,
  asyncHandler(photoController.searchPhotos)
);

/**
 * Get recent photos across all albums (Public - all users can view)
 * GET /api/albums/photos/recent
 */
router.get('/photos/recent',
  optionalAuth,
  cacheRecentPhotos,
  asyncHandler(photoController.getRecentPhotos)
);

/**
 * Get all photos across all albums (Public - all users can view)
 * GET /api/albums/photos/all
 */
router.get('/photos/all',
  optionalAuth,
  cachePhotoSearch,
  asyncHandler(photoController.getPhotos)
);

// ============================================
// R2 IMAGE PROXY ROUTES
// ============================================

/**
 * Serve album cover image from R2 (Public proxy)
 * GET /api/albums/cover/:albumId
 */
router.get('/cover/:albumId',
  asyncHandler(albumController.serveAlbumCover)
);

/**
 * Serve album photo from R2 (Public proxy)
 * GET /api/albums/photo/:filename
 */
router.get('/photo/:filename',
  asyncHandler(photoController.servePhoto)
);

// ============================================
// ROUTE ERROR HANDLING
// ============================================

// Handle undefined album routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Album route not found: ${req.method} ${req.baseUrl}${req.path}`,
    availableRoutes: {
      albums: 'GET /api/albums',
      albumDetails: 'GET /api/albums/:albumId',
      createAlbum: 'POST /api/albums',
      albumPhotos: 'GET /api/albums/:albumId/photos',
      uploadPhoto: 'POST /api/albums/:albumId/photos',
      bulkUpload: 'POST /api/albums/:albumId/photos/bulk',
      searchPhotos: 'GET /api/albums/photos/search',
      recentPhotos: 'GET /api/albums/photos/recent'
    }
  });
});

module.exports = router;

// ============================================
// ROUTE DOCUMENTATION SUMMARY
// ============================================

/**
 * Album & Photo Management API Routes - Complete Admin-Only Implementation
 * 
 * Base URL: /api/albums
 * Access: SUPER_ADMIN only
 * Total Endpoints: 18
 * 
 * ALBUM MANAGEMENT (8 endpoints):
 * - GET /api/albums                                 - List all albums
 * - GET /api/albums/:albumId                        - Get album details
 * - POST /api/albums                                - Create new album
 * - PUT /api/albums/:albumId                        - Update album
 * - DELETE /api/albums/:albumId                     - Delete album
 * - POST /api/albums/:albumId/archive               - Archive/unarchive album
 * - POST /api/albums/:albumId/cover                 - Set album cover
 * - GET /api/albums/:albumId/stats                  - Album statistics
 * 
 * ALBUM PHOTOS MANAGEMENT (6 endpoints):
 * - GET /api/albums/:albumId/photos                 - Get album photos
 * - POST /api/albums/:albumId/photos                - Upload single photo
 * - POST /api/albums/:albumId/photos/bulk           - Bulk upload photos
 * - POST /api/albums/:albumId/photos/bulk-delete    - Bulk delete photos
 * - POST /api/albums/:albumId/photos/move           - Move photos to different album
 * 
 * INDIVIDUAL PHOTO MANAGEMENT (3 endpoints):
 * - GET /api/albums/:albumId/photos/:photoId        - Get photo details
 * - PUT /api/albums/:albumId/photos/:photoId        - Update photo
 * - DELETE /api/albums/:albumId/photos/:photoId     - Delete photo
 * 
 * GLOBAL PHOTO OPERATIONS (3 endpoints):
 * - GET /api/albums/photos/search                   - Search all photos
 * - GET /api/albums/photos/recent                   - Get recent photos
 * - GET /api/albums/photos/all                      - Get all photos
 * 
 * Features:
 * - Complete album lifecycle management
 * - Single & bulk photo upload capabilities
 * - Photo tagging with user mentions
 * - Album cover management
 * - Archive functionality
 * - Comprehensive search & filtering
 * - Full caching implementation
 * - Complete audit trail
 * - File cleanup on errors
 * - Admin-only access control
 */
