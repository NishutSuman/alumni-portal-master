// src/routes/sponsors.route.js
const express = require('express');
const router = express.Router();

// ============================================
// MIDDLEWARE IMPORTS
// ============================================
const { 
  authenticateToken, 
  requireRole,
  optionalAuth
} = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/response');

// Upload middleware
const {
  uploadSponsorLogo,
  uploadSponsorHeadPhoto,
  uploadSponsorFiles,
  handleUploadError
} = require('../middleware/upload.middleware');

// Sponsor-specific middleware
const {
  validateCreateSponsor,
  validateUpdateSponsor,
  validateReorderSponsors,
  validateSponsorIdParam,
  validateSponsorListQuery,
  validateSponsorNameUnique,
  validateSponsorAccess,
  validateSponsorFileUpload
} = require('../middleware/sponsor.validation.middleware');

const {
  cacheSponsorsList,
  cacheSponsorDetails,
  cacheSponsorStats,
  cachePublicSponsors,
  cacheSponsorsByCategory,
  autoInvalidateSponsorCaches,
  autoInvalidateSponsorImageCaches
} = require('../middleware/sponsor.cache.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================
const sponsorController = require('../controllers/sponsor.controller');

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * Get public sponsors (for website display)
 * GET /api/sponsors/public
 * Access: Public
 */
router.get('/public',
  [
    optionalAuth,
    cachePublicSponsors
  ],
  asyncHandler(sponsorController.getPublicSponsors)
);

/**
 * Get sponsors grouped by category
 * GET /api/sponsors/by-category
 * Access: Public
 */
router.get('/by-category',
  [
    optionalAuth,
    cacheSponsorsByCategory
  ],
  asyncHandler(sponsorController.getSponsorsByCategory)
);

// ============================================
// PROTECTED ROUTES (SUPER_ADMIN ONLY)
// All management routes require SUPER_ADMIN access
// ============================================
router.use(authenticateToken);
router.use(requireRole('SUPER_ADMIN'));

// ============================================
// SPONSOR MANAGEMENT ROUTES
// ============================================

/**
 * Get all sponsors with filtering and pagination
 * GET /api/sponsors
 * Access: SUPER_ADMIN
 */
router.get('/',
  [
    validateSponsorListQuery,
    cacheSponsorsList
  ],
  asyncHandler(sponsorController.getSponsors)
);

/**
 * Get sponsor statistics
 * GET /api/sponsors/statistics
 * Access: SUPER_ADMIN
 */
router.get('/statistics',
  [
    cacheSponsorStats
  ],
  asyncHandler(sponsorController.getSponsorStatistics)
);

/**
 * Create new sponsor (with optional file uploads)
 * POST /api/sponsors
 * Access: SUPER_ADMIN
 */
router.post('/',
  [
    uploadSponsorFiles, // Handle logo and head photo upload
    handleUploadError,
    validateSponsorFileUpload,
    validateCreateSponsor,
    validateSponsorNameUnique,
    autoInvalidateSponsorCaches
  ],
  asyncHandler(sponsorController.createSponsor)
);

/**
 * Reorder sponsors
 * POST /api/sponsors/reorder
 * Access: SUPER_ADMIN
 */
router.post('/reorder',
  [
    validateReorderSponsors,
    autoInvalidateSponsorCaches
  ],
  asyncHandler(sponsorController.reorderSponsors)
);

/**
 * Get single sponsor with details
 * GET /api/sponsors/:sponsorId
 * Access: SUPER_ADMIN
 */
router.get('/:sponsorId',
  [
    validateSponsorIdParam,
    validateSponsorAccess,
    cacheSponsorDetails
  ],
  asyncHandler(sponsorController.getSponsor)
);

/**
 * Update sponsor details
 * PUT /api/sponsors/:sponsorId
 * Access: SUPER_ADMIN
 */
router.put('/:sponsorId',
  [
    validateSponsorIdParam,
    validateSponsorAccess,
    validateUpdateSponsor,
    validateSponsorNameUnique,
    autoInvalidateSponsorCaches
  ],
  asyncHandler(sponsorController.updateSponsor)
);

/**
 * Delete sponsor
 * DELETE /api/sponsors/:sponsorId
 * Access: SUPER_ADMIN
 */
router.delete('/:sponsorId',
  [
    validateSponsorIdParam,
    validateSponsorAccess,
    autoInvalidateSponsorCaches
  ],
  asyncHandler(sponsorController.deleteSponsor)
);

// ============================================
// FILE UPLOAD ROUTES
// ============================================

/**
 * Upload sponsor logo
 * POST /api/sponsors/:sponsorId/logo
 * Access: SUPER_ADMIN
 */
router.post('/:sponsorId/logo',
  [
    validateSponsorIdParam,
    validateSponsorAccess,
    uploadSponsorLogo,
    handleUploadError,
    validateSponsorFileUpload,
    autoInvalidateSponsorImageCaches
  ],
  asyncHandler(sponsorController.uploadSponsorLogo)
);

/**
 * Upload sponsor head photo
 * POST /api/sponsors/:sponsorId/head-photo
 * Access: SUPER_ADMIN
 */
router.post('/:sponsorId/head-photo',
  [
    validateSponsorIdParam,
    validateSponsorAccess,
    uploadSponsorHeadPhoto,
    handleUploadError,
    validateSponsorFileUpload,
    autoInvalidateSponsorImageCaches
  ],
  asyncHandler(sponsorController.uploadSponsorHeadPhoto)
);

// ============================================
// ERROR HANDLING
// ============================================

// Handle undefined sponsor routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Sponsor route not found: ${req.method} ${req.baseUrl}${req.path}`,
    availableRoutes: {
      sponsors: 'GET /api/sponsors',
      publicSponsors: 'GET /api/sponsors/public',
      sponsorsByCategory: 'GET /api/sponsors/by-category',
      sponsorDetails: 'GET /api/sponsors/:sponsorId',
      createSponsor: 'POST /api/sponsors',
      uploadLogo: 'POST /api/sponsors/:sponsorId/logo',
      uploadHeadPhoto: 'POST /api/sponsors/:sponsorId/head-photo',
      statistics: 'GET /api/sponsors/statistics'
    }
  });
});

module.exports = router;