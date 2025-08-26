const CacheService = require('../config/redis');

// ==========================================
// CACHE KEY GENERATORS
// ==========================================

const TicketCacheKeys = {
  userTickets: (userId, page, filters) => {
    const filterHash = Buffer.from(JSON.stringify(filters)).toString('base64').slice(0, 8);
    return `tickets:user:${userId}:page:${page}:${filterHash}`;
  },
  
  adminTickets: (page, filters) => {
    const filterHash = Buffer.from(JSON.stringify(filters)).toString('base64').slice(0, 8);
    return `tickets:admin:page:${page}:${filterHash}`;
  },
  
  ticketDetails: (ticketId) => `tickets:details:${ticketId}`,
  
  userDashboard: (userId) => `tickets:user:${userId}:dashboard`,
  
  adminDashboard: (adminId) => `tickets:admin:${adminId}:dashboard`,
  
  categories: () => 'tickets:categories:active',
  
  availableAdmins: () => 'tickets:admins:available'
};

const ANALYTICS_CACHE_KEYS = {
  OVERVIEW: 'tickets:analytics:overview',
  CATEGORIES: 'tickets:analytics:categories',
  TRENDS: 'tickets:analytics:trends:weekly',
  ADMIN_PERFORMANCE: 'tickets:analytics:admin:performance',
  PRIORITY_DISTRIBUTION: 'tickets:analytics:priority:distribution',
  COMPLETE: 'tickets:analytics:complete'
};


// ==========================================
// GENERIC CACHE MIDDLEWARE
// ==========================================

const cache = (keyGenerator, expireInSeconds = 300) => {
  return async (req, res, next) => {
    try {
      const cacheKey = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : keyGenerator;
      
      // Try to get cached data
      const cachedData = await CacheService.get(cacheKey);
      
      if (cachedData) {
        console.log(`🎯 Ticket cache hit: ${cacheKey}`);
        req.cacheHit = true;
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return res.json(cachedData);
      }
      
      console.log(`❌ Ticket cache miss: ${cacheKey}`);
      req.cacheHit = false;
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache successful responses
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success !== false) {
          CacheService.set(cacheKey, data, expireInSeconds)
            .catch(err => console.error('Ticket cache set error:', err));
        }
        
        // Add cache headers
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      // Attach cache key to request for manual invalidation
      req.cacheKey = cacheKey;
      
      next();
      
    } catch (error) {
      console.error('Ticket cache middleware error:', error);
      req.cacheHit = false;
      next();
    }
  };
};

// ==========================================
// SPECIFIC CACHE MIDDLEWARE FUNCTIONS
// ==========================================

// Cache user tickets (5 minutes)
const cacheUserTickets = cache(
  (req) => {
    const { page = 1 } = req.query;
    const filters = { 
      status: req.query.status, 
      categoryId: req.query.categoryId,
      search: req.query.search 
    };
    return TicketCacheKeys.userTickets(req.user.id, page, filters);
  },
  5 * 60 // 5 minutes
);

// Cache admin tickets (3 minutes)
const cacheAdminTickets = cache(
  (req) => {
    const { page = 1 } = req.query;
    const filters = { 
      status: req.query.status, 
      categoryId: req.query.categoryId,
      assignedToMe: req.query.assignedToMe,
      priority: req.query.priority,
      search: req.query.search 
    };
    return TicketCacheKeys.adminTickets(page, filters);
  },
  3 * 60 // 3 minutes
);

// Cache ticket details (2 minutes - frequently updated)
const cacheTicketDetails = cache(
  (req) => TicketCacheKeys.ticketDetails(req.params.ticketId),
  2 * 60 // 2 minutes
);

// Cache user dashboard (5 minutes)
const cacheUserDashboard = cache(
  (req) => TicketCacheKeys.userDashboard(req.user.id),
  5 * 60 // 5 minutes
);

// Cache admin dashboard (5 minutes)
const cacheAdminDashboard = cache(
  (req) => TicketCacheKeys.adminDashboard(req.user.id),
  5 * 60 // 5 minutes
);

// Cache categories (1 hour - rarely change)
const cacheCategories = cache(
  () => TicketCacheKeys.categories(),
  60 * 60 // 1 hour
);

// Cache available admins (30 minutes)
const cacheAvailableAdmins = cache(
  () => TicketCacheKeys.availableAdmins(),
  30 * 60 // 30 minutes
);

// ==========================================
// Ticket Analysis  MIDDLEWARE
// ==========================================

const cacheTicketAnalytics = async (req, res, next) => {
  try {
    const CacheService = require('../../services/cache.service');
    const cacheKey = `${ANALYTICS_CACHE_KEYS.OVERVIEW}:${req.originalUrl}`;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    res.cacheKey = cacheKey;
    res.cacheTTL = 900; // 15 minutes for analytics
    next();
  } catch (error) {
    next();
  }
};

/**
 * Cache analytics overview data
 */
