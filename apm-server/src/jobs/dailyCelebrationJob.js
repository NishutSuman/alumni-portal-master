// src/jobs/dailyCelebrationJob.js
// Daily cron job for birthday and festival notifications at 8 AM
// Uses existing ActivityLog table for tracking

const cron = require('node-cron');
const BirthdayService = require('../services/birthday/BirthdayService');
const FestivalService = require('../services/festival/FestivalService');
const { prisma } = require('../config/database');

class DailyCelebrationJob {
  constructor() {
    this.isRunning = false;
    this.jobSchedule = '0 8 * * *'; // Every day at 8:00 AM IST
    this.timezone = 'Asia/Kolkata';
  }

  /**
   * Initialize the daily celebration cron job
   */
  static initialize() {
    const job = new DailyCelebrationJob();
    
    console.log('🕐 Initializing daily celebration cron job...');
    
    cron.schedule(job.jobSchedule, async () => {
      console.log('🎉 Running daily celebration notifications...');
      await job.runDailyCelebrations();
    }, {
      scheduled: true,
      timezone: job.timezone
    });
    
    console.log(`✅ Daily celebration job initialized (runs daily at 8:00 AM ${job.timezone})`);
    return job;
  }

  /**
   * Main function to run daily celebrations
   */
  async runDailyCelebrations() {
    if (this.isRunning) {
      console.log('⚠️ Daily celebration job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    
    try {
      console.log('🎊 Starting daily celebration notifications...');
      
      // Run birthday and festival notifications concurrently
      const [birthdayResult, festivalResult] = await Promise.allSettled([
        this.processBirthdayNotifications(),
        this.processFestivalNotifications()
      ]);

      // Log results
      this.logResults(birthdayResult, festivalResult);

      // Log job completion in existing ActivityLog table
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'daily_celebration_job_completed',
          details: {
            startTime: startTime,
            endTime: new Date(),
            duration: Date.now() - startTime.getTime(),
            birthdayResult: birthdayResult.status === 'fulfilled' ? birthdayResult.value : { error: birthdayResult.reason?.message },
            festivalResult: festivalResult.status === 'fulfilled' ? festivalResult.value : { error: festivalResult.reason?.message },
            jobType: 'daily_scheduled'
          }
        }
      });

      const summary = {
        success: true,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        birthdays: birthdayResult.status === 'fulfilled' ? birthdayResult.value : { error: birthdayResult.reason?.message },
        festivals: festivalResult.status === 'fulfilled' ? festivalResult.value : { error: festivalResult.reason?.message }
      };

      console.log('✅ Daily celebration job completed successfully');
      return summary;

    } catch (error) {
      console.error('❌ Daily celebration job error:', error);
      
      // Log error in existing ActivityLog table
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'daily_celebration_job_error',
          details: {
            error: error.message,
            startTime,
            endTime: new Date(),
            jobType: 'daily_scheduled'
          }
        }
      });
      
      throw error;
    } finally {
      this.isRunning = false;
      console.log('⏰ Daily celebration job completed');
    }
  }

  /**
   * Process birthday notifications
   */
  async processBirthdayNotifications() {
    try {
      console.log('🎂 Processing birthday notifications...');
      
      const result = await BirthdayService.sendBirthdayNotifications();
      
      if (result.birthdaysCount > 0) {
        console.log(`🎉 Processed ${result.birthdaysCount} birthday(s), sent ${result.notificationsSent} notifications`);
      } else {
        console.log('ℹ️ No birthdays today');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Birthday notification processing error:', error);
      throw error;
    }
  }

  /**
   * Process festival notifications
   */
  async processFestivalNotifications() {
    try {
      console.log('🎊 Processing festival notifications...');
      
      const result = await FestivalService.sendFestivalNotifications();
      
      if (result.festivalsCount > 0) {
        console.log(`🎊 Processed ${result.festivalsCount} festival(s), sent ${result.notificationsSent} notifications`);
      } else {
        console.log('ℹ️ No festivals today');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Festival notification processing error:', error);
      throw error;
    }
  }

  /**
   * Log job results
   */
  logResults(birthdayResult, festivalResult) {
    console.log('\n📊 Daily Celebration Job Results:');
    console.log('=====================================');
    
    if (birthdayResult.status === 'fulfilled') {
      const br = birthdayResult.value;
      console.log(`✅ Birthdays: ${br.birthdaysCount} found, ${br.notificationsSent} notifications sent`);
      
      if (br.birthdays && br.birthdays.length > 0) {
        console.log('🎂 Today\'s birthdays:');
        br.birthdays.forEach(b => {
          console.log(`   - ${b.name} (Batch ${b.batch}) turns ${b.age}`);
        });
      }
    } else {
      console.error('❌ Birthday error:', birthdayResult.reason?.message);
    }

    if (festivalResult.status === 'fulfilled') {
      const fr = festivalResult.value;
      console.log(`✅ Festivals: ${fr.festivalsCount} found, ${fr.notificationsSent} notifications sent`);
      
      if (fr.festivals && fr.festivals.length > 0) {
        console.log('🎊 Today\'s festivals:');
        fr.festivals.forEach(f => {
          console.log(`   - ${f.name} (${f.type}, ${f.priority})`);
        });
      }
    } else {
      console.error('❌ Festival error:', festivalResult.reason?.message);
    }
    
    console.log('=====================================\n');
  }

  /**
   * Manual trigger for testing
   */
  async runNow() {
    console.log('🔄 Manually triggering daily celebration job...');
    return await this.runDailyCelebrations();
  }

  /**
   * Get job status and next run time
   */
  static getJobInfo() {
    return {
      name: 'Daily Celebration Job',
      description: 'Sends birthday and festival notifications to all active users',
      schedule: '0 8 * * *',
      timezone: 'Asia/Kolkata',
      runTime: '8:00 AM IST daily',
      nextRun: 'Tomorrow at 8:00 AM IST',
      isActive: true,
      features: [
        'Birthday notifications for today\'s birthdays',
        'Festival notifications for today\'s festivals',
        'Smart notification targeting (excludes birthday person from their own notification)',
        'Comprehensive logging in ActivityLog table'
      ]
    };
  }

  /**
   * Get recent job execution history from existing ActivityLog table
   */
  static async getJobHistory(limit = 10) {
    try {
      const history = await prisma.activityLog.findMany({
        where: {
          action: {
            in: ['daily_celebration_job_completed', 'daily_celebration_job_error']
          }
        },
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      });

      return history.map(log => ({
        id: log.id,
        status: log.action.includes('error') ? 'FAILED' : 'SUCCESS',
        startTime: log.details?.startTime,
        endTime: log.details?.endTime,
        duration: log.details?.duration,
        birthdayCount: log.details?.birthdayResult?.birthdaysCount || 0,
        festivalCount: log.details?.festivalResult?.festivalsCount || 0,
        totalNotifications: (log.details?.birthdayResult?.notificationsSent || 0) + 
                           (log.details?.festivalResult?.notificationsSent || 0),
        error: log.details?.error,
        createdAt: log.createdAt
      }));
    } catch (error) {
      console.error('❌ Error getting job history:', error);
      throw error;
    }
  }

  /**
   * Get today's job status (if run today)
   */
  static async getTodaysJobStatus() {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(startOfDay.getDate() + 1);

      const todaysJob = await prisma.activityLog.findFirst({
        where: {
          action: {
            in: ['daily_celebration_job_completed', 'daily_celebration_job_error']
          },
          createdAt: {
            gte: startOfDay,
            lt: endOfDay
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!todaysJob) {
        return {
          hasRunToday: false,
          message: 'Job has not run today yet'
        };
      }

      return {
        hasRunToday: true,
        status: todaysJob.action.includes('error') ? 'FAILED' : 'SUCCESS',
        runTime: todaysJob.createdAt,
        details: todaysJob.details
      };
    } catch (error) {
      console.error('❌ Error getting today\'s job status:', error);
      throw error;
    }
  }
}

module.exports = new DailyCelebrationJob();