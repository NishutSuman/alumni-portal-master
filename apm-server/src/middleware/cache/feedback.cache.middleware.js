// src/middleware/feedback.cache.middleware.js
const { CacheService } = require('../../config/redis');

// =============================================
// CACHE KEY GENERATORS
// =============================================

const FeedbackCacheKeys = {
  // Feedback form cache keys
  feedbackForm: (eventId) => `feedback_form:${eventId}`,
  feedbackFormFields: (eventId) => `feedback_form_fields:${eventId}`,
  
  // Analytics cache keys
  feedbackAnalytics: (feedbackFormId) => `feedback_analytics:${feedbackFormId}`,
  feedbackSummary: (eventId) => `feedback_summary:${eventId}`,
  
  // Response cache keys
  feedbackResponses: (feedbackFormId, page = 1, filters = '') => 
    `feedback_responses:${feedbackFormId}:${page}:${filters}`,
  userFeedbackResponse: (feedbackFormId, userId) => 
    `user_feedback:${feedbackFormId}:${userId}`,
    
  // Export cache keys
  feedbackExport: (feedbackFormId, format, filters) => 
    `feedback_export:${feedbackFormId}:${format}:${filters}`,
    
  // Admin dashboard cache keys
  feedbackStats: (eventId) => `feedback_stats:${eventId}`,
  feedbackTrends: (eventIds) => `feedback_trends:${eventIds.sort().join(',')}`,
};

// =============================================
// GENERIC CACHE MIDDLEWARE
// =============================================

const cache = (keyGenerator, expireInSeconds = 3600, skipCache = false) => {
  return async (req, res, next) => {
    try {
      // Skip cache if requested or in development with skip flag
      if (skipCache || req.headers['cache-control'] === 'no-cache') {
        req.cacheHit = false;
        return next();
      }

      // Generate cache key
      const cacheKey = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : keyGenerator;
      
      // Try to get cached data
      const cachedData = await CacheService.get(cacheKey);
      
      if (cachedData) {
        console.log(`🎯 Feedback cache hit: ${cacheKey}`);
        req.cacheHit = true;
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return res.json(cachedData);
      }
      
      console.log(`❌ Feedback cache miss: ${cacheKey}`);
      req.cacheHit = false;
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache successful responses
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success !== false) {
          CacheService.set(cacheKey, data, expireInSeconds)
            .catch(err => console.error('Feedback cache set error:', err));
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
      console.error('Feedback cache middleware error:', error);
      req.cacheHit = false;
      next();
    }
  };
};

// =============================================
// SPECIFIC CACHE MIDDLEWARE FUNCTIONS
// =============================================

// Cache feedback form (30 minutes)
const cacheFeedbackForm = cache(
  (req) => FeedbackCacheKeys.feedbackForm(req.params.eventId),
  30 * 60 // 30 minutes
);

// Cache feedback form fields (1 hour)
const cacheFeedbackFormFields = cache(
  (req) => FeedbackCacheKeys.feedbackFormFields(req.params.eventId),
  60 * 60 // 1 hour
);

// Cache feedback analytics (2 hours)
const cacheFeedbackAnalytics = cache(
  (req) => {
    // Need to get feedbackFormId from request or generate key differently
    const eventId = req.params.eventId;
    return `feedback_analytics_by_event:${eventId}`;
  },
  2 * 60 * 60 // 2 hours
);

// Cache feedback responses (15 minutes)
const cacheFeedbackResponses = cache(
  (req) => {
    const eventId = req.params.eventId;
    const { page = 1, includeAnonymous, fieldId, sentimentFilter } = req.query;
    const filters = [includeAnonymous, fieldId, sentimentFilter].filter(Boolean).join('_');
    return FeedbackCacheKeys.feedbackResponses(eventId, page, filters);
  },
  15 * 60 // 15 minutes
);

// Cache user's own feedback response (1 hour)
const cacheUserFeedbackResponse = cache(
  (req) => {
    const eventId = req.params.eventId;
    const userId = req.user.id;
    return FeedbackCacheKeys.userFeedbackResponse(eventId, userId);
  },
  60 * 60 // 1 hour
);

// Cache feedback summary statistics (30 minutes)
const cacheFeedbackSummary = cache(
  (req) => FeedbackCacheKeys.feedbackSummary(req.params.eventId),
  30 * 60 // 30 minutes
);

// Cache feedback export (5 minutes - shorter due to data freshness needs)
const cacheFeedbackExport = cache(
  (req) => {
    const eventId = req.params.eventId;
    const { format = 'csv', includeAnonymous = 'true' } = req.query;
    const filters = `${format}_${includeAnonymous}`;
    return FeedbackCacheKeys.feedbackExport(eventId, format, filters);
  },
  5 * 60 // 5 minutes
);

// =============================================
// CACHE INVALIDATION MIDDLEWARE
// =============================================

