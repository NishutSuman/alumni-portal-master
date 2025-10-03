// src/services/celebrations/BirthdayService.js
// Uses existing Notification table for tracking instead of custom logs

const { prisma } = require('../../config/database');
const { NotificationService } = require('../notification.service');
const emailManager = require('../email/EmailManager');

class BirthdayService {
  /**
   * Get today's birthdays
   */
  static async getTodaysBirthdays() {
    try {
      const today = new Date();
      const todayMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
      const todayDate = today.getDate();
      
      const birthdays = await prisma.$queryRaw`
        SELECT id, "fullName", email, "dateOfBirth", batch, "profileImage", "isProfilePublic"
        FROM "users" 
        WHERE "isActive" = true 
        AND "dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM "dateOfBirth") = ${todayMonth}
        AND EXTRACT(DAY FROM "dateOfBirth") = ${todayDate}
        ORDER BY "fullName" ASC
      `;

      // Calculate ages and format data
      const birthdaysWithAge = birthdays.map(user => {
        const age = this.calculateAge(user.dateOfBirth);
        return {
          ...user,
          age,
          celebrationMessage: this.generateBirthdayMessage(user.fullName, age)
        };
      });

      return birthdaysWithAge;
    } catch (error) {
      console.error('❌ Error fetching today\'s birthdays:', error);
      throw error;
    }
  }

  /**
   * Get upcoming birthdays (next 7 days)
   */
  static async getUpcomingBirthdays(days = 7) {
    try {
      const today = new Date();
      const upcomingBirthdays = [];
      
      // Check each of the next 'days' days
      for (let i = 1; i <= days; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        
        const month = checkDate.getMonth() + 1;
        const date = checkDate.getDate();
        
        const dayBirthdays = await prisma.$queryRaw`
          SELECT id, "fullName", email, "dateOfBirth", batch, "profileImage", "isProfilePublic"
          FROM "users" 
          WHERE "isActive" = true 
          AND "dateOfBirth" IS NOT NULL
          AND EXTRACT(MONTH FROM "dateOfBirth") = ${month}
          AND EXTRACT(DAY FROM "dateOfBirth") = ${date}
          ORDER BY "fullName" ASC
        `;

        if (dayBirthdays.length > 0) {
          upcomingBirthdays.push({
            date: checkDate.toISOString().split('T')[0],
            dayName: checkDate.toLocaleDateString('en-IN', { weekday: 'long' }),
            daysFromToday: i,
            birthdays: dayBirthdays.map(user => ({
              ...user,
              age: this.calculateAge(user.dateOfBirth),
              celebrationMessage: this.generateBirthdayMessage(user.fullName, this.calculateAge(user.dateOfBirth))
            }))
          });
        }
      }

      return upcomingBirthdays;
    } catch (error) {
      console.error('❌ Error fetching upcoming birthdays:', error);
      throw error;
    }
  }

  /**
   * Send birthday notifications to all active users
   * Uses existing Notification table for tracking
   */
  static async sendBirthdayNotifications() {
    try {
      const todaysBirthdays = await this.getTodaysBirthdays();
      
      if (todaysBirthdays.length === 0) {
        console.log('ℹ️ No birthdays today');
        return { success: true, birthdaysCount: 0, notificationsSent: 0 };
      }

      console.log(`🎂 Found ${todaysBirthdays.length} birthday(s) today`);
      
      // Get all active users to send notifications to
      const allUsers = await prisma.user.findMany({
        where: { 
          isActive: true 
        },
        select: {
          id: true,
          fullName: true
        }
      });

      let totalNotificationsSent = 0;
      
      // Send individual birthday notifications
      for (const birthdayUser of todaysBirthdays) {
        try {
          // Get recipients (all users except the birthday person)
          const recipients = allUsers
            .filter(user => user.id !== birthdayUser.id)
            .map(user => user.id);
          
          if (recipients.length > 0) {
            const notificationResult = await this.sendBirthdayNotification(birthdayUser, recipients);
            
            if (notificationResult.success) {
              totalNotificationsSent++;
            }
          }
        } catch (error) {
          console.error(`❌ Failed to send birthday notification for ${birthdayUser.fullName}:`, error);
        }
      }

      // TODO: Log overall birthday job completion (requires valid userId)
      // Skip activity logging for system jobs

      console.log(`✅ Birthday notifications processed: ${totalNotificationsSent}/${todaysBirthdays.length} sent successfully`);
      
      return {
        success: true,
        birthdaysCount: todaysBirthdays.length,
        notificationsSent: totalNotificationsSent,
        birthdays: todaysBirthdays.map(user => ({
          name: user.fullName,
          age: user.age,
          batch: user.batch
        }))
      };
    } catch (error) {
      console.error('❌ Birthday notification service error:', error);
      throw error;
    }
  }

