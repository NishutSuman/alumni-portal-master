// src/routes/announcements.route.js
// System Announcements Routes

const express = require('express');
const router = express.Router();
const {
  authenticateToken,
  requireRole,
} = require('../middleware/auth/auth.middleware');
const { requireAlumniVerification } = require('../middleware/auth/alumniVerification.middleware');
const { asyncHandler } = require('../utils/response');
const announcementController = require('../controllers/announcement/announcement.controller');

// ============================================
// PUBLIC/USER ROUTES
// ============================================

/**
 * Get active announcements (for dashboard)
 * GET /api/announcements/active
 * Access: Authenticated users
 */
router.get(
  '/active',
  [authenticateToken, requireAlumniVerification],
  asyncHandler(announcementController.getActiveAnnouncements)
);

/**
 * Get all announcements (user history view)
 * GET /api/announcements
 * Access: Authenticated users
 */
router.get(
  '/',
  [authenticateToken, requireAlumniVerification],
  asyncHandler(announcementController.getAnnouncements)
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * Get all announcements (admin view with all statuses)
 * GET /api/announcements/admin
 * Access: SUPER_ADMIN
 */
router.get(
  '/admin',
  [authenticateToken, requireRole(['SUPER_ADMIN'])],
  asyncHandler(announcementController.getAdminAnnouncements)
);

/**
 * Create a new announcement
 * POST /api/announcements
 * Access: SUPER_ADMIN
 */
router.post(
  '/',
  [authenticateToken, requireRole(['SUPER_ADMIN'])],
  asyncHandler(announcementController.createAnnouncement)
);

/**
 * Toggle announcement active status
 * PATCH /api/announcements/:id/toggle
 * Access: SUPER_ADMIN
 */
router.patch(
  '/:id/toggle',
  [authenticateToken, requireRole(['SUPER_ADMIN'])],
  asyncHandler(announcementController.toggleAnnouncementStatus)
);

/**
 * Delete announcement
 * DELETE /api/announcements/:id
 * Access: SUPER_ADMIN
 */
router.delete(
  '/:id',
  [authenticateToken, requireRole(['SUPER_ADMIN'])],
  asyncHandler(announcementController.deleteAnnouncement)
);

module.exports = router;
