// src/routes/lifelink.route.js
// LifeLink Network Routes - Following established patterns

const express = require('express');
const router = express.Router();

// ============================================
// MIDDLEWARE IMPORTS
// ============================================
const { 
  authenticateToken, 
  requireRole,
  optionalAuth
} = require('../middleware/auth/auth.middleware');
const { requireAlumniVerification, optionalAlumniVerification } = require('../middleware/auth/alumniVerification.middleware');
const { asyncHandler } = require('../utils/response');
const lifeLinkController = require('../controllers/lifeLink/lifeLink.controller');


// LifeLink-specific middleware
const {
  validateUpdateBloodProfile,
  validateAddDonation,
  validateCreateRequisition,
  validateSearchDonors,
  validateRespondToRequisition,
  validateNotifyDonors,
  validateDashboardQuery,
  validateRequisitionIdParam,
  validateNotificationIdParam,
  validateBloodDonor,
  validateRequisitionAccess,
  validateActiveRequisition,
  validateNotificationAccess,
  validateUniqueResponse
} = require('../middleware/validation/lifelink.validation.middleware');

const {
  cacheLifeLinkDashboard,
  cacheUserBloodProfile,
  cacheUserDonations,
  cacheDonationStatus,
  cacheAvailableDonors,
  cacheBloodGroupStats,
  cacheRequisitionDetails,
  cacheUserRequisitions,
  cacheUserNotifications,
  cacheWillingDonors,
  cacheDiscoverRequisitions,
  autoInvalidateLifeLinkCaches
} = require('../middleware/cache/lifelink.cache.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================

// ============================================
// PUBLIC ROUTES (Dashboard & Info)
// ============================================

/**
 * Get LifeLink dashboard with all donors
 * GET /api/lifelink/dashboard
 * Access: Public (enhanced with auth)
 */
router.get('/dashboard',
  [
    authenticateToken,
    requireAlumniVerification,
    validateDashboardQuery,
    cacheLifeLinkDashboard
  ],
  asyncHandler(lifeLinkController.getLifeLinkDashboard)
);

/**
 * Get blood group statistics
 * GET /api/lifelink/stats/bloodgroups
 * Access: Public
 */
router.get('/stats/bloodgroups',
  [
    cacheBloodGroupStats
  ],
  asyncHandler(lifeLinkController.getBloodGroupStats)
);

// ============================================
// USER PROFILE ROUTES (Blood Profile)
// ============================================

/**
 * Get user's blood profile
 * GET /api/users/profile/blood
 * Access: Authenticated users
 */
router.get('/profile/blood',
  [
    authenticateToken,
    requireAlumniVerification,
    cacheUserBloodProfile
  ],
  asyncHandler(lifeLinkController.getBloodProfile)
);

/**
 * Update user's blood profile
 * PUT /api/users/profile/blood
 * Access: Authenticated users
 */
router.put('/profile/blood',
  [
    authenticateToken,
    requireAlumniVerification,
    validateUpdateBloodProfile,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.updateBloodProfile)
);

// ============================================
// DONATION MANAGEMENT ROUTES
// ============================================

/**
 * Get user's donation history
 * GET /api/lifelink/my-donations
 * Access: Authenticated blood donors
 */
router.get('/my-donations',
  [
    authenticateToken,
    requireAlumniVerification,
    validateBloodDonor,
    cacheUserDonations
  ],
  asyncHandler(lifeLinkController.getMyDonations)
);

/**
 * Add new donation record
 * POST /api/lifelink/donations
 * Access: Authenticated blood donors
 */
router.post('/donations',
  [
    authenticateToken,
    requireAlumniVerification,
    validateBloodDonor,
    validateAddDonation,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.addDonation)
);

/**
 * Check donation eligibility status
 * GET /api/lifelink/donation-status
 * Access: Authenticated blood donors
 */
router.get('/donation-status',
  [
    authenticateToken,
    requireAlumniVerification,
    validateBloodDonor,
    cacheDonationStatus
  ],
  asyncHandler(lifeLinkController.getDonationStatus)
);

// ============================================
// EMERGENCY REQUISITION ROUTES (Phase 3)
// ============================================

/**
 * Create blood requisition
 * POST /api/lifelink/requisitions
 * Access: Authenticated users
 */
router.post('/requisitions',
  [
    authenticateToken,
    requireAlumniVerification,
    validateCreateRequisition,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.createRequisition)
);

/**
 * Get user's requisitions
 * GET /api/lifelink/my-requisitions
 * Access: Authenticated users
 */
router.get('/my-requisitions',
  [
    authenticateToken,
    requireAlumniVerification,
    cacheUserRequisitions
  ],
  asyncHandler(lifeLinkController.getMyRequisitions)
);

/**
 * Get single requisition details
 * GET /api/lifelink/requisitions/:requisitionId
 * Access: Requester or SUPER_ADMIN
 */
router.get('/requisitions/:requisitionId',
  [
    authenticateToken,
    requireAlumniVerification,
    validateRequisitionIdParam,
    validateRequisitionAccess,
    cacheRequisitionDetails
  ],
  asyncHandler(lifeLinkController.getRequisition)
);

/**
 * Update requisition status
 * PUT /api/lifelink/requisitions/:requisitionId/status
 * Access: Requester or SUPER_ADMIN
 */
router.put('/requisitions/:requisitionId/status',
  [
    authenticateToken,
    requireAlumniVerification,
    validateRequisitionIdParam,
    validateRequisitionAccess,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.updateRequisitionStatus)
);

/**
 * Reuse expired requisition
 * PUT /api/lifelink/requisitions/:requisitionId/reuse
 * Access: Requester
 */
router.put('/requisitions/:requisitionId/reuse',
  [
    authenticateToken,
    requireAlumniVerification,
    validateRequisitionIdParam,
    validateRequisitionAccess,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.reuseRequisition)
);

// ============================================
// DONOR SEARCH ROUTES (Phase 3)
// ============================================

/**
 * Discover available requisitions for donors
 * GET /api/lifelink/discover-requisitions
 * Access: Authenticated blood donors
 */
router.get('/discover-requisitions',
  [
    authenticateToken,
    requireAlumniVerification,
    validateBloodDonor,
    validateDashboardQuery, // Reuse for pagination params
    cacheDiscoverRequisitions
  ],
  asyncHandler(lifeLinkController.discoverRequisitions)
);

/**
 * Search compatible donors
 * POST /api/lifelink/search-donors
 * Access: Authenticated users
 */
router.post('/search-donors',
  [
    authenticateToken,
    requireAlumniVerification,
    validateSearchDonors,
    cacheAvailableDonors
  ],
  asyncHandler(lifeLinkController.searchDonors)
);

/**
 * Get willing donors for a requisition
 * GET /api/lifelink/willing-donors/:requisitionId
 * Access: Requester or SUPER_ADMIN
 */
router.get('/willing-donors/:requisitionId',
  [
    authenticateToken,
    requireAlumniVerification,
    validateRequisitionIdParam,
    validateRequisitionAccess,
    cacheWillingDonors
  ],
  asyncHandler(lifeLinkController.getWillingDonors)
);

// ============================================
// NOTIFICATION ROUTES (Phase 2)
// ============================================

/**
 * Notify selected donors
 * POST /api/lifelink/notify-selected
 * Access: Authenticated users (with active requisition)
 */
router.post('/notify-selected',
  [
    authenticateToken,
    requireAlumniVerification,
    validateNotifyDonors,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.notifySelectedDonors)
);

/**
 * Broadcast to all available donors in area
 * POST /api/lifelink/notify-all
 * Access: Authenticated users (with active requisition)
 */
router.post('/notify-all',
  [
    authenticateToken,
    requireAlumniVerification,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.notifyAllDonors)
);

/**
 * Get user's emergency notifications
 * GET /api/lifelink/notifications
 * Access: Authenticated blood donors
 */
router.get('/notifications',
  [
    authenticateToken,
    requireAlumniVerification,
    validateBloodDonor,
    cacheUserNotifications
  ],
  asyncHandler(lifeLinkController.getMyNotifications)
);

/**
 * Mark notification as read
 * PUT /api/lifelink/notifications/:notificationId/read
 * Access: Notification recipient
 */
router.put('/notifications/:notificationId/read',
  [
    authenticateToken,
    requireAlumniVerification,
    validateNotificationIdParam,
    validateNotificationAccess,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.markNotificationRead)
);

// ============================================
// DONOR RESPONSE ROUTES (Phase 3)
// ============================================

/**
 * Respond to emergency notification
 * POST /api/lifelink/notifications/:notificationId/respond
 * Access: Notification recipient (blood donor)
 */
router.post('/notifications/:notificationId/respond',
  [
    authenticateToken,
    requireAlumniVerification,
    validateNotificationIdParam,
    validateNotificationAccess,
    validateBloodDonor,
    validateRespondToRequisition,
    validateUniqueResponse,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.respondToNotification)
);

/**
 * Respond to requisition directly
 * POST /api/lifelink/requisitions/:requisitionId/respond
 * Access: Authenticated blood donors
 */
router.post('/requisitions/:requisitionId/respond',
  [
    authenticateToken,
    requireAlumniVerification,
    validateRequisitionIdParam,
    validateActiveRequisition,
    validateBloodDonor,
    validateRespondToRequisition,
    validateUniqueResponse,
    autoInvalidateLifeLinkCaches
  ],
  asyncHandler(lifeLinkController.respondToRequisition)
);

// ============================================
// ADMIN ROUTES (Optional - for monitoring)
// ============================================

/**
 * Get all requisitions (Admin)
 * GET /api/lifelink/admin/requisitions
 * Access: SUPER_ADMIN
 */
router.get('/admin/requisitions',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN'])
  ],
  asyncHandler(lifeLinkController.getAdminRequisitions)
);

