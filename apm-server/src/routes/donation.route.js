const express = require('express');
const router = express.Router();

// Middleware
const { authenticateToken } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/response');
const { 
  validateInitiateDonation, 
  validateDonationQuery 
} = require('../middleware/donation.validation.middleware');

// Controller
const donationController = require('../controllers/donation.controller');

// ============================================
// DONATION ROUTES (ALL REQUIRE AUTHENTICATION)
// ============================================

/**
 * Initiate organization donation
 * POST /api/donations
 * Access: Authenticated Alumni Only
 */
router.post('/',
  [
    authenticateToken, // Must be logged in
    validateInitiateDonation
  ],
  asyncHandler(donationController.initiateDonation)
);

/**
 * Get my donation history
 * GET /api/donations/my-donations
 * Access: Authenticated Alumni Only
 */
router.get('/my-donations',
  [
    authenticateToken,
    validateDonationQuery
  ],
  asyncHandler(donationController.getMyDonations)
);

/**
 * Get organization donation statistics
 * GET /api/donations/organization-stats
 * Access: Authenticated Alumni Only (for transparency)
 */
router.get('/organization-stats',
  [
    authenticateToken
  ],
  asyncHandler(donationController.getOrganizationStats)
);

module.exports = router;
