// src/services/notification.service.js
// Generic Notification Service - Universal system for all app features
// Multi-Tenant Aware Implementation

const { PrismaClient } = require('@prisma/client');
const PushNotificationService = require('../utils/push-notification.util');
const TenantPushNotificationService = require('./TenantPushNotificationService');
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
  
  // Admin/Verification notifications
  ALUMNI_VERIFIED: 'ALUMNI_VERIFIED',
  ALUMNI_REJECTED: 'ALUMNI_REJECTED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  
  // Post/Comment notifications
  POST_APPROVED: 'POST_APPROVED',
  POST_COMMENTED: 'POST_COMMENTED',
  POST_LIKED: 'POST_LIKED',
  MENTION: 'MENTION',
  
  // Birthday/Festival notifications
  BIRTHDAY_NOTIFICATION: 'BIRTHDAY_NOTIFICATION',
  FESTIVAL_NOTIFICATION: 'FESTIVAL_NOTIFICATION'
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
   * Create and send notification (Multi-Tenant Aware)
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
        relatedEntityId = null,
        tenantCode = null,        // Multi-tenant support
        organizationId = null     // Multi-tenant support
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
        relatedEntityId,
        organizationId  // Multi-tenant support
      });

      // Send push notifications if not scheduled (Multi-tenant aware)
      if (!scheduleAt && channels.includes(CHANNELS.PUSH)) {
        await this.sendPushNotifications(notifications, tenantCode);
      }

      // Send email notifications if enabled (Multi-tenant aware)
      if (!scheduleAt && channels.includes(CHANNELS.EMAIL)) {
        await this.sendEmailNotifications(notifications, tenantCode);
      }

      return {
        success: true,
        notificationsSent: notifications.length,
        notifications: notifications.map(n => ({
          id: n.id,
          userId: n.userId,
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
   * Create notifications in database (Multi-Tenant Aware)
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
      relatedEntityId,
      organizationId = null  // Multi-tenant support
    } = data;

    try {
      const notifications = await prisma.$transaction(async (tx) => {
        const createdNotifications = [];

        for (const recipientId of recipientIds) {
          const notification = await tx.notification.create({
            data: {
              userId: recipientId,
              type,
              title,
              message,
              payload: notificationData,
              organizationId  // Multi-tenant support
            }
          });

          createdNotifications.push(notification);
        }

        return createdNotifications;
      });

      // Clear user notification caches (tenant-aware)
      const tenantPrefix = organizationId ? `${organizationId}:` : '';
      for (const recipientId of recipientIds) {
        await CacheService.delPattern(`${tenantPrefix}notifications:user:${recipientId}*`);
      }

      return notifications;
    } catch (error) {
      console.error('Create notifications error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack
      });
      throw new Error(`Failed to create notifications in database: ${error.message}`);
    }
  }

  /**
   * Send push notifications (Multi-Tenant Aware)
   * @param {Array} notifications - Array of notification objects
   * @param {string} tenantCode - Tenant code for multi-tenant push
   * @returns {Promise<void>}
   */
  static async sendPushNotifications(notifications, tenantCode = null) {
    console.log(`🔔 sendPushNotifications called for ${notifications.length} notifications`);

    try {
      for (const notification of notifications) {
        // Get user's push tokens from the device tokens table
        const user = await prisma.user.findUnique({
          where: { id: notification.userId },
          select: {
            id: true,
            fullName: true,
            organizationId: true,
            deviceTokens: {
              where: { isActive: true },
              select: { token: true, platform: true },
              orderBy: { lastUsedAt: 'desc' },
              take: 5 // Limit to 5 most recent active tokens
            }
          }
        });

        if (!user) {
          console.log(`⚠️ User not found for notification ${notification.id}`);
          continue;
        }

        // Get tenant code from user's organization if not provided
        let effectiveTenantCode = tenantCode;
        if (!effectiveTenantCode && user.organizationId) {
          const org = await prisma.organization.findUnique({
            where: { id: user.organizationId },
            select: { tenantCode: true }
          });
          effectiveTenantCode = org?.tenantCode;
        }

        // Get device tokens to send to
        const deviceTokens = user.deviceTokens?.map(dt => dt.token) || [];

        console.log(`📱 User ${user.fullName} has ${deviceTokens.length} active device tokens`);
        if (deviceTokens.length > 0) {
          console.log(`   Token preview: ${deviceTokens[0]?.substring(0, 30)}...`);
        }

        // Send push notification using tenant-aware service
        try {
          let pushResult;

          if (deviceTokens.length > 0) {
            // Send to actual device tokens using tenant-aware service
            console.log(`📤 Sending FCM push to ${deviceTokens.length} tokens for ${user.fullName}`);
            pushResult = await TenantPushNotificationService.sendToTokens(
              effectiveTenantCode,
              {
                tokens: deviceTokens,
                title: notification.title,
                body: notification.message,
                data: {
                  notificationId: notification.id,
                  type: notification.type,
                  userId: user.id,
                  ...notification.payload
                },
                priority: 'high'  // Changed to high priority for better delivery
              }
            );
            console.log(`📤 FCM push result:`, JSON.stringify(pushResult, null, 2));
          } else {
            // No device tokens registered
            console.log(`⚠️ No device tokens for ${user.fullName}, skipping FCM push`);
            pushResult = { success: false, error: 'No device tokens' };
          }

          // Update notification status based on result
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              isRead: false
            }
          });

          if (pushResult.success) {
            console.log(`✅ Push notification sent to ${user.fullName}: ${notification.title}`);
          } else {
            console.log(`⚠️ Push notification may have failed for ${user.fullName}: ${pushResult.error || 'unknown'}`);
          }
        } catch (pushError) {
          console.error(`❌ Failed to send push notification to ${user.fullName}:`, pushError);

          // Update notification to mark delivery failure
          await prisma.notification.update({
            where: { id: notification.id },
            data: { isRead: false }
          });
        }
      }
    } catch (error) {
      console.error('Send push notifications error:', error);
      // Don't throw - partial failure is acceptable
    }
  }

  /**
   * Send email notifications (Multi-Tenant Aware)
   * @param {Array} notifications - Array of notification objects
   * @param {string} tenantCode - Tenant code for multi-tenant email
   * @returns {Promise<void>}
   */
  static async sendEmailNotifications(notifications, tenantCode = null) {
    try {
      const TenantEmailManager = require('./email/TenantEmailManager');
      const defaultEmailManager = require('./email/EmailManager');

      for (const notification of notifications) {
        try {
          // Get user details for email
          const user = await prisma.user.findUnique({
            where: { id: notification.userId },
            select: {
              id: true,
              fullName: true,
              email: true,
              batch: true,
              organizationId: true
            }
          });

          if (!user?.email) {
            // Update notification status - no email
            await prisma.notification.update({
              where: { id: notification.id },
              data: {
                status: 'NO_EMAIL',
                deliveryAttempts: { increment: 1 }
              }
            });
            continue;
          }

          // Get tenant code from user's organization if not provided
          let effectiveTenantCode = tenantCode;
          if (!effectiveTenantCode && user.organizationId) {
            const org = await prisma.organization.findUnique({
              where: { id: user.organizationId },
              select: { tenantCode: true }
            });
            effectiveTenantCode = org?.tenantCode;
          }

          // Get email service (tenant-aware or default)
          let emailService;
          try {
            emailService = await TenantEmailManager.getServiceForTenant(effectiveTenantCode);
          } catch (tenantError) {
            console.log(`Using default email service for notification (tenant error): ${tenantError.message}`);
            emailService = defaultEmailManager.getService();
          }

          // Send notification email
          const emailOptions = {
            to: user.email,
            subject: notification.title,
            html: this.generateNotificationEmailHTML(notification, user, emailService.tenantConfig)
          };

          const result = await emailService.provider.sendEmail(emailOptions);

          // Update notification status based on email result
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: result.success ? 'SENT' : 'FAILED',
              sentAt: result.success ? new Date() : null,
              deliveryAttempts: { increment: 1 },
              failureReason: result.success ? null : result.error
            }
          });

        } catch (notificationError) {
          console.error(`Failed to send email notification ${notification.id}:`, notificationError);

          // Update notification as failed
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: 'FAILED',
              deliveryAttempts: { increment: 1 },
              failureReason: notificationError.message
            }
          });
        }
      }
    } catch (error) {
      console.error('Send email notifications error:', error);
      // Don't throw - partial failure is acceptable
    }
  }

  /**
   * Generate HTML for notification email (Multi-Tenant Aware)
   * @param {Object} notification - Notification object
   * @param {Object} user - User object
   * @param {Object} tenantConfig - Tenant branding configuration (optional)
   * @returns {string} HTML email content
   */
  static generateNotificationEmailHTML(notification, user, tenantConfig = null) {
    // Default branding
    const defaultBranding = {
      primaryColor: '#667eea',
      secondaryColor: '#764ba2',
      logoUrl: null,
      organizationName: 'Alumni Portal',
      fromName: 'Alumni Portal Team'
    };

    // Merge tenant config with defaults
    const branding = {
      ...defaultBranding,
      ...(tenantConfig || {})
    };

    const logoHtml = branding.logoUrl
      ? `<img src="${branding.logoUrl}" alt="${branding.organizationName}" style="max-width: 150px; max-height: 60px; margin-bottom: 15px;" />`
      : '';

    const currentYear = new Date().getFullYear();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .content { padding: 30px; }
          .content p { margin: 0 0 15px 0; }
          .notification-badge {
            display: inline-block;
            background: ${branding.primaryColor};
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            margin-bottom: 15px;
          }
          .action-button {
            display: inline-block;
            background: ${branding.primaryColor};
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            margin-top: 15px;
          }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-top: 1px solid #eee; }
          .footer a { color: ${branding.primaryColor}; text-decoration: none; }
          @media only screen and (max-width: 600px) {
            body { padding: 10px; }
            .container { border-radius: 5px; }
            .header, .content { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoHtml}
            <h1>${notification.title}</h1>
          </div>
          <div class="content">
            <span class="notification-badge">${notification.type?.replace(/_/g, ' ') || 'Notification'}</span>
            <p>Dear ${user.fullName},</p>
            <p>${notification.message}</p>
            <p style="margin-top: 25px;">Best regards,<br><strong>${branding.fromName}</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${currentYear} ${branding.organizationName}. All rights reserved.</p>
            <p style="margin-top: 10px; font-size: 12px; color: #999;">This is an automated notification. Please do not reply directly to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
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
        userId: userId
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
        select: { userId: true, readAt: true }
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.userId !== userId) {
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
          userId: userId,
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
          userId: userId,
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