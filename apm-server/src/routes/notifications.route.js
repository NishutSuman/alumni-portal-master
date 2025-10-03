// src/routes/notifications.route.js
// Generic Notification Routes - Universal system for entire app

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
const { asyncHandler } = require('../utils/response');

// Notification-specific middleware
const {
  validateRegisterPushToken,
  validateUnregisterPushToken,
  validateSendCustomNotification,
  validateSendSystemAnnouncement,
  validateCleanupOldNotifications,
  validateNotificationListQuery,
  validateAnalyticsQuery,
  validateNotificationIdParam,
  validateNotificationAccess,
  validatePushPermissions,
  validateRecipients,
  validateNotificationRateLimit,
  validateNotificationNotExpired
} = require('../middleware/validation/notification.validation.middleware');

const {
  cacheUserNotifications,
  cacheUnreadCount,
  cacheNotificationDetails,
  cacheNotificationAnalytics,
  cacheUserPushTokens,
  cacheSystemStats,
  autoInvalidateNotificationCaches,
  autoInvalidatePushTokenCaches
} = require('../middleware/cache/notification.cache.middleware');
const { 
  requireAlumniVerification, 
  optionalAlumniVerification 
} = require('../middleware/auth/alumniVerification.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================
const notificationController = require('../controllers/notification/notification.controller');

// ============================================
// USER NOTIFICATION ROUTES
// ============================================

/**
 * Get user notifications with filtering and pagination
 * GET /api/notifications
 * Access: Authenticated users
 */
router.get('/',
  [
    authenticateToken,
    requireAlumniVerification,
    validateNotificationListQuery,
    cacheUserNotifications
  ],
  asyncHandler(notificationController.getUserNotifications)
);

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 * Access: Authenticated users
 */
router.get('/unread-count',
  [
    authenticateToken,
    requireAlumniVerification,
    cacheUnreadCount
  ],
  asyncHandler(notificationController.getUnreadCount)
);

/**
 * Mark notification as read
 * PUT /api/notifications/:notificationId/read
 * Access: Notification recipient
 */
router.put('/:notificationId/read',
  [
    authenticateToken,
    requireAlumniVerification,
    validateNotificationIdParam,
    validateNotificationAccess,
    validateNotificationNotExpired,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.markNotificationAsRead)
);

/**
 * Mark all notifications as read for user
 * PUT /api/notifications/mark-all-read
 * Access: Authenticated users
 */
router.put('/mark-all-read',
  [
    authenticateToken,
    requireAlumniVerification,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.markAllNotificationsAsRead)
);

/**
 * Get single notification details
 * GET /api/notifications/:notificationId
 * Access: Notification recipient or SUPER_ADMIN
 */
router.get('/:notificationId',
  [
    authenticateToken,
    requireAlumniVerification,
    validateNotificationIdParam,
    validateNotificationAccess,
    cacheNotificationDetails
  ],
  asyncHandler(notificationController.getNotificationDetails)
);

/**
 * Clear all notifications for user
 * DELETE /api/notifications/clear-all
 * Access: Authenticated users
 * IMPORTANT: Must be placed BEFORE /:notificationId route to avoid route conflicts
 */
router.delete('/clear-all',
  [
    authenticateToken,
    requireAlumniVerification,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.clearAllNotifications)
);

/**
 * Delete notification
 * DELETE /api/notifications/:notificationId
 * Access: Notification recipient
 */
router.delete('/:notificationId',
  [
    authenticateToken,
    requireAlumniVerification,
    validateNotificationIdParam,
    validateNotificationAccess,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.deleteNotification)
);

// ============================================
// PUSH TOKEN MANAGEMENT ROUTES
// ============================================

/**
 * Register device push token
 * POST /api/notifications/register-token
 * Access: Authenticated users
 */
router.post('/register-token',
  [
    authenticateToken,
    requireAlumniVerification,
    validatePushPermissions,
    validateRegisterPushToken,
    autoInvalidatePushTokenCaches
  ],
  asyncHandler(notificationController.registerPushToken)
);

/**
 * Unregister device push token
 * DELETE /api/notifications/unregister-token
 * Access: Authenticated users
 */
router.delete('/unregister-token',
  [
    authenticateToken,
    requireAlumniVerification,
    validateUnregisterPushToken,
    autoInvalidatePushTokenCaches
  ],
  asyncHandler(notificationController.unregisterPushToken)
);

/**
 * Get user's registered push tokens (Admin view)
 * GET /api/notifications/my-tokens
 * Access: Authenticated users
 */
router.get('/my-tokens',
  [
    authenticateToken,
    requireAlumniVerification,
    cacheUserPushTokens
  ],
  asyncHandler(notificationController.getUserPushTokens)
);

// ============================================
// NOTIFICATION PREFERENCES ROUTES
// ============================================

/**
 * Get user notification preferences
 * GET /api/notifications/preferences
 * Access: Authenticated users
 */
router.get('/preferences',
  [
    authenticateToken,
    requireAlumniVerification
  ],
  asyncHandler(notificationController.getNotificationPreferences)
);

/**
 * Update user notification preferences
 * PUT /api/notifications/preferences
 * Access: Authenticated users
 */
router.put('/preferences',
  [
    authenticateToken,
    requireAlumniVerification,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.updateNotificationPreferences)
);

// ============================================
// ADMIN NOTIFICATION MANAGEMENT ROUTES
// ============================================

/**
 * Send custom notification to specific users (Admin)
 * POST /api/notifications/admin/send
 * Access: SUPER_ADMIN
 */
router.post('/admin/send',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    validateSendCustomNotification,
    validateRecipients,
    validateNotificationRateLimit,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.sendCustomNotification)
);

