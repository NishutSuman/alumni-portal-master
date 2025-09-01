// src/middleware/lifelink.cache.middleware.js
// LifeLink Network Cache Middleware - Following established patterns

const { CacheService } = require('../../config/redis');
const { successResponse } = require('../../utils/response');

// ============================================
// CACHE KEY GENERATORS
// ============================================

const generateDashboardCacheKey = (filters = {}) => {
  const { 
    bloodGroup, 
    eligibleOnly = 'false',
    page = 1, 
    limit = 20
  } = filters;
  
  return `lifelink:dashboard:${bloodGroup || 'all'}:eligible:${eligibleOnly}:page:${page}:limit:${limit}`;
};

const generateUserBloodProfileCacheKey = (userId) => {
  return `lifelink:profile:${userId}`;
};

const generateUserDonationsCacheKey = (userId, filters = {}) => {
  const { page = 1, limit = 10 } = filters;
  return `lifelink:donations:user:${userId}:page:${page}:limit:${limit}`;
};

const generateDonationStatusCacheKey = (userId) => {
  return `lifelink:status:${userId}`;
};

const generateAvailableDonorsCacheKey = (bloodGroup, location, limit = 50) => {
  const sanitizedLocation = location.toLowerCase().replace(/\s+/g, '-');
  return `lifelink:search:${bloodGroup}:${sanitizedLocation}:limit:${limit}`;
};

const generateDiscoverRequisitionsCacheKey = (userId, filters = {}) => {
  const { urgencyLevel, maxDistance, page = 1, limit = 20 } = filters;
  return `lifelink:discover:${userId}:urgency:${urgencyLevel || 'all'}:distance:${maxDistance || 'all'}:page:${page}:limit:${limit}`;
};

const generateBloodGroupStatsCacheKey = () => {
  return 'lifelink:stats:bloodgroups';
};

const generateRequisitionCacheKey = (requisitionId) => {
  return `lifelink:requisition:${requisitionId}`;
};

const generateUserRequisitionsCacheKey = (userId, filters = {}) => {
  const { status, page = 1, limit = 10 } = filters;
  return `lifelink:requisitions:user:${userId}:status:${status || 'all'}:page:${page}:limit:${limit}`;
};

const generateUserNotificationsCacheKey = (userId, filters = {}) => {
  const { status, page = 1, limit = 20 } = filters;
  return `lifelink:notifications:user:${userId}:status:${status || 'all'}:page:${page}:limit:${limit}`;
};

const generateWillingDonorsCacheKey = (requisitionId) => {
  return `lifelink:willing:${requisitionId}`;
};

// ============================================
// CACHING MIDDLEWARE FUNCTIONS
// ============================================

// Cache LifeLink dashboard
const cacheLifeLinkDashboard = async (req, res, next) => {
  try {
    const cacheKey = generateDashboardCacheKey(req.query);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'LifeLink dashboard retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 600; // 10 minutes - donors list changes less frequently
    next();
  } catch (error) {
    console.error('LifeLink dashboard cache error:', error);
    next(); // Continue without cache on error
  }
};

// Cache user blood profile
const cacheUserBloodProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = generateUserBloodProfileCacheKey(userId);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Blood profile retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 1800; // 30 minutes - profile data is relatively stable
    next();
  } catch (error) {
    console.error('Blood profile cache error:', error);
    next();
  }
};

// Cache user donations
const cacheUserDonations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = generateUserDonationsCacheKey(userId, req.query);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Donation history retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 900; // 15 minutes - donation history doesn't change often
    next();
  } catch (error) {
    console.error('User donations cache error:', error);
    next();
  }
};

// Cache donation status
const cacheDonationStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = generateDonationStatusCacheKey(userId);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Donation status retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 300; // 5 minutes - eligibility can change daily
    next();
  } catch (error) {
    console.error('Donation status cache error:', error);
    next();
  }
};

// Cache available donors search
const cacheAvailableDonors = async (req, res, next) => {
  try {
    const { requiredBloodGroup, location, limit = 50 } = req.body;
    const cacheKey = generateAvailableDonorsCacheKey(requiredBloodGroup, location, limit);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Available donors retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 180; // 3 minutes - donor availability changes frequently
    next();
  } catch (error) {
    console.error('Available donors cache error:', error);
    next();
  }
};

// Cache requisition discovery for donors
const cacheDiscoverRequisitions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = generateDiscoverRequisitionsCacheKey(userId, req.query);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Emergency requests discovered successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 180; // 3 minutes - requisitions change frequently
    next();
  } catch (error) {
    console.error('Discover requisitions cache error:', error);
    next();
  }
};

// Cache blood group statistics
const cacheBloodGroupStats = async (req, res, next) => {
  try {
    const cacheKey = generateBloodGroupStatsCacheKey();
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Blood group statistics retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 3600; // 1 hour - statistics change slowly
    next();
  } catch (error) {
    console.error('Blood group stats cache error:', error);
    next();
  }
};

