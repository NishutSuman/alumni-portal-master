// src/services/ticketNotification.service.js - ENHANCED VERSION
// Replace your existing ticketNotification.service.js with this enhanced version

const { prisma } = require('../config/database');
const EmailManager = require('./email/EmailManager');
const NotificationService = require('./notification.service');

class TicketNotificationService {
  
  /**
   * Send comprehensive notification (Email + Web App + Push)
   * Enhanced to include all notification channels
   */
  static async sendComprehensiveNotification({ 
    recipientId,
    recipientEmail, 
    recipientName, 
    templateName, 
    subject, 
    templateData, 
    notificationData,
    priority = 'MEDIUM'
  }) {
    try {
      const results = {
        email: null,
        webApp: null,
        push: null,
        success: false
      };

      // 1. Send Email Notification
      try {
        const emailService = EmailManager.getService();
        results.email = await emailService.sendEmail(
          recipientEmail,
          subject,
          templateName,
          {
            ...templateData,
            recipientName
          }
        );
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
        results.email = { error: emailError.message };
      }

      // 2. Send Web App + Push Notification
      try {
        results.webApp = await NotificationService.createAndSendNotification({
          recipientIds: [recipientId],
          type: 'TICKET_NOTIFICATION',
          title: subject,
          message: this.formatNotificationMessage(templateName, notificationData),
          data: {
            ...notificationData,
            ticketUrl: templateData.ticketUrl,
            actionType: this.getNotificationActionType(templateName)
          },
          priority,
          channels: ['IN_APP', 'PUSH'], // Both web app and push
          relatedEntityType: 'TICKET',
          relatedEntityId: notificationData.ticketId
        });
      } catch (notificationError) {
        console.error('Web app/Push notification failed:', notificationError);
        results.webApp = { error: notificationError.message };
      }

      // Determine overall success
      results.success = results.email?.success || results.webApp?.success;

      return results;

    } catch (error) {
      console.error('Comprehensive notification error:', error);
      throw error;
    }
  }

