// src/routes/celebrations.route.js
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
const { 
  requireAlumniVerification, 
  optionalAlumniVerification 
} = require('../middleware/auth/alumniVerification.middleware');
const { asyncHandler } = require('../utils/response');

// Celebration-specific middleware
const {
  validateUpcomingBirthdays,
  validateUpcomingFestivals,
  validateMonthBirthdays,
  validateSearchFestivals,
  validateFestivalCalendar,
  validateFestivalIdParam,
  validateToggleNotifications,
  validateSyncHistory,
  validateNotificationHistory,
  validateFestivalAccess,
  validateSyncRateLimit
} = require('../middleware/validation/celebration.validation.middleware');

// Cache middleware
const {
  cacheTodaysBirthdays,
  cacheUpcomingBirthdays,
  cacheTodaysFestivals,
  cacheUpcomingFestivals,
  cacheTodaysCelebrations,
  cacheBirthdayStats,
  cacheFestivalStats,
  cacheCelebrationSummary,
  cacheFestivalCalendar,
  cacheBirthdayDistribution,
  cacheBirthdaysInMonth,
  cacheFestivalSearch,
  autoInvalidateCelebrationCaches,
  autoInvalidateFestivalCaches,
  autoInvalidateBirthdayCaches
} = require('../middleware/cache/celebration.cache.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================
const celebrationController = require('../controllers/celebrations/birthday.controller');

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * Get today's festivals (public access for website)
 * GET /api/celebrations/festivals/today
 * Access: Public (with optional auth)
 */
router.get('/festivals/today',
  [
    optionalAuth,
    cacheTodaysFestivals
  ],
  asyncHandler(celebrationController.getTodaysFestivals)
);

/**
 * Get upcoming festivals (public access)
 * GET /api/celebrations/festivals/upcoming
 * Access: Public (with optional auth)
 */
router.get('/festivals/upcoming',
  [
    optionalAuth,
    validateUpcomingFestivals,
    cacheUpcomingFestivals
  ],
  asyncHandler(celebrationController.getUpcomingFestivals)
);

// ============================================
// AUTHENTICATED USER ROUTES
// ============================================

/**
 * Get today's birthdays
 * GET /api/celebrations/birthdays/today
 * Access: Authenticated users
 */
router.get('/birthdays/today',
  [
    authenticateToken,
    requireAlumniVerification,
    cacheTodaysBirthdays
  ],
  asyncHandler(celebrationController.getTodaysBirthdays)
);

/**
 * Get upcoming birthdays
 * GET /api/celebrations/birthdays/upcoming
 * Access: Authenticated users
 */
router.get('/birthdays/upcoming',
  [
    authenticateToken,
    requireAlumniVerification,
    validateUpcomingBirthdays,
    cacheUpcomingBirthdays
  ],
  asyncHandler(celebrationController.getUpcomingBirthdays)
);

/**
 * Get combined today's celebrations (birthdays + festivals)
 * GET /api/celebrations/today
 * Access: Authenticated users
 */
router.get('/today',
  [
    authenticateToken,
    requireAlumniVerification,
    cacheTodaysCelebrations
  ],
  asyncHandler(celebrationController.getTodaysCelebrations)
);

/**
 * Search festivals
 * GET /api/celebrations/festivals/search
 * Access: Authenticated users
 */
router.get('/festivals/search',
  [
    authenticateToken,
    requireAlumniVerification,
    validateSearchFestivals,
    cacheFestivalSearch
  ],
  asyncHandler(celebrationController.searchFestivals)
);

/**
 * Get festival calendar for year
 * GET /api/celebrations/festivals/calendar
 * Access: Authenticated users
 */
router.get('/festivals/calendar',
  [
    authenticateToken,
    requireAlumniVerification,
    validateFestivalCalendar,
    cacheFestivalCalendar
  ],
  asyncHandler(celebrationController.getFestivalCalendar)
);

// ============================================
// ADMIN ROUTES - STATISTICS & ANALYTICS
// ============================================

/**
 * Get birthday statistics (Admin)
 * GET /api/celebrations/admin/birthdays/stats
 * Access: SUPER_ADMIN
 */
router.get('/admin/birthdays/stats',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cacheBirthdayStats
  ],
  asyncHandler(celebrationController.getBirthdayStats)
);

/**
 * Get birthday distribution by month (Admin)
 * GET /api/celebrations/admin/birthdays/distribution
 * Access: SUPER_ADMIN
 */
router.get('/admin/birthdays/distribution',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cacheBirthdayDistribution
  ],
  asyncHandler(celebrationController.getBirthdayDistribution)
);

/**
 * Get birthdays in specific month (Admin)
 * GET /api/celebrations/admin/birthdays/month/:month
 * Access: SUPER_ADMIN
 */
router.get('/admin/birthdays/month/:month',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateMonthBirthdays,
    cacheBirthdaysInMonth
  ],
  asyncHandler(celebrationController.getBirthdaysInMonth)
);

