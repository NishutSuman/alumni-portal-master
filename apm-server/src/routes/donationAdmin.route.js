const express = require('express');
const router = express.Router();

const { authenticateToken, requireRole } = require('../../middleware/auth/auth.middleware');
const { asyncHandler } = require('../../utils/response');
const donationAdminController = require('../../controllers/admin/donationAdmin.controller');

// All routes require SUPER_ADMIN role
router.use(authenticateToken);
router.use(requireRole('SUPER_ADMIN'));

/**
 * Get all donations (admin)
 * GET /api/admin/donations
 */
router.get('/',
  asyncHandler(donationAdminController.getAllDonations)
);

/**
 * Get donation analytics (admin)
 * GET /api/admin/donations/analytics
 */
router.get('/analytics',
  asyncHandler(donationAdminController.getDonationAnalytics)
);

module.exports = router;