  /**
   * Send notification when new ticket is created
   * Enhanced with web app + push notifications
   */
  static async notifyNewTicket(ticketId) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true }
          },
          category: {
            select: { name: true }
          },
          assignedTo: {
            select: { id: true, fullName: true, email: true }
          }
        }
      });

      if (!ticket || !ticket.assignedTo) {
        return { success: false, reason: 'No assigned admin found' };
      }

      const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/tickets/${ticket.id}`;

      // Send comprehensive notification to assigned admin
      const result = await this.sendComprehensiveNotification({
        recipientId: ticket.assignedTo.id,
        recipientEmail: ticket.assignedTo.email,
        recipientName: ticket.assignedTo.fullName,
        templateName: 'ticket-new',
        subject: `🎫 New Support Ticket: ${ticket.subject}`,
        templateData: {
          adminName: ticket.assignedTo.fullName,
          ticketNumber: ticket.ticketNumber,
          userFullName: ticket.user.fullName,
          userEmail: ticket.user.email,
          subject: ticket.subject,
          description: ticket.description,
          priority: ticket.priority,
          category: ticket.category.name,
          ticketUrl,
          createdAt: ticket.createdAt.toLocaleDateString()
        },
        notificationData: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          type: 'NEW_TICKET'
        },
        priority: ticket.priority === 'URGENT' ? 'HIGH' : 'MEDIUM'
      });

      return result;

    } catch (error) {
      console.error('New ticket notification error:', error);
      throw error;
    }
  }

  /**
   * Send notification when admin responds to ticket
   * Enhanced with web app + push notifications
   */
  static async notifyAdminResponse(ticketId, messageId) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true }
          },
          assignedTo: {
            select: { fullName: true }
          },
          messages: {
            where: { id: messageId },
            include: {
              sender: {
                select: { fullName: true }
              }
            }
          }
        }
      });

      if (!ticket || !ticket.messages[0]) {
        return { success: false, reason: 'Ticket or message not found' };
      }

      const message = ticket.messages[0];
      const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}`;

      // Send comprehensive notification to user
      const result = await this.sendComprehensiveNotification({
        recipientId: ticket.user.id,
        recipientEmail: ticket.user.email,
        recipientName: ticket.user.fullName,
        templateName: 'ticket-admin-response',
        subject: `💬 Response to Your Ticket: ${ticket.subject}`,
        templateData: {
          userName: ticket.user.fullName,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          adminName: message.sender.fullName,
          responseMessage: message.message.substring(0, 200) + (message.message.length > 200 ? '...' : ''),
          ticketUrl,
          respondedAt: message.createdAt.toLocaleDateString()
        },
        notificationData: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          messageId: message.id,
          type: 'ADMIN_RESPONSE'
        },
        priority: 'HIGH' // User responses are high priority
      });

      return result;

    } catch (error) {
      console.error('Admin response notification error:', error);
      throw error;
    }
  }

  /**
   * Send notification when ticket is closed
   * Enhanced with web app + push notifications
   */
  static async notifyTicketClosed(ticketId) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true }
          },
          resolver: {
            select: { fullName: true }
          },
          category: {
            select: { name: true }
          }
        }
      });

      if (!ticket) {
        return { success: false, reason: 'Ticket not found' };
      }

      const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}`;
      const satisfactionUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}/satisfaction`;

      // Send comprehensive notification to user
      const result = await this.sendComprehensiveNotification({
        recipientId: ticket.user.id,
        recipientEmail: ticket.user.email,
        recipientName: ticket.user.fullName,
        templateName: 'ticket-closed',
        subject: `✅ Ticket Resolved: ${ticket.subject}`,
        templateData: {
          userName: ticket.user.fullName,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          resolverName: ticket.resolver?.fullName || 'Support Team',
          category: ticket.category.name,
          ticketUrl,
          satisfactionUrl,
          closedAt: ticket.resolvedAt?.toLocaleDateString() || new Date().toLocaleDateString()
        },
        notificationData: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          type: 'TICKET_CLOSED',
          actionRequired: 'SATISFACTION_SURVEY'
        },
        priority: 'MEDIUM'
      });

      return result;

    } catch (error) {
      console.error('Ticket closed notification error:', error);
      throw error;
    }
  }

  /**
   * Format notification message for web app display
   */
  static formatNotificationMessage(templateName, notificationData) {
    const messages = {
      'ticket-new': `New ticket ${notificationData.ticketNumber} has been assigned to you`,
      'ticket-admin-response': `${notificationData.ticketNumber} has a new response from support`,
      'ticket-closed': `Your ticket ${notificationData.ticketNumber} has been resolved`,
      'ticket-reminder': `Reminder: Ticket ${notificationData.ticketNumber} awaiting response`
    };
    
    return messages[templateName] || `Ticket notification: ${notificationData.ticketNumber}`;
  }

  /**
   * Get notification action type for web app routing
   */
  static getNotificationActionType(templateName) {
    const actionTypes = {
      'ticket-new': 'VIEW_ADMIN_TICKET',
      'ticket-admin-response': 'VIEW_USER_TICKET',
      'ticket-closed': 'RATE_SATISFACTION',
      'ticket-reminder': 'RESPOND_TO_TICKET'
    };
    
    return actionTypes[templateName] || 'VIEW_TICKET';
  }

  /**
   * Check and send delayed notifications for unanswered tickets/messages
   * Enhanced with web app + push notifications
   */
  static async checkAndSendDelayedNotifications() {
    try {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      // Find tickets that haven't been responded to in 6 hours
      const delayedTickets = await prisma.ticket.findMany({
        where: {
          status: 'OPEN',
          lastActivity: {
            lt: sixHoursAgo
          },
          NOT: {
            messages: {
              some: {
                isFromAdmin: true,
                createdAt: {
                  gt: sixHoursAgo
                }
              }
            }
          }
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true }
          },
          assignedTo: {
            select: { id: true, fullName: true, email: true }
          },
          category: {
            select: { name: true }
          }
        }
      });

      const notificationResults = [];

      // Send reminder notifications with all channels
      for (const ticket of delayedTickets) {
        if (ticket.assignedTo) {
          const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/tickets/${ticket.id}`;
          
          const result = await this.sendComprehensiveNotification({
            recipientId: ticket.assignedTo.id,
            recipientEmail: ticket.assignedTo.email,
            recipientName: ticket.assignedTo.fullName,
            templateName: 'ticket-reminder',
            subject: `⚠️ Reminder: Unanswered Ticket - ${ticket.subject}`,
            templateData: {
              adminName: ticket.assignedTo.fullName,
              ticketNumber: ticket.ticketNumber,
              userFullName: ticket.user.fullName,
              subject: ticket.subject,
              category: ticket.category.name,
              priority: ticket.priority,
              ticketUrl,
              waitingHours: 6,
              createdAt: ticket.createdAt.toLocaleDateString()
            },
            notificationData: {
              ticketId: ticket.id,
              ticketNumber: ticket.ticketNumber,
              type: 'DELAYED_RESPONSE_REMINDER',
              urgent: true
            },
            priority: 'HIGH' // Delayed responses are high priority
          });

          notificationResults.push({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            result
          });
        }
      }

      return {
        success: true,
        notificationsSent: notificationResults.length,
        results: notificationResults
      };

    } catch (error) {
      console.error('Delayed notifications check error:', error);
      throw error;
    }
  }

  /**
   * Send user notification when they have a reply (enhanced)
   * This can be called when user adds message to their ticket
   */
  static async notifyUserReply(ticketId, messageId) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          user: {
            select: { id: true, fullName: true }
          },
          assignedTo: {
            select: { id: true, fullName: true, email: true }
          },
          messages: {
            where: { id: messageId },
            include: {
              sender: {
                select: { fullName: true }
              }
            }
          }
        }
      });

      if (!ticket || !ticket.assignedTo || !ticket.messages[0]) {
        return { success: false, reason: 'Missing data for notification' };
      }

      const message = ticket.messages[0];
      const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/tickets/${ticket.id}`;

      // Send web app + push notification to assigned admin (no email for user replies)
      const result = await NotificationService.createAndSendNotification({
        recipientIds: [ticket.assignedTo.id],
        type: 'TICKET_NOTIFICATION',
        title: `💬 User Reply: ${ticket.ticketNumber}`,
        message: `${ticket.user.fullName} replied to ticket: ${ticket.subject}`,
        data: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          messageId: message.id,
          type: 'USER_REPLY',
          ticketUrl,
          actionType: 'VIEW_USER_REPLY'
        },
        priority: 'MEDIUM',
        channels: ['IN_APP', 'PUSH'], // No email for user replies
        relatedEntityType: 'TICKET',
        relatedEntityId: ticket.id
      });

      return { success: true, result };

    } catch (error) {
      console.error('User reply notification error:', error);
      throw error;
    }
  }

  /**
   * Integration hooks for ticket lifecycle events
   * Enhanced with all notification channels
   */
  static async handleTicketLifecycleEvent(eventType, ticketId, additionalData = {}) {
    try {
      switch (eventType) {
        case 'CREATED':
          const createdNotificationSent = await this.wasNotificationSent(ticketId, 'CREATED');
          if (!createdNotificationSent) {
            await this.notifyNewTicket(ticketId);
            await this.markNotificationSent(ticketId, 'CREATED');
          }
          break;

        case 'ADMIN_RESPONSE':
          const responseKey = `${ticketId}:RESPONSE:${additionalData.messageId}`;
          const responseNotificationSent = await this.wasNotificationSent(responseKey, 'RESPONSE');
          if (!responseNotificationSent) {
            await this.notifyAdminResponse(ticketId, additionalData.messageId);
            await this.markNotificationSent(responseKey, 'RESPONSE');
          }
          break;

        case 'USER_REPLY':
          // New event type for when user replies
          const userReplyKey = `${ticketId}:USER_REPLY:${additionalData.messageId}`;
          const userReplyNotificationSent = await this.wasNotificationSent(userReplyKey, 'USER_REPLY');
          if (!userReplyNotificationSent) {
            await this.notifyUserReply(ticketId, additionalData.messageId);
            await this.markNotificationSent(userReplyKey, 'USER_REPLY');
          }
          break;

        case 'CLOSED':
          const closedNotificationSent = await this.wasNotificationSent(ticketId, 'CLOSED');
          if (!closedNotificationSent) {
            await this.notifyTicketClosed(ticketId);
            await this.markNotificationSent(ticketId, 'CLOSED');
          }
          break;

        default:
          console.log(`Unhandled ticket lifecycle event: ${eventType}`);
      }

    } catch (error) {
      console.error('Ticket lifecycle event handling error:', error);
      // Don't throw - notifications should not break main functionality
    }
  }

  /**
   * Mark ticket notification as sent to avoid duplicates
   */
  static async markNotificationSent(ticketId, notificationType) {
    try {
      const key = `ticket:notification:${ticketId}:${notificationType}`;
      const CacheService = require('./cache.service');
      
      // Store in cache for 24 hours to prevent duplicate notifications
      await CacheService.setex(key, 86400, JSON.stringify({
        sent: true,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error) {
      console.error('Mark notification sent error:', error);
    }
  }

  /**
   * Check if notification was already sent
   */
  static async wasNotificationSent(ticketId, notificationType) {
    try {
      const key = `ticket:notification:${ticketId}:${notificationType}`;
      const CacheService = require('./cache.service');
      
      const result = await CacheService.get(key);
      return result !== null;
      
    } catch (error) {
      console.error('Check notification sent error:', error);
      return false;
    }
  }

  /**
   * Setup delayed notification checking with enhanced channels
   */
  static setupDelayedNotificationCheck() {
    // Run every hour to check for 6-hour delays
    const HOUR_IN_MS = 60 * 60 * 1000;
    
    setInterval(async () => {
      try {
        console.log('🔍 Checking for delayed ticket notifications...');
        const result = await this.checkAndSendDelayedNotifications();
        
        if (result.notificationsSent > 0) {
          console.log(`📧 Sent ${result.notificationsSent} delayed notifications (Email + Web + Push)`);
        } else {
          console.log('✅ No delayed notifications needed');
        }
      } catch (error) {
        console.error('❌ Delayed notification check failed:', error);
      }
    }, HOUR_IN_MS);
    
    console.log('✅ Ticket delayed notification checker started (runs every hour)');
  }

  /**
   * Get notification statistics for admin dashboard
   */
  static async getNotificationStats() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalTicketNotifications,
        recentTicketNotifications,
        emailSuccessRate,
        pushSuccessRate
      ] = await Promise.all([
        prisma.notification.count({
          where: {
            type: 'TICKET_NOTIFICATION'
          }
        }),
        prisma.notification.count({
          where: {
            type: 'TICKET_NOTIFICATION',
            createdAt: { gte: thirtyDaysAgo }
          }
        }),
        // Calculate email success rate from activity logs
        this.calculateEmailSuccessRate(),
        // Calculate push notification success rate
        this.calculatePushSuccessRate()
      ]);

      return {
        total: {
          ticketNotifications: totalTicketNotifications
        },
        recent30Days: {
          ticketNotifications: recentTicketNotifications
        },
        successRates: {
          email: emailSuccessRate,
          push: pushSuccessRate
        }
      };

    } catch (error) {
      console.error('Notification stats error:', error);
      throw error;
    }
  }

  /**
   * Calculate email success rate from logs
   */
  static async calculateEmailSuccessRate() {
    try {
      const emailLogs = await prisma.activityLog.findMany({
        where: {
          action: {
            contains: 'email'
          }
        },
        select: {
          details: true
        }
      });

      if (emailLogs.length === 0) return 0;

      const successCount = emailLogs.filter(log => 
        log.details?.emailResult?.success === true
      ).length;

      return ((successCount / emailLogs.length) * 100).toFixed(1);

    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate push notification success rate
   */
  static async calculatePushSuccessRate() {
    try {
      const pushNotifications = await prisma.notification.findMany({
        where: {
          channels: {
            has: 'PUSH'
          }
        },
        select: {
          status: true
        }
      });

      if (pushNotifications.length === 0) return 0;

      const successCount = pushNotifications.filter(n => 
        n.status === 'DELIVERED' || n.status === 'READ'
      ).length;

      return ((successCount / pushNotifications.length) * 100).toFixed(1);

    } catch (error) {
      return 0;
    }
  }
}

module.exports = TicketNotificationService;