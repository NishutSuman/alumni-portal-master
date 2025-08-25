// src/services/notification.service.js
// Generic Notification Service - Universal system for all app features

const { PrismaClient } = require('@prisma/client');
const PushNotificationService = require('../utils/push-notification.util');
const { CacheService } = require('../config/redis');

const prisma = new PrismaClient();

/**
 * Notification Types - Extensible for all app features
 */
const NOTIFICATION_TYPES = {
  // LifeLink notifications
  LIFELINK_EMERGENCY: 'LIFELINK_EMERGENCY',
  LIFELINK_BROADCAST: 'LIFELINK_BROADCAST', 
  LIFELINK_REMINDER: 'LIFELINK_REMINDER',
  
  // Event notifications
  EVENT_REGISTRATION: 'EVENT_REGISTRATION',
  EVENT_REMINDER: 'EVENT_REMINDER',
  EVENT_UPDATE: 'EVENT_UPDATE',
  EVENT_CANCELLATION: 'EVENT_CANCELLATION',
  
  // Poll notifications
  POLL_CREATED: 'POLL_CREATED',
  POLL_REMINDER: 'POLL_REMINDER',
  POLL_RESULTS: 'POLL_RESULTS',
  
  // Treasury notifications
  PAYMENT_DUE: 'PAYMENT_DUE',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  
  // System notifications
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
  ACCOUNT_REMINDER: 'ACCOUNT_REMINDER',
  SECURITY_ALERT: 'SECURITY_ALERT',
  
  // Post/Comment notifications
  POST_APPROVED: 'POST_APPROVED',
  POST_COMMENTED: 'POST_COMMENTED',
  POST_LIKED: 'POST_LIKED'
};

/**
 * Notification Priority Levels
 */
const PRIORITY_LEVELS = {
  EMERGENCY: 'EMERGENCY', // LifeLink emergency requests
  HIGH: 'HIGH',           // Important reminders, payment due
  MEDIUM: 'MEDIUM',       // Event updates, poll results
  LOW: 'LOW'              // General announcements
};

/**
 * Notification Channels
 */
const CHANNELS = {
  PUSH: 'PUSH',           // Push notifications
  EMAIL: 'EMAIL',         // Email notifications (future)
  SMS: 'SMS',             // SMS notifications (future)  
  IN_APP: 'IN_APP'        // In-app notifications only
};

class NotificationService {

  /**
   * Create and send notification
   * @param {Object} notificationData - Notification details
   * @returns {Promise<Object>} Created notification
   */
  static async createAndSendNotification(notificationData) {
    try {
      const {
        recipientIds,
        type,
        title,
        message,
        data = {},
        priority = PRIORITY_LEVELS.MEDIUM,
        channels = [CHANNELS.PUSH, CHANNELS.IN_APP],
        scheduleAt = null,
        expiresAt = null,
        relatedEntityType = null,
        relatedEntityId = null
      } = notificationData;

      // Validate recipients
      if (!recipientIds || recipientIds.length === 0) {
        throw new Error('At least one recipient is required');
      }

      // Create notifications in database
      const notifications = await this.createNotifications({
        recipientIds,
        type,
        title,
        message,
        data,
        priority,
        channels,
        scheduleAt,
        expiresAt,
        relatedEntityType,
        relatedEntityId
      });

      // Send push notifications if not scheduled
      if (!scheduleAt && channels.includes(CHANNELS.PUSH)) {
        await this.sendPushNotifications(notifications);
      }

      // Send email notifications if enabled (future feature)
      if (!scheduleAt && channels.includes(CHANNELS.EMAIL)) {
        // await this.sendEmailNotifications(notifications);
      }

      return {
        success: true,
        notificationsSent: notifications.length,
        notifications: notifications.map(n => ({
          id: n.id,
          recipientId: n.recipientId,
          type: n.type,
          status: n.status
        }))
      };

    } catch (error) {
      console.error('Create and send notification error:', error);
      throw new Error(`Failed to create and send notification: ${error.message}`);
    }
  }

