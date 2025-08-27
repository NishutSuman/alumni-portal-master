

// File 2: src/routes/admin/membershipAdmin.route.js
const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateToken, requireRole } = require('../../middleware/auth.middleware');
const { asyncHandler } = require('../../utils/response');
const {
  validateBatchMembershipSettings,
  validateGlobalMembershipSettings,
  validateBatchYearParam,
  validateBatchExists,
  validateMembershipSettingsConflict,
  validateMembershipYearNotPast
} = require('../../middleware/membership.validation.middleware');

const {
  validateBulkUpdateStatus,
  validateUpdateUserStatus,
  validateSendReminders,
  validateUserIdParam
} = require('../../middleware/membershipAdmin.validation.middleware');

// Import controllers
const membershipAdminController = require('../../controllers/membershipAdmin.controller');
// All routes require SUPER_ADMIN role
router.use(authenticateToken);
router.use(requireRole('SUPER_ADMIN'));

/**
 * Set batch-specific membership settings
 * POST /api/admin/membership/batch-settings/:batchYear
 * Access: SUPER_ADMIN
 */
router.post('/batch-settings/:batchYear',
  [
    validateBatchYearParam,
    validateBatchExists,
    validateBatchMembershipSettings,
    validateMembershipYearNotPast,
    validateMembershipSettingsConflict
  ],
  asyncHandler(membershipAdminController.setBatchMembershipSettings)
);

/**
 * Update batch-specific membership settings
 * PUT /api/admin/membership/batch-settings/:batchYear
 * Access: SUPER_ADMIN
 */
router.put('/batch-settings/:batchYear',
  [
    validateBatchYearParam,
    validateBatchExists,
    validateBatchMembershipSettings,
    validateMembershipYearNotPast,
    validateMembershipSettingsConflict
  ],
  asyncHandler(membershipAdminController.setBatchMembershipSettings)
);

/**
 * Set global membership settings
 * POST /api/admin/membership/global-settings
 * Access: SUPER_ADMIN
 */
router.post('/global-settings',
  [
    validateGlobalMembershipSettings,
    validateMembershipYearNotPast
  ],
  asyncHandler(membershipAdminController.setGlobalMembershipSettings)
);

/**
 * Update global membership settings
 * PUT /api/admin/membership/global-settings
 * Access: SUPER_ADMIN
 */
router.put('/global-settings',
  [
    validateGlobalMembershipSettings,
    validateMembershipYearNotPast
  ],
  asyncHandler(membershipAdminController.setGlobalMembershipSettings)
);

/**
 * Get membership overview and analytics
 * GET /api/admin/membership/overview
 * Access: SUPER_ADMIN
 */
router.get('/overview',
  asyncHandler(membershipAdminController.getMembershipOverview)
);

/**
 * Get expired users with pagination
 * GET /api/admin/membership/expired-users
 * Access: SUPER_ADMIN
 */
router.get('/expired-users',
  asyncHandler(membershipAdminController.getExpiredUsers)
);

/**
 * Bulk update membership status
 * POST /api/admin/membership/bulk-update-status
 * Access: SUPER_ADMIN
 */
router.post('/bulk-update-status',
  [
    validateBulkUpdateStatus
  ],
  asyncHandler(membershipAdminController.bulkUpdateMembershipStatus)
);

/**
 * Update individual user membership status
 * POST /api/admin/membership/users/:userId/status
 * Access: SUPER_ADMIN
 */
router.post('/users/:userId/status',
  [
    validateUserIdParam,
    validateUpdateUserStatus
  ],
  asyncHandler(membershipAdminController.updateUserMembershipStatus)
);

/**
 * Send membership reminder emails
 * POST /api/admin/membership/send-reminders
 * Access: SUPER_ADMIN
 */
router.post('/send-reminders',
  [
    validateSendReminders
  ],
  asyncHandler(membershipAdminController.sendMembershipReminders)
);

module.exports = router;