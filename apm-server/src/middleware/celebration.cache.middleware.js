// src/middleware/celebration.cache.middleware.js
// 12-hour caching strategy using existing CacheService

const { CacheService } = require('../config/redis');

// ============================================
// CELEBRATION CACHE KEYS (Following your existing pattern)
// ============================================

class CelebrationCacheKeys {
  // Birthday cache keys
  static todaysBirthdays() {
    const today = new Date().toISOString().split('T')[0];
    return `celebrations:birthdays:today:${today}`;
  }
  
  static upcomingBirthdays(days) {
    const today = new Date().toISOString().split('T')[0];
    return `celebrations:birthdays:upcoming:${days}:${today}`;
  }
  
  static birthdayStats() {
    const today = new Date().toISOString().split('T')[0];
    return `celebrations:birthdays:stats:${today}`;
  }
  
  static birthdayDistribution() {
    return `celebrations:birthdays:distribution`;
  }
  
  static birthdaysInMonth(month, year) {
    return `celebrations:birthdays:month:${month}:${year}`;
  }
  
  // Festival cache keys
  static todaysFestivals() {
    const today = new Date().toISOString().split('T')[0];
    return `celebrations:festivals:today:${today}`;
  }
  
  static upcomingFestivals(days) {
    const today = new Date().toISOString().split('T')[0];
    return `celebrations:festivals:upcoming:${days}:${today}`;
  }
  
  static festivalStats() {
    const year = new Date().getFullYear();
    return `celebrations:festivals:stats:${year}`;
  }
  
  static festivalCalendar(year) {
    return `celebrations:festivals:calendar:${year}`;
  }
  
  static searchFestivals(query, filters) {
    const filterStr = JSON.stringify(filters);
    const hash = require('crypto').createHash('md5').update(filterStr).digest('hex').slice(0, 8);
    return `celebrations:festivals:search:${query || 'all'}:${hash}`;
  }
  
  // Combined cache keys
  static todaysCelebrations() {
    const today = new Date().toISOString().split('T')[0];
    return `celebrations:combined:today:${today}`;
  }
  
  static celebrationSummary() {
    const today = new Date().toISOString().split('T')[0];
    return `celebrations:summary:${today}`;
  }
}

// ============================================
// CACHE TTL CONFIGURATION (in seconds)
// ============================================

const TTL = {
  TWELVE_HOURS: 12 * 60 * 60,     // 43200 seconds - Main caching strategy
  SIX_HOURS: 6 * 60 * 60,         // 21600 seconds - For stats
  ONE_HOUR: 60 * 60,              // 3600 seconds - For search results
  THIRTY_MINUTES: 30 * 60,        // 1800 seconds - For admin data
  ONE_DAY: 24 * 60 * 60           // 86400 seconds - For calendar data
};

// ============================================
// GENERIC CACHE MIDDLEWARE (Following your existing pattern)
// ============================================

const cacheCelebration = (keyGenerator, expireInSeconds = TTL.TWELVE_HOURS) => {
  return async (req, res, next) => {
    try {
      // Generate cache key
      const cacheKey = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : keyGenerator;
      
      // Try to get cached data using your existing CacheService
      const cachedData = await CacheService.get(cacheKey);
      
      if (cachedData) {
        console.log(`🎯 Celebration cache hit: ${cacheKey}`);
        req.cacheHit = true;
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return res.json(cachedData);
      }
      
      console.log(`❌ Celebration cache miss: ${cacheKey}`);
      req.cacheHit = false;
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache successful responses
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success !== false) {
          CacheService.set(cacheKey, data, expireInSeconds)
            .catch(err => console.error('Celebration cache set error:', err));
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
      console.error('Celebration cache middleware error:', error);
      // Don't let cache errors break the request
      req.cacheHit = false;
      next();
    }
  };
};

// ============================================
// SPECIFIC CACHE MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Cache today's birthdays (12-hour cache)
 */
const cacheTodaysBirthdays = cacheCelebration(
  () => CelebrationCacheKeys.todaysBirthdays(),
  TTL.TWELVE_HOURS
);

/**
 * Cache upcoming birthdays (12-hour cache)
 */
const cacheUpcomingBirthdays = cacheCelebration(
  (req) => CelebrationCacheKeys.upcomingBirthdays(req.query.days || 7),
  TTL.TWELVE_HOURS
);

/**
 * Cache today's festivals (12-hour cache)
 */
const cacheTodaysFestivals = cacheCelebration(
  () => CelebrationCacheKeys.todaysFestivals(),
  TTL.TWELVE_HOURS
);

/**
 * Cache upcoming festivals (12-hour cache)
 */
const cacheUpcomingFestivals = cacheCelebration(
  (req) => CelebrationCacheKeys.upcomingFestivals(req.query.days || 30),
  TTL.TWELVE_HOURS
);

/**
 * Cache today's celebrations (12-hour cache)
 */
const cacheTodaysCelebrations = cacheCelebration(
  () => CelebrationCacheKeys.todaysCelebrations(),
  TTL.TWELVE_HOURS
);

/**
 * Cache birthday statistics (6-hour cache)
 */
