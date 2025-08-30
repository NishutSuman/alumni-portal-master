// src/jobs/weeklyFestivalSyncJob.js
// Weekly cron job for syncing festivals from external API
// Runs weekly to stay within API limits (104 calls/year vs 1000 limit)

const cron = require('node-cron');
const FestivalSyncService = require('../services/FestivalSyncService');
const { prisma } = require('../config/database');

class WeeklyFestivalSyncJob {
  constructor() {
    this.isRunning = false;
    this.jobSchedule = '0 3 * * 0'; // Every Sunday at 3:00 AM IST
    this.timezone = 'Asia/Kolkata';
  }

  /**
   * Initialize the weekly festival sync cron job
   */
  static initialize() {
    const job = new WeeklyFestivalSyncJob();
    
    console.log('🕐 Initializing weekly festival sync cron job...');
    
    cron.schedule(job.jobSchedule, async () => {
      console.log('🔄 Running weekly festival sync...');
      await job.runWeeklyFestivalSync();
    }, {
      scheduled: true,
      timezone: job.timezone
    });
    
    console.log(`✅ Weekly festival sync job initialized (runs Sundays at 3:00 AM ${job.timezone})`);
    return job;
  }

  /**
   * Main function to run weekly festival sync
   */
  async runWeeklyFestivalSync() {
    if (this.isRunning) {
      console.log('⚠️ Festival sync job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    
    try {
      console.log('🔄 Starting weekly festival sync...');
      
      const result = await FestivalSyncService.runFestivalSync();
      
      console.log('✅ Weekly festival sync completed successfully');
      
      return {
        success: true,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        result
      };

    } catch (error) {
      console.error('❌ Weekly festival sync error:', error);
      
      // Log error in ActivityLog
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'weekly_festival_sync_error',
          details: {
            error: error.message,
            startTime,
            endTime: new Date(),
            jobType: 'weekly_scheduled'
          }
        }
      });
      
      throw error;
    } finally {
      this.isRunning = false;
      console.log('⏰ Weekly festival sync job completed');
    }
  }

  /**
   * Manual trigger for testing
   */
  async runNow() {
    console.log('🔄 Manually triggering weekly festival sync...');
    return await this.runWeeklyFestivalSync();
  }

  /**
   * Get job status and next run time
   */
  static getJobInfo() {
    return {
      name: 'Weekly Festival Sync Job',
      description: 'Syncs festival data from external API (Calendarific)',
      schedule: '0 3 * * 0',
      timezone: 'Asia/Kolkata',
      runTime: '3:00 AM IST every Sunday',
      nextRun: 'Every Sunday at 3:00 AM IST',
      isActive: true,
      apiUsage: '2 calls per week (current year + next year)',
      annualUsage: '~104 API calls (well within 1000 limit)'
    };
  }

  /**
   * Get recent sync execution history from ActivityLog
   */
  static async getSyncHistory(limit = 10) {
    try {
      const history = await prisma.activityLog.findMany({
        where: {
          action: {
            in: ['festival_sync_completed', 'festival_sync_failed', 'festival_fallback_used']
          }
        },
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      });

      return history.map(log => ({
        id: log.id,
        action: log.action,
        status: log.action.includes('failed') ? 'FAILED' : 'SUCCESS',
        details: log.details,
        timestamp: log.createdAt
      }));
    } catch (error) {
      console.error('❌ Error getting sync history:', error);
      throw error;
    }
  }

  /**
   * Get current API usage statistics
   */
  static async getAPIUsageStats() {
    try {
      return await FestivalSyncService.getAPIUsageStats();
    } catch (error) {
      console.error('❌ Error getting API usage stats:', error);
      throw error;
    }
  }
}

module.exports = new WeeklyFestivalSyncJob();