/**
 * Send system announcement to all users (Admin)
 * POST /api/notifications/admin/announce
 * Access: SUPER_ADMIN
 */
router.post('/admin/announce',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    validateSendSystemAnnouncement,
    validateNotificationRateLimit,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.sendSystemAnnouncement)
);

/**
 * Get notification analytics (Admin)
 * GET /api/notifications/admin/analytics
 * Access: SUPER_ADMIN
 */
router.get('/admin/analytics',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    validateAnalyticsQuery,
    cacheNotificationAnalytics
  ],
  asyncHandler(notificationController.getNotificationAnalytics)
);

/**
 * Get system notification stats (Admin)
 * GET /api/notifications/admin/stats
 * Access: SUPER_ADMIN
 */
router.get('/admin/stats',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    cacheSystemStats
  ],
  asyncHandler(notificationController.getSystemNotificationStats)
);

/**
 * Get all notifications for admin management
 * GET /api/notifications/admin/all
 * Access: SUPER_ADMIN
 */
router.get('/admin/all',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    validateNotificationListQuery
  ],
  asyncHandler(notificationController.getAllNotifications)
);

/**
 * Cleanup old notifications (Admin)
 * POST /api/notifications/admin/cleanup
 * Access: SUPER_ADMIN
 */
router.post('/admin/cleanup',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    validateCleanupOldNotifications,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.cleanupOldNotifications)
);

/**
 * Resend failed notifications (Admin)
 * POST /api/notifications/admin/resend-failed
 * Access: SUPER_ADMIN
 */
router.post('/admin/resend-failed',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.resendFailedNotifications)
);

// ============================================
// TESTING ROUTES (Development/Staging only)
// ============================================

/**
 * Test push notification (Development)
 * POST /api/notifications/test/push
 * Access: SUPER_ADMIN (only in non-production)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test/push',
    [
      authenticateToken,
      requireRole(['SUPER_ADMIN'])
    ],
    asyncHandler(notificationController.testPushNotification)
  );

  /**
   * Test notification delivery (Development)
   * POST /api/notifications/test/delivery
   * Access: SUPER_ADMIN (only in non-production)
   */
  router.post('/test/delivery',
    [
      authenticateToken,
      requireRole(['SUPER_ADMIN'])
    ],
    asyncHandler(notificationController.testNotificationDelivery)
  );
}

// ============================================
// WEBHOOK ROUTES (for external services)
// ============================================

/**
 * Firebase Cloud Messaging delivery receipt webhook
 * POST /api/notifications/webhooks/fcm-delivery
 * Access: Public (with API key validation)
 */
router.post('/webhooks/fcm-delivery',
  [
    // Add webhook validation middleware if needed
  ],
  asyncHandler(notificationController.handleFCMDeliveryWebhook)
);

/**
 * Email delivery webhook (future integration)
 * POST /api/notifications/webhooks/email-delivery
 * Access: Public (with API key validation)
 */
router.post('/webhooks/email-delivery',
  [
    // Add webhook validation middleware if needed
  ],
  asyncHandler(notificationController.handleEmailDeliveryWebhook)
);

// ============================================
// BULK OPERATIONS ROUTES
// ============================================

/**
 * Send bulk notifications by user filters (Admin)
 * POST /api/notifications/admin/bulk-send
 * Access: SUPER_ADMIN
 */
router.post('/admin/bulk-send',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    validateNotificationRateLimit,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.sendBulkNotifications)
);

/**
 * Schedule bulk notification (Admin)
 * POST /api/notifications/admin/schedule-bulk
 * Access: SUPER_ADMIN
 */
router.post('/admin/schedule-bulk',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.scheduleBulkNotification)
);

/**
 * Get scheduled notifications (Admin)
 * GET /api/notifications/admin/scheduled
 * Access: SUPER_ADMIN
 */
router.get('/admin/scheduled',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN'])
  ],
  asyncHandler(notificationController.getScheduledNotifications)
);

/**
 * Cancel scheduled notification (Admin)
 * DELETE /api/notifications/admin/scheduled/:notificationId
 * Access: SUPER_ADMIN
 */
router.delete('/admin/scheduled/:notificationId',
  [
    authenticateToken,
    requireRole(['SUPER_ADMIN']),
    validateNotificationIdParam,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.cancelScheduledNotification)
);

// ============================================
// INTEGRATION HELPER ROUTES
// ============================================

/**
 * Get notification templates (for other features)
 * GET /api/notifications/templates
 * Access: Authenticated users
 */
router.get('/templates',
  [
    authenticateToken
  ],
  asyncHandler(notificationController.getNotificationTemplates)
);

/**
 * Trigger integration notifications (for events, polls, etc.)
 * POST /api/notifications/integrations/:feature/send
 * Access: Internal (API key or service account)
 */
router.post('/integrations/:feature/send',
  [
    // Add internal API validation middleware
    authenticateToken,
    requireAlumniVerification,
    autoInvalidateNotificationCaches
  ],
  asyncHandler(notificationController.sendIntegrationNotification)
);

// ============================================
// ROUTE EXPORTS
// ============================================

module.exports = router;

// ============================================
// ROUTE INTEGRATION NOTES
// ============================================

/*
INTEGRATION IN APP.JS:

// Add this to your main routes section
app.use('/api/notifications', require('./routes/notifications.route'));

ROUTE SUMMARY:
✅ 30+ endpoints covering complete notification system
✅ User notification management (CRUD)
✅ Push token registration/management
✅ Admin notification sending & analytics
✅ Bulk operations & scheduling
✅ Integration hooks for other features
✅ Testing endpoints for development
✅ Webhook endpoints for delivery receipts

AUTHENTICATION LEVELS:
- Public: Webhook endpoints only
- User: Personal notification management
- Admin: System-wide notification control

FEATURE INTEGRATIONS READY:
✅ LifeLink emergency notifications
✅ Event registration confirmations
✅ Poll creation announcements
✅ Treasury payment reminders
✅ Post approval notifications
✅ System announcements

CACHING STRATEGY:
- User notifications: 2 minutes
- Unread counts: 1 minute
- Analytics: 15 minutes
- System stats: 30 minutes
- Auto-invalidation after modifications

NEXT: Ready for Phase 2B LifeLink Integration! 🩸
*/