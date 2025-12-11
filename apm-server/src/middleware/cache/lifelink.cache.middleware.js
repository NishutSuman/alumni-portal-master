// src/middleware/lifelink.cache.middleware.js
// LifeLink Network Cache Middleware - Tenant-Aware Implementation

const { CacheService } = require('../../config/redis');
const { successResponse } = require('../../utils/response');

// ============================================
// TENANT CODE HELPER
// ============================================

/**
 * Get tenant code from request for cache key namespacing
 */
function getTenantCode(req) {
  return req.headers['x-tenant-code'] || 'default';
}

// ============================================
// TENANT-AWARE CACHE KEY GENERATORS
// ============================================

const generateDashboardCacheKey = (tenantCode, filters = {}) => {
  const {
    bloodGroup,
    eligibleOnly = 'false',
    page = 1,
    limit = 20,
    city
  } = filters;

  return `${tenantCode}:lifelink:dashboard:${bloodGroup || 'all'}:eligible:${eligibleOnly}:page:${page}:limit:${limit}:city:${city || 'all'}`;
};

const generateUserBloodProfileCacheKey = (tenantCode, userId) => {
  return `${tenantCode}:lifelink:profile:${userId}`;
};

const generateUserDonationsCacheKey = (tenantCode, userId, filters = {}) => {
  const { page = 1, limit = 10 } = filters;
  return `${tenantCode}:lifelink:donations:user:${userId}:page:${page}:limit:${limit}`;
};

const generateDonationStatusCacheKey = (tenantCode, userId) => {
  return `${tenantCode}:lifelink:status:${userId}`;
};

const generateAvailableDonorsCacheKey = (tenantCode, bloodGroup, location, limit = 50) => {
  const sanitizedLocation = location.toLowerCase().replace(/\s+/g, '-');
  return `${tenantCode}:lifelink:search:${bloodGroup}:${sanitizedLocation}:limit:${limit}`;
};

const generateDiscoverRequisitionsCacheKey = (tenantCode, userId, filters = {}) => {
  const { urgencyLevel, maxDistance, page = 1, limit = 20 } = filters;
  return `${tenantCode}:lifelink:discover:${userId}:urgency:${urgencyLevel || 'all'}:distance:${maxDistance || 'all'}:page:${page}:limit:${limit}`;
};

const generateBloodGroupStatsCacheKey = (tenantCode) => {
  return `${tenantCode}:lifelink:stats:bloodgroups`;
};

const generateRequisitionCacheKey = (tenantCode, requisitionId) => {
  return `${tenantCode}:lifelink:requisition:${requisitionId}`;
};

const generateUserRequisitionsCacheKey = (tenantCode, userId, filters = {}) => {
  const { status, page = 1, limit = 10 } = filters;
  return `${tenantCode}:lifelink:requisitions:user:${userId}:status:${status || 'all'}:page:${page}:limit:${limit}`;
};

const generateUserNotificationsCacheKey = (tenantCode, userId, filters = {}) => {
  const { status, page = 1, limit = 20 } = filters;
  return `${tenantCode}:lifelink:notifications:user:${userId}:status:${status || 'all'}:page:${page}:limit:${limit}`;
};

const generateWillingDonorsCacheKey = (tenantCode, requisitionId) => {
  return `${tenantCode}:lifelink:willing:${requisitionId}`;
};

// ============================================
// CACHING MIDDLEWARE FUNCTIONS
// ============================================

// Cache LifeLink dashboard (tenant-aware)
const cacheLifeLinkDashboard = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const cacheKey = generateDashboardCacheKey(tenantCode, req.query);
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

// Cache user blood profile (tenant-aware)
const cacheUserBloodProfile = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const userId = req.user.id;
    const cacheKey = generateUserBloodProfileCacheKey(tenantCode, userId);
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

// Cache user donations (tenant-aware)
const cacheUserDonations = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const userId = req.user.id;
    const cacheKey = generateUserDonationsCacheKey(tenantCode, userId, req.query);
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

// Cache donation status (tenant-aware)
const cacheDonationStatus = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const userId = req.user.id;
    const cacheKey = generateDonationStatusCacheKey(tenantCode, userId);
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

// Cache available donors search (tenant-aware)
const cacheAvailableDonors = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const { requiredBloodGroup, location, limit = 50 } = req.body;
    const cacheKey = generateAvailableDonorsCacheKey(tenantCode, requiredBloodGroup, location, limit);
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

// Cache requisition discovery for donors (tenant-aware)
const cacheDiscoverRequisitions = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const userId = req.user.id;
    const cacheKey = generateDiscoverRequisitionsCacheKey(tenantCode, userId, req.query);
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

