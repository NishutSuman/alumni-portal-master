// File 1: src/routes/membership.route.js
const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateToken } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/response');

const { 
  requireAlumniVerification,
  optionalAlumniVerification 
} = require('../middleware/alumniVerification.middleware');

const { 
  checkMembershipStatus, 
  membershipRateLimit 
} = require('../middleware/membership.middleware');
const {
  validateMembershipPayment
} = require('../middleware/membership.validation.middleware');

// Import controllers
const membershipController = require('../controllers/membership.controller');

/**
 * Get user's membership status and fee information
 * GET /api/membership/status
 * Access: Authenticated users
 */
router.get('/status',
  authenticateToken,
  optionalAlumniVerification,
  asyncHandler(membershipController.getMembershipStatus)
);

/**
 * Get applicable membership fee for user's batch
 * GET /api/membership/fee
 * Access: Authenticated users
 */
router.get('/fee',
  authenticateToken,
  optionalAlumniVerification,
  asyncHandler(membershipController.getMembershipFee)
);

/**
 * Initiate membership payment
 * POST /api/membership/pay
 * Access: Authenticated users
 */
router.post('/pay',
  authenticateToken,
  requireAlumniVerification,
  membershipRateLimit,
  validateMembershipPayment,
  asyncHandler(membershipController.initiateMembershipPayment)
);

module.exports = router;