  /**
   * Create notifications in database
   * @param {Object} data - Notification data
   * @returns {Promise<Array>} Created notifications
   */
  static async createNotifications(data) {
    const {
      recipientIds,
      type,
      title,
      message,
      data: notificationData,
      priority,
      channels,
      scheduleAt,
      expiresAt,
      relatedEntityType,
      relatedEntityId
    } = data;

    try {
      const notifications = await prisma.$transaction(async (tx) => {
        const createdNotifications = [];

        for (const recipientId of recipientIds) {
          const notification = await tx.notification.create({
            data: {
              recipientId,
              type,
              title,
              message,
              data: notificationData,
              priority,
              channels,
              status: scheduleAt ? 'SCHEDULED' : 'PENDING',
              scheduledFor: scheduleAt ? new Date(scheduleAt) : null,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
              relatedEntityType,
              relatedEntityId
            }
          });

          createdNotifications.push(notification);
        }

        return createdNotifications;
      });

      // Clear user notification caches
      for (const recipientId of recipientIds) {
        await CacheService.delPattern(`notifications:user:${recipientId}*`);
      }

      return notifications;
    } catch (error) {
      console.error('Create notifications error:', error);
      throw new Error('Failed to create notifications in database');
    }
  }

  /**
   * Send push notifications
   * @param {Array} notifications - Array of notification objects
   * @returns {Promise<void>}
   */
  static async sendPushNotifications(notifications) {
    try {
      for (const notification of notifications) {
        // Get user's push tokens
        const user = await prisma.user.findUnique({
          where: { id: notification.recipientId },
          select: {
            id: true,
            firstName: true,
            pushTokens: true // Assuming you'll add this field
          }
        });

        if (!user?.pushTokens || user.pushTokens.length === 0) {
          // Update notification status - no push token
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: 'NO_DEVICE',
              deliveryAttempts: { increment: 1 }
            }
          });
          continue;
        }

        // Send push notification using FCM
        const pushResult = await PushNotificationService.sendToTokens({
          tokens: user.pushTokens,
          title: notification.title,
          body: notification.message,
          data: {
            notificationId: notification.id,
            type: notification.type,
            relatedEntityType: notification.relatedEntityType,
            relatedEntityId: notification.relatedEntityId,
            ...notification.data
          },
          priority: this.mapPriorityToFCM(notification.priority)
        });