// Cache blood group statistics (tenant-aware)
const cacheBloodGroupStats = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const cacheKey = generateBloodGroupStatsCacheKey(tenantCode);
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

// Cache requisition details (tenant-aware)
const cacheRequisitionDetails = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const { requisitionId } = req.params;
    const cacheKey = generateRequisitionCacheKey(tenantCode, requisitionId);
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

// Cache user requisitions (tenant-aware)
const cacheUserRequisitions = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const userId = req.user.id;
    const cacheKey = generateUserRequisitionsCacheKey(tenantCode, userId, req.query);
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

// Cache user notifications (tenant-aware)
const cacheUserNotifications = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const userId = req.user.id;
    const cacheKey = generateUserNotificationsCacheKey(tenantCode, userId, req.query);
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

// Cache willing donors for requisition (tenant-aware)
const cacheWillingDonors = async (req, res, next) => {
  try {
    const tenantCode = getTenantCode(req);
    const { requisitionId } = req.params;
    const cacheKey = generateWillingDonorsCacheKey(tenantCode, requisitionId);
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

// Auto-invalidate LifeLink caches after modifications (tenant-aware)
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

// Invalidate all LifeLink-related caches (tenant-aware)
const invalidateLifeLinkCaches = async (req) => {
  try {
    const tenantCode = getTenantCode(req);
    const { requisitionId } = req.params || {};
    const userId = req.user?.id;

    // General patterns to invalidate (tenant-specific)
    const patterns = [
      `${tenantCode}:lifelink:dashboard*`,
      `${tenantCode}:lifelink:stats*`,
      `${tenantCode}:lifelink:search*`
    ];

    // User-specific patterns
    if (userId) {
      patterns.push(`${tenantCode}:lifelink:profile:${userId}`);
      patterns.push(`${tenantCode}:lifelink:donations:user:${userId}*`);
      patterns.push(`${tenantCode}:lifelink:status:${userId}`);
      patterns.push(`${tenantCode}:lifelink:requisitions:user:${userId}*`);
      patterns.push(`${tenantCode}:lifelink:notifications:user:${userId}*`);
    }

    // Requisition-specific patterns
    if (requisitionId) {
      patterns.push(`${tenantCode}:lifelink:requisition:${requisitionId}`);
      patterns.push(`${tenantCode}:lifelink:willing:${requisitionId}`);
    }

    // Delete cache keys by pattern
    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated LifeLink caches for tenant ${tenantCode}:`, patterns);
  } catch (error) {
    console.error('LifeLink cache invalidation error:', error);
  }
};

// Invalidate user-specific caches only (tenant-aware)
const invalidateUserLifeLinkCaches = async (tenantCode, userId) => {
  try {
    const patterns = [
      `${tenantCode}:lifelink:profile:${userId}`,
      `${tenantCode}:lifelink:donations:user:${userId}*`,
      `${tenantCode}:lifelink:status:${userId}`,
      `${tenantCode}:lifelink:requisitions:user:${userId}*`,
      `${tenantCode}:lifelink:notifications:user:${userId}*`,
      `${tenantCode}:lifelink:dashboard*`, // Dashboard shows all donors, so invalidate when user changes
      `${tenantCode}:lifelink:stats*` // Stats may change when user updates profile
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated user LifeLink caches for user ${userId} in tenant ${tenantCode}`);
  } catch (error) {
    console.error('User LifeLink cache invalidation error:', error);
  }
};

// Invalidate requisition-related caches (tenant-aware)
const invalidateRequisitionCaches = async (tenantCode, requisitionId) => {
  try {
    const patterns = [
      `${tenantCode}:lifelink:requisition:${requisitionId}`,
      `${tenantCode}:lifelink:willing:${requisitionId}`,
      `${tenantCode}:lifelink:search*` // New requisition may affect search results
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated requisition caches for requisition ${requisitionId} in tenant ${tenantCode}`);
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

  // Cache key generators (for controller use - tenant-aware)
  generateDiscoverRequisitionsCacheKey,
  generateUserBloodProfileCacheKey,
  generateUserDonationsCacheKey,
  generateDonationStatusCacheKey,
  generateAvailableDonorsCacheKey,
  generateBloodGroupStatsCacheKey,
  generateRequisitionCacheKey,
  generateUserRequisitionsCacheKey,
  generateUserNotificationsCacheKey,
  generateWillingDonorsCacheKey,

  // Utility
  getTenantCode
};