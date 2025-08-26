// src/controllers/support/ticketPerformance.controller.js
const TicketPerformanceService = require('../../services/ticketPerformance.service');
const { successResponse, errorResponse } = require('../../utils/response');

/**
 * Get database performance metrics
 * GET /api/tickets/admin/performance/metrics
 */
const getDatabaseMetrics = async (req, res) => {
  try {
    const metrics = await TicketPerformanceService.getDatabaseMetrics();
    
    return successResponse(
      res,
      metrics,
      'Database performance metrics retrieved successfully'
    );
  } catch (error) {
    console.error('Database metrics error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve database metrics', 500);
  }
};

/**
 * Run manual cleanup of old data
 * POST /api/tickets/admin/performance/cleanup
 */
const runManualCleanup = async (req, res) => {
  try {
    const { cleanupType } = req.body;
    
    let result;
    
    switch (cleanupType) {
      case 'search_history':
        result = await TicketPerformanceService.cleanupOldSearchHistory();
        break;
        
      case 'cache':
        result = await TicketPerformanceService.cleanupTicketCaches();
        break;
        
      case 'complete':
        result = await TicketPerformanceService.runCompleteCleanup();
        break;
        
      default:
        return errorResponse(res, 'Invalid cleanup type. Use: search_history, cache, or complete', 400);
    }

    // Log cleanup activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'ticket_performance_cleanup',
        details: {
          cleanupType,
          result
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      result,
      `${cleanupType} cleanup completed successfully`
    );
    
  } catch (error) {
    console.error('Manual cleanup error:', error);
    return errorResponse(res, error.message || 'Failed to run cleanup', 500);
  }
};

/**
 * Get cleanup history and logs
 * GET /api/tickets/admin/performance/cleanup-history
 */
const getCleanupHistory = async (req, res) => {
  try {
    const cleanupLogs = await prisma.activityLog.findMany({
      where: {
        action: 'ticket_performance_cleanup'
      },
      include: {
        user: {
          select: { fullName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const history = cleanupLogs.map(log => ({
      id: log.id,
      adminName: log.user.fullName,
      cleanupType: log.details.cleanupType,
      result: log.details.result,
      performedAt: log.createdAt,
      ipAddress: log.ipAddress
    }));

    return successResponse(
      res,
      { cleanupHistory: history },
      'Cleanup history retrieved successfully'
    );

  } catch (error) {
    console.error('Cleanup history error:', error);
    return errorResponse(res, 'Failed to retrieve cleanup history', 500);
  }
};

/**
 * Get performance recommendations
 * GET /api/tickets/admin/performance/recommendations
 */
const getPerformanceRecommendations = async (req, res) => {
  try {
    const metrics = await TicketPerformanceService.getDatabaseMetrics();
    
    return successResponse(
      res,
      {
        metrics: metrics.database,
        recommendations: metrics.recommendations,
        lastChecked: new Date()
      },
      'Performance recommendations retrieved successfully'
    );
    
  } catch (error) {
    console.error('Performance recommendations error:', error);
    return errorResponse(res, 'Failed to retrieve performance recommendations', 500);
  }
};

/**
 * Test notification system
 * POST /api/tickets/admin/performance/test-notification
 */
const testNotificationSystem = async (req, res) => {
  try {
    const { testType } = req.body;
    const userId = req.user.id;
    
    const TicketNotificationService = require('../../services/ticketNotification.service');
    
    let result;
    
    switch (testType) {
      case 'delayed_check':
        result = await TicketNotificationService.checkAndSendDelayedNotifications();
        break;
        
      default:
        return errorResponse(res, 'Invalid test type. Use: delayed_check', 400);
    }

    // Log test activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'ticket_notification_test',
        details: {
          testType,
          result
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      result,
      'Notification test completed successfully'
    );
    
  } catch (error) {
    console.error('Test notification error:', error);
    return errorResponse(res, error.message || 'Failed to test notification system', 500);
  }
};

module.exports = {
  getDatabaseMetrics,
  runManualCleanup,
  getCleanupHistory,
  getPerformanceRecommendations,
  testNotificationSystem
};