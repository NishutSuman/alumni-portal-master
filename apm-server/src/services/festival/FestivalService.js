// src/services/celebrations/FestivalService.js
// Internal festival management using existing Notification table

const { prisma } = require('../../config/database');
const { NotificationService } = require('../notification.service');
const emailManager = require('../email/EmailManager');
const FestivalConfig = require('../../config/festivalConfig');
const TenantEmailManager = require('../email/TenantEmailManager');

class FestivalService {
  /**
   * Get today's festivals (cached for 12 hours)
   */
  static async getTodaysFestivals() {
    try {
      const today = new Date();
      const todayISO = today.toISOString().split('T')[0];
      
      const festivals = await prisma.festival.findMany({
        where: {
          isActive: true,
          date: {
            gte: new Date(`${todayISO}T00:00:00.000Z`),
            lte: new Date(`${todayISO}T23:59:59.999Z`)
          }
        },
        orderBy: [
          { priority: 'asc' }, // MAJOR first
          { name: 'asc' }
        ]
      });

      // Format festivals for frontend
      return festivals.map(festival => ({
        id: festival.id,
        name: festival.name,
        description: festival.description,
        festivalType: festival.festivalType,
        religion: festival.religion,
        greetingMessage: festival.greetingMessage,
        styling: {
          vectorImage: festival.vectorImage,
          backgroundColor: festival.backgroundColor,
          textColor: festival.textColor
        },
        priority: festival.priority,
        date: festival.date,
        isToday: true
      }));
    } catch (error) {
      console.error('❌ Error fetching today\'s festivals:', error);
      throw error;
    }
  }

