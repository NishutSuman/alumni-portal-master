// src/services/celebrations/FestivalService.js
// Internal festival management using existing Notification table

const { prisma } = require('../../config/database');
const { NotificationService } = require('../notification.service');

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
   */
  static async sendFestivalNotifications() {
    try {
      const todaysFestivals = await this.getTodaysFestivals();
      
      if (todaysFestivals.length === 0) {
        console.log('ℹ️ No festivals today');
        return { success: true, festivalsCount: 0, notificationsSent: 0 };
      }

      console.log(`🎊 Found ${todaysFestivals.length} festival(s) today`);
      
      // Get all active users for notifications
      const allUsers = await prisma.user.findMany({
        where: { 
          isActive: true 
        },
        select: {
          id: true
        }
      });

      const userIds = allUsers.map(user => user.id);
      let totalNotificationsSent = 0;

      // Send notification for each festival
      for (const festival of todaysFestivals) {
        try {
          const notificationResult = await this.sendFestivalNotification(festival, userIds);
          
          if (notificationResult.success) {
            totalNotificationsSent++;
          }
        } catch (error) {
          console.error(`❌ Failed to send festival notification for ${festival.name}:`, error);
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
            festivals: todaysFestivals.map(f => ({
              name: f.name,
              type: f.festivalType,
              priority: f.priority
            })),
            recipientCount: userIds.length,
            date: new Date().toISOString().split('T')[0]
          }
        }
      });

      console.log(`✅ Festival notifications processed: ${totalNotificationsSent}/${todaysFestivals.length} sent successfully`);
      
      return {
        success: true,
        festivalsCount: todaysFestivals.length,
        notificationsSent: totalNotificationsSent,
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
   */
  static async getFestivalCalendar(year = new Date().getFullYear()) {
    try {
      const festivals = await prisma.festival.findMany({
        where: {
          isActive: true,
          date: {
            gte: new Date(`${year}-01-01`),
            lte: new Date(`${year}-12-31`)
          }
        },
        orderBy: { date: 'asc' }
      });

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
        months: Object.values(calendar),
        totalFestivals: festivals.length
      };
    } catch (error) {
      console.error('❌ Error getting festival calendar:', error);
      throw error;
    }
  }
}

module.exports = FestivalService;