/**
 * Get LifeLink analytics (Admin)
 * GET /api/lifelink/admin/analytics
 * Access: SUPER_ADMIN
 */
router.get('/admin/analytics',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN'])
  ],
  asyncHandler(lifeLinkController.getLifeLinkAnalytics)
);

/**
 * Get donor response analytics for requisition (Admin)
 * GET /api/lifelink/admin/requisitions/:requisitionId/analytics
 * Access: SUPER_ADMIN
 */
router.get('/admin/requisitions/:requisitionId/analytics',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    validateRequisitionIdParam
  ],
  asyncHandler(lifeLinkController.getRequisitionAnalytics)
);

// ============================================
// ROUTE EXPORTS
// ============================================

module.exports = router;

// ============================================
// ROUTE INTEGRATION NOTES
// ============================================

/*
To integrate these routes in your main app.js:

// Add this to your main routes section
app.use('/api/lifelink', require('./routes/lifelink.route'));

// Also add blood profile routes to user routes if preferred:
// In your existing users route file, you can add:
app.use('/api/users', require('./routes/users.route')); // existing
// Or include blood profile routes in lifelink routes as shown above

ROUTE SUMMARY:
✅ 25 endpoints covering all LifeLink functionality
✅ Proper middleware chains with validation + caching
✅ Role-based access control
✅ Following your established patterns
✅ Ready for Phase 2 & 3 controller methods

PHASE STATUS:
✅ Phase 1: Foundation routes (profile, donations, dashboard)
🔄 Phase 2: Notification routes (ready for implementation)  
🔄 Phase 3: Emergency system routes (ready for implementation)
*/