const cacheBirthdayStats = cacheCelebration(
  () => CelebrationCacheKeys.birthdayStats(),
  TTL.SIX_HOURS
);

/**
 * Cache festival statistics (6-hour cache)
 */
const cacheFestivalStats = cacheCelebration(
  () => CelebrationCacheKeys.festivalStats(),
  TTL.SIX_HOURS
);

/**
 * Cache celebration summary (6-hour cache)
 */
const cacheCelebrationSummary = cacheCelebration(
  () => CelebrationCacheKeys.celebrationSummary(),
  TTL.SIX_HOURS
);

/**
 * Cache festival calendar (1-day cache)
 */
const cacheFestivalCalendar = cacheCelebration(
  (req) => CelebrationCacheKeys.festivalCalendar(req.query.year || new Date().getFullYear()),
  TTL.ONE_DAY
);

/**
 * Cache birthday distribution (1-day cache - rarely changes)
 */
const cacheBirthdayDistribution = cacheCelebration(
  () => CelebrationCacheKeys.birthdayDistribution(),
  TTL.ONE_DAY
);

/**
 * Cache birthdays in month (1-hour cache)
 */
const cacheBirthdaysInMonth = cacheCelebration(
  (req) => CelebrationCacheKeys.birthdaysInMonth(
    req.params.month, 
    req.query.year || new Date().getFullYear()
  ),
  TTL.ONE_HOUR
);

/**
 * Cache festival search results (1-hour cache)
 */
const cacheFestivalSearch = cacheCelebration(
  (req) => {
    const filters = {
      festivalType: req.query.festivalType,
      religion: req.query.religion,
      priority: req.query.priority,
      year: req.query.year,
      limit: req.query.limit
    };
    return CelebrationCacheKeys.searchFestivals(req.query.q, filters);
  },
  TTL.ONE_HOUR
);

// ============================================
// CACHE INVALIDATION MIDDLEWARE (Following your existing pattern)
// ============================================

/**
 * Auto-invalidate celebration caches after admin operations
 */
const autoInvalidateCelebrationCaches = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  res.json = async function(data) {
    if (data.success !== false) {
      try {
        console.log('🗑️ Auto-invalidating celebration caches...');
        
        // Get all celebration cache keys and delete them
        await CacheService.delPattern('celebrations:*');
        
        console.log('✅ Celebration caches invalidated');
      } catch (error) {
        console.error('❌ Cache invalidation error:', error);
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Invalidate only festival-related caches (for festival admin operations)
 */
const autoInvalidateFestivalCaches = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = async function(data) {
    if (data.success !== false) {
      try {
        console.log('🗑️ Auto-invalidating festival caches...');
        
        // Delete festival-specific caches
        await CacheService.delPattern('celebrations:festivals:*');
        await CacheService.delPattern('celebrations:combined:*');
        
        console.log('✅ Festival caches invalidated');
      } catch (error) {
        console.error('❌ Festival cache invalidation error:', error);
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Invalidate only birthday-related caches (for birthday admin operations)
 */
const autoInvalidateBirthdayCaches = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = async function(data) {
    if (data.success !== false) {
      try {
        console.log('🗑️ Auto-invalidating birthday caches...');
        
        // Delete birthday-specific caches
        await CacheService.delPattern('celebrations:birthdays:*');
        await CacheService.delPattern('celebrations:combined:*');
        
        console.log('✅ Birthday caches invalidated');
      } catch (error) {
        console.error('❌ Birthday cache invalidation error:', error);
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// ============================================
// CACHE UTILITIES
// ============================================

/**
 * Manual cache invalidation utility
 */
const invalidateAllCelebrationCaches = async () => {
  try {
    await CacheService.delPattern('celebrations:*');
    console.log('🗑️ Manually invalidated all celebration caches');
    return { success: true, message: 'All celebration caches cleared' };
  } catch (error) {
    console.error('❌ Manual cache invalidation error:', error);
    throw error;
  }
};

/**
 * Get cache statistics
 */
const getCacheStats = async () => {
  try {
    // This would need to be implemented based on your CacheService capabilities
    // For now, return basic info
    return {
      message: 'Cache statistics available through Redis CLI',
      patterns: [
        'celebrations:birthdays:*',
        'celebrations:festivals:*', 
        'celebrations:combined:*'
      ]
    };
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    throw error;
  }
};

module.exports = {
  // Cache middleware
  cacheTodaysBirthdays,
  cacheUpcomingBirthdays,
  cacheTodaysFestivals,
  cacheUpcomingFestivals,
  cacheTodaysCelebrations,
  cacheBirthdayStats,
  cacheFestivalStats,
  cacheCelebrationSummary,
  cacheFestivalCalendar,
  cacheBirthdayDistribution,
  cacheBirthdaysInMonth,
  cacheFestivalSearch,
  
  // Auto-invalidation middleware
  autoInvalidateCelebrationCaches,
  autoInvalidateFestivalCaches,
  autoInvalidateBirthdayCaches,
  
  // Utilities
  invalidateAllCelebrationCaches,
  getCacheStats,
  
  // Cache key generators (for manual use)
  CelebrationCacheKeys,
  TTL
};