// Cache requisition details
const cacheRequisitionDetails = async (req, res, next) => {
  try {
    const { requisitionId } = req.params;
    const cacheKey = generateRequisitionCacheKey(requisitionId);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Requisition details retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 300; // 5 minutes - requisition data can change with responses
    next();
  } catch (error) {
    console.error('Requisition cache error:', error);
    next();
  }
};

// Cache user requisitions
const cacheUserRequisitions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = generateUserRequisitionsCacheKey(userId, req.query);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'User requisitions retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 600; // 10 minutes
    next();
  } catch (error) {
    console.error('User requisitions cache error:', error);
    next();
  }
};

// Cache user notifications
const cacheUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = generateUserNotificationsCacheKey(userId, req.query);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'User notifications retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 120; // 2 minutes - notifications change frequently
    next();
  } catch (error) {
    console.error('User notifications cache error:', error);
    next();
  }
};

// Cache willing donors for requisition
const cacheWillingDonors = async (req, res, next) => {
  try {
    const { requisitionId } = req.params;
    const cacheKey = generateWillingDonorsCacheKey(requisitionId);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Willing donors retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 180; // 3 minutes - responses change frequently
    next();
  } catch (error) {
    console.error('Willing donors cache error:', error);
    next();
  }
};

// ============================================
// CACHE INVALIDATION FUNCTIONS
// ============================================

// Auto-invalidate LifeLink caches after modifications
const autoInvalidateLifeLinkCaches = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    originalJson.call(this, data);
    
    // Perform cache invalidation asynchronously
    setImmediate(async () => {
      try {
        await invalidateLifeLinkCaches(req);
      } catch (error) {
        console.error('LifeLink cache invalidation error:', error);
      }
    });
  };

  next();
};

// Invalidate all LifeLink-related caches
const invalidateLifeLinkCaches = async (req) => {
  try {
    const { requisitionId } = req.params || {};
    const userId = req.user?.id;
    
    // General patterns to invalidate
    const patterns = [
      'lifelink:dashboard*',
      'lifelink:stats*',
      'lifelink:search*'
    ];

    // User-specific patterns
    if (userId) {
      patterns.push(`lifelink:profile:${userId}`);
      patterns.push(`lifelink:donations:user:${userId}*`);
      patterns.push(`lifelink:status:${userId}`);
      patterns.push(`lifelink:requisitions:user:${userId}*`);
      patterns.push(`lifelink:notifications:user:${userId}*`);
    }

    // Requisition-specific patterns
    if (requisitionId) {
      patterns.push(`lifelink:requisition:${requisitionId}`);
      patterns.push(`lifelink:willing:${requisitionId}`);
    }

    // Delete cache keys by pattern
    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated LifeLink caches for patterns:`, patterns);
  } catch (error) {
    console.error('LifeLink cache invalidation error:', error);
  }
};

// Invalidate user-specific caches only
const invalidateUserLifeLinkCaches = async (userId) => {
  try {
    const patterns = [
      `lifelink:profile:${userId}`,
      `lifelink:donations:user:${userId}*`,
      `lifelink:status:${userId}`,
      `lifelink:requisitions:user:${userId}*`,
      `lifelink:notifications:user:${userId}*`,
      'lifelink:dashboard*', // Dashboard shows all donors, so invalidate when user changes
      'lifelink:stats*' // Stats may change when user updates profile
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated user LifeLink caches for user: ${userId}`);
  } catch (error) {
    console.error('User LifeLink cache invalidation error:', error);
  }
};

// Invalidate requisition-related caches
const invalidateRequisitionCaches = async (requisitionId) => {
  try {
    const patterns = [
      `lifelink:requisition:${requisitionId}`,
      `lifelink:willing:${requisitionId}`,
      'lifelink:search*' // New requisition may affect search results
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated requisition caches for requisition: ${requisitionId}`);
  } catch (error) {
    console.error('Requisition cache invalidation error:', error);
  }
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

module.exports = {
  // Caching middleware
  cacheLifeLinkDashboard,
  cacheUserBloodProfile,
  cacheUserDonations,
  cacheDonationStatus,
  cacheAvailableDonors,
  cacheBloodGroupStats,
  cacheRequisitionDetails,
  cacheUserRequisitions,
  cacheUserNotifications,
  cacheWillingDonors,
  cacheDiscoverRequisitions,

  // Auto-invalidation middleware
  autoInvalidateLifeLinkCaches,

  // Manual cache operations
  invalidateLifeLinkCaches,
  invalidateUserLifeLinkCaches,
  invalidateRequisitionCaches,

  // Cache key generators (for controller use)
  generateDiscoverRequisitionsCacheKey,
  generateUserBloodProfileCacheKey,
  generateUserDonationsCacheKey,
  generateDonationStatusCacheKey,
  generateAvailableDonorsCacheKey,
  generateBloodGroupStatsCacheKey,
  generateRequisitionCacheKey,
  generateUserRequisitionsCacheKey,
  generateUserNotificationsCacheKey,
  generateWillingDonorsCacheKey
};