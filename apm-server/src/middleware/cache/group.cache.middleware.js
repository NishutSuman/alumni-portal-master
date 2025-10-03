const { CacheService } = require('../../config/redis');
const { successResponse } = require('../../utils/response');

// ============================================
// CACHE KEY GENERATORS
// ============================================

const generateGroupsCacheKey = (filters = {}) => {
  const { 
    type, 
    isActive, 
    page = 1, 
    limit = 10, 
    search = '',
    sortBy = 'displayOrder',
    sortOrder = 'asc'
  } = filters;
  
  return `groups:list:${type || 'all'}:${isActive}:${page}:${limit}:${search}:${sortBy}:${sortOrder}`;
};

const generateGroupDetailsCacheKey = (groupId, includeMembers = true) => {
  return `groups:details:${groupId}:members:${includeMembers}`;
};

const generateGroupMembersCacheKey = (groupId, filters = {}) => {
  const { 
    isActive, 
    role,
    page = 1, 
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = filters;
  
  return `groups:${groupId}:members:${isActive}:${role || 'all'}:${page}:${limit}:${sortBy}:${sortOrder}`;
};

const generateGroupStatsCacheKey = () => {
  return 'groups:statistics';
};

const generatePublicGroupsCacheKey = () => {
  return 'groups:public:all';
};

// ============================================
// CACHING MIDDLEWARE FUNCTIONS
// ============================================

// Cache groups list
const cacheGroupsList = async (req, res, next) => {
  try {
    const cacheKey = generateGroupsCacheKey(req.query);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Groups retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    // Store reference for setting cache after response
    req.cacheKey = cacheKey;
    req.cacheTTL = 300; // 5 minutes
    next();
  } catch (error) {
    console.error('Groups cache error:', error);
    next(); // Continue without cache on error
  }
};

// Cache group details
const cacheGroupDetails = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const includeMembers = req.query.includeMembers !== 'false';
    const cacheKey = generateGroupDetailsCacheKey(groupId, includeMembers);
    
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Group details retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 180; // 3 minutes for faster updates
    next();
  } catch (error) {
    console.error('Group details cache error:', error);
    next();
  }
};

// Cache group members list
const cacheGroupMembers = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const cacheKey = generateGroupMembersCacheKey(groupId, req.query);
    
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Group members retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 300; // 5 minutes
    next();
  } catch (error) {
    console.error('Group members cache error:', error);
    next();
  }
};

// Cache group statistics
const cacheGroupStats = async (req, res, next) => {
  try {
    const cacheKey = generateGroupStatsCacheKey();
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Group statistics retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 900; // 15 minutes
    next();
  } catch (error) {
    console.error('Group stats cache error:', error);
    next();
  }
};

// Cache public groups view
const cachePublicGroups = async (req, res, next) => {
  try {
    const cacheKey = generatePublicGroupsCacheKey();
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Public groups retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 1800; // 30 minutes (longer for public data)
    next();
  } catch (error) {
    console.error('Public groups cache error:', error);
    next();
  }
};

// ============================================
// CACHE INVALIDATION FUNCTIONS
// ============================================

// Auto-invalidate group caches after modifications
const autoInvalidateGroupCaches = async (req, res, next) => {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = function(data) {
    // Call original res.json first
    originalJson.call(this, data);
    
    // Then perform cache invalidation asynchronously
    setImmediate(async () => {
      try {
        await invalidateGroupCaches(req);
      } catch (error) {
        console.error('Cache invalidation error:', error);
      }
    });
  };

  next();
};

// Invalidate all group-related caches
const invalidateGroupCaches = async (req) => {
  try {
    const { groupId } = req.params || {};
    
    // Get all cache keys to invalidate
    const patterns = [
      'groups:list:*',
      'groups:statistics',
      'groups:public:*'
    ];

    // Add specific group caches if groupId exists
    if (groupId) {
      patterns.push(`groups:details:${groupId}:*`);
      patterns.push(`groups:${groupId}:members:*`);
    }

    // Delete cache keys by pattern using CacheService
    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated group caches for patterns:`, patterns);
  } catch (error) {
    console.error('Group cache invalidation error:', error);
  }
};

// Invalidate specific group member caches
const invalidateGroupMemberCaches = async (req) => {
  try {
    const { groupId } = req.params || {};
    
    if (!groupId) return;

    const patterns = [
      `groups:details:${groupId}:*`,
      `groups:${groupId}:members:*`,
      'groups:list:*',
      'groups:statistics',
      'groups:public:*'
    ];

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated group member caches for group: ${groupId}`);
  } catch (error) {
    console.error('Group member cache invalidation error:', error);
  }
};

// Auto-invalidate member caches
const autoInvalidateGroupMemberCaches = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    originalJson.call(this, data);
    
    setImmediate(async () => {
      try {
        await invalidateGroupMemberCaches(req);
      } catch (error) {
        console.error('Member cache invalidation error:', error);
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
  await CacheService.set(cacheKey, data, ttl);
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

module.exports = {
  // Caching middleware
  cacheGroupsList,
  cacheGroupDetails,
  cacheGroupMembers,
  cacheGroupStats,
  cachePublicGroups,

  // Cache invalidation middleware
  autoInvalidateGroupCaches,
  autoInvalidateGroupMemberCaches,

  // Manual cache operations
  invalidateGroupCaches,
  invalidateGroupMemberCaches,
  setCacheData,

  // Cache key generators (for use in controllers)
  generateGroupsCacheKey,
  generateGroupDetailsCacheKey,
  generateGroupMembersCacheKey,
  generateGroupStatsCacheKey,
  generatePublicGroupsCacheKey
};