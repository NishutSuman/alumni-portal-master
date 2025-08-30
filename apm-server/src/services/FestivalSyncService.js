// src/services/celebrations/FestivalSyncService.js
// Handles external API calls for festival data with smart caching
// Uses existing ActivityLog table for tracking

const axios = require('axios');
const { prisma } = require('../config/database');
const FestivalConfig = require('../config/festivalConfig');

class FestivalSyncService {
  constructor() {
    this.apiConfig = FestivalConfig.getAPIConfig();
    this.majorFestivals = FestivalConfig.getMajorFestivals();
  }

  /**
   * Main festival sync function - Called by weekly cron job
   * Fetches festivals for current year and next year (2 API calls)
   */
  async runFestivalSync() {
    try {
      console.log('🔄 Starting festival sync process...');
      
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const startTime = new Date();
      
      // Check API usage before making calls
      const canMakeAPICalls = await this.checkAPIUsage();
      if (!canMakeAPICalls) {
        console.log('⚠️ API limit reached, using fallback festivals');
        return await this.useFallbackFestivals(currentYear);
      }

      let totalAdded = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      let totalAPICalls = 0;

      try {
        // Sync current year festivals
        const currentYearResult = await this.syncFestivalsForYear(currentYear);
        totalAdded += currentYearResult.added;
        totalUpdated += currentYearResult.updated;
        totalFailed += currentYearResult.failed;
        totalAPICalls += currentYearResult.apiCalls;

        // Sync next year festivals
        const nextYearResult = await this.syncFestivalsForYear(nextYear);
        totalAdded += nextYearResult.added;
        totalUpdated += nextYearResult.updated;
        totalFailed += nextYearResult.failed;
        totalAPICalls += nextYearResult.apiCalls;

        // Log successful sync in ActivityLog
        await prisma.activityLog.create({
          data: {
            userId: 'system',
            action: 'festival_sync_completed',
            details: {
              syncType: 'WEEKLY_SYNC',
              years: [currentYear, nextYear],
              festivalsAdded: totalAdded,
              festivalsUpdated: totalUpdated,
              festivalsFailed: totalFailed,
              apiCallsUsed: totalAPICalls,
              startTime,
              endTime: new Date(),
              duration: Date.now() - startTime.getTime(),
              status: totalFailed === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS'
            }
          }
        });

        console.log(`✅ Festival sync completed: ${totalAdded} added, ${totalUpdated} updated, ${totalFailed} failed`);
        
        return {
          success: true,
          added: totalAdded,
          updated: totalUpdated,
          failed: totalFailed,
          apiCalls: totalAPICalls,
          years: [currentYear, nextYear]
        };

      } catch (error) {
        // Log failed sync in ActivityLog
        await prisma.activityLog.create({
          data: {
            userId: 'system',
            action: 'festival_sync_failed',
            details: {
              syncType: 'WEEKLY_SYNC',
              years: [currentYear, nextYear],
              apiCallsUsed: totalAPICalls,
              error: error.message,
              startTime,
              endTime: new Date()
            }
          }
        });
        
        throw error;
      }
    } catch (error) {
      console.error('❌ Festival sync error:', error);
      
      // Use fallback festivals if sync fails
      console.log('🔄 Using fallback festivals due to sync failure');
      return await this.useFallbackFestivals(new Date().getFullYear());
    }
  }

  /**
   * Sync festivals for a specific year
   */
  async syncFestivalsForYear(year) {
    try {
      console.log(`📅 Syncing festivals for year ${year}...`);
      
      // Make API call to external service
      const apiResponse = await this.fetchFestivalsFromAPI(year);
      
      if (!apiResponse.success) {
        throw new Error(`API call failed: ${apiResponse.error}`);
      }

      // Track API usage in ActivityLog
      await this.trackAPIUsage('CALENDARIFIC', '/holidays');

      const festivals = apiResponse.data.response?.holidays || [];
      console.log(`📥 Received ${festivals.length} festivals from API for ${year}`);

      let added = 0;
      let updated = 0;
      let failed = 0;

      // Process only major festivals from our curated list
      for (const apiFestival of festivals) {
        try {
          const matchedFestival = this.findMatchingMajorFestival(apiFestival);
          
          if (matchedFestival) {
            const result = await this.upsertFestival(apiFestival, matchedFestival, year);
            if (result.created) {
              added++;
            } else {
              updated++;
            }
          }
        } catch (error) {
          console.error(`❌ Failed to process festival ${apiFestival.name}:`, error);
          failed++;
        }
      }

      console.log(`✅ Year ${year} sync completed: ${added} added, ${updated} updated, ${failed} failed`);
      
      return {
        added,
        updated,
        failed,
        apiCalls: 1
      };
    } catch (error) {
      console.error(`❌ Error syncing festivals for year ${year}:`, error);
      throw error;
    }
  }

