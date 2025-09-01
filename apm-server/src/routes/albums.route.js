// src/routes/albums.route.js
const express = require('express');
const router = express.Router();

// ============================================
// MIDDLEWARE IMPORTS
// ============================================
const { 
  authenticateToken, 
  requireRole 
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
// ADMIN-ONLY MIDDLEWARE
// All album routes require SUPER_ADMIN access
// ============================================
router.use(authenticateToken);
router.use(requireRole('SUPER_ADMIN'));

// ============================================
// ALBUM MANAGEMENT ROUTES
// ============================================

/**
 * Get all albums with pagination and filtering
 * GET /api/albums
 */
router.get('/',
  [
    cacheAlbumsList
  ],
  asyncHandler(albumController.getAlbums)
);

/**
 * Get single album with photos
 * GET /api/albums/:albumId
 */
router.get('/:albumId',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    cacheAlbumDetails
  ],
  asyncHandler(albumController.getAlbum)
);

/**
 * Create new album (with optional cover image)
 * POST /api/albums
 */
router.post('/',
  [
    uploadAlbumCover,
    handleUploadError,
    validateCreateAlbum,
    validateAlbumNameUnique,
    autoInvalidateAlbumCaches
  ],
  asyncHandler(albumController.createAlbum)
);

/**
 * Update album details (with optional cover image)
 * PUT /api/albums/:albumId
 */
router.put('/:albumId',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    uploadAlbumCover,
    handleUploadError,
    validateUpdateAlbum,
    validateAlbumNameUnique,
    autoInvalidateAlbumCaches
  ],
  asyncHandler(albumController.updateAlbum)
);

/**
 * Delete album and all its photos
 * DELETE /api/albums/:albumId
 */
router.delete('/:albumId',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    autoInvalidateAlbumCaches,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(albumController.deleteAlbum)
);

/**
 * Archive/Unarchive album
 * POST /api/albums/:albumId/archive
 */
router.post('/:albumId/archive',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    autoInvalidateAlbumCaches
  ],
  asyncHandler(albumController.toggleArchiveAlbum)
);

/**
 * Set album cover from existing photo
 * POST /api/albums/:albumId/cover
 */
router.post('/:albumId/cover',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    validateSetCover,
    autoInvalidateAlbumCaches
  ],
  asyncHandler(albumController.setAlbumCover)
);

/**
 * Get album statistics
 * GET /api/albums/:albumId/stats
 */
router.get('/:albumId/stats',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    cacheAlbumStats
  ],
  asyncHandler(albumController.getAlbumStats)
);

// ============================================
// ALBUM PHOTOS MANAGEMENT ROUTES
// ============================================

/**
 * Get photos in album with pagination
 * GET /api/albums/:albumId/photos
 */
router.get('/:albumId/photos',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    cacheAlbumPhotos
  ],
  asyncHandler(photoController.getPhotos) // Uses albumId filter from query
);

/**
 * Upload single photo to album
 * POST /api/albums/:albumId/photos
 */
router.post('/:albumId/photos',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    uploadSinglePhoto,
    handleUploadError,
    validatePhotoUpload,
    autoInvalidateAlbumCaches,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.uploadPhotoToAlbum)
);

/**
 * Bulk upload photos to album
 * POST /api/albums/:albumId/photos/bulk
 */
router.post('/:albumId/photos/bulk',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    uploadAlbumPhotos,
    handleUploadError,
    validateBulkUploadPhotos,
    validatePhotoUpload,
    autoInvalidateAlbumCaches,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.bulkUploadPhotos)
);

// ============================================
// INDIVIDUAL PHOTO ROUTES (within album context)
// ============================================

/**
 * Get specific photo in album
 * GET /api/albums/:albumId/photos/:photoId
 */
router.get('/:albumId/photos/:photoId',
  [
    validateAlbumIdParam,
    validatePhotoIdParam,
    validateAlbumAccess,
    validatePhotoAccess,
    cachePhotoDetails
  ],
  asyncHandler(photoController.getPhoto)
);

/**
 * Update photo details (caption, tags)
 * PUT /api/albums/:albumId/photos/:photoId
 */
router.put('/:albumId/photos/:photoId',
  [
    validateAlbumIdParam,
    validatePhotoIdParam,
    validateAlbumAccess,
    validatePhotoAccess,
    validateUpdatePhoto,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.updatePhoto)
);

/**
 * Delete specific photo from album
 * DELETE /api/albums/:albumId/photos/:photoId
 */
router.delete('/:albumId/photos/:photoId',
  [
    validateAlbumIdParam,
    validatePhotoIdParam,
    validateAlbumAccess,
    validatePhotoAccess,
    autoInvalidateAlbumCaches,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.deletePhoto)
);

// ============================================
// BULK PHOTO OPERATIONS
// ============================================

/**
 * Bulk delete photos from album
 * POST /api/albums/:albumId/photos/bulk-delete
 */
router.post('/:albumId/photos/bulk-delete',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    validateBulkDeletePhotos,
    autoInvalidateAlbumCaches,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.bulkDeletePhotos)
);

/**
 * Move photos to different album
 * POST /api/albums/:albumId/photos/move
 */
router.post('/:albumId/photos/move',
  [
    validateAlbumIdParam,
    validateAlbumAccess,
    validateMovePhotos,
    autoInvalidateAlbumCaches,
    autoInvalidatePhotoCaches
  ],
  asyncHandler(photoController.movePhotos)
);

// ============================================
// GLOBAL PHOTO ROUTES (across all albums)
// ============================================

/**
 * Search photos across all albums
 * GET /api/albums/photos/search
 */
router.get('/photos/search',
  [
    cachePhotoSearch
  ],
  asyncHandler(photoController.searchPhotos)
);

/**
 * Get recent photos across all albums
 * GET /api/albums/photos/recent
 */
router.get('/photos/recent',
  [
    cacheRecentPhotos
  ],
  asyncHandler(photoController.getRecentPhotos)
);

/**
 * Get all photos across all albums (admin view)
 * GET /api/albums/photos/all
 */
router.get('/photos/all',
  [
    cachePhotoSearch
  ],
  asyncHandler(photoController.getPhotos)
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
