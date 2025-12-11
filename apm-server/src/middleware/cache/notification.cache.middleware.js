// src/middleware/notification.cache.middleware.js
// Notification Cache Middleware - Following established patterns
// Multi-Tenant Aware Implementation

const { CacheService } = require('../../config/redis');
const { successResponse } = require('../../utils/response');

// ============================================
// CACHE KEY GENERATORS (Tenant-Aware)
// ============================================

const generateUserNotificationsCacheKey = (userId, filters = {}, tenantId = null) => {
  const {
    type,
    status,
    priority,
    unreadOnly = false,
    page = 1,
    limit = 20
  } = filters;

  const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
  return `${tenantPrefix}notifications:user:${userId}:${type || 'all'}:${status || 'all'}:${priority || 'all'}:unread:${unreadOnly}:page:${page}:limit:${limit}`;
};

const generateUnreadCountCacheKey = (userId, tenantId = null) => {
  const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
  return `${tenantPrefix}notifications:unread:${userId}`;
};

const generateNotificationDetailsCacheKey = (notificationId, tenantId = null) => {
  const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
  return `${tenantPrefix}notifications:details:${notificationId}`;
};

const generateNotificationAnalyticsCacheKey = (filters = {}, tenantId = null) => {
  const { fromDate, toDate } = filters;
  const dateKey = `${fromDate || 'all'}-${toDate || 'all'}`;
  const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
  return `${tenantPrefix}notifications:analytics:${dateKey}`;
};

const generateUserPushTokensCacheKey = (userId, tenantId = null) => {
  const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
  return `${tenantPrefix}notifications:tokens:${userId}`;
};

const generateSystemStatsCacheKey = (tenantId = null) => {
  const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
  return `${tenantPrefix}notifications:system:stats`;
};

// ============================================
// CACHING MIDDLEWARE FUNCTIONS
// ============================================

// Cache user notifications list (Tenant-Aware)
const cacheUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const tenantId = req.tenant?.id || null;
    const cacheKey = generateUserNotificationsCacheKey(userId, req.query, tenantId);
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

// Cache unread count (Tenant-Aware)
const cacheUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const tenantId = req.tenant?.id || null;
    const cacheKey = generateUnreadCountCacheKey(userId, tenantId);
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

// Cache notification details (Tenant-Aware)
const cacheNotificationDetails = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const tenantId = req.tenant?.id || null;
    const cacheKey = generateNotificationDetailsCacheKey(notificationId, tenantId);
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

// Cache notification analytics (Tenant-Aware)
const cacheNotificationAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || null;
    const cacheKey = generateNotificationAnalyticsCacheKey(req.query, tenantId);
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

// Cache user push tokens (Tenant-Aware)
const cacheUserPushTokens = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const tenantId = req.tenant?.id || null;
    const cacheKey = generateUserPushTokensCacheKey(userId, tenantId);
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

// Cache system notification stats (Tenant-Aware)
const cacheSystemStats = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || null;
    const cacheKey = generateSystemStatsCacheKey(tenantId);
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

// Invalidate all notification-related caches for specific patterns (Tenant-Aware)
const invalidateNotificationCaches = async (req) => {
  try {
    const { notificationId } = req.params || {};
    const userId = req.user?.id;
    const tenantId = req.tenant?.id || null;
    const { recipientIds = [] } = req.body || {};

    const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';

    // Base patterns that always get invalidated
    const patterns = [
      `${tenantPrefix}notifications:system:stats`,
      `${tenantPrefix}notifications:analytics*`
    ];

    // User-specific patterns
    if (userId) {
      patterns.push(`${tenantPrefix}notifications:user:${userId}*`);
      patterns.push(`${tenantPrefix}notifications:unread:${userId}`);
      patterns.push(`${tenantPrefix}notifications:tokens:${userId}`);
    }

    // Recipient-specific patterns (for sent notifications)
    if (recipientIds && recipientIds.length > 0) {
      recipientIds.forEach(recipientId => {
        patterns.push(`${tenantPrefix}notifications:user:${recipientId}*`);
        patterns.push(`${tenantPrefix}notifications:unread:${recipientId}`);
      });
    }

    // Notification-specific patterns
    if (notificationId) {
      patterns.push(`${tenantPrefix}notifications:details:${notificationId}`);
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

// Invalidate user-specific notification caches (Tenant-Aware)
const invalidateUserNotificationCaches = async (userId, tenantId = null) => {
  try {
    const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
    const patterns = [
      `${tenantPrefix}notifications:user:${userId}*`,
      `${tenantPrefix}notifications:unread:${userId}`,
      `${tenantPrefix}notifications:tokens:${userId}`,
      `${tenantPrefix}notifications:system:stats` // System stats may change when user notifications change
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated user notification caches for user: ${userId} (tenant: ${tenantId || 'all'})`);
  } catch (error) {
    console.error('User notification cache invalidation error:', error);
  }
};

// Invalidate multiple users' notification caches (for broadcast notifications) (Tenant-Aware)
const invalidateMultipleUserCaches = async (userIds, tenantId = null) => {
  try {
    const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
    const patterns = [`${tenantPrefix}notifications:system:stats`];

    userIds.forEach(userId => {
      patterns.push(`${tenantPrefix}notifications:user:${userId}*`);
      patterns.push(`${tenantPrefix}notifications:unread:${userId}`);
    });

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated notification caches for ${userIds.length} users (tenant: ${tenantId || 'all'})`);
  } catch (error) {
    console.error('Multiple user cache invalidation error:', error);
  }
};

// Invalidate system-wide notification caches (Tenant-Aware)
const invalidateSystemNotificationCaches = async (tenantId = null) => {
  try {
    const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
    const patterns = [
      `${tenantPrefix}notifications:system:stats`,
      `${tenantPrefix}notifications:analytics*`,
      `${tenantPrefix}notifications:user:*` // Invalidate all user caches for system announcements
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated all system notification caches (tenant: ${tenantId || 'all'})`);
  } catch (error) {
    console.error('System notification cache invalidation error:', error);
  }
};

// Auto-invalidate caches after push token operations (Tenant-Aware)
const autoInvalidatePushTokenCaches = async (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    originalJson.call(this, data);

    setImmediate(async () => {
      try {
        const userId = req.user?.id;
        const tenantId = req.tenant?.id || null;
        if (userId) {
          await invalidateUserPushTokenCaches(userId, tenantId);
        }
      } catch (error) {
        console.error('Push token cache invalidation error:', error);
      }
    });
  };

  next();
};

// Invalidate user push token caches (Tenant-Aware)
const invalidateUserPushTokenCaches = async (userId, tenantId = null) => {
  try {
    const tenantPrefix = tenantId ? `tenant:${tenantId}:` : '';
    const patterns = [
      `${tenantPrefix}notifications:tokens:${userId}`
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated push token caches for user: ${userId} (tenant: ${tenantId || 'all'})`);
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