// src/controllers/admin.controller.js
const { CacheAnalytics } = require('../utils/cache-analytics');
const { CacheService, CacheKeys } = require('../config/redis');
const { successResponse, errorResponse } = require('../utils/response');

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

module.exports = {
  getCacheDashboard,
  getCacheStats,
  clearCache,
  warmUpCache,
  getCacheHealth,
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