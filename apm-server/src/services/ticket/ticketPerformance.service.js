// src/services/ticketPerformance.service.js
const { prisma } = require('../../config/database');

class TicketPerformanceService {
  
  /**
   * Clean up old search history entries (older than 30 days)
   * Run this daily via cron job
   */
  static async cleanupOldSearchHistory() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Check if search history table exists (from Phase 3)
      const searchHistoryExists = await this.checkTableExists('ticket_search_history');
      
      if (searchHistoryExists) {
        const deletedCount = await prisma.$executeRaw`
          DELETE FROM ticket_search_history 
          WHERE created_at < ${thirtyDaysAgo}
        `;

        console.log(`🧹 Cleaned up ${deletedCount} old search history entries`);
        
        return {
          success: true,
          deletedEntries: Number(deletedCount),
          cutoffDate: thirtyDaysAgo
        };
      }

      return {
        success: true,
        deletedEntries: 0,
        message: 'Search history table not found'
      };

    } catch (error) {
      console.error('Cleanup search history error:', error);
      throw new Error('Failed to cleanup old search history');
    }
  }

  /**
   * Clean up old cache entries related to tickets
   */
  static async cleanupTicketCaches() {
    try {
      const CacheService = require('./cache.service');
      
      // Get all ticket-related cache keys
      const cachePatterns = [
        'tickets:*',
        'ticket:*'
      ];

      let totalDeleted = 0;
      
      for (const pattern of cachePatterns) {
        const deleted = await CacheService.delPattern(pattern);
        totalDeleted += deleted;
      }

      console.log(`🧹 Cleaned up ${totalDeleted} ticket cache entries`);
      
      return {
        success: true,
        deletedCacheEntries: totalDeleted
      };

    } catch (error) {
      console.error('Cleanup ticket caches error:', error);
      throw new Error('Failed to cleanup ticket caches');
    }
  }

  /**
   * Archive old resolved tickets (older than 1 year)
   * Move to archive table for better performance
   */
  static async archiveOldTickets() {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Find old resolved tickets
      const oldTickets = await prisma.ticket.findMany({
        where: {
          status: 'CLOSED',
          resolvedAt: {
            lt: oneYearAgo
          }
        },
        include: {
          messages: true,
          attachments: true
        }
      });

      if (oldTickets.length === 0) {
        return {
          success: true,
          archivedTickets: 0,
          message: 'No tickets found for archiving'
        };
      }

      // Create archived tickets table if not exists
      await this.ensureArchivedTicketsTable();

      // Move tickets to archive (using transaction)
      const archivedCount = await prisma.$transaction(async (tx) => {
        let count = 0;
        
        for (const ticket of oldTickets) {
          // Create archive record
          await tx.$executeRaw`
            INSERT INTO archived_tickets (
              original_id, ticket_number, user_id, category_id, subject, description,
              priority, status, assigned_to_id, resolved_by, resolved_at, satisfaction,
              reopen_count, created_at, updated_at, last_activity, 
              message_count, attachment_count, archived_at
            ) VALUES (
              ${ticket.id}, ${ticket.ticketNumber}, ${ticket.userId}, ${ticket.categoryId},
              ${ticket.subject}, ${ticket.description}, ${ticket.priority}, ${ticket.status},
              ${ticket.assignedToId}, ${ticket.resolvedBy}, ${ticket.resolvedAt}, 
              ${ticket.satisfaction}, ${ticket.reopenCount}, ${ticket.createdAt}, 
              ${ticket.updatedAt}, ${ticket.lastActivity}, ${ticket.messages.length},
              ${ticket.attachments.length}, NOW()
            )
          `;

          // Delete original ticket (cascades to messages and attachments)
          await tx.ticket.delete({
            where: { id: ticket.id }
          });

          count++;
        }
        
        return count;
      });

      console.log(`📦 Archived ${archivedCount} old tickets`);
      
      return {
        success: true,
        archivedTickets: archivedCount,
        cutoffDate: oneYearAgo
      };

    } catch (error) {
      console.error('Archive old tickets error:', error);
      throw new Error('Failed to archive old tickets');
    }
  }

  /**
   * Get database performance metrics
   */
  static async getDatabaseMetrics() {
    try {
      const [
        ticketCount,
        messageCount,
        attachmentCount,
        searchHistoryCount,
        cacheStats
      ] = await Promise.all([
        prisma.ticket.count(),
        prisma.ticketMessage.count(),
        prisma.ticketAttachment.count(),
        this.getSearchHistoryCount(),
        this.getCacheStats()
      ]);

      return {
        database: {
          ticketCount,
          messageCount,
          attachmentCount,
          searchHistoryCount,
          totalRecords: ticketCount + messageCount + attachmentCount + (searchHistoryCount || 0)
        },
        cache: cacheStats,
        recommendations: this.getPerformanceRecommendations({
          ticketCount,
          messageCount,
          attachmentCount,
          searchHistoryCount
        })
      };

    } catch (error) {
      console.error('Database metrics error:', error);
      throw new Error('Failed to get database metrics');
    }
  }

  /**
   * Run complete performance cleanup
   * Combines all cleanup operations
   */
  static async runCompleteCleanup() {
    try {
      console.log('🚀 Starting ticket system performance cleanup...');
      
      const results = await Promise.allSettled([
        this.cleanupOldSearchHistory(),
        this.cleanupTicketCaches(),
        // Skip archiving for now as it's more complex
        // this.archiveOldTickets()
      ]);

      const summary = {
        searchHistoryCleanup: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason?.message },
        cacheCleanup: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason?.message },
        completedAt: new Date()
      };

      console.log('✅ Ticket system cleanup completed');
      
      return summary;

    } catch (error) {
      console.error('Complete cleanup error:', error);
      throw error;
    }
  }

  /**
   * Helper method to check if table exists
   */
  static async checkTableExists(tableName) {
    try {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        );
      `;
      
      return result[0]?.exists || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get search history count if table exists
   */
  static async getSearchHistoryCount() {
    try {
      const exists = await this.checkTableExists('ticket_search_history');
      if (!exists) return 0;

      const result = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM ticket_search_history
      `;
      
      return result[0]?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats() {
    try {
      const CacheService = require('./cache.service');
      
      // Get ticket-related cache keys
      const ticketKeys = await CacheService.getPattern('tickets:*');
      const ticketDetailKeys = await CacheService.getPattern('ticket:*');
      
      return {
        ticketListCaches: ticketKeys?.length || 0,
        ticketDetailCaches: ticketDetailKeys?.length || 0,
        totalTicketCaches: (ticketKeys?.length || 0) + (ticketDetailKeys?.length || 0)
      };
      
    } catch (error) {
      return {
        ticketListCaches: 0,
        ticketDetailCaches: 0,
        totalTicketCaches: 0,
        error: error.message
      };
    }
  }

  /**
   * Get performance recommendations based on current metrics
   */
  static getPerformanceRecommendations(metrics) {
    const recommendations = [];

    if (metrics.searchHistoryCount > 10000) {
      recommendations.push({
        type: 'CLEANUP',
        priority: 'HIGH',
        message: 'Search history has grown large. Consider running cleanup.',
        action: 'Run cleanupOldSearchHistory()'
      });
    }

    if (metrics.ticketCount > 5000) {
      recommendations.push({
        type: 'ARCHIVE',
        priority: 'MEDIUM',
        message: 'Large number of tickets detected. Consider archiving old resolved tickets.',
        action: 'Run archiveOldTickets() for tickets older than 1 year'
      });
    }

    if (metrics.messageCount > 50000) {
      recommendations.push({
        type: 'DATABASE',
        priority: 'MEDIUM',
        message: 'High message volume detected. Monitor database performance.',
        action: 'Consider database indexing optimization'
      });
    }

    return recommendations;
  }

  /**
   * Ensure archived tickets table exists
   */
  static async ensureArchivedTicketsTable() {
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS archived_tickets (
          id SERIAL PRIMARY KEY,
          original_id TEXT NOT NULL,
          ticket_number TEXT NOT NULL,
          user_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          subject TEXT NOT NULL,
          description TEXT NOT NULL,
          priority TEXT NOT NULL,
          status TEXT NOT NULL,
          assigned_to_id TEXT,
          resolved_by TEXT,
          resolved_at TIMESTAMP,
          satisfaction TEXT,
          reopen_count INTEGER DEFAULT 0,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL,
          last_activity TIMESTAMP NOT NULL,
          message_count INTEGER DEFAULT 0,
          attachment_count INTEGER DEFAULT 0,
          archived_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_archived_tickets_original_id ON archived_tickets(original_id);
        CREATE INDEX IF NOT EXISTS idx_archived_tickets_user_id ON archived_tickets(user_id);
        CREATE INDEX IF NOT EXISTS idx_archived_tickets_archived_at ON archived_tickets(archived_at);
      `;

    } catch (error) {
      console.error('Create archived tickets table error:', error);
    }
  }

  /**
   * Setup performance monitoring cron jobs
   */
  static setupPerformanceJobs() {
    // Daily cleanup at 2 AM
    const DAILY_CLEANUP_HOUR = 2;
    const now = new Date();
    const millisTillNext2AM = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, DAILY_CLEANUP_HOUR, 0, 0, 0) - now;
    
    setTimeout(() => {
      // Run immediately, then every 24 hours
      this.runCompleteCleanup();
      
      setInterval(async () => {
        await this.runCompleteCleanup();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, millisTillNext2AM);

    console.log('✅ Ticket performance cleanup scheduled (daily at 2 AM)');
  }
}

module.exports = TicketPerformanceService;