  /**
   * Send birthday wish emails to birthday people at midnight
   */
  static async sendBirthdayEmails() {
    try {
      const todaysBirthdays = await this.getTodaysBirthdays();
      
      if (todaysBirthdays.length === 0) {
        console.log('ℹ️ No birthday emails to send today');
        return { success: true, birthdaysCount: 0, emailsSent: 0 };
      }

      console.log(`🎂 Found ${todaysBirthdays.length} birthday(s) today - sending email wishes`);
      
      // Get organization data
      const organization = await prisma.organization.findFirst({
        select: {
          name: true,
          shortName: true
        }
      });

      let totalEmailsSent = 0;
      
      // Send birthday emails to each birthday person
      for (const birthdayUser of todaysBirthdays) {
        try {
          await this.sendBirthdayEmail(birthdayUser, organization);
          totalEmailsSent++;
        } catch (error) {
          console.error(`❌ Failed to send birthday email to ${birthdayUser.fullName}:`, error);
        }
      }

      // TODO: Log birthday email completion (requires valid userId)
      // Skip activity logging for system jobs

      console.log(`✅ Birthday emails processed: ${totalEmailsSent}/${todaysBirthdays.length} sent successfully`);
      
      return {
        success: true,
        birthdaysCount: todaysBirthdays.length,
        emailsSent: totalEmailsSent,
        birthdays: todaysBirthdays.map(user => ({
          name: user.fullName,
          age: user.age,
          batch: user.batch,
          email: user.email
        }))
      };
    } catch (error) {
      console.error('❌ Birthday email service error:', error);
      throw error;
    }
  }