  /**
   * Fetch festivals from external API
   */
  async fetchFestivalsFromAPI(year) {
    try {
      const apiKey = process.env.CALENDARIFIC_API_KEY;
      
      if (!apiKey) {
        throw new Error('CALENDARIFIC_API_KEY not configured');
      }

      const url = `${this.apiConfig.calendarific.baseUrl}/holidays`;
      const params = {
        api_key: apiKey,
        country: this.apiConfig.calendarific.country,
        year: year,
        type: 'national,religious' // Only major holidays
      };

      console.log(`🌐 Making API call to Calendarific for year ${year}...`);
      
      const response = await axios.get(url, { 
        params,
        timeout: 30000 // 30 second timeout
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ API call failed for year ${year}:`, error.message);
      
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Find matching festival from our curated major festivals list
   */
  findMatchingMajorFestival(apiFestival) {
    const apiName = apiFestival.name.toLowerCase();
    
    return this.majorFestivals.find(majorFestival => {
      // Check main name
      if (majorFestival.name.toLowerCase().includes(apiName) || 
          apiName.includes(majorFestival.name.toLowerCase())) {
        return true;
      }
      
      // Check alternate names
      if (majorFestival.alternateNames) {
        return majorFestival.alternateNames.some(altName => 
          altName.toLowerCase().includes(apiName) || 
          apiName.includes(altName.toLowerCase())
        );
      }
      
      return false;
    });
  }

  /**
   * Create or update festival in database
   */
  async upsertFestival(apiFestival, configFestival, year) {
    try {
      const festivalDate = new Date(apiFestival.date.iso);
      
      // Check if festival already exists for this year
      const existingFestival = await prisma.festival.findFirst({
        where: {
          name: configFestival.name,
          date: {
            gte: new Date(`${year}-01-01`),
            lte: new Date(`${year}-12-31`)
          }
        }
      });

      const festivalData = {
        name: configFestival.name,
        description: configFestival.description || apiFestival.description,
        date: festivalDate,
        festivalType: configFestival.festivalType,
        religion: configFestival.religion || null,
        region: 'INDIA',
        vectorImage: configFestival.vectorImage,
        backgroundColor: configFestival.backgroundColor,
        textColor: configFestival.textColor,
        greetingMessage: configFestival.greetingMessage,
        priority: configFestival.priority,
        isActive: true,
        enableNotifications: true,
        externalId: apiFestival.id?.toString(),
        source: 'CALENDARIFIC',
        lastSyncedAt: new Date()
      };

      if (existingFestival) {
        // Update existing festival
        await prisma.festival.update({
          where: { id: existingFestival.id },
          data: festivalData
        });
        
        console.log(`📝 Updated festival: ${configFestival.name} for ${year}`);
        return { created: false };
      } else {
        // Create new festival
        await prisma.festival.create({
          data: festivalData
        });
        
        console.log(`➕ Added festival: ${configFestival.name} for ${year}`);
        return { created: true };
      }
    } catch (error) {
      console.error(`❌ Error upserting festival ${configFestival.name}:`, error);
      throw error;
    }
  }

  /**
   * Check if we can make API calls without exceeding limits
   * Uses ActivityLog to track monthly usage
   */
  async checkAPIUsage() {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // "2024-12"
      
      // Get this month's API usage from ActivityLog
      const monthStart = new Date(`${currentMonth}-01T00:00:00.000Z`);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthStart.getMonth() + 1);
      
      const apiCalls = await prisma.activityLog.count({
        where: {
          action: 'festival_api_call',
          createdAt: {
            gte: monthStart,
            lt: monthEnd
          }
        }
      });

      const remainingCalls = this.apiConfig.calendarific.monthlyLimit - apiCalls;
      const callsNeeded = this.apiConfig.calendarific.weeklyCallsNeeded;
      
      if (remainingCalls >= callsNeeded) {
        return true;
      }

      console.log(`⚠️ API limit check: ${remainingCalls} remaining, ${callsNeeded} needed`);
      return false;
    } catch (error) {
      console.error('❌ Error checking API usage:', error);
      return false; // Fail safe
    }
  }

  /**
   * Track API usage in ActivityLog
   */
  async trackAPIUsage(provider, endpoint) {
    try {
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'festival_api_call',
          details: {
            provider,
            endpoint,
            monthYear: new Date().toISOString().slice(0, 7),
            timestamp: new Date()
          }
        }
      });
    } catch (error) {
      console.error('❌ Error tracking API usage:', error);
    }
  }

  /**
   * Use fallback festivals when API fails or limit is reached
   */
  async useFallbackFestivals(year) {
    try {
      console.log('🔄 Using fallback static festivals...');
      
      const staticFestivals = FestivalConfig.getStaticFestivals(year);
      let added = 0;
      let updated = 0;

      for (const staticFestival of staticFestivals.holidays) {
        try {
          const matchedConfig = this.majorFestivals.find(f => 
            f.name.toLowerCase() === staticFestival.name.toLowerCase()
          );

          if (matchedConfig) {
            const festivalDate = new Date(staticFestival.date.iso);
            
            const existingFestival = await prisma.festival.findFirst({
              where: {
                name: matchedConfig.name,
                date: {
                  gte: new Date(`${year}-01-01`),
                  lte: new Date(`${year}-12-31`)
                }
              }
            });

            const festivalData = {
              name: matchedConfig.name,
              description: matchedConfig.description,
              date: festivalDate,
              festivalType: matchedConfig.festivalType,
              religion: matchedConfig.religion || null,
              region: 'INDIA',
              vectorImage: matchedConfig.vectorImage,
              backgroundColor: matchedConfig.backgroundColor,
              textColor: matchedConfig.textColor,
              greetingMessage: matchedConfig.greetingMessage,
              priority: matchedConfig.priority,
              isActive: true,
              enableNotifications: true,
              source: 'FALLBACK',
              lastSyncedAt: new Date()
            };

            if (existingFestival) {
              await prisma.festival.update({
                where: { id: existingFestival.id },
                data: festivalData
              });
              updated++;
            } else {
              await prisma.festival.create({
                data: festivalData
              });
              added++;
            }
          }
        } catch (error) {
          console.error(`❌ Failed to process fallback festival ${staticFestival.name}:`, error);
        }
      }

      // Log fallback usage
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'festival_fallback_used',
          details: {
            year,
            festivalsAdded: added,
            festivalsUpdated: updated,
            reason: 'API_LIMIT_REACHED_OR_FAILED'
          }
        }
      });

      console.log(`✅ Fallback festivals processed: ${added} added, ${updated} updated`);
      
      return {
        success: true,
        added,
        updated,
        failed: 0,
        apiCalls: 0,
        source: 'FALLBACK'
      };
    } catch (error) {
      console.error('❌ Fallback festivals error:', error);
      throw error;
    }
  }

  /**
   * Get current API usage statistics from ActivityLog
   */
  async getAPIUsageStats() {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthStart = new Date(`${currentMonth}-01T00:00:00.000Z`);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthStart.getMonth() + 1);
      
      const apiCalls = await prisma.activityLog.count({
        where: {
          action: 'festival_api_call',
          createdAt: {
            gte: monthStart,
            lt: monthEnd
          }
        }
      });

      const remainingCalls = this.apiConfig.calendarific.monthlyLimit - apiCalls;
      const usagePercentage = (apiCalls / this.apiConfig.calendarific.monthlyLimit) * 100;

      return {
        currentMonth,
        requestsMade: apiCalls,
        monthlyLimit: this.apiConfig.calendarific.monthlyLimit,
        remainingCalls,
        usagePercentage: Math.round(usagePercentage)
      };
    } catch (error) {
      console.error('❌ Error getting API usage stats:', error);
      throw error;
    }
  }

  /**
   * Get festival sync history from ActivityLog
   */
  async getSyncHistory(limit = 10) {
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
   * Manual trigger for testing (admin only)
   */
  async runManualSync() {
    try {
      console.log('🔄 Manual festival sync triggered...');
      
      const result = await this.runFestivalSync();
      
      // Log manual trigger
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'festival_manual_sync_triggered',
          details: {
            result,
            triggeredAt: new Date()
          }
        }
      });
      
      return result;
    } catch (error) {
      console.error('❌ Manual sync error:', error);
      throw error;
    }
  }

  /**
   * Clean up old festival data (older than 2 years)
   */
  async cleanupOldFestivals() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
      
      const deletedCount = await prisma.festival.deleteMany({
        where: {
          date: {
            lt: cutoffDate
          }
        }
      });

      // Log cleanup activity
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          action: 'festival_cleanup_completed',
          details: {
            deletedCount: deletedCount.count,
            cutoffDate,
            cleanupDate: new Date()
          }
        }
      });

      console.log(`🧹 Cleaned up ${deletedCount.count} old festivals (older than 2 years)`);
      
      return {
        success: true,
        deletedCount: deletedCount.count,
        cutoffDate
      };
    } catch (error) {
      console.error('❌ Error cleaning up old festivals:', error);
      throw error;
    }
  }
}

module.exports = new FestivalSyncService();