        // Update notification status based on push result
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: pushResult.success ? 'SENT' : 'FAILED',
            sentAt: pushResult.success ? new Date() : null,
            deliveryAttempts: { increment: 1 },
            failureReason: pushResult.success ? null : pushResult.error
          }
        });
      }
    } catch (error) {
      console.error('Send push notifications error:', error);
      // Don't throw - partial failure is acceptable
    }
  }

  /**
   * Get user notifications with pagination and filtering
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Notifications with pagination
   */
  static async getUserNotifications(userId, filters = {}) {
    try {
      const {
        type,
        status,
        priority,
        unreadOnly = false,
        page = 1,
        limit = 20
      } = filters;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build where clause
      const where = {
        recipientId: userId
      };

      if (type) where.type = type;
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (unreadOnly) where.readAt = null;

      // Don't show expired notifications
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } }
      ];

      const [notifications, totalCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          select: {
            id: true,
            type: true,
            title: true,
            message: true,
            data: true,
            priority: true,
            status: true,
            readAt: true,
            createdAt: true,
            sentAt: true,
            relatedEntityType: true,
            relatedEntityId: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit)
        }),
        prisma.notification.count({ where })
      ]);

      return {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          hasNext: skip + notifications.length < totalCount,
          hasPrev: parseInt(page) > 1
        },
        summary: {
          total: totalCount,
          unread: await this.getUnreadCount(userId)
        }
      };

    } catch (error) {
      console.error('Get user notifications error:', error);
      throw new Error('Failed to retrieve user notifications');
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Updated notification
   */
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { recipientId: true, readAt: true }
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.recipientId !== userId) {
        throw new Error('Unauthorized to mark this notification as read');
      }

      if (notification.readAt) {
        return { alreadyRead: true };
      }

      const updatedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() }
      });

      // Clear user notification caches
      await CacheService.delPattern(`notifications:user:${userId}*`);

      return updatedNotification;
    } catch (error) {
      console.error('Mark notification as read error:', error);
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Update result
   */
  static async markAllAsRead(userId) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          recipientId: userId,
          readAt: null
        },
        data: {
          readAt: new Date()
        }
      });

      // Clear user notification caches
      await CacheService.delPattern(`notifications:user:${userId}*`);

      return { markedCount: result.count };
    } catch (error) {
      console.error('Mark all as read error:', error);
      throw new Error('Failed to mark all notifications as read');
    }
  }

  /**
   * Get unread notification count for user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  static async getUnreadCount(userId) {
    try {
      const count = await prisma.notification.count({
        where: {
          recipientId: userId,
          readAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } }
          ]
        }
      });

      return count;
    } catch (error) {
      console.error('Get unread count error:', error);
      return 0;
    }
  }

  /**
   * Delete old notifications (cleanup job)
   * @param {number} daysOld - Days old to delete
   * @returns {Promise<Object>} Deletion result
   */
  static async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          OR: [
            { readAt: { not: null } }, // Read notifications
            { expiresAt: { lt: new Date() } } // Expired notifications
          ]
        }
      });

      return { deletedCount: result.count };
    } catch (error) {
      console.error('Cleanup old notifications error:', error);
      throw new Error('Failed to cleanup old notifications');
    }
  }

  /**
   * Helper: Map internal priority to FCM priority
   * @param {string} priority - Internal priority level
   * @returns {string} FCM priority
   */
  static mapPriorityToFCM(priority) {
    switch (priority) {
      case PRIORITY_LEVELS.EMERGENCY:
      case PRIORITY_LEVELS.HIGH:
        return 'high';
      case PRIORITY_LEVELS.MEDIUM:
      case PRIORITY_LEVELS.LOW:
      default:
        return 'normal';
    }
  }

  /**
   * Send LifeLink emergency notification with donor database integration
   * @param {Object} requisitionData - Requisition details
   * @param {Array} donorIds - Donor user IDs
   * @param {string} customMessage - Optional custom message from requester
   * @returns {Promise<Object>} Notification result
   */
  static async sendLifeLinkEmergencyNotification(requisitionData, donorIds, customMessage = null) {
    try {
      const { patientName, hospitalName, requiredBloodGroup, urgencyLevel, location, id: requisitionId } = requisitionData;

      // Create emergency notification title and message
      const title = `🆘 URGENT: ${requiredBloodGroup} Blood Needed`;
      const baseMessage = `Emergency blood request for ${patientName} at ${hospitalName}, ${location}`;
      const message = customMessage ? `${baseMessage}\n\nMessage: ${customMessage}` : baseMessage;

      // Determine priority based on urgency
      const priority = urgencyLevel === 'HIGH' ? PRIORITY_LEVELS.EMERGENCY : PRIORITY_LEVELS.HIGH;

      // First, create donor notifications in LifeLink-specific table
      const donorNotifications = await prisma.$transaction(async (tx) => {
        const notifications = [];
        
        for (const donorId of donorIds) {
          const donorNotification = await tx.donorNotification.create({
            data: {
              donorId,
              requisitionId,
              title,
              message,
              notificationType: 'EMERGENCY',
              status: 'PENDING'
            }
          });
          notifications.push(donorNotification);
        }
        
        return notifications;
      });

      // Then send via generic notification system
      const genericNotificationResult = await this.createAndSendNotification({
        recipientIds: donorIds,
        type: NOTIFICATION_TYPES.LIFELINK_EMERGENCY,
        title,
        message,
        data: {
          requisitionId,
          patientName,
          hospitalName,
          requiredBloodGroup,
          urgencyLevel,
          location,
          isLifeLinkEmergency: true
        },
        priority,
        channels: [CHANNELS.PUSH, CHANNELS.IN_APP],
        expiresAt: requisitionData.requiredByDate,
        relatedEntityType: 'BloodRequisition',
        relatedEntityId: requisitionId
      });

      // Update donor notification status based on generic notification success
      if (genericNotificationResult.success) {
        await prisma.donorNotification.updateMany({
          where: {
            id: { in: donorNotifications.map(n => n.id) }
          },
          data: {
            status: 'SENT',
            sentAt: new Date()
          }
        });
      }

      return {
        success: genericNotificationResult.success,
        donorNotifications: donorNotifications.length,
        genericNotifications: genericNotificationResult.notificationsSent,
        requisitionId,
        urgencyLevel,
        customMessage: !!customMessage
      };

    } catch (error) {
      console.error('Send LifeLink emergency notification error:', error);
      throw new Error(`Failed to send emergency notification: ${error.message}`);
    }
  }

  /**
   * Send LifeLink donation reminder
   * @param {Array} donorIds - Donor user IDs  
   * @param {Object} reminderData - Reminder details
   * @returns {Promise<Object>} Notification result
   */
  static async sendLifeLinkDonationReminder(donorIds, reminderData = {}) {
    const { message = 'You are now eligible to donate blood again!' } = reminderData;

    return await this.createAndSendNotification({
      recipientIds: donorIds,
      type: NOTIFICATION_TYPES.LIFELINK_REMINDER,
      title: '💉 Blood Donation Eligible',
      message,
      data: {
        isLifeLinkReminder: true,
        ...reminderData
      },
      priority: PRIORITY_LEVELS.MEDIUM,
      channels: [CHANNELS.PUSH, CHANNELS.IN_APP]
    });
  }

  /**
   * Send LifeLink broadcast notification
   * @param {Object} requisitionData - Requisition details
   * @param {Array} donorIds - All available donor IDs
   * @returns {Promise<Object>} Notification result  
   */
  static async sendLifeLinkBroadcastNotification(requisitionData, donorIds) {
    const { requiredBloodGroup, location, urgencyLevel } = requisitionData;

    return await this.sendLifeLinkEmergencyNotification(
      requisitionData,
      donorIds,
      `EMERGENCY BROADCAST: ${requiredBloodGroup} blood needed urgently in ${location}. Your help can save a life!`
    );
  }

  /**
   * Send event registration confirmation
   * @param {Object} eventData - Event details
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Notification result
   */
  static async sendEventRegistrationNotification(eventData, userId) {
    return await this.createAndSendNotification({
      recipientIds: [userId],
      type: NOTIFICATION_TYPES.EVENT_REGISTRATION,
      title: `✅ Registration Confirmed`,
      message: `You're registered for "${eventData.title}" on ${new Date(eventData.eventDate).toLocaleDateString()}`,
      data: {
        eventId: eventData.id,
        eventTitle: eventData.title,
        eventDate: eventData.eventDate
      },
      priority: PRIORITY_LEVELS.MEDIUM,
      channels: [CHANNELS.PUSH, CHANNELS.IN_APP]
    });
  }

  /**
   * Send poll creation notification
   * @param {Object} pollData - Poll details
   * @param {Array} userIds - User IDs to notify
   * @returns {Promise<Object>} Notification result
   */
  static async sendPollCreationNotification(pollData, userIds) {
    return await this.createAndSendNotification({
      recipientIds: userIds,
      type: NOTIFICATION_TYPES.POLL_CREATED,
      title: `🗳️ New Poll: ${pollData.title}`,
      message: `A new poll has been created. Cast your vote now!`,
      data: {
        pollId: pollData.id,
        pollTitle: pollData.title
      },
      priority: PRIORITY_LEVELS.MEDIUM,
      channels: [CHANNELS.PUSH, CHANNELS.IN_APP]
    });
  }
}

// Export types and service
module.exports = {
  NotificationService,
  NOTIFICATION_TYPES,
  PRIORITY_LEVELS,
  CHANNELS
};