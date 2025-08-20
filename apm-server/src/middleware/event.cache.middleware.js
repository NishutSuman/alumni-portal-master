// src/middleware/event.cache.middleware.js
const { CacheService } = require('../config/redis');

// Event-specific cache keys
class EventCacheKeys {
  
  // Event category cache keys
  static eventCategories(includeInactive = false) {
    return `event:categories:${includeInactive ? 'all' : 'active'}`;
  }
  
  static eventCategory(categoryId) {
    return `event:category:${categoryId}`;
  }
  
  static categoryEvents(categoryId, page = 1, limit = 10) {
    return `event:category:${categoryId}:events:page:${page}:limit:${limit}`;
  }
  
  // Event cache keys
  static events(filters = {}) {
    const filterString = Object.keys(filters)
      .sort()
      .map(key => `${key}:${filters[key] || 'all'}`)
      .join(':');
    return `events:list:${filterString}`;
  }
  
  static event(eventId) {
    return `event:${eventId}`;
  }
  
  static eventBySlug(slug) {
    return `event:slug:${slug}`;
  }
  
  // Event sections cache keys
  static eventSections(eventId, includeHidden = false) {
    return `event:${eventId}:sections:${includeHidden ? 'all' : 'visible'}`;
  }
  
  static eventSection(eventId, sectionId) {
    return `event:${eventId}:section:${sectionId}`;
  }
  
  // Event statistics cache keys
  static eventStats(eventId) {
    return `event:${eventId}:stats`;
  }
  
  static eventRegistrationCount(eventId) {
    return `event:${eventId}:registration:count`;
  }
  
  // Admin dashboard cache keys
  static adminEventsList(status = 'all') {
    return `admin:events:${status}`;
  }
  
  static eventDashboardStats() {
    return 'admin:events:dashboard:stats';
  }
}

// Generic event cache middleware
const cacheEvent = (keyGenerator, expireInSeconds = 1800) => { // 30 minutes default
  return async (req, res, next) => {
    try {
      // Generate cache key based on request
      const cacheKey = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : keyGenerator;
      
      // Try to get cached data
      const cachedData = await CacheService.get(cacheKey);
      
      if (cachedData) {
        // Cache hit - return cached data
        console.log(`🎯 Event cache hit: ${cacheKey}`);
        req.cacheHit = true;
        return res.json(cachedData);
      }
      
      // Cache miss - continue to controller
      console.log(`❌ Event cache miss: ${cacheKey}`);
      req.cacheHit = false;
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success) {
          CacheService.set(cacheKey, data, expireInSeconds)
            .catch(err => console.error('Failed to cache event response:', err));
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      // Attach cache key to request for manual cache invalidation
      req.cacheKey = cacheKey;
      
      next();
    } catch (error) {
      console.error('Event cache middleware error:', error);
      // Don't let cache errors break the request
      req.cacheHit = false;
      next();
    }
  };
};

// Specific event caching middleware

// Cache event categories (2 hours)
const cacheEventCategories = cacheEvent(
  (req) => EventCacheKeys.eventCategories(req.query.includeInactive),
  2 * 60 * 60
);

// Cache single event category with events (1 hour)
const cacheEventCategory = cacheEvent(
  (req) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    return EventCacheKeys.categoryEvents(req.params.categoryId, page, limit);
  },
  60 * 60
);

// Cache events list (30 minutes)
const cacheEventsList = cacheEvent(
  (req) => {
    const filters = {
      category: req.query.category,
      status: req.query.status,
      eventMode: req.query.eventMode,
      search: req.query.search,
      upcoming: req.query.upcoming,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      page: req.query.page || 1,
      limit: req.query.limit || 10,
    };
    return EventCacheKeys.events(filters);
  },
  30 * 60
);

// Cache single event details (45 minutes)
const cacheEventDetails = cacheEvent(
  (req) => {
    // Support both ID and slug lookup
    return req.params.eventId.length === 25 
      ? EventCacheKeys.event(req.params.eventId)
      : EventCacheKeys.eventBySlug(req.params.eventId);
  },
  45 * 60
);

// Cache event sections (1 hour)
const cacheEventSections = cacheEvent(
  (req) => EventCacheKeys.eventSections(req.params.eventId, req.query.includeHidden),
  60 * 60
);

// Cache single event section (1 hour)
const cacheEventSection = cacheEvent(
  (req) => EventCacheKeys.eventSection(req.params.eventId, req.params.sectionId),
  60 * 60
);

// Cache event statistics (20 minutes)
const cacheEventStats = cacheEvent(
  (req) => EventCacheKeys.eventStats(req.params.eventId),
  20 * 60
);

// Cache admin events list (15 minutes)
const cacheAdminEventsList = cacheEvent(
  (req) => EventCacheKeys.adminEventsList(req.query.status),
  15 * 60
);