const cacheAnalyticsOverview = async (req, res, next) => {
  try {
    const CacheService = require('../../services/cache.service');
    const cacheKey = ANALYTICS_CACHE_KEYS.OVERVIEW;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // Store cache key for response caching
    res.cacheKey = cacheKey;
    res.cacheTTL = 900; // 15 minutes
    next();
  } catch (error) {
    next();
  }
};

/**
 * Cache category analysis data
 */
const cacheCategoryAnalysis = async (req, res, next) => {
  try {
    const CacheService = require('../../services/cache.service');
    const cacheKey = ANALYTICS_CACHE_KEYS.CATEGORIES;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    res.cacheKey = cacheKey;
    res.cacheTTL = 1800; // 30 minutes (categories change less frequently)
    next();
  } catch (error) {
    next();
  }
};

/**
 * Cache weekly trends data
 */
const cacheWeeklyTrends = async (req, res, next) => {
  try {
    const CacheService = require('../../services/cache.service');
    const cacheKey = ANALYTICS_CACHE_KEYS.TRENDS;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    res.cacheKey = cacheKey;
    res.cacheTTL = 600; // 10 minutes (trends change frequently)
    next();
  } catch (error) {
    next();
  }
};

/**
 * Cache admin performance data
 */
const cacheAdminPerformance = async (req, res, next) => {
  try {
    const CacheService = require('../../services/cache.service');
    const cacheKey = ANALYTICS_CACHE_KEYS.ADMIN_PERFORMANCE;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    res.cacheKey = cacheKey;
    res.cacheTTL = 1200; // 20 minutes
    next();
  } catch (error) {
    next();
  }
};

/**
 * Cache complete analytics data
 */
const cacheCompleteAnalytics = async (req, res, next) => {
  try {
    const CacheService = require('../../services/cache.service');
    const cacheKey = ANALYTICS_CACHE_KEYS.COMPLETE;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    res.cacheKey = cacheKey;
    res.cacheTTL = 900; // 15 minutes
    next();
  } catch (error) {
    next();
  }
};

/**
 * Invalidate all analytics caches when tickets are modified
 */
const invalidateAnalyticsCaches = async () => {
  try {
    const CacheService = require('../../services/cache.service');
    
    await Promise.all([
      CacheService.del(ANALYTICS_CACHE_KEYS.OVERVIEW),
      CacheService.del(ANALYTICS_CACHE_KEYS.CATEGORIES),
      CacheService.del(ANALYTICS_CACHE_KEYS.TRENDS),
      CacheService.del(ANALYTICS_CACHE_KEYS.ADMIN_PERFORMANCE),
      CacheService.del(ANALYTICS_CACHE_KEYS.PRIORITY_DISTRIBUTION),
      CacheService.del(ANALYTICS_CACHE_KEYS.COMPLETE)
    ]);
    
    console.log('✅ Analytics caches invalidated');
  } catch (error) {
    console.error('Analytics cache invalidation error:', error);
  }
};

/**
 * Auto-invalidate analytics caches middleware
 * Use this on any route that modifies ticket data
 */
const autoInvalidateAnalyticsCaches = async (req, res, next) => {
  try {
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await invalidateAnalyticsCaches();
      }
    });
    next();
  } catch (error) {
    next();
  }
};



// ==========================================
// CACHE INVALIDATION MIDDLEWARE
// ==========================================

const invalidateCache = (invalidationFunction) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to invalidate cache after successful response
    res.json = function(data) {
      // Only invalidate on successful operations
      if (res.statusCode < 300 && data.success) {
        invalidationFunction(req, res)
          .catch(err => console.error('Cache invalidation error:', err));
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Invalidate ticket caches after operations
const invalidateTicketCaches = invalidateCache(async (req) => {
  const patterns = [
    `tickets:user:${req.user.id}:*`,
    'tickets:admin:*',
    'tickets:details:*'
  ];
  
  // Also invalidate assigned admin's cache if ticket has one
  if (req.ticket?.assignedToId) {
    patterns.push(`tickets:admin:${req.ticket.assignedToId}:*`);
  }
  
  await Promise.all(patterns.map(pattern => CacheService.delPattern(pattern)));
  await invalidateAnalyticsCaches();
});

// ==========================================
// EXPORTED MIDDLEWARE
// ==========================================

module.exports = {
  // Cache middleware
  cacheUserTickets,
  cacheAdminTickets,
  cacheTicketDetails,
  cacheUserDashboard,
  cacheAdminDashboard,
  cacheCategories,
  cacheAvailableAdmins,
  
  // Cache invalidation middleware
  invalidateTicketCaches,
  
  // Cache utilities
  TicketCacheKeys,
  ANALYTICS_CACHE_KEYS,

  cacheTicketAnalytics,
  cacheAnalyticsOverview,
  cacheCategoryAnalysis,
  cacheWeeklyTrends,
  cacheAdminPerformance,
  cacheCompleteAnalytics,
  invalidateAnalyticsCaches,
  autoInvalidateAnalyticsCaches
};