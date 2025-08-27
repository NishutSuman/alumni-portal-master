const cron = require('node-cron');
const MembershipAdminService = require('../services/membershipAdmin.service');
const { prisma } = require('../config/database');

class MembershipExpiryJob {
  /**
   * Initialize membership expiry cron job
   */
  static initialize() {
    console.log('🕐 Initializing membership expiry cron job...');
    
    // Run daily at 2:00 AM to auto-expire memberships
    cron.schedule('0 2 * * *', async () => {
      console.log('🔄 Running automatic membership expiry check...');
      
      try {
        const expiredCount = await MembershipAdminService.autoExpireMemberships();
        
        // Log system activity
        await prisma.activityLog.create({
          data: {
            userId: 'system',
            action: 'membership_auto_expire_cron',
            details: {
              expiredCount,
              runAt: new Date(),
              jobType: 'scheduled'
            }
          }
        });

        console.log(`✅ Automatic expiry completed: ${expiredCount} memberships expired`);
        
        // Send notification to admins if many memberships expired
        if (expiredCount > 10) {
          console.log(`🚨 High expiry count: ${expiredCount} memberships auto-expired`);
          // TODO: Send email notification to super admins
        }
        
      } catch (error) {
        console.error('❌ Membership auto-expiry cron job failed:', error);
        
        // Log error
        await prisma.activityLog.create({
          data: {
            userId: 'system',
            action: 'membership_auto_expire_cron_error',
            details: {
              error: error.message,
              runAt: new Date(),
              jobType: 'scheduled'
            }
          }
        }).catch(logError => {
          console.error('Failed to log cron error:', logError);
        });
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata" // Adjust timezone as needed
    });
    
    console.log('✅ Membership expiry cron job initialized (runs daily at 2:00 AM IST)');
  }

  /**
   * Manual trigger for testing (call this in development)
   */
  static async runManual() {
    console.log('🔄 Running manual membership expiry check...');
    
    try {
      const expiredCount = await MembershipAdminService.autoExpireMemberships();
      
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'membership_auto_expire_manual',
          details: {
            expiredCount,
            runAt: new Date(),
            jobType: 'manual'
          }
        }
      });

      console.log(`✅ Manual expiry completed: ${expiredCount} memberships expired`);
      return expiredCount;
      
    } catch (error) {
      console.error('❌ Manual membership expiry failed:', error);
      throw error;
    }
  }

  /**
   * Get next scheduled run time
   */
  static getNextRunTime() {
    const now = new Date();
    const tomorrow2AM = new Date(now);
    tomorrow2AM.setDate(now.getDate() + 1);
    tomorrow2AM.setHours(2, 0, 0, 0);
    
    return tomorrow2AM;
  }
}

module.exports = MembershipExpiryJob;