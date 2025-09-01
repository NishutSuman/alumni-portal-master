
const CacheService = require('../../config/redis');

// ==========================================
// CACHE KEY GENERATORS
// ==========================================

const AdvancedCacheKeys = {
  // Template caching
  activeTemplates: (categoryId) => categoryId 
    ? `templates:category:${categoryId}:active` 
    : 'templates:all:active',
  templateDetails: (templateId) => `templates:details:${templateId}`,
  
  // Search caching
  searchResults: (userId, searchHash) => `search:results:${userId}:${searchHash}`,
  searchConfig: () => 'tickets:search:config',
  searchSuggestions: (userId, partial) => `search:suggestions:${userId}:${partial}`,
  
  // Filter caching
  userFilters: (userId) => `filters:user:${userId}:all`,
  
  // Bulk operation caching
  bulkOperationStatus: (operationId) => `bulk:operation:${operationId}:status`,
  adminBulkHistory: (adminId) => `bulk:history:admin:${adminId}`,
  
  // Statistics caching
  ticketStatistics: (period) => `tickets:stats:${period}`,
  popularSearches: () => 'tickets:search:popular'
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
        console.log(`🎯 Advanced cache hit: ${cacheKey}`);
        req.cacheHit = true;
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return res.json(cachedData);
      }
      
      console.log(`❌ Advanced cache miss: ${cacheKey}`);
      req.cacheHit = false;
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache successful responses
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success !== false) {
          CacheService.set(cacheKey, data, expireInSeconds)
            .catch(err => console.error('Advanced cache set error:', err));
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
      console.error('Advanced cache middleware error:', error);
      req.cacheHit = false;
      next();
    }
  };
};

// ==========================================
// SPECIFIC CACHE MIDDLEWARE FUNCTIONS
// ==========================================

// Cache active templates (30 minutes)
const cacheActiveTemplates = cache(
  (req) => {
    const { categoryId } = req.query;
    return AdvancedCacheKeys.activeTemplates(categoryId);
  },
  30 * 60 // 30 minutes
);

// Cache template details (1 hour)
const cacheTemplateDetails = cache(
  (req) => AdvancedCacheKeys.templateDetails(req.params.templateId),
  60 * 60 // 1 hour
);

// Cache search configuration (2 hours - rarely changes)
const cacheSearchConfig = cache(
  () => AdvancedCacheKeys.searchConfig(),
  2 * 60 * 60 // 2 hours
);

// Cache search suggestions (10 minutes)
const cacheSearchSuggestions = cache(
  (req) => {
    const { q } = req.query;
    return AdvancedCacheKeys.searchSuggestions(req.user.id, q);
  },
  10 * 60 // 10 minutes
);

// Cache user filters (30 minutes)
const cacheUserFilters = cache(
  (req) => AdvancedCacheKeys.userFilters(req.user.id),
  30 * 60 // 30 minutes
);

// Cache bulk operation status (1 minute - frequently updated)
const cacheBulkOperationStatus = cache(
  (req) => AdvancedCacheKeys.bulkOperationStatus(req.params.operationId),
  1 * 60 // 1 minute
);

// Cache admin bulk history (15 minutes)
const cacheAdminBulkHistory = cache(
  (req) => AdvancedCacheKeys.adminBulkHistory(req.user.id),
  15 * 60 // 15 minutes
);

// Cache ticket statistics (10 minutes)
const cacheTicketStatistics = cache(
  (req) => {
    const { period = '30d' } = req.query;
    return AdvancedCacheKeys.ticketStatistics(period);
  },
  10 * 60 // 10 minutes
);

// Cache popular searches (1 hour)
const cachePopularSearches = cache(
  () => AdvancedCacheKeys.popularSearches(),
  60 * 60 // 1 hour
);

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

// Invalidate template-related caches
const invalidateTemplateCaches = invalidateCache(async (req) => {
  const patterns = [
    'templates:*',
    'tickets:categories:*' // Templates affect category data
  ];
  
  await Promise.all(patterns.map(pattern => CacheService.delPattern(pattern)));
});

// Invalidate search-related caches
const invalidateSearchCaches = invalidateCache(async (req) => {
  const patterns = [
    `search:*`,
    `filters:user:${req.user.id}:*`
  ];
  
  await Promise.all(patterns.map(pattern => CacheService.delPattern(pattern)));
});

// Invalidate bulk operation caches
const invalidateBulkCaches = invalidateCache(async (req) => {
  const patterns = [
    'bulk:*',
    'tickets:admin:*',
    'tickets:user:*',
    'tickets:details:*',
    'tickets:stats:*'
  ];
  
  await Promise.all(patterns.map(pattern => CacheService.delPattern(pattern)));
});

// ==========================================
// EXPORTED MIDDLEWARE
// ==========================================

module.exports = {
  // Cache middleware
  cacheActiveTemplates,
  cacheTemplateDetails,
  cacheSearchConfig,
  cacheSearchSuggestions,
  cacheUserFilters,
  cacheBulkOperationStatus,
  cacheAdminBulkHistory,
  cacheTicketStatistics,
  cachePopularSearches,
  
  // Cache invalidation middleware
  invalidateTemplateCaches,
  invalidateSearchCaches,
  invalidateBulkCaches,
  
  // Cache utilities
  AdvancedCacheKeys
};