// src/services/ticketAnalytics.service.js
const { prisma } = require('../../config/database');

class TicketAnalyticsService {
  
  /**
   * Get dashboard overview analytics
   * Essential metrics: Total tickets, open/closed ratios, avg response time
   */
  static async getDashboardOverview() {
    try {
      const [
        totalTickets,
        openTickets,
        inProgressTickets,
        closedTickets,
        avgResponseTimeResult,
        avgSatisfactionResult
      ] = await Promise.all([
        // Total tickets count
        prisma.ticket.count(),
        
        // Open tickets count
        prisma.ticket.count({
          where: { status: 'OPEN' }
        }),
        
        // In progress tickets count  
        prisma.ticket.count({
          where: { status: 'IN_PROGRESS' }
        }),
        
        // Closed tickets count
        prisma.ticket.count({
          where: { status: 'CLOSED' }
        }),
        
        // Average response time calculation
        prisma.$queryRaw`
          SELECT AVG(
            EXTRACT(EPOCH FROM (first_response.created_at - tickets.created_at)) / 3600
          )::numeric(10,2) as avg_response_hours
          FROM tickets
          LEFT JOIN (
            SELECT ticket_id, MIN(created_at) as created_at
            FROM ticket_messages 
            WHERE is_from_admin = true
            GROUP BY ticket_id
          ) first_response ON tickets.id = first_response.ticket_id
          WHERE first_response.created_at IS NOT NULL
        `,
        
        // Average satisfaction rating
        prisma.ticket.aggregate({
          where: {
            satisfaction: { not: null }
          },
          _avg: {
            satisfaction: true
          }
        })
      ]);

      const avgResponseHours = avgResponseTimeResult[0]?.avg_response_hours || 0;
      const avgSatisfaction = avgSatisfactionResult._avg.satisfaction || 0;

      return {
        overview: {
          totalTickets,
          openTickets,
          inProgressTickets, 
          closedTickets,
          avgResponseHours: Number(avgResponseHours),
          avgSatisfactionScore: Number(avgSatisfaction).toFixed(1)
        },
        ratios: {
          openRatio: totalTickets > 0 ? ((openTickets / totalTickets) * 100).toFixed(1) : 0,
          closedRatio: totalTickets > 0 ? ((closedTickets / totalTickets) * 100).toFixed(1) : 0,
          inProgressRatio: totalTickets > 0 ? ((inProgressTickets / totalTickets) * 100).toFixed(1) : 0
        }
      };
      
    } catch (error) {
      console.error('Dashboard overview analytics error:', error);
      throw new Error('Failed to calculate dashboard overview');
    }
  }

  /**
   * Get category analysis 
   * Which categories get most tickets
   */
  static async getCategoryAnalysis() {
    try {
      const categoryStats = await prisma.ticketCategory.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          _count: {
            select: {
              tickets: true
            }
          }
        },
        where: {
          isActive: true
        },
        orderBy: {
          tickets: {
            _count: 'desc'
          }
        }
      });

      const totalTickets = categoryStats.reduce((sum, cat) => sum + cat._count.tickets, 0);

      const categoryAnalysis = categoryStats.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        ticketCount: category._count.tickets,
        percentage: totalTickets > 0 ? 
          ((category._count.tickets / totalTickets) * 100).toFixed(1) : 0
      }));

      return {
        totalTickets,
        categories: categoryAnalysis,
        topCategory: categoryAnalysis[0] || null
      };
      
    } catch (error) {
      console.error('Category analysis error:', error);
      throw new Error('Failed to calculate category analysis');
    }
  }

  /**
   * Get weekly ticket trends (for trend charts)
   */
  static async getWeeklyTrends() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const weeklyTrends = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*)::int as ticket_count,
          COUNT(CASE WHEN status = 'CLOSED' THEN 1 END)::int as closed_count
        FROM tickets 
        WHERE created_at >= ${sevenDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      return weeklyTrends.map(day => ({
        date: day.date.toISOString().split('T')[0],
        ticketCount: day.ticket_count,
        closedCount: day.closed_count,
        resolution_rate: day.ticket_count > 0 ? 
          ((day.closed_count / day.ticket_count) * 100).toFixed(1) : 0
      }));
      
    } catch (error) {
      console.error('Weekly trends error:', error);
      throw new Error('Failed to calculate weekly trends');
    }
  }

  /**
   * Get admin performance metrics
   */
  static async getAdminPerformance() {
    try {
      const adminStats = await prisma.user.findMany({
        where: {
          role: 'SUPER_ADMIN'
        },
        select: {
          id: true,
          fullName: true,
          _count: {
            select: {
              resolvedTickets: true
            }
          }
        }
      });

      // Get average response time per admin
      const responseTimeStats = await prisma.$queryRaw`
        SELECT 
          u.id as admin_id,
          u.full_name,
          COUNT(t.id)::int as assigned_tickets,
          AVG(
            EXTRACT(EPOCH FROM (first_response.created_at - t.created_at)) / 3600
          )::numeric(10,2) as avg_response_hours
        FROM users u
        LEFT JOIN tickets t ON t.assigned_to_id = u.id
        LEFT JOIN (
          SELECT ticket_id, MIN(created_at) as created_at
          FROM ticket_messages 
          WHERE is_from_admin = true
          GROUP BY ticket_id
        ) first_response ON t.id = first_response.ticket_id
        WHERE u.role = 'SUPER_ADMIN'
        GROUP BY u.id, u.full_name
        ORDER BY assigned_tickets DESC
      `;

      return responseTimeStats.map(admin => ({
        adminId: admin.admin_id,
        fullName: admin.full_name,
        assignedTickets: admin.assigned_tickets,
        resolvedTickets: adminStats.find(a => a.id === admin.admin_id)?._count.resolvedTickets || 0,
        avgResponseHours: Number(admin.avg_response_hours || 0)
      }));
      
    } catch (error) {
      console.error('Admin performance error:', error);
      throw new Error('Failed to calculate admin performance');
    }
  }

  /**
   * Get priority distribution
   */
  static async getPriorityDistribution() {
    try {
      const priorityStats = await prisma.ticket.groupBy({
        by: ['priority'],
        _count: {
          _all: true
        },
        orderBy: {
          _count: {
            _all: 'desc'
          }
        }
      });

      const totalTickets = priorityStats.reduce((sum, p) => sum + p._count._all, 0);

      return priorityStats.map(stat => ({
        priority: stat.priority,
        count: stat._count._all,
        percentage: totalTickets > 0 ? 
          ((stat._count._all / totalTickets) * 100).toFixed(1) : 0
      }));
      
    } catch (error) {
      console.error('Priority distribution error:', error);
      throw new Error('Failed to calculate priority distribution');
    }
  }

  /**
   * Cache key generators
   */
  static getCacheKeys() {
    return {
      DASHBOARD_OVERVIEW: 'tickets:analytics:overview',
      CATEGORY_ANALYSIS: 'tickets:analytics:categories',
      WEEKLY_TRENDS: 'tickets:analytics:trends:weekly',
      ADMIN_PERFORMANCE: 'tickets:analytics:admin:performance',
      PRIORITY_DISTRIBUTION: 'tickets:analytics:priority'
    };
  }

  /**
   * Invalidate all analytics caches
   */
  static async invalidateAnalyticsCache() {
    try {
      const CacheService = require('../services/cache.service');
      const cacheKeys = this.getCacheKeys();
      
      await Promise.all([
        CacheService.del(cacheKeys.DASHBOARD_OVERVIEW),
        CacheService.del(cacheKeys.CATEGORY_ANALYSIS),
        CacheService.del(cacheKeys.WEEKLY_TRENDS),
        CacheService.del(cacheKeys.ADMIN_PERFORMANCE),
        CacheService.del(cacheKeys.PRIORITY_DISTRIBUTION)
      ]);
      
    } catch (error) {
      console.error('Analytics cache invalidation error:', error);
    }
  }
}

module.exports = TicketAnalyticsService;