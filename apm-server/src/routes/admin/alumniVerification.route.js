// ==========================================
// STEP 7: ALUMNI VERIFICATION API ROUTES
// File: apm-server/src/routes/admin/alumniVerification.route.js
// ==========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateToken, requireRole } = require('../../middleware/auth/auth.middleware');
const { asyncHandler } = require('../../utils/response');
const {
  validateBatchAdminVerificationPermission,
  verificationRateLimit,
  validateVerificationRequest,
  addVerificationContext
} = require('../../middleware/auth/alumniVerification.middleware');

// Import controllers
const alumniVerificationController = require('../../controllers/admin/alumniVerification.controller');
const emailBlacklistController = require('../../controllers/admin/emailBlacklist.controller');

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// ALUMNI VERIFICATION MANAGEMENT
// ==========================================

/**
 * Get pending verification users
 * GET /api/admin/verification/pending
 * Access: SUPER_ADMIN (all batches), BATCH_ADMIN (own batches only)
 * Query params: ?page=1&limit=20&batch=2020&search=john
 */
router.get('/pending',
  requireRole(['SUPER_ADMIN', 'BATCH_ADMIN']),
  addVerificationContext,
  asyncHandler(alumniVerificationController.getPendingVerifications)
);

/**
 * Get verification statistics and analytics
 * GET /api/admin/verification/stats
 * Access: SUPER_ADMIN (all batches), BATCH_ADMIN (own batches only)
 * Query params: ?timeframe=30 (days)
 */
router.get('/stats',
  requireRole(['SUPER_ADMIN', 'BATCH_ADMIN']),
  addVerificationContext,
  asyncHandler(alumniVerificationController.getVerificationStats)
);

/**
 * Get verification details for specific user
 * GET /api/admin/verification/users/:userId
 * Access: SUPER_ADMIN (any user), BATCH_ADMIN (own batch users only)
 */
router.get('/users/:userId',
  requireRole(['SUPER_ADMIN', 'BATCH_ADMIN']),
  validateBatchAdminVerificationPermission,
  asyncHandler(alumniVerificationController.getVerificationDetails)
);

/**
 * Verify alumni user (APPROVE)
 * POST /api/admin/verification/users/:userId/verify
 * Body: { notes?: string }
 * Access: SUPER_ADMIN (any user), BATCH_ADMIN (own batch users only)
 */
router.post('/users/:userId/verify',
  requireRole(['SUPER_ADMIN', 'BATCH_ADMIN']),
  validateVerificationRequest,
  validateBatchAdminVerificationPermission,
  verificationRateLimit,
  asyncHandler(alumniVerificationController.verifyAlumniUser)
);

/**
 * Reject alumni user
 * POST /api/admin/verification/users/:userId/reject  
 * Body: { reason: string (required) }
 * Access: SUPER_ADMIN (any user), BATCH_ADMIN (own batch users only)
 */
router.post('/users/:userId/reject',
  requireRole(['SUPER_ADMIN', 'BATCH_ADMIN']),
  validateVerificationRequest,
  validateBatchAdminVerificationPermission,
  verificationRateLimit,
  asyncHandler(alumniVerificationController.rejectAlumniUser)
);

/**
 * Bulk verify multiple users
 * POST /api/admin/verification/bulk-verify
 * Body: { userIds: string[], notes?: string }
 * Access: SUPER_ADMIN only
 */
router.post('/bulk-verify',
  requireRole('SUPER_ADMIN'),
  verificationRateLimit,
  asyncHandler(alumniVerificationController.bulkVerifyUsers)
);

// ==========================================
// EMAIL BLACKLIST MANAGEMENT
// Access: SUPER_ADMIN only
// ==========================================

/**
 * Get all blacklisted emails
 * GET /api/admin/verification/blacklist
 * Query params: ?page=1&limit=20&search=email&status=active&sortBy=blacklistedAt&sortOrder=desc
 * Access: SUPER_ADMIN only
 */
router.get('/blacklist',
  requireRole('SUPER_ADMIN'),
  asyncHandler(emailBlacklistController.getBlacklistedEmails)
);

/**
 * Get blacklist statistics  
 * GET /api/admin/verification/blacklist/stats
 * Access: SUPER_ADMIN only
 */
router.get('/blacklist/stats',
  requireRole('SUPER_ADMIN'),
  asyncHandler(emailBlacklistController.getBlacklistStats)
);

/**
 * Check if specific email is blacklisted
 * GET /api/admin/verification/blacklist/check/:email
 * Access: SUPER_ADMIN only
 */
router.get('/blacklist/check/:email',
  requireRole('SUPER_ADMIN'),
  asyncHandler(emailBlacklistController.checkEmailStatus)
);

/**
 * Manually add email to blacklist
 * POST /api/admin/verification/blacklist
 * Body: { email: string, reason: string }
 * Access: SUPER_ADMIN only
 */
router.post('/blacklist',
  requireRole('SUPER_ADMIN'),
  asyncHandler(emailBlacklistController.addToBlacklist)
);

/**
 * Remove email from blacklist (allow registration again)
 * DELETE /api/admin/verification/blacklist/:emailId
 * Body: { reason?: string }
 * Access: SUPER_ADMIN only
 */
router.delete('/blacklist/:emailId',
  requireRole('SUPER_ADMIN'),
  asyncHandler(emailBlacklistController.removeFromBlacklist)
);

/**
 * Bulk remove emails from blacklist
 * POST /api/admin/verification/blacklist/bulk-remove
 * Body: { emailIds: string[], reason?: string }
 * Access: SUPER_ADMIN only
 */
router.post('/blacklist/bulk-remove',
  requireRole('SUPER_ADMIN'),
  asyncHandler(emailBlacklistController.bulkRemoveFromBlacklist)
);

/**
 * Export blacklisted emails
 * GET /api/admin/verification/blacklist/export
 * Query params: ?status=active&format=json
 * Access: SUPER_ADMIN only
 */
router.get('/blacklist/export',
  requireRole('SUPER_ADMIN'),
  asyncHandler(emailBlacklistController.exportBlacklistedEmails)
);

module.exports = router;