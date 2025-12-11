// src/routes/demo.route.js - Public Demo/Showcase Routes
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/response');
const marqueeController = require('../controllers/demo/marquee.controller');

// Import tenant middleware for multi-tenant isolation
const { optionalTenantMiddleware } = require('../middleware/tenant.middleware');

// ==========================================
// MARQUEE PROFILE PICTURES - PUBLIC ENDPOINT
// ==========================================

/**
 * GET /api/demo/marquee-profiles
 * Public endpoint to fetch 16 profile pictures for marquee display
 * - Returns mix of real user profiles + dummy images
 * - Tenant-isolated: Only shows profiles from same organization
 * - Cached for 7 days in Redis
 * - No authentication required (public showcase)
 */
router.get(
  '/marquee-profiles',
  optionalTenantMiddleware, // Extract organizationId from subdomain/header
  asyncHandler(marqueeController.getMarqueeProfiles)
);

module.exports = router;