// Invalidate feedback caches after form modifications
const invalidateFeedbackFormCache = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = async function(data) {
    // Only invalidate on successful operations
    if (res.statusCode === 200 && data.success !== false) {
      const eventId = req.params.eventId;
      
      try {
        const keysToInvalidate = [
          FeedbackCacheKeys.feedbackForm(eventId),
          FeedbackCacheKeys.feedbackFormFields(eventId),
          FeedbackCacheKeys.feedbackSummary(eventId),
          `feedback_analytics_by_event:${eventId}`
        ];
        
        await Promise.all(keysToInvalidate.map(key => CacheService.del(key)));
        console.log(`🗑️ Invalidated feedback form cache for event: ${eventId}`);
        
      } catch (error) {
        console.error('Feedback form cache invalidation error:', error);
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Invalidate response caches after feedback submission
const invalidateResponseCache = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = async function(data) {
    // Only invalidate on successful operations
    if (res.statusCode === 200 && data.success !== false) {
      const eventId = req.params.eventId;
      
      try {
        // Invalidate all response-related caches
        const pattern = `feedback_responses:*${eventId}*`;
        await CacheService.deletePattern(pattern);
        
        // Also invalidate analytics and summary
        const specificKeys = [
          FeedbackCacheKeys.feedbackSummary(eventId),
          `feedback_analytics_by_event:${eventId}`,
          FeedbackCacheKeys.feedbackStats(eventId)
        ];
        
        await Promise.all(specificKeys.map(key => CacheService.del(key)));
        console.log(`🗑️ Invalidated feedback response cache for event: ${eventId}`);
        
      } catch (error) {
        console.error('Feedback response cache invalidation error:', error);
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Invalidate analytics cache specifically
const invalidateAnalyticsCache = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = async function(data) {
    if (res.statusCode === 200 && data.success !== false) {
      const eventId = req.params.eventId;
      
      try {
        const keysToInvalidate = [
          `feedback_analytics_by_event:${eventId}`,
          FeedbackCacheKeys.feedbackSummary(eventId),
          FeedbackCacheKeys.feedbackStats(eventId)
        ];
        
        await Promise.all(keysToInvalidate.map(key => CacheService.del(key)));
        console.log(`🗑️ Invalidated analytics cache for event: ${eventId}`);
        
      } catch (error) {
        console.error('Analytics cache invalidation error:', error);
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// =============================================
// BATCH CACHE OPERATIONS
// =============================================

// Clear all feedback caches for an event
const clearEventFeedbackCache = async (eventId) => {
  try {
    const keysToInvalidate = [
      FeedbackCacheKeys.feedbackForm(eventId),
      FeedbackCacheKeys.feedbackFormFields(eventId),
      FeedbackCacheKeys.feedbackSummary(eventId),
      FeedbackCacheKeys.feedbackStats(eventId),
      `feedback_analytics_by_event:${eventId}`
    ];
    
    // Clear specific keys
    await Promise.all(keysToInvalidate.map(key => CacheService.del(key)));
    
    // Clear pattern-based keys
    const patterns = [
      `feedback_responses:*${eventId}*`,
      `feedback_export:*${eventId}*`,
      `user_feedback:*${eventId}*`
    ];
    
    await Promise.all(patterns.map(pattern => CacheService.deletePattern(pattern)));
    
    console.log(`🗑️ Cleared all feedback cache for event: ${eventId}`);
    
  } catch (error) {
    console.error('Clear event feedback cache error:', error);
  }
};

// Warm up frequently accessed caches
const warmupFeedbackCaches = async (eventIds) => {
  try {
    console.log(`🔥 Warming up feedback caches for ${eventIds.length} events`);
    
    // This would typically be called during off-peak hours
    // Implementation would pre-load frequently accessed data
    
    for (const eventId of eventIds) {
      // Pre-generate basic analytics if form exists
      // This is a placeholder - actual implementation would call the analytics service
      console.log(`🔥 Warming cache for event: ${eventId}`);
    }
    
  } catch (error) {
    console.error('Warmup feedback caches error:', error);
  }
};

// =============================================
// CACHE HEALTH CHECK
// =============================================

const getFeedbackCacheHealth = async () => {
  try {
    const stats = {
      feedbackForms: 0,
      analytics: 0,
      responses: 0,
      exports: 0,
      total: 0
    };
    
    // Count different types of cached items
    const patterns = {
      feedbackForms: 'feedback_form:*',
      analytics: 'feedback_analytics:*',
      responses: 'feedback_responses:*',
      exports: 'feedback_export:*'
    };
    
    for (const [type, pattern] of Object.entries(patterns)) {
      const keys = await CacheService.keys(pattern);
      stats[type] = keys.length;
      stats.total += keys.length;
    }
    
    return {
      healthy: true,
      stats,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error('Feedback cache health check error:', error);
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

// =============================================
// MODULE EXPORTS
// =============================================

module.exports = {
  // Cache middleware functions
  cacheFeedbackForm,
  cacheFeedbackFormFields,
  cacheFeedbackAnalytics,
  cacheFeedbackResponses,
  cacheUserFeedbackResponse,
  cacheFeedbackSummary,
  cacheFeedbackExport,
  
  // Cache invalidation middleware
  invalidateFeedbackFormCache,
  invalidateResponseCache,
  invalidateAnalyticsCache,
  
  // Utility functions
  clearEventFeedbackCache,
  warmupFeedbackCaches,
  getFeedbackCacheHealth,
  
  // Cache key generators (for external use)
  FeedbackCacheKeys
};