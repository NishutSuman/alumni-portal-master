// ==========================================
// TENANT EMAIL & PUSH NOTIFICATION CONFIGURATION ROUTES
// File: apm-server/src/routes/tenantConfig.route.js
// Multi-Tenant Email and Push Notification Configuration Management
// ==========================================

const express = require('express');
const router = express.Router();
const {
  authenticateToken,
  requireRole
} = require('../middleware/auth/auth.middleware');
const { asyncHandler } = require('../utils/response');
const tenantConfigController = require('../controllers/admin/tenantConfig.controller');

// ==========================================
// PUBLIC/USER ROUTES (Require authentication only)
// ==========================================

// Device token management - any authenticated user
router.post(
  '/device-token',
  authenticateToken,
  asyncHandler(tenantConfigController.registerDeviceToken)
);

router.delete(
  '/device-token',
  authenticateToken,
  asyncHandler(tenantConfigController.removeDeviceToken)
);

router.get(
  '/device-tokens',
  authenticateToken,
  asyncHandler(tenantConfigController.getUserDeviceTokens)
);

// ==========================================
// ADMIN ROUTES (Require SUPER_ADMIN role)
// ==========================================

// Apply authentication and admin role for all admin routes
const adminMiddleware = [
  authenticateToken,
  requireRole('SUPER_ADMIN')
];

// ==========================================
// EMAIL CONFIGURATION ROUTES
// ==========================================

/**
 * GET /api/tenant-config/admin/email
 * Get email configuration for the organization
 * Access: SUPER_ADMIN only
 */
router.get(
  '/admin/email',
  adminMiddleware,
  asyncHandler(tenantConfigController.getEmailConfig)
);

/**
 * POST /api/tenant-config/admin/email
 * Save/Update email configuration
 * Body: { provider, smtpHost, smtpPort, smtpUser, smtpPassword, fromEmail, fromName, ... }
 * Access: SUPER_ADMIN only
 */
router.post(
  '/admin/email',
  adminMiddleware,
  asyncHandler(tenantConfigController.saveEmailConfig)
);

/**
 * POST /api/tenant-config/admin/email/test
 * Test email configuration
 * Body: { testEmail?: string }
 * Access: SUPER_ADMIN only
 */
router.post(
  '/admin/email/test',
  adminMiddleware,
  asyncHandler(tenantConfigController.testEmailConfig)
);

/**
 * POST /api/tenant-config/admin/email/activate
 * Activate email configuration
 * Access: SUPER_ADMIN only
 */
router.post(
  '/admin/email/activate',
  adminMiddleware,
  asyncHandler(tenantConfigController.activateEmailConfig)
);

/**
 * POST /api/tenant-config/admin/email/deactivate
 * Deactivate email configuration (switch back to default)
 * Access: SUPER_ADMIN only
 */
router.post(
  '/admin/email/deactivate',
  adminMiddleware,
  asyncHandler(tenantConfigController.deactivateEmailConfig)
);

/**
 * GET /api/tenant-config/admin/email/stats
 * Get email usage statistics
 * Access: SUPER_ADMIN only
 */
router.get(
  '/admin/email/stats',
  adminMiddleware,
  asyncHandler(tenantConfigController.getEmailStats)
);

// ==========================================
// PUSH NOTIFICATION CONFIGURATION ROUTES
// ==========================================

/**
 * GET /api/tenant-config/admin/push
 * Get push notification configuration for the organization
 * Access: SUPER_ADMIN only
 */
router.get(
  '/admin/push',
  adminMiddleware,
  asyncHandler(tenantConfigController.getPushConfig)
);

/**
 * POST /api/tenant-config/admin/push
 * Save/Update push notification configuration
 * Body: { firebaseProjectId, firebaseClientEmail, firebasePrivateKey, ... }
 * Access: SUPER_ADMIN only
 */
router.post(
  '/admin/push',
  adminMiddleware,
  asyncHandler(tenantConfigController.savePushConfig)
);

/**
 * POST /api/tenant-config/admin/push/test
 * Test push notification configuration
 * Body: { testToken?: string }
 * Access: SUPER_ADMIN only
 */
router.post(
  '/admin/push/test',
  adminMiddleware,
  asyncHandler(tenantConfigController.testPushConfig)
);

/**
 * POST /api/tenant-config/admin/push/activate
 * Activate push notification configuration
 * Access: SUPER_ADMIN only
 */
router.post(
  '/admin/push/activate',
  adminMiddleware,
  asyncHandler(tenantConfigController.activatePushConfig)
);

/**
 * POST /api/tenant-config/admin/push/deactivate
 * Deactivate push notification configuration (switch back to default)
 * Access: SUPER_ADMIN only
 */
router.post(
  '/admin/push/deactivate',
  adminMiddleware,
  asyncHandler(tenantConfigController.deactivatePushConfig)
);

/**
 * GET /api/tenant-config/admin/push/stats
 * Get push notification usage statistics
 * Access: SUPER_ADMIN only
 */
router.get(
  '/admin/push/stats',
  adminMiddleware,
  asyncHandler(tenantConfigController.getPushStats)
);

module.exports = router;
