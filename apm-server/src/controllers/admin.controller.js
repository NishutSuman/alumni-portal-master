// src/controllers/admin.controller.js
const { CacheAnalytics } = require('../utils/cache-analytics');
const { CacheService, CacheKeys } = require('../config/redis');
const { successResponse, errorResponse } = require('../utils/response');
const AnalyticsService = require('../services/analytics/AnalyticsService');

// Get cache performance dashboard
const getCacheDashboard = async (req, res) => {
  try {
    const stats = await CacheAnalytics.getDashboardStats();
    return successResponse(res, { stats }, 'Cache dashboard retrieved successfully');
  } catch (error) {
    console.error('Get cache dashboard error:', error);
    return errorResponse(res, 'Failed to retrieve cache dashboard', 500);
  }
};

// Get detailed cache stats
const getCacheStats = async (req, res) => {
  const { days = 7 } = req.query;
  
  try {
    const [cacheStats, memoryStats, topKeys] = await Promise.all([
      CacheAnalytics.getCacheStats(parseInt(days)),
      CacheAnalytics.getMemoryStats(),
      CacheAnalytics.getTopKeys(20)
    ]);
    
    return successResponse(res, {
      cacheStats,
      memoryStats,
      topKeys
    }, 'Cache statistics retrieved successfully');
  } catch (error) {
    console.error('Get cache stats error:', error);
    return errorResponse(res, 'Failed to retrieve cache statistics', 500);
  }
};

// Clear specific cache pattern
const clearCache = async (req, res) => {
  const { pattern } = req.body;
  
  if (!pattern) {
    return errorResponse(res, 'Cache pattern is required', 400);
  }
  
  // Validate pattern to prevent accidental deletion
  const allowedPatterns = [
    'posts:*',
    'user:*',
    'batch:*',
    'alumni:*',
    'stats:*'
  ];
  
  const isValidPattern = allowedPatterns.some(allowed => 
    pattern.startsWith(allowed.replace('*', ''))
  );
  
  if (!isValidPattern) {
    return errorResponse(res, 'Invalid cache pattern', 400);
  }
  
  try {
    await CacheService.delPattern(pattern);
    
    // Log cache clearing action
    console.log(`🗑️ Cache cleared by admin: ${req.user.fullName} - Pattern: ${pattern}`);
    
    return successResponse(res, null, `Cache cleared for pattern: ${pattern}`);
  } catch (error) {
    console.error('Clear cache error:', error);
    return errorResponse(res, 'Failed to clear cache', 500);
  }
};

// Warm up cache with frequently accessed data
const warmUpCache = async (req, res) => {
  try {
    const warmupTasks = [];
    
    // Warm up alumni stats
    warmupTasks.push(
      CacheService.set(CacheKeys.alumniStats(), 'warming', 1)
    );
    
    // Warm up recent batches
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      const year = currentYear - i;
      warmupTasks.push(
        CacheService.set(CacheKeys.batchStats(year), 'warming', 1)
      );
    }
    
    // Warm up recent posts
    warmupTasks.push(
      CacheService.set(CacheKeys.posts('all', 1, 10), 'warming', 1)
    );
    
    await Promise.all(warmupTasks);
    
    return successResponse(res, null, 'Cache warmup initiated successfully');
  } catch (error) {
    console.error('Cache warmup error:', error);
    return errorResponse(res, 'Failed to warm up cache', 500);
  }
};

// Get cache health check
const getCacheHealth = async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test cache operations
    const testKey = 'health:check:' + Date.now();
    const testValue = { test: true, timestamp: Date.now() };
    
    // Test SET operation
    await CacheService.set(testKey, testValue, 60);
    
    // Test GET operation
    const retrievedValue = await CacheService.get(testKey);
    
    // Test DELETE operation
    await CacheService.del(testKey);
    
    const responseTime = Date.now() - startTime;
    
    const health = {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      operations: {
        set: '✅',
        get: retrievedValue ? '✅' : '❌',
        delete: '✅'
      },
      timestamp: new Date().toISOString()
    };
    
    return successResponse(res, { health }, 'Cache health check completed');
  } catch (error) {
    console.error('Cache health check error:', error);
    return errorResponse(res, {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'Cache health check failed', 500);
  }
};

// ==========================================
// ANALYTICS DASHBOARD ENDPOINTS
// (Add these to existing admin.controller.js)
// ==========================================

/**
 * @desc    Get system-wide overview analytics
 * @route   GET /api/admin/dashboard/overview
 * @access  Private (SUPER_ADMIN)
 */
const getDashboardOverview = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const overview = await AnalyticsService.getSystemOverview(fromDate, toDate);
    
    return successResponse(res, overview, 'Dashboard overview retrieved successfully');
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return errorResponse(res, 'Failed to retrieve dashboard overview', 500);
  }
};

/**
 * @desc    Get comprehensive events analytics
 * @route   GET /api/admin/dashboard/events-analytics
 * @access  Private (SUPER_ADMIN)
 */
