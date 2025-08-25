// src/middleware/notification.cache.middleware.js
// Notification Cache Middleware - Following established patterns

const { CacheService } = require('../config/redis');
const { successResponse } = require('../utils/response');

// ============================================
// CACHE KEY GENERATORS
// ============================================

const generateUserNotificationsCacheKey = (userId, filters = {}) => {
  const { 
    type, 
    status, 
    priority, 
    unreadOnly = false,
    page = 1, 
    limit = 20 
  } = filters;
  
  return `notifications:user:${userId}:${type || 'all'}:${status || 'all'}:${priority || 'all'}:unread:${unreadOnly}:page:${page}:limit:${limit}`;
};

const generateUnreadCountCacheKey = (userId) => {
  return `notifications:unread:${userId}`;
};

const generateNotificationDetailsCacheKey = (notificationId) => {
  return `notifications:details:${notificationId}`;
};

const generateNotificationAnalyticsCacheKey = (filters = {}) => {
  const { fromDate, toDate } = filters;
  const dateKey = `${fromDate || 'all'}-${toDate || 'all'}`;
  return `notifications:analytics:${dateKey}`;
};

const generateUserPushTokensCacheKey = (userId) => {
  return `notifications:tokens:${userId}`;
};

const generateSystemStatsCacheKey = () => {
  return 'notifications:system:stats';
};

// ============================================
// CACHING MIDDLEWARE FUNCTIONS
// ============================================

// Cache user notifications list
const cacheUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = generateUserNotificationsCacheKey(userId, req.query);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Notifications retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 120; // 2 minutes - notifications change frequently
    next();
  } catch (error) {
    console.error('User notifications cache error:', error);
    next(); // Continue without cache on error
  }
};

// Cache unread count
const cacheUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = generateUnreadCountCacheKey(userId);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Unread count retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 60; // 1 minute - unread count changes very frequently
    next();
  } catch (error) {
    console.error('Unread count cache error:', error);
    next();
  }
};

// Cache notification details
const cacheNotificationDetails = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const cacheKey = generateNotificationDetailsCacheKey(notificationId);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Notification details retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 600; // 10 minutes - notification details are relatively stable
    next();
  } catch (error) {
    console.error('Notification details cache error:', error);
    next();
  }
};

// Cache notification analytics
const cacheNotificationAnalytics = async (req, res, next) => {
  try {
    const cacheKey = generateNotificationAnalyticsCacheKey(req.query);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Notification analytics retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 900; // 15 minutes - analytics don't change very often
    next();
  } catch (error) {
    console.error('Notification analytics cache error:', error);
    next();
  }
};

// Cache user push tokens
const cacheUserPushTokens = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = generateUserPushTokensCacheKey(userId);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Push tokens retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 3600; // 1 hour - push tokens don't change often
    next();
  } catch (error) {
    console.error('Push tokens cache error:', error);
    next();
  }
};

// Cache system notification stats
const cacheSystemStats = async (req, res, next) => {
  try {
    const cacheKey = generateSystemStatsCacheKey();
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'System notification stats retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 1800; // 30 minutes - system stats change slowly
    next();
  } catch (error) {
    console.error('System stats cache error:', error);
    next();
  }
};

// ============================================
// CACHE INVALIDATION FUNCTIONS
// ============================================

// Auto-invalidate notification caches after modifications
const autoInvalidateNotificationCaches = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    originalJson.call(this, data);
    
    // Perform cache invalidation asynchronously
    setImmediate(async () => {
      try {
        await invalidateNotificationCaches(req);
      } catch (error) {
        console.error('Notification cache invalidation error:', error);
      }
    });
  };

  next();
};

// Invalidate all notification-related caches for specific patterns
const invalidateNotificationCaches = async (req) => {
  try {
    const { notificationId } = req.params || {};
    const userId = req.user?.id;
    const { recipientIds = [] } = req.body || {};
    
    // Base patterns that always get invalidated
    const patterns = [
      'notifications:system:stats',
      'notifications:analytics*'
    ];

    // User-specific patterns
    if (userId) {
      patterns.push(`notifications:user:${userId}*`);
      patterns.push(`notifications:unread:${userId}`);
      patterns.push(`notifications:tokens:${userId}`);
    }

    // Recipient-specific patterns (for sent notifications)
    if (recipientIds && recipientIds.length > 0) {
      recipientIds.forEach(recipientId => {
        patterns.push(`notifications:user:${recipientId}*`);
        patterns.push(`notifications:unread:${recipientId}`);
      });
    }

    // Notification-specific patterns
    if (notificationId) {
      patterns.push(`notifications:details:${notificationId}`);
    }

    // Delete cache keys by pattern
    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated notification caches for patterns:`, patterns);
  } catch (error) {
    console.error('Notification cache invalidation error:', error);
  }
};

// Invalidate user-specific notification caches
const invalidateUserNotificationCaches = async (userId) => {
  try {
    const patterns = [
      `notifications:user:${userId}*`,
      `notifications:unread:${userId}`,
      `notifications:tokens:${userId}`,
      'notifications:system:stats' // System stats may change when user notifications change
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated user notification caches for user: ${userId}`);
  } catch (error) {
    console.error('User notification cache invalidation error:', error);
  }
};