/**
 * Get festival statistics (Admin)
 * GET /api/celebrations/admin/festivals/stats
 * Access: SUPER_ADMIN
 */
router.get('/admin/festivals/stats',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cacheFestivalStats
  ],
  asyncHandler(celebrationController.getFestivalStats)
);

/**
 * Get celebration summary (Admin dashboard)
 * GET /api/celebrations/admin/summary
 * Access: SUPER_ADMIN
 */
router.get('/admin/summary',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cacheCelebrationSummary
  ],
  asyncHandler(celebrationController.getCelebrationSummary)
);

// ============================================
// ADMIN ROUTES - NOTIFICATION MANAGEMENT
// ============================================

/**
 * Toggle festival notifications (Admin)
 * PUT /api/celebrations/admin/festivals/:festivalId/notifications
 * Access: SUPER_ADMIN
 */
router.put('/admin/festivals/:festivalId/notifications',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateFestivalIdParam,
    validateFestivalAccess,
    validateToggleNotifications,
    autoInvalidateFestivalCaches
  ],
  asyncHandler(celebrationController.toggleFestivalNotifications)
);

/**
 * Get festival notification history (Admin)
 * GET /api/celebrations/admin/festivals/notifications
 * Access: SUPER_ADMIN
 */
router.get('/admin/festivals/notifications',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateNotificationHistory
  ],
  asyncHandler(celebrationController.getFestivalNotificationHistory)
);

/**
 * Get birthday notification history (Admin)
 * GET /api/celebrations/admin/birthdays/notifications
 * Access: SUPER_ADMIN
 */
router.get('/admin/birthdays/notifications',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateNotificationHistory
  ],
  asyncHandler(celebrationController.getBirthdayNotificationHistory)
);

// ============================================
// ADMIN ROUTES - SYNC MANAGEMENT
// ============================================

/**
 * Manually trigger festival sync (Admin)
 * POST /api/celebrations/admin/festivals/sync
 * Access: SUPER_ADMIN
 */
router.post('/admin/festivals/sync',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateSyncRateLimit,
    autoInvalidateFestivalCaches
  ],
  asyncHandler(celebrationController.triggerFestivalSync)
);

/**
 * Get festival sync history (Admin)
 * GET /api/celebrations/admin/festivals/sync-history
 * Access: SUPER_ADMIN
 */
router.get('/admin/festivals/sync-history',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateSyncHistory
  ],
  asyncHandler(celebrationController.getFestivalSyncHistory)
);

/**
 * Get API usage statistics (Admin)
 * GET /api/celebrations/admin/api-usage
 * Access: SUPER_ADMIN
 */
router.get('/admin/api-usage',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(celebrationController.getAPIUsageStats)
);

// ============================================
// ADMIN ROUTES - TESTING & MANUAL TRIGGERS
// ============================================

/**
 * Manually trigger birthday notifications (Admin testing)
 * POST /api/celebrations/admin/birthdays/trigger
 * Access: SUPER_ADMIN
 */
router.post('/admin/birthdays/trigger',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    autoInvalidateBirthdayCaches
  ],
  asyncHandler(celebrationController.triggerBirthdayNotifications)
);

// ============================================
// DEVELOPMENT/TESTING ROUTES (Non-production only)
// ============================================

if (process.env.NODE_ENV !== 'production') {
  /**
   * Clear all celebration caches (Development)
   * DELETE /api/celebrations/dev/cache
   * Access: SUPER_ADMIN
   */
  router.delete('/dev/cache',
    [
      authenticateToken,
      requireRole('SUPER_ADMIN')
    ],
    asyncHandler(async (req, res) => {
      try {
        const { invalidateAllCelebrationCaches } = require('../middleware/celebration.cache.middleware');
        const result = await invalidateAllCelebrationCaches();
        
        return require('../utils/response').successResponse(
          res, 
          result, 
          'All celebration caches cleared successfully'
        );
      } catch (error) {
        console.error('Clear cache error:', error);
        return require('../utils/response').errorResponse(res, 'Failed to clear caches', 500);
      }
    })
  );

  /**
   * Get cache statistics (Development)
   * GET /api/celebrations/dev/cache/stats
   * Access: SUPER_ADMIN
   */
  router.get('/dev/cache/stats',
    [
      authenticateToken,
      requireRole('SUPER_ADMIN')
    ],
    asyncHandler(async (req, res) => {
      try {
        const { getCacheStats } = require('../middleware/celebration.cache.middleware');
        const stats = await getCacheStats();
        
        return require('../utils/response').successResponse(
          res,
          stats,
          'Cache statistics retrieved successfully'
        );
      } catch (error) {
        console.error('Get cache stats error:', error);
        return require('../utils/response').errorResponse(res, 'Failed to get cache stats', 500);
      }
    })
  );
}

module.exports = router;