const getEventsAnalytics = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'eventDate', 
      sortOrder = 'desc',
      status,
      fromDate,
      toDate 
    } = req.query;

    // Get events with analytics
    const whereClause = {};
    
    if (status) whereClause.status = status;
    if (fromDate || toDate) {
      whereClause.eventDate = {};
      if (fromDate) whereClause.eventDate.gte = new Date(fromDate);
      if (toDate) whereClause.eventDate.lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [events, totalCount] = await Promise.all([
      prisma.event.findMany({
        where: whereClause,
        include: {
          analytics: true,
          _count: {
            select: {
              registrations: {
                where: { status: 'CONFIRMED' }
              }
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.event.count({ where: whereClause })
    ]);

    // Calculate analytics for events that don't have them
    const eventsWithAnalytics = await Promise.all(
      events.map(async (event) => {
        let analytics = event.analytics;
        
        if (!analytics) {
          analytics = await AnalyticsService.calculateEventAnalytics(event.id);
        }
        
        return {
          id: event.id,
          title: event.title,
          eventDate: event.eventDate,
          status: event.status,
          maxCapacity: event.maxCapacity,
          registrationCount: event._count.registrations,
          analytics: {
            totalRevenue: Number(analytics.totalRevenue),
            registrationRevenue: Number(analytics.registrationRevenue),
            merchandiseRevenue: Number(analytics.merchandiseRevenue),
            donationRevenue: Number(analytics.donationRevenue),
            totalRegistrations: analytics.totalRegistrations,
            conversionRate: Number(analytics.conversionRate),
            averageOrderValue: Number(analytics.averageOrderValue),
            feedbackScore: Number(analytics.feedbackScore)
          },
          performance: {
            capacityUtilization: event.maxCapacity ? 
              Math.round((event._count.registrations / event.maxCapacity) * 100) : null,
            revenuePerRegistration: event._count.registrations > 0 ? 
              Math.round(Number(analytics.totalRevenue) / event._count.registrations) : 0
          }
        };
      })
    );

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    return successResponse(res, {
      events: eventsWithAnalytics,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      },
      summary: {
        totalEvents: totalCount,
        totalRevenue: eventsWithAnalytics.reduce((sum, e) => sum + e.analytics.totalRevenue, 0),
        averageCapacityUtilization: Math.round(
          eventsWithAnalytics
            .filter(e => e.performance.capacityUtilization !== null)
            .reduce((sum, e) => sum + e.performance.capacityUtilization, 0) / 
          eventsWithAnalytics.filter(e => e.performance.capacityUtilization !== null).length || 0
        )
      }
    }, 'Events analytics retrieved successfully');

  } catch (error) {
    console.error('Events analytics error:', error);
    return errorResponse(res, 'Failed to retrieve events analytics', 500);
  }
};

/**
 * @desc    Get revenue breakdown analytics
 * @route   GET /api/admin/dashboard/revenue-breakdown
 * @access  Private (SUPER_ADMIN)
 */
const getRevenueBreakdown = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const breakdown = await AnalyticsService.getRevenueBreakdown(fromDate, toDate);
    
    return successResponse(res, breakdown, 'Revenue breakdown retrieved successfully');
  } catch (error) {
    console.error('Revenue breakdown error:', error);
    return errorResponse(res, 'Failed to retrieve revenue breakdown', 500);
  }
};

/**
 * @desc    Get batch participation analytics
 * @route   GET /api/admin/dashboard/batch-participation
 * @access  Private (SUPER_ADMIN)
 */
const getBatchParticipation = async (req, res) => {
  try {
    const participation = await AnalyticsService.getBatchParticipation();
    
    return successResponse(res, participation, 'Batch participation retrieved successfully');
  } catch (error) {
    console.error('Batch participation error:', error);
    return errorResponse(res, 'Failed to retrieve batch participation', 500);
  }
};

/**
 * @desc    Get live registration stats for an event
 * @route   GET /api/admin/dashboard/live-registrations/:eventId
 * @access  Private (SUPER_ADMIN)
 */
const getLiveRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const stats = await AnalyticsService.getLiveRegistrationStats(eventId);
    
    if (!stats) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    return successResponse(res, stats, 'Live registration stats retrieved successfully');
  } catch (error) {
    console.error('Live registrations error:', error);
    return errorResponse(res, 'Failed to retrieve live registration stats', 500);
  }
};

/**
 * @desc    Refresh analytics cache
 * @route   POST /api/admin/dashboard/refresh-analytics
 * @access  Private (SUPER_ADMIN)
 */
const refreshAnalytics = async (req, res) => {
  try {
    const { eventId } = req.body;
    
    if (eventId) {
      // Refresh specific event analytics
      await AnalyticsService.invalidateEventAnalytics(eventId);
      await AnalyticsService.calculateEventAnalytics(eventId);
    } else {
      // Refresh system-wide analytics
      await AnalyticsService.invalidateSystemAnalytics();
    }
    
    return successResponse(res, null, 'Analytics cache refreshed successfully');
  } catch (error) {
    console.error('Refresh analytics error:', error);
    return errorResponse(res, 'Failed to refresh analytics', 500);
  }
};

module.exports = {
  getCacheDashboard,
  getCacheStats,
  clearCache,
  warmUpCache,
  getCacheHealth,

  // NEW ANALYTICS EXPORTS
  getDashboardOverview,
  getEventsAnalytics,
  getRevenueBreakdown,
  getBatchParticipation,
  getLiveRegistrations,
  refreshAnalytics,
};

// ==========================================

// src/routes/admin.route.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/response');
const adminController = require('../controllers/admin.controller');


// All admin routes require SUPER_ADMIN role
router.use(authenticateToken);
router.use(requireRole('SUPER_ADMIN'));

// Cache management routes
router.get('/cache/dashboard', asyncHandler(adminController.getCacheDashboard));
router.get('/cache/stats', asyncHandler(adminController.getCacheStats));
router.get('/cache/health', asyncHandler(adminController.getCacheHealth));
router.post('/cache/clear', asyncHandler(adminController.clearCache));
router.post('/cache/warmup', asyncHandler(adminController.warmUpCache));

module.exports = router;

// ==========================================

// Add to src/app.js
// app.use('/api/admin', require('./routes/admin.route'));