// Invalidate multiple users' notification caches (for broadcast notifications)
const invalidateMultipleUserCaches = async (userIds) => {
  try {
    const patterns = ['notifications:system:stats'];
    
    userIds.forEach(userId => {
      patterns.push(`notifications:user:${userId}*`);
      patterns.push(`notifications:unread:${userId}`);
    });

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated notification caches for ${userIds.length} users`);
  } catch (error) {
    console.error('Multiple user cache invalidation error:', error);
  }
};

// Invalidate system-wide notification caches
const invalidateSystemNotificationCaches = async () => {
  try {
    const patterns = [
      'notifications:system:stats',
      'notifications:analytics*',
      'notifications:user:*' // Invalidate all user caches for system announcements
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log('Invalidated all system notification caches');
  } catch (error) {
    console.error('System notification cache invalidation error:', error);
  }
};

// Auto-invalidate caches after push token operations
const autoInvalidatePushTokenCaches = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    originalJson.call(this, data);
    
    setImmediate(async () => {
      try {
        const userId = req.user?.id;
        if (userId) {
          await invalidateUserPushTokenCaches(userId);
        }
      } catch (error) {
        console.error('Push token cache invalidation error:', error);
      }
    });
  };

  next();
};

// Invalidate user push token caches
const invalidateUserPushTokenCaches = async (userId) => {
  try {
    const patterns = [
      `notifications:tokens:${userId}`
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated push token caches for user: ${userId}`);
  } catch (error) {
    console.error('Push token cache invalidation error:', error);
  }
};

// ============================================
// CACHE SETTING HELPERS
// ============================================

// Set cache data manually (for controllers)
const setCacheData = async (cacheKey, data, ttl = 300) => {
  try {
    await CacheService.set(cacheKey, data, ttl);
    console.log(`✅ Cache set: ${cacheKey}`);
  } catch (error) {
    console.error('Set cache data error:', error);
  }
};

// Get cache data manually (for controllers)
const getCacheData = async (cacheKey) => {
  try {
    return await CacheService.get(cacheKey);
  } catch (error) {
    console.error('Get cache data error:', error);
    return null;
  }
};

// ============================================
// CACHE WARMING FUNCTIONS
// ============================================

// Warm up frequently accessed caches
const warmNotificationCaches = async (userId) => {
  try {
    // This can be called after user login to pre-populate caches
    const promises = [
      // Pre-cache unread count
      getCacheData(generateUnreadCountCacheKey(userId)),
      
      // Pre-cache first page of notifications
      getCacheData(generateUserNotificationsCacheKey(userId, { page: 1, limit: 20 }))
    ];

    await Promise.allSettled(promises);
    console.log(`Warmed notification caches for user: ${userId}`);
  } catch (error) {
    console.error('Warm notification caches error:', error);
  }
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

module.exports = {
  // Caching middleware
  cacheUserNotifications,
  cacheUnreadCount,
  cacheNotificationDetails,
  cacheNotificationAnalytics,
  cacheUserPushTokens,
  cacheSystemStats,

  // Auto-invalidation middleware
  autoInvalidateNotificationCaches,
  autoInvalidatePushTokenCaches,

  // Manual cache operations
  invalidateNotificationCaches,
  invalidateUserNotificationCaches,
  invalidateMultipleUserCaches,
  invalidateSystemNotificationCaches,
  invalidateUserPushTokenCaches,

  // Cache helpers
  setCacheData,
  getCacheData,
  warmNotificationCaches,

  // Cache key generators (for controller use)
  generateUserNotificationsCacheKey,
  generateUnreadCountCacheKey,
  generateNotificationDetailsCacheKey,
  generateNotificationAnalyticsCacheKey,
  generateUserPushTokensCacheKey,
  generateSystemStatsCacheKey
};