  /**
   * Send birthday wish email to specific birthday person
   */
  static async sendBirthdayEmail(birthdayUser, organizationData) {
    try {
      const emailService = emailManager.getService();
      
      await emailService.sendBirthdayWish(birthdayUser, organizationData);
      console.log(`✅ Birthday email sent to ${birthdayUser.fullName} (${birthdayUser.email})`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to send birthday email to ${birthdayUser.fullName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification for a specific birthday
   * Uses existing NotificationService
   */
  static async sendBirthdayNotification(birthdayUser, recipientIds) {
    try {
      const title = `🎂 Birthday Celebration!`;
      const message = `${birthdayUser.fullName} (Batch ${birthdayUser.batch}) is celebrating ${birthdayUser.age}${this.getOrdinalSuffix(birthdayUser.age)} birthday today! 🎉`;
      
      await NotificationService.createAndSendNotification({
        recipientIds,
        type: 'BIRTHDAY_NOTIFICATION',
        title,
        message,
        data: {
          birthdayUserId: birthdayUser.id,
          birthdayUserName: birthdayUser.fullName,
          birthdayUserBatch: birthdayUser.batch,
          age: birthdayUser.age,
          profileImage: birthdayUser.profileImage,
          celebrationMessage: birthdayUser.celebrationMessage,
          date: new Date().toISOString().split('T')[0]
        },
        priority: 'NORMAL',
        channels: ['PUSH', 'IN_APP'],
        relatedEntityType: 'BIRTHDAY_CELEBRATION',
        relatedEntityId: birthdayUser.id
      });

      console.log(`✅ Birthday notification sent for ${birthdayUser.fullName}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to send birthday notification for ${birthdayUser.fullName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get birthday statistics for admin dashboard
   * Uses existing tables for data
   */
  static async getBirthdayStats() {
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      // Get this month's birthdays
      const thisMonthBirthdays = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "users" 
        WHERE "isActive" = true 
        AND "dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM "dateOfBirth") = ${currentMonth}
      `;

      // Get today's birthdays count
      const todaysBirthdaysCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "users" 
        WHERE "isActive" = true 
        AND "dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM "dateOfBirth") = ${currentMonth}
        AND EXTRACT(DAY FROM "dateOfBirth") = ${today.getDate()}
      `;

      // Get recent birthday notifications from existing Notification table
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const recentNotifications = await prisma.notification.count({
        where: {
          type: 'BIRTHDAY_NOTIFICATION',
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      });

      return {
        thisMonth: parseInt(thisMonthBirthdays[0]?.count || 0),
        today: parseInt(todaysBirthdaysCount[0]?.count || 0),
        recentNotifications,
        currentMonth: today.toLocaleDateString('en-IN', { month: 'long' })
      };
    } catch (error) {
      console.error('❌ Error getting birthday stats:', error);
      throw error;
    }
  }

  /**
   * Calculate age from birth date
   */
  static calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Get ordinal suffix for age (1st, 2nd, 3rd, etc.)
   */
  static getOrdinalSuffix(num) {
    const ones = num % 10;
    const tens = Math.floor(num / 10) % 10;
    
    if (tens === 1) {
      return 'th';
    }
    
    switch (ones) {
      case 1: return 'st';
      case 2: return 'nd'; 
      case 3: return 'rd';
      default: return 'th';
    }
  }

  /**
   * Generate personalized birthday message
   */
  static generateBirthdayMessage(name, age) {
    const messages = [
      `Wishing ${name} a fantastic ${age}${this.getOrdinalSuffix(age)} birthday! 🎉`,
      `Happy ${age}${this.getOrdinalSuffix(age)} birthday to ${name}! May this year bring joy and success! 🎂`,
      `Celebrating ${name}'s ${age}${this.getOrdinalSuffix(age)} birthday today! 🎈`,
      `${name} turns ${age} today! Wishing a year filled with happiness! 🎊`
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Get month-wise birthday distribution for analytics
   */
  static async getBirthdayDistribution() {
    try {
      const distribution = await prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM "dateOfBirth") as month,
          COUNT(*) as count
        FROM "users" 
        WHERE "isActive" = true 
        AND "dateOfBirth" IS NOT NULL
        GROUP BY EXTRACT(MONTH FROM "dateOfBirth")
        ORDER BY month
      `;

      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      return distribution.map(item => ({
        month: months[parseInt(item.month) - 1],
        monthNumber: parseInt(item.month),
        count: parseInt(item.count)
      }));
    } catch (error) {
      console.error('❌ Error getting birthday distribution:', error);
      throw error;
    }
  }

  /**
   * Get users with birthdays in specific month
   */
  static async getBirthdaysInMonth(month, year = new Date().getFullYear()) {
    try {
      const birthdays = await prisma.$queryRaw`
        SELECT 
          id, "fullName", email, "dateOfBirth", batch, "profileImage", "isProfilePublic"
        FROM "users" 
        WHERE "isActive" = true 
        AND "dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM "dateOfBirth") = ${month}
        ORDER BY EXTRACT(DAY FROM "dateOfBirth") ASC, "fullName" ASC
      `;

      return birthdays.map(user => ({
        ...user,
        age: this.calculateAge(user.dateOfBirth),
        dayOfMonth: new Date(user.dateOfBirth).getDate()
      }));
    } catch (error) {
      console.error('❌ Error getting birthdays in month:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for testing birthday notifications
   */
  static async triggerTodaysBirthdayNotifications() {
    try {
      console.log('🔄 Manually triggering birthday notifications...');
      return await this.sendBirthdayNotifications();
    } catch (error) {
      console.error('❌ Manual birthday trigger error:', error);
      throw error;
    }
  }

  /**
   * Get birthday notification history from existing Notification table
   */
  static async getBirthdayNotificationHistory(limit = 50) {
    try {
      const history = await prisma.notification.findMany({
        where: {
          type: 'BIRTHDAY_NOTIFICATION'
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
        birthdayData: notification.payload, // Birthday user info stored in payload
        sentAt: notification.createdAt,
        isRead: notification.isRead
      }));
    } catch (error) {
      console.error('❌ Error getting birthday notification history:', error);
      throw error;
    }
  }

  /**
   * Check if user has birthday today
   */
  static async isUserBirthdayToday(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { dateOfBirth: true }
      });

      if (!user?.dateOfBirth) {
        return false;
      }

      const today = new Date();
      const birthDate = new Date(user.dateOfBirth);
      
      return (
        today.getMonth() === birthDate.getMonth() &&
        today.getDate() === birthDate.getDate()
      );
    } catch (error) {
      console.error('❌ Error checking user birthday:', error);
      return false;
    }
  }

  /**
   * Get birthday celebration data for specific user
   */
  static async getUserBirthdayCelebration(userId) {
    try {
      const isBirthdayToday = await this.isUserBirthdayToday(userId);
      
      if (!isBirthdayToday) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          dateOfBirth: true,
          batch: true,
          profileImage: true
        }
      });

      if (!user) {
        return null;
      }

      const age = this.calculateAge(user.dateOfBirth);
      
      return {
        user: {
          id: user.id,
          name: user.fullName,
          batch: user.batch,
          profileImage: user.profileImage,
          age
        },
        celebrationMessage: this.generateBirthdayMessage(user.fullName, age),
        specialMessage: `🎂 Happy ${age}${this.getOrdinalSuffix(age)} Birthday!`,
        birthdayDate: user.dateOfBirth
      };
    } catch (error) {
      console.error('❌ Error getting user birthday celebration:', error);
      throw error;
    }
  }

  /**
   * Get recent birthday notification stats from existing Notification table
   */
  static async getRecentNotificationStats(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const stats = await prisma.notification.groupBy({
        by: ['type'],
        where: {
          type: 'BIRTHDAY_NOTIFICATION',
          createdAt: {
            gte: cutoffDate
          }
        },
        _count: {
          type: true
        }
      });

      const totalSent = stats.reduce((sum, stat) => sum + stat._count.type, 0);
      
      return {
        period: `Last ${days} days`,
        totalNotificationsSent: totalSent,
        averagePerDay: Math.round(totalSent / days)
      };
    } catch (error) {
      console.error('❌ Error getting notification stats:', error);
      throw error;
    }
  }
}

module.exports = BirthdayService;