// Event cache invalidation helpers
class EventCacheInvalidator {
  
  // Invalidate all event category caches
  static async invalidateCategories() {
    await CacheService.delPattern('event:categories:*');
    await CacheService.delPattern('event:category:*');
    console.log('🗑️ Invalidated event category caches');
  }
  
  // Invalidate specific category cache
  static async invalidateCategory(categoryId) {
    await CacheService.del(EventCacheKeys.eventCategory(categoryId));
    await CacheService.delPattern(`event:category:${categoryId}:*`);
    console.log(`🗑️ Invalidated category cache: ${categoryId}`);
  }
  
  // Invalidate all events list caches
  static async invalidateEventsList() {
    await CacheService.delPattern('events:list:*');
    await CacheService.delPattern('admin:events:*');
    console.log('🗑️ Invalidated events list caches');
  }
  
  // Invalidate specific event cache
  static async invalidateEvent(eventId, slug = null) {
    await CacheService.del(EventCacheKeys.event(eventId));
    if (slug) {
      await CacheService.del(EventCacheKeys.eventBySlug(slug));
    }
    await CacheService.delPattern(`event:${eventId}:*`);
    console.log(`🗑️ Invalidated event cache: ${eventId}`);
  }
  
  // Invalidate event sections
  static async invalidateEventSections(eventId) {
    await CacheService.delPattern(`event:${eventId}:section*`);
    console.log(`🗑️ Invalidated event sections cache: ${eventId}`);
  }
  
  // Invalidate event stats and counts
  static async invalidateEventStats(eventId) {
    await CacheService.del(EventCacheKeys.eventStats(eventId));
    await CacheService.del(EventCacheKeys.eventRegistrationCount(eventId));
    console.log(`🗑️ Invalidated event stats cache: ${eventId}`);
  }
  
  // Invalidate dashboard stats
  static async invalidateDashboardStats() {
    await CacheService.del(EventCacheKeys.eventDashboardStats());
    console.log('🗑️ Invalidated event dashboard stats');
  }
  
  // Invalidate all event-related caches
  static async invalidateAllEventCaches() {
    await CacheService.delPattern('event:*');
    await CacheService.delPattern('events:*');
    await CacheService.delPattern('admin:events:*');
    console.log('🗑️ Invalidated ALL event caches');
  }
}

// Cache invalidation middleware for event mutations
const invalidateEventCache = (invalidationFunction) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to invalidate cache after successful response
    res.json = function(data) {
      // Only invalidate on successful operations
      if (res.statusCode < 300 && data.success) {
        invalidationFunction(req, res)
          .catch(err => console.error('Event cache invalidation error:', err));
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Specific event cache invalidation middleware

// Invalidate category caches after category operations
const invalidateEventCategoryCache = invalidateEventCache(async (req) => {
  const categoryId = req.params.categoryId;
  
  if (categoryId) {
    await EventCacheInvalidator.invalidateCategory(categoryId);
  }
  
  // Always invalidate categories list
  await EventCacheInvalidator.invalidateCategories();
});

// Invalidate event caches after event operations
const invalidateEventCacheMiddleware = invalidateEventCache(async (req) => {
  const eventId = req.params.eventId;
  const eventSlug = req.body.slug || req.event?.slug;
  
  if (eventId) {
    await EventCacheInvalidator.invalidateEvent(eventId, eventSlug);
  }
  
  // Always invalidate events lists
  await EventCacheInvalidator.invalidateEventsList();
  await EventCacheInvalidator.invalidateDashboardStats();
});

// Invalidate section caches after section operations
const invalidateEventSectionCache = invalidateEventCache(async (req) => {
  const eventId = req.params.eventId;
  
  if (eventId) {
    await EventCacheInvalidator.invalidateEventSections(eventId);
    // Also invalidate the event details since sections are included
    await EventCacheInvalidator.invalidateEvent(eventId);
  }
});

// Invalidate registration-related caches
const invalidateEventRegistrationCache = invalidateEventCache(async (req) => {
  const eventId = req.params.eventId;
  
  if (eventId) {
    await EventCacheInvalidator.invalidateEventStats(eventId);
    await EventCacheInvalidator.invalidateEvent(eventId); // Update registration counts in event details
  }
});

module.exports = {
  EventCacheKeys,
  cacheEvent,
  cacheEventCategories,
  cacheEventCategory,
  cacheEventsList,
  cacheEventDetails,
  cacheEventSections,
  cacheEventSection,
  cacheEventStats,
  cacheAdminEventsList,
  EventCacheInvalidator,
  invalidateEventCategoryCache,
  invalidateEventCacheMiddleware,
  invalidateEventSectionCache,
  invalidateEventRegistrationCache,
};