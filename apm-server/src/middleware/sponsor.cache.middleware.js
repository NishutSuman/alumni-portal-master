// src/middleware/sponsor.cache.middleware.js
const Redis = require('ioredis');
const { successResponse } = require('../utils/response');

// Initialize Redis client (following existing pattern)
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100
});

// ============================================
// CACHE KEY GENERATORS
// ============================================

const generateSponsorsCacheKey = (filters = {}) => {
  const { 
    category, 
    isActive, 
    page = 1, 
    limit = 10, 
    search = '',
    sortBy = 'displayOrder',
    sortOrder = 'asc'
  } = filters;
  
  return `sponsors:list:${category || 'all'}:${isActive}:${page}:${limit}:${search}:${sortBy}:${sortOrder}`;
};

const generateSponsorDetailsCacheKey = (sponsorId) => {
  return `sponsors:details:${sponsorId}`;
};

const generateSponsorStatsCacheKey = () => {
  return 'sponsors:statistics';
};

const generatePublicSponsorsCacheKey = (category = 'all') => {
  return `sponsors:public:${category}`;
};

const generateSponsorsByCategoryCacheKey = () => {
  return 'sponsors:by-category';
};

// ============================================
// CACHING MIDDLEWARE FUNCTIONS
// ============================================

// Cache sponsors list
const cacheSponsorsList = async (req, res, next) => {
  try {
    const cacheKey = generateSponsorsCacheKey(req.query);
    const cached = await redis.get(cacheKey);

    if (cached) {
      const data = JSON.parse(cached);
      return successResponse(
        res,
        data,
        'Sponsors retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    // Store reference for setting cache after response
    req.cacheKey = cacheKey;
    req.cacheTTL = 300; // 5 minutes
    next();
  } catch (error) {
    console.error('Sponsors cache error:', error);
    next(); // Continue without cache on error
  }
};

// Cache sponsor details
const cacheSponsorDetails = async (req, res, next) => {
  try {
    const { sponsorId } = req.params;
    const cacheKey = generateSponsorDetailsCacheKey(sponsorId);
    
    const cached = await redis.get(cacheKey);

    if (cached) {
      const data = JSON.parse(cached);
      return successResponse(
        res,
        data,
        'Sponsor details retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 600; // 10 minutes
    next();
  } catch (error) {
    console.error('Sponsor details cache error:', error);
    next();
  }
};

// Cache sponsor statistics
const cacheSponsorStats = async (req, res, next) => {
  try {
    const cacheKey = generateSponsorStatsCacheKey();
    const cached = await redis.get(cacheKey);

    if (cached) {
      const data = JSON.parse(cached);
      return successResponse(
        res,
        data,
        'Sponsor statistics retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 900; // 15 minutes
    next();
  } catch (error) {
    console.error('Sponsor stats cache error:', error);
    next();
  }
};

// Cache public sponsors view
const cachePublicSponsors = async (req, res, next) => {
  try {
    const { category } = req.query;
    const cacheKey = generatePublicSponsorsCacheKey(category);
    const cached = await redis.get(cacheKey);

    if (cached) {
      const data = JSON.parse(cached);
      return successResponse(
        res,
        data,
        'Public sponsors retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 1800; // 30 minutes (longer for public data)
    next();
  } catch (error) {
    console.error('Public sponsors cache error:', error);
    next();
  }
};

// Cache sponsors by category
const cacheSponsorsByCategory = async (req, res, next) => {
  try {
    const cacheKey = generateSponsorsByCategoryCacheKey();
    const cached = await redis.get(cacheKey);

    if (cached) {
      const data = JSON.parse(cached);
      return successResponse(
        res,
        data,
        'Sponsors by category retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 1200; // 20 minutes
    next();
  } catch (error) {
    console.error('Sponsors by category cache error:', error);
    next();
  }
};

// ============================================
// CACHE INVALIDATION FUNCTIONS
// ============================================

// Auto-invalidate sponsor caches after modifications
const autoInvalidateSponsorCaches = async (req, res, next) => {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = function(data) {
    // Call original res.json first
    originalJson.call(this, data);
    
    // Then perform cache invalidation asynchronously
    setImmediate(async () => {
      try {
        await invalidateSponsorCaches(req);
      } catch (error) {
        console.error('Cache invalidation error:', error);
      }
    });
  };

  next();
};

// Invalidate all sponsor-related caches
const invalidateSponsorCaches = async (req) => {
  try {
    const { sponsorId } = req.params || {};
    
    // Get all cache keys to invalidate
    const patterns = [
      'sponsors:list:*',
      'sponsors:statistics',
      'sponsors:public:*',
      'sponsors:by-category'
    ];

    // Add specific sponsor cache if sponsorId exists
    if (sponsorId) {
      patterns.push(`sponsors:details:${sponsorId}`);
    }

    // Delete cache keys by pattern
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    console.log(`Invalidated sponsor caches for patterns:`, patterns);
  } catch (error) {
    console.error('Sponsor cache invalidation error:', error);
  }
};

// Invalidate specific sponsor caches (for file uploads)
const invalidateSponsorImageCaches = async (req) => {
  try {
    const { sponsorId } = req.params || {};
    
    if (!sponsorId) return;

    const patterns = [
      `sponsors:details:${sponsorId}`,
      'sponsors:list:*',
      'sponsors:public:*',
      'sponsors:by-category'
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    console.log(`Invalidated sponsor image caches for sponsor: ${sponsorId}`);
  } catch (error) {
    console.error('Sponsor image cache invalidation error:', error);
  }
};

// Auto-invalidate image caches
const autoInvalidateSponsorImageCaches = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    originalJson.call(this, data);
    
    setImmediate(async () => {
      try {
        await invalidateSponsorImageCaches(req);
      } catch (error) {
        console.error('Image cache invalidation error:', error);
      }
    });
  };

  next();
};

// ============================================
// CACHE SETTING HELPER
// ============================================

// Set cache after successful response (to be used in controllers)
const setCacheData = async (cacheKey, data, ttl = 300) => {
  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to set cache:', error);
  }
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

module.exports = {
  // Caching middleware
  cacheSponsorsList,
  cacheSponsorDetails,
  cacheSponsorStats,
  cachePublicSponsors,
  cacheSponsorsByCategory,

  // Cache invalidation middleware
  autoInvalidateSponsorCaches,
  autoInvalidateSponsorImageCaches,

  // Manual cache operations
  invalidateSponsorCaches,
  invalidateSponsorImageCaches,
  setCacheData,

  // Cache key generators (for use in controllers)
  generateSponsorsCacheKey,
  generateSponsorDetailsCacheKey,
  generateSponsorStatsCacheKey,
  generatePublicSponsorsCacheKey,
  generateSponsorsByCategoryCacheKey
};