  /**
   * Get upcoming festivals (next 30 days)
   */
  static async getUpcomingFestivals(days = 30) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);
      
      const festivals = await prisma.festival.findMany({
        where: {
          isActive: true,
          date: {
            gt: today,
            lte: futureDate
          }
        },
        orderBy: [
          { date: 'asc' },
          { priority: 'asc' }
        ]
      });

      // Group festivals by date and calculate days until
      const groupedFestivals = {};
      
      festivals.forEach(festival => {
        const festivalDate = festival.date.toISOString().split('T')[0];
        const daysUntil = Math.ceil((festival.date - today) / (1000 * 60 * 60 * 24));
        
        if (!groupedFestivals[festivalDate]) {
          groupedFestivals[festivalDate] = {
            date: festivalDate,
            dayName: festival.date.toLocaleDateString('en-IN', { weekday: 'long' }),
            daysUntil,
            festivals: []
          };
        }
        
        groupedFestivals[festivalDate].festivals.push({
          id: festival.id,
          name: festival.name,
          description: festival.description,
          festivalType: festival.festivalType,
          religion: festival.religion,
          greetingMessage: festival.greetingMessage,
          styling: {
            vectorImage: festival.vectorImage,
            backgroundColor: festival.backgroundColor,
            textColor: festival.textColor
          },
          priority: festival.priority
        });
      });

      return Object.values(groupedFestivals);
    } catch (error) {
      console.error('❌ Error fetching upcoming festivals:', error);
      throw error;
    }
  }

  /**
   * Send festival notifications to all active users
   * Uses existing Notification table for tracking
   * Multi-tenant: Groups users by organization and sends from their tenant email
   */
  static async sendFestivalNotifications() {
    try {
      const todaysFestivals = await this.getTodaysFestivals();

      if (todaysFestivals.length === 0) {
        console.log('ℹ️ No festivals today');
        return { success: true, festivalsCount: 0, notificationsSent: 0 };
      }

      console.log(`🎊 Found ${todaysFestivals.length} festival(s) today`);

      // Get all active users with their organization info for multi-tenant email isolation
      const allUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          role: { not: 'DEVELOPER' } // Exclude developer accounts
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              shortName: true,
              tenantCode: true
            }
          }
        }
      });

      const userIds = allUsers.map(user => user.id);
      let totalNotificationsSent = 0;
      let totalEmailsSent = 0;

      // Group users by organization for tenant-specific emails
      const usersByOrg = {};
      for (const user of allUsers) {
        const orgId = user.organizationId || 'default';
        if (!usersByOrg[orgId]) {
          usersByOrg[orgId] = {
            organization: user.organization || null,
            tenantCode: user.organization?.tenantCode || null,
            users: []
          };
        }
        usersByOrg[orgId].users.push(user);
      }

      // Send notifications and emails for each festival
      for (const festival of todaysFestivals) {
        try {
          // Send push notifications (all users)
          const notificationResult = await this.sendFestivalNotification(festival, userIds);

          if (notificationResult.success) {
            totalNotificationsSent++;
          }

          // Send festival emails per organization (multi-tenant isolation)
          for (const orgId of Object.keys(usersByOrg)) {
            const { organization, tenantCode, users } = usersByOrg[orgId];
            const emailResult = await this.sendFestivalEmailsForTenant(
              festival,
              users,
              organization,
              tenantCode
            );
            totalEmailsSent += emailResult.emailsSent;
          }

        } catch (error) {
          console.error(`❌ Failed to send festival notifications/emails for ${festival.name}:`, error);
        }
      }

      // Log overall festival job completion in ActivityLog
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'festival_notifications_sent',
          details: {
            festivalsCount: todaysFestivals.length,
            notificationsSent: totalNotificationsSent,
            emailsSent: totalEmailsSent,
            festivals: todaysFestivals.map(f => ({
              name: f.name,
              type: f.festivalType,
              priority: f.priority
            })),
            recipientCount: userIds.length,
            organizationsCount: Object.keys(usersByOrg).length,
            date: new Date().toISOString().split('T')[0]
          }
        }
      });

      console.log(`✅ Festival notifications processed: ${totalNotificationsSent}/${todaysFestivals.length} push notifications and ${totalEmailsSent} emails sent successfully`);

      return {
        success: true,
        festivalsCount: todaysFestivals.length,
        notificationsSent: totalNotificationsSent,
        emailsSent: totalEmailsSent,
        festivals: todaysFestivals.map(f => ({
          name: f.name,
          type: f.festivalType,
          priority: f.priority
        }))
      };
    } catch (error) {
      console.error('❌ Festival notification service error:', error);
      throw error;
    }
  }

  /**
   * Send notification for a specific festival
   * Uses existing NotificationService
   */
  static async sendFestivalNotification(festival, userIds) {
    try {
      await NotificationService.createAndSendNotification({
        recipientIds: userIds,
        type: 'FESTIVAL_NOTIFICATION',
        title: `🎊 ${festival.name}`,
        message: festival.greetingMessage,
        data: {
          festivalId: festival.id,
          festivalName: festival.name,
          festivalType: festival.festivalType,
          religion: festival.religion,
          vectorImage: festival.styling.vectorImage,
          backgroundColor: festival.styling.backgroundColor,
          textColor: festival.styling.textColor,
          date: new Date().toISOString().split('T')[0]
        },
        priority: 'NORMAL',
        channels: ['PUSH', 'IN_APP'],
        relatedEntityType: 'FESTIVAL_CELEBRATION',
        relatedEntityId: festival.id
      });

      console.log(`✅ Festival notification sent for ${festival.name}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to send festival notification for ${festival.name}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send festival emails for a specific tenant
   * Uses tenant-specific email service for isolation
   */
  static async sendFestivalEmailsForTenant(festival, users, organizationData, tenantCode) {
    try {
      // Get tenant-specific email service
      const emailService = tenantCode
        ? await TenantEmailManager.getServiceForTenant(tenantCode)
        : emailManager.getService();

      let emailsSent = 0;
      const orgName = organizationData?.name || 'Alumni Portal';

      console.log(`📧 Sending festival emails for ${festival.name} to ${users.length} users (Tenant: ${tenantCode || 'default'})...`);

      // Send festival emails to all users in this tenant
      for (const user of users) {
        try {
          await emailService.sendFestivalWish(user, festival, organizationData);
          emailsSent++;
        } catch (error) {
          console.error(`❌ Failed to send festival email to ${user.fullName} (${tenantCode}):`, error);
        }
      }

      console.log(`✅ Festival emails sent for ${festival.name} (${orgName}): ${emailsSent}/${users.length} successful`);

      return {
        success: true,
        emailsSent: emailsSent,
        totalUsers: users.length,
        tenantCode: tenantCode || 'default'
      };
    } catch (error) {
      console.error(`❌ Failed to send festival emails for ${festival.name} (${tenantCode}):`, error);
      return { success: false, emailsSent: 0, error: error.message };
    }
  }

  /**
   * Send festival emails to all users (legacy method - kept for backward compatibility)
   * @deprecated Use sendFestivalEmailsForTenant for multi-tenant support
   */
  static async sendFestivalEmails(festival, users, organizationData) {
    return this.sendFestivalEmailsForTenant(festival, users, organizationData, null);
  }

  /**
   * Get festival statistics for admin dashboard
   */
  static async getFestivalStats() {
    try {
      const currentYear = new Date().getFullYear();
      
      // Total festivals this year
      const totalFestivals = await prisma.festival.count({
        where: {
          date: {
            gte: new Date(`${currentYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        }
      });

      // Festivals by type
      const festivalsByType = await prisma.festival.groupBy({
        by: ['festivalType'],
        where: {
          date: {
            gte: new Date(`${currentYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        },
        _count: {
          festivalType: true
        }
      });

      // Recent festival notifications from existing Notification table
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const recentNotifications = await prisma.notification.count({
        where: {
          type: 'FESTIVAL_NOTIFICATION',
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      });

      return {
        currentYear,
        totalFestivals,
        festivalsByType: festivalsByType.map(item => ({
          type: item.festivalType,
          count: item._count.festivalType
        })),
        recentNotifications
      };
    } catch (error) {
      console.error('❌ Error getting festival stats:', error);
      throw error;
    }
  }

  /**
   * Toggle festival notifications for specific festival
   */
  static async toggleFestivalNotifications(festivalId, enabled) {
    try {
      const festival = await prisma.festival.update({
        where: { id: festivalId },
        data: { enableNotifications: enabled }
      });

      console.log(`${enabled ? '✅' : '❌'} Festival notifications ${enabled ? 'enabled' : 'disabled'} for ${festival.name}`);
      
      return {
        success: true,
        festival: {
          id: festival.id,
          name: festival.name,
          enableNotifications: festival.enableNotifications
        }
      };
    } catch (error) {
      console.error('❌ Error toggling festival notifications:', error);
      throw error;
    }
  }

  /**
   * Get festival notification history from existing Notification table
   */
  static async getFestivalNotificationHistory(limit = 50) {
    try {
      const history = await prisma.notification.findMany({
        where: {
          type: 'FESTIVAL_NOTIFICATION'
        },
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              batch: true
            }
          }
        }
      });

      return history.map(notification => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        sentTo: notification.user.fullName,
        userBatch: notification.user.batch,
        festivalData: notification.payload, // Festival info stored in payload
        sentAt: notification.createdAt,
        isRead: notification.isRead
      }));
    } catch (error) {
      console.error('❌ Error getting festival notification history:', error);
      throw error;
    }
  }

  /**
   * Get combined today's celebrations (birthdays + festivals)
   */
  static async getTodaysCelebrations() {
    try {
      const [birthdays, festivals] = await Promise.all([
        require('../BirthdayService').getTodaysBirthdays(),
        this.getTodaysFestivals()
      ]);

      return {
        date: new Date().toISOString().split('T')[0],
        celebrations: {
          birthdays: {
            count: birthdays.length,
            list: birthdays
          },
          festivals: {
            count: festivals.length,
            list: festivals
          }
        },
        hasAnyCelebrations: birthdays.length > 0 || festivals.length > 0
      };
    } catch (error) {
      console.error('❌ Error getting today\'s celebrations:', error);
      throw error;
    }
  }

  /**
   * Get celebration summary for admin dashboard
   */
  static async getCelebrationSummary() {
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();

      // Today's celebrations
      const todaysCelebrations = await this.getTodaysCelebrations();
      
      // This month's stats
      const thisMonthBirthdays = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "users" 
        WHERE "isActive" = true 
        AND "dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM "dateOfBirth") = ${currentMonth}
      `;

      const thisMonthFestivals = await prisma.festival.count({
        where: {
          isActive: true,
          date: {
            gte: new Date(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`),
            lte: new Date(currentYear, currentMonth, 0) // Last day of month
          }
        }
      });

      return {
        today: todaysCelebrations,
        thisMonth: {
          birthdays: parseInt(thisMonthBirthdays[0]?.count || 0),
          festivals: thisMonthFestivals
        },
        month: today.toLocaleDateString('en-IN', { month: 'long' }),
        year: currentYear
      };
    } catch (error) {
      console.error('❌ Error getting celebration summary:', error);
      throw error;
    }
  }

  /**
   * Search festivals by name, type, or religion
   */
  static async searchFestivals(query, filters = {}) {
    try {
      const { 
        festivalType, 
        religion, 
        priority, 
        year = new Date().getFullYear(),
        limit = 50 
      } = filters;

      const whereConditions = {
        isActive: true,
        date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        }
      };

      // Add search query
      if (query) {
        whereConditions.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ];
      }

      // Add filters
      if (festivalType) {
        whereConditions.festivalType = festivalType;
      }
      
      if (religion) {
        whereConditions.religion = religion;
      }
      
      if (priority) {
        whereConditions.priority = priority;
      }

      const festivals = await prisma.festival.findMany({
        where: whereConditions,
        take: limit,
        orderBy: [
          { date: 'asc' },
          { priority: 'asc' }
        ]
      });

      return festivals.map(festival => ({
        id: festival.id,
        name: festival.name,
        description: festival.description,
        date: festival.date,
        festivalType: festival.festivalType,
        religion: festival.religion,
        greetingMessage: festival.greetingMessage,
        styling: {
          vectorImage: festival.vectorImage,
          backgroundColor: festival.backgroundColor,
          textColor: festival.textColor
        },
        priority: festival.priority,
        enableNotifications: festival.enableNotifications,
        source: festival.source,
        daysUntil: Math.ceil((festival.date - new Date()) / (1000 * 60 * 60 * 24))
      }));
    } catch (error) {
      console.error('❌ Error searching festivals:', error);
      throw error;
    }
  }

  /**
   * Get festival calendar for the year (month-wise breakdown)
   * Auto-seeds from static config if database is empty
   */
  static async getFestivalCalendar(year = new Date().getFullYear()) {
    try {
      let festivals = await prisma.festival.findMany({
        where: {
          isActive: true,
          date: {
            gte: new Date(`${year}-01-01`),
            lte: new Date(`${year}-12-31`)
          }
        },
        orderBy: { date: 'asc' }
      });

      // If no festivals in database, seed from static config
      if (festivals.length === 0) {
        console.log(`📅 No festivals found for ${year}, seeding from static config...`);
        await this.seedFestivalsFromConfig(year);

        // Fetch again after seeding
        festivals = await prisma.festival.findMany({
          where: {
            isActive: true,
            date: {
              gte: new Date(`${year}-01-01`),
              lte: new Date(`${year}-12-31`)
            }
          },
          orderBy: { date: 'asc' }
        });
      }

      // Group by month
      const calendar = {};
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      // Initialize all months
      months.forEach((month, index) => {
        calendar[month] = {
          monthNumber: index + 1,
          monthName: month,
          festivals: []
        };
      });

      // Populate festivals
      festivals.forEach(festival => {
        const monthIndex = festival.date.getMonth();
        const monthName = months[monthIndex];

        calendar[monthName].festivals.push({
          id: festival.id,
          name: festival.name,
          date: festival.date,
          dayOfMonth: festival.date.getDate(),
          festivalType: festival.festivalType,
          religion: festival.religion,
          priority: festival.priority,
          styling: {
            vectorImage: festival.vectorImage,
            backgroundColor: festival.backgroundColor,
            textColor: festival.textColor
          },
          greetingMessage: festival.greetingMessage
        });
      });

      return {
        year,
        calendar: Object.values(calendar).map(month => ({
          month: month.monthNumber,
          monthName: month.monthName,
          festivals: month.festivals
        })),
        totalFestivals: festivals.length
      };
    } catch (error) {
      console.error('❌ Error getting festival calendar:', error);
      throw error;
    }
  }

  /**
   * Seed festivals from static configuration
   * Used when database is empty or for initial setup
   */
  static async seedFestivalsFromConfig(year = new Date().getFullYear()) {
    try {
      const majorFestivals = FestivalConfig.getMajorFestivals(year);
      let seededCount = 0;

      console.log(`🌱 Seeding ${majorFestivals.length} festivals for ${year}...`);

      for (const festival of majorFestivals) {
        // Skip lunar festivals without fixed dates (they need API data)
        if (festival.isLunar && !festival.date?.iso) {
          console.log(`⏭️ Skipping ${festival.name} (lunar calendar - needs API sync)`);
          continue;
        }

        // Check if festival already exists
        const existing = await prisma.festival.findFirst({
          where: {
            name: festival.name,
            date: {
              gte: new Date(`${year}-01-01`),
              lte: new Date(`${year}-12-31`)
            }
          }
        });

        if (existing) {
          console.log(`⏭️ Festival ${festival.name} already exists for ${year}`);
          continue;
        }

        // Create festival record
        await prisma.festival.create({
          data: {
            name: festival.name,
            description: festival.description || '',
            date: new Date(festival.date.iso),
            festivalType: festival.festivalType || 'OTHER',
            religion: festival.religion || null,
            priority: festival.priority || 'MINOR',
            greetingMessage: festival.greetingMessage || `Happy ${festival.name}!`,
            vectorImage: festival.vectorImage || null,
            backgroundColor: festival.backgroundColor || '#f8f9fa',
            textColor: festival.textColor || '#333333',
            source: 'STATIC_CONFIG',
            enableNotifications: true,
            isActive: true
          }
        });

        seededCount++;
        console.log(`✅ Seeded festival: ${festival.name}`);
      }

      console.log(`🎉 Successfully seeded ${seededCount} festivals for ${year}`);
      return { success: true, seededCount };
    } catch (error) {
      console.error('❌ Error seeding festivals:', error);
      throw error;
    }
  }
}

module.exports = FestivalService;