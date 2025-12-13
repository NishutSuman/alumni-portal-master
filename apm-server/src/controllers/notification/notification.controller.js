// src/controllers/notification.controller.js
// Generic Notification Controller - Following established patterns
// Multi-Tenant Aware Implementation

const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../../utils/response');
const { CacheService } = require('../../config/redis');
const { NotificationService, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('../../services/notification.service');
const { getTenantFilter } = require('../../utils/tenant.util');

const prisma = new PrismaClient();

// ============================================
// USER NOTIFICATION CONTROLLERS
// ============================================

/**
 * Get user notifications with filtering and pagination
 * GET /api/notifications
 * Access: Authenticated users
 */
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      type,
      status,
      priority,
      unreadOnly = 'false',
      page = 1,
      limit = 20
    } = req.query;

    const filters = {
      type,
      status,
      priority,
      unreadOnly: unreadOnly === 'true',
      page: parseInt(page),
      limit: parseInt(limit)
    };

    // Get notifications using prisma directly for now
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      userId: userId
    };
    
    if (type) where.type = type;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (unreadOnly === 'true') where.isRead = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          payload: true,
          isRead: true,
          createdAt: true
        }
      }),
      prisma.notification.count({ where })
    ]);

    const result = {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    };

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, result, req.cacheTTL);
    }

    return successResponse(res, result, 'Notifications retrieved successfully');
  } catch (error) {
    console.error('Get user notifications error:', error);
    return errorResponse(res, 'Failed to retrieve notifications', 500);
  }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 * Access: Authenticated users
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const count = await prisma.notification.count({
      where: {
        userId: userId,
        isRead: false
      }
    });

    return successResponse(res, { count }, 'Unread count retrieved successfully');
  } catch (error) {
    console.error('Get unread count error:', error);
    return errorResponse(res, 'Failed to get unread count', 500);
  }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:notificationId/read
 * Access: Notification recipient
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId
      }
    });

    if (!notification) {
      return errorResponse(res, 'Notification not found', 404);
    }

    const alreadyRead = notification.isRead;

    if (!alreadyRead) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true
        }
      });
    }

    const message = alreadyRead 
      ? 'Notification was already read' 
      : 'Notification marked as read';

    return successResponse(res, { success: true, message }, message);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return errorResponse(res, error.message || 'Failed to mark notification as read', 500);
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/mark-all-read
 * Access: Authenticated users
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    return successResponse(res, { success: true, message: `${result.count} notifications marked as read` }, `${result.count} notifications marked as read`);
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return errorResponse(res, 'Failed to mark all notifications as read', 500);
  }
};

/**
 * Delete notification
 * DELETE /api/notifications/:notificationId
 * Access: Notification recipient
 */
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        userId: true,
        type: true,
        title: true
      }
    });

    if (!notification) {
      return errorResponse(res, 'Notification not found', 404);
    }

    if (notification.userId !== userId) {
      return errorResponse(res, 'You can only delete your own notifications', 403);
    }

    // Delete notification
    await prisma.notification.delete({
      where: { id: notificationId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'notification_delete',
        details: {
          notificationId,
          notificationType: notification.type,
          notificationTitle: notification.title
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Clear user notification caches
    await CacheService.delPattern(`notifications:user:${userId}*`);

    return successResponse(res, { deletedId: notificationId }, 'Notification deleted successfully');
  } catch (error) {
    console.error('Delete notification error:', error);
    return errorResponse(res, 'Failed to delete notification', 500);
  }
};

/**
 * Delete all notifications for user
 * DELETE /api/notifications/clear-all
 * Access: Authenticated users
 */
const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get count before deletion for response
    const count = await prisma.notification.count({
      where: { userId }
    });

    if (count === 0) {
      return successResponse(res, { deletedCount: 0 }, 'No notifications to delete');
    }

    // Delete all user notifications
    const result = await prisma.notification.deleteMany({
      where: { userId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'notifications_clear_all',
        details: {
          deletedCount: result.count
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Clear user notification caches
    await CacheService.delPattern(`notifications:user:${userId}*`);

    return successResponse(res, { 
      deletedCount: result.count 
    }, `Successfully deleted ${result.count} notification${result.count !== 1 ? 's' : ''}`);
  } catch (error) {
    console.error('Clear all notifications error:', error);
    return errorResponse(res, 'Failed to clear all notifications', 500);
  }
};

// ============================================
// PUSH TOKEN MANAGEMENT
// ============================================

/**
 * Register device push token
 * POST /api/notifications/register-token
 * Access: Authenticated users
 */
const registerPushToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, deviceType, deviceId } = req.body;

    // Validate token format (basic validation)
    if (!token || typeof token !== 'string' || token.length < 50) {
      return errorResponse(res, 'Invalid push token format', 400);
    }

    // Map deviceType to platform enum
    const platformMap = {
      'android': 'ANDROID',
      'ios': 'IOS',
      'web': 'WEB'
    };
    const platform = platformMap[deviceType?.toLowerCase()] || 'ANDROID';

    // Get user's organization for multi-tenant support
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    // Check if token already exists for this user
    const existingToken = await prisma.userDeviceToken.findFirst({
      where: {
        userId,
        token
      }
    });

    if (existingToken) {
      // Update existing token - mark as active and update lastUsedAt
      await prisma.userDeviceToken.update({
        where: { id: existingToken.id },
        data: {
          isActive: true,
          lastUsedAt: new Date(),
          invalidAt: null
        }
      });

      return successResponse(res, {
        registered: true,
        message: 'Token reactivated'
      }, 'Push token already exists, reactivated');
    }

    // Create new device token
    await prisma.userDeviceToken.create({
      data: {
        userId,
        token,
        platform,
        deviceId: deviceId || null,
        deviceName: req.get('User-Agent')?.substring(0, 100) || null,
        isActive: true,
        organizationId: user?.organizationId || null
      }
    });

    // Get token count for user
    const tokenCount = await prisma.userDeviceToken.count({
      where: { userId, isActive: true }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'push_token_registered',
        details: {
          platform,
          deviceId,
          tokenCount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    console.log(`✅ FCM token registered for user ${userId}, platform: ${platform}`);

    return successResponse(res, {
      registered: true,
      tokenCount
    }, 'Push token registered successfully');

  } catch (error) {
    console.error('Register push token error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    // Return detailed error for debugging
    return errorResponse(res, `Failed to register push token: ${error.message}`, 500);
  }
};

/**
 * Unregister device push token
 * DELETE /api/notifications/unregister-token
 * Access: Authenticated users
 */
const unregisterPushToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return errorResponse(res, 'Push token is required', 400);
    }

    // Find and deactivate the token
    const result = await prisma.userDeviceToken.updateMany({
      where: {
        userId,
        token
      },
      data: {
        isActive: false,
        invalidAt: new Date()
      }
    });

    if (result.count > 0) {
      // Get remaining active token count
      const remainingTokens = await prisma.userDeviceToken.count({
        where: { userId, isActive: true }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'push_token_unregistered',
          details: {
            remainingTokens
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return successResponse(res, {
        unregistered: true,
        remainingTokens
      }, 'Push token unregistered successfully');
    }

    return successResponse(res, {
      unregistered: false,
      message: 'Token not found' 
    }, 'Push token was not registered');

  } catch (error) {
    console.error('Unregister push token error:', error);
    return errorResponse(res, 'Failed to unregister push token', 500);
  }
};

// ============================================
// NOTIFICATION SENDING (ADMIN/SYSTEM)
// ============================================

/**
 * Send custom notification (Admin)
 * POST /api/notifications/send
 * Access: SUPER_ADMIN
 * Multi-Tenant: Recipients filtered by admin's organization
 */
const sendCustomNotification = async (req, res) => {
  try {
    const {
      recipientIds,
      type = NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
      title,
      message,
      data = {},
      priority = PRIORITY_LEVELS.MEDIUM,
      scheduleAt = null
    } = req.body;

    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);
    const tenantId = req.tenantId || null;

    // Validate recipients exist and belong to the same tenant
    if (recipientIds && recipientIds.length > 0) {
      const recipientCount = await prisma.user.count({
        where: {
          id: { in: recipientIds },
          isActive: true,
          ...tenantFilter // Multi-tenant isolation - only allow recipients from same org
        }
      });

      if (recipientCount !== recipientIds.length) {
        return errorResponse(res, 'Some recipient users not found, inactive, or not in your organization', 400);
      }
    }

    const result = await NotificationService.createAndSendNotification({
      recipientIds: recipientIds || [],
      type,
      title,
      message,
      data,
      priority,
      scheduleAt,
      organizationId: tenantId, // Pass tenant ID for multi-tenant notification storage
      tenantCode: req.tenantCode // Pass tenant code for push notifications
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'custom_notification_sent',
        details: {
          recipientCount: recipientIds?.length || 0,
          type,
          title: title.substring(0, 50),
          scheduled: !!scheduleAt
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, result, 'Custom notification sent successfully');
  } catch (error) {
    console.error('Send custom notification error:', error);
    return errorResponse(res, error.message || 'Failed to send custom notification', 500);
  }
};

/**
 * Send system announcement to all users
 * POST /api/notifications/announce
 * Access: SUPER_ADMIN
 * Multi-Tenant: Only sends to users in admin's organization
 */
const sendSystemAnnouncement = async (req, res) => {
  try {
    const { title, message, priority = PRIORITY_LEVELS.MEDIUM } = req.body;

    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);
    const tenantId = req.tenantId || null;

    // Get all active users in the tenant's organization
    const activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        ...tenantFilter // Multi-tenant isolation - only users from same org
      },
      select: { id: true }
    });

    const recipientIds = activeUsers.map(user => user.id);

    if (recipientIds.length === 0) {
      return errorResponse(res, 'No active users found in your organization', 400);
    }

    const result = await NotificationService.createAndSendNotification({
      recipientIds,
      type: NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
      title,
      message,
      priority,
      organizationId: tenantId, // Pass tenant ID for multi-tenant notification storage
      tenantCode: req.tenantCode // Pass tenant code for push notifications
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'system_announcement_sent',
        details: {
          recipientCount: recipientIds.length,
          title: title.substring(0, 50),
          priority
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, result, 'System announcement sent to all users');
  } catch (error) {
    console.error('Send system announcement error:', error);
    return errorResponse(res, 'Failed to send system announcement', 500);
  }
};

// ============================================
// ADMIN ANALYTICS & MANAGEMENT
// ============================================

/**
 * Get notification analytics (Admin)
 * GET /api/notifications/admin/analytics
 * Access: SUPER_ADMIN
 * Multi-Tenant: Only shows analytics for admin's organization
 */
const getNotificationAnalytics = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    const dateFilter = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    // Combine date filter with tenant filter
    const whereClause = {
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      ...tenantFilter // Multi-tenant isolation
    };

    // Get analytics data filtered by tenant
    const [
      totalNotifications,
      notificationsByType,
      notificationsByStatus,
      notificationsByPriority
    ] = await Promise.all([
      prisma.notification.count({ where: whereClause }),

      prisma.notification.groupBy({
        by: ['type'],
        where: whereClause,
        _count: { type: true },
        orderBy: { _count: { type: 'desc' } }
      }),

      prisma.notification.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { status: true }
      }),

      prisma.notification.groupBy({
        by: ['priority'],
        where: whereClause,
        _count: { priority: true }
      })
    ]);

    const analytics = {
      summary: {
        totalNotifications,
        dateRange: { fromDate, toDate }
      },
      byType: notificationsByType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {}),
      byStatus: notificationsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      byPriority: notificationsByPriority.reduce((acc, item) => {
        acc[item.priority] = item._count.priority;
        return acc;
      }, {})
    };

    return successResponse(res, analytics, 'Notification analytics retrieved successfully');
  } catch (error) {
    console.error('Get notification analytics error:', error);
    return errorResponse(res, 'Failed to retrieve notification analytics', 500);
  }
};

/**
 * Cleanup old notifications (Admin)
 * POST /api/notifications/admin/cleanup
 * Access: SUPER_ADMIN
 * Multi-Tenant: Only cleans up notifications in admin's organization
 */
const cleanupOldNotifications = async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;

    // Build tenant filter for multi-tenant isolation
    const tenantFilter = getTenantFilter(req);

    // Custom cleanup with tenant filter (instead of using service that doesn't filter)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld));

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        ...tenantFilter, // Multi-tenant isolation
        OR: [
          { isRead: true }, // Read notifications
        ]
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'notifications_cleanup',
        details: {
          daysOld: parseInt(daysOld),
          deletedCount: result.count
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, { deletedCount: result.count }, `Cleaned up ${result.count} old notifications`);
  } catch (error) {
    console.error('Cleanup old notifications error:', error);
    return errorResponse(res, 'Failed to cleanup old notifications', 500);
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // User notification management
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,

  // Push token management
  registerPushToken,
  unregisterPushToken,

  // Admin notification sending
  sendCustomNotification,
  sendSystemAnnouncement,

  // Admin analytics & management
  getNotificationAnalytics,
  cleanupOldNotifications
};