const TicketSearchService = require('../../services/ticket/ticketSearch.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');

/**
 * Get advanced search form configuration
 * GET /api/tickets/search/config
 */
const getSearchConfig = async (req, res) => {
  try {
    // Get available filter options
    const [categories, admins, batches] = await Promise.all([
      prisma.ticketCategory.findMany({
        where: { isActive: true },
        select: { id: true, name: true, icon: true }
      }),
      prisma.user.findMany({
        where: { role: 'SUPER_ADMIN', isActive: true },
        select: { id: true, fullName: true }
      }),
      prisma.user.findMany({
        select: { batch: true },
        distinct: ['batch'],
        orderBy: { batch: 'desc' }
      })
    ]);
    
    const config = {
      categories,
      admins,
      batches: batches.map(b => b.batch),
      statusOptions: [
        { value: 'OPEN', label: 'Open' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'WAITING_FOR_USER', label: 'Waiting for User' },
        { value: 'RESOLVED', label: 'Resolved' },
        { value: 'CLOSED', label: 'Closed' },
        { value: 'REOPENED', label: 'Reopened' }
      ],
      priorityOptions: [
        { value: 'LOW', label: 'Low' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'HIGH', label: 'High' },
        { value: 'URGENT', label: 'Urgent' }
      ]
    };
    
    return successResponse(
      res,
      config,
      'Search configuration retrieved successfully'
    );
  } catch (error) {
    console.error('Get search config error:', error);
    return errorResponse(res, 'Failed to retrieve search configuration', 500);
  }
};

/**
 * Get ticket statistics for dashboard
 * GET /api/tickets/admin/statistics
 */
const getTicketStatistics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const fromDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    
    const [
      totalStats,
      categoryStats,
      priorityStats,
      statusStats,
      assignmentStats,
      trendData
    ] = await Promise.all([
      // Overall statistics
      prisma.ticket.groupBy({
        by: [],
        _count: { id: true },
        _avg: { reopenCount: true }
      }),
      
      // Category breakdown
      prisma.ticket.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        where: {
          createdAt: { gte: fromDate }
        }
      }),
      
      // Priority breakdown
      prisma.ticket.groupBy({
        by: ['priority'],
        _count: { id: true },
        where: {
          createdAt: { gte: fromDate }
        }
      }),
      
      // Status breakdown
      prisma.ticket.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      
      // Assignment statistics
      prisma.ticket.groupBy({
        by: ['assignedToId'],
        _count: { id: true },
        where: {
          assignedToId: { not: null },
          createdAt: { gte: fromDate }
        }
      }),
      
      // Daily trend data
      this.getTicketTrendData(fromDate, now)
    ]);
    
    const statistics = {
      overview: {
        total: totalStats[0]?._count?.id || 0,
        avgReopens: totalStats[0]?._avg?.reopenCount || 0,
        period: `${daysBack} days`
      },
      categoryBreakdown: categoryStats,
      priorityBreakdown: priorityStats,
      statusBreakdown: statusStats,
      assignmentBreakdown: assignmentStats,
      trendData
    };
    
    return successResponse(
      res,
      statistics,
      'Ticket statistics retrieved successfully'
    );
  } catch (error) {
    console.error('Get ticket statistics error:', error);
    return errorResponse(res, 'Failed to retrieve statistics', 500);
  }
};

/**
 * Helper method for trend data
 */
const getTicketTrendData = async (fromDate, toDate) => {
  // This would need proper SQL for daily/weekly aggregation
  // For now, return basic data structure
  const tickets = await prisma.ticket.findMany({
    where: {
      createdAt: {
        gte: fromDate,
        lte: toDate
      }
    },
    select: {
      createdAt: true,
      status: true
    }
  });
  
  // Group by day (simplified - can be enhanced)
  const trendMap = new Map();
  tickets.forEach(ticket => {
    const day = ticket.createdAt.toISOString().split('T')[0];
    if (!trendMap.has(day)) {
      trendMap.set(day, { date: day, created: 0, resolved: 0 });
    }
    
    const dayData = trendMap.get(day);
    dayData.created++;
    
    if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      dayData.resolved++;
    }
  });
  
  return Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

module.exports = {
  getSearchConfig,
  getTicketStatistics
};