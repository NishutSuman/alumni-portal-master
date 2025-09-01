// src/controllers/notification.controller.js
// Generic Notification Controller - Following established patterns

const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../../utils/response');
const { CacheService } = require('../../config/redis');
const { NotificationService, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('../../services/notification.service');

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

    const result = await NotificationService.getUserNotifications(userId, filters);

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
    
    const count = await NotificationService.getUnreadCount(userId);

    return successResponse(res, { unreadCount: count }, 'Unread count retrieved successfully');
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

    const result = await NotificationService.markAsRead(notificationId, userId);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'notification_read',
        details: {
          notificationId,
          alreadyRead: result.alreadyRead || false
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const message = result.alreadyRead 
      ? 'Notification was already read' 
      : 'Notification marked as read';

    return successResponse(res, result, message);
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

    const result = await NotificationService.markAllAsRead(userId);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'notifications_mark_all_read',
        details: {
          markedCount: result.markedCount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, result, `${result.markedCount} notifications marked as read`);
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
        recipientId: true,
        type: true,
        title: true
      }
    });

    if (!notification) {
      return errorResponse(res, 'Notification not found', 404);
    }

    if (notification.recipientId !== userId) {
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
    const { token, deviceType, deviceInfo } = req.body;

    // Validate token format (basic validation)
    if (!token || typeof token !== 'string' || token.length < 50) {
      return errorResponse(res, 'Invalid push token format', 400);
    }

    // Get current user tokens
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushTokens: true }
    });

    const currentTokens = user?.pushTokens || [];
    
    // Add token if not already present
    if (!currentTokens.includes(token)) {
      const updatedTokens = [...currentTokens, token];
      
      // Keep only last 5 tokens per user (cleanup old devices)
      const limitedTokens = updatedTokens.slice(-5);

      await prisma.user.update({
        where: { id: userId },
        data: { pushTokens: limitedTokens }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'push_token_registered',
          details: {
            deviceType,
            deviceInfo,
            tokenCount: limitedTokens.length
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return successResponse(res, { 
        registered: true,
        tokenCount: limitedTokens.length 
      }, 'Push token registered successfully');
    }

    return successResponse(res, { 
      registered: false,
      message: 'Token already registered' 
    }, 'Push token already exists');

  } catch (error) {
    console.error('Register push token error:', error);
    return errorResponse(res, 'Failed to register push token', 500);
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

    // Get current user tokens
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushTokens: true }
    });

    const currentTokens = user?.pushTokens || [];
    const updatedTokens = currentTokens.filter(t => t !== token);

    if (updatedTokens.length !== currentTokens.length) {
      await prisma.user.update({
        where: { id: userId },
        data: { pushTokens: updatedTokens }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'push_token_unregistered',
          details: {
            remainingTokens: updatedTokens.length
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return successResponse(res, { 
        unregistered: true,
        remainingTokens: updatedTokens.length 
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

    // Validate recipients exist
    if (recipientIds && recipientIds.length > 0) {
      const recipientCount = await prisma.user.count({
        where: { 
          id: { in: recipientIds },
          isActive: true 
        }
      });

      if (recipientCount !== recipientIds.length) {
        return errorResponse(res, 'Some recipient users not found or inactive', 400);
      }
    }

    const result = await NotificationService.createAndSendNotification({
      recipientIds: recipientIds || [],
      type,
      title,
      message,
      data,
      priority,
      scheduleAt
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
 */
const sendSystemAnnouncement = async (req, res) => {
  try {
    const { title, message, priority = PRIORITY_LEVELS.MEDIUM } = req.body;

    // Get all active users
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true }
    });

    const recipientIds = activeUsers.map(user => user.id);

    if (recipientIds.length === 0) {
      return errorResponse(res, 'No active users found', 400);
    }

    const result = await NotificationService.createAndSendNotification({
      recipientIds,
      type: NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
      title,
      message,
      priority
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
 */
const getNotificationAnalytics = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const dateFilter = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    const whereClause = Object.keys(dateFilter).length > 0 
      ? { createdAt: dateFilter } 
      : {};

    // Get analytics data
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
 */
const cleanupOldNotifications = async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;

    const result = await NotificationService.cleanupOldNotifications(parseInt(daysOld));

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'notifications_cleanup',
        details: {
          daysOld: parseInt(daysOld),
          deletedCount: result.deletedCount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, result, `Cleaned up ${result.deletedCount} old notifications`);
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