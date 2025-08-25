// src/middleware/poll.cache.middleware.js
const { CacheService } = require('../config/redis');
const { successResponse } = require('../utils/response');

// ============================================
// CACHE KEY GENERATORS
// ============================================

const generatePollsCacheKey = (filters = {}) => {
  const { 
    isActive, 
    createdBy,
    hasExpired,
    search = '',
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = filters;
  
  return `polls:list:${isActive}:${createdBy || 'all'}:${hasExpired}:${search}:${page}:${limit}:${sortBy}:${sortOrder}`;
};

const generatePollDetailsCacheKey = (pollId, includeResults = true) => {
  return `polls:details:${pollId}:results:${includeResults}`;
};

const generatePollResultsCacheKey = (pollId) => {
  return `polls:results:${pollId}`;
};

const generatePollStatsCacheKey = () => {
  return 'polls:statistics';
};

const generateUserPollsCacheKey = (userId, filters = {}) => {
  const { 
    page = 1, 
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = filters;
  
  return `polls:user:${userId}:${page}:${limit}:${sortBy}:${sortOrder}`;
};

const generateUserVotesCacheKey = (userId, filters = {}) => {
  const { 
    page = 1, 
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = filters;
  
  return `polls:votes:user:${userId}:${page}:${limit}:${sortBy}:${sortOrder}`;
};

const generateActivePollsCacheKey = () => {
  return 'polls:active:list';
};

// ============================================
// CACHING MIDDLEWARE FUNCTIONS
// ============================================

// Cache polls list
const cachePollsList = async (req, res, next) => {
  try {
    const cacheKey = generatePollsCacheKey(req.query);
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Polls retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    // Store reference for setting cache after response
    req.cacheKey = cacheKey;
    req.cacheTTL = 300; // 5 minutes
    next();
  } catch (error) {
    console.error('Polls cache error:', error);
    next(); // Continue without cache on error
  }
};

// Cache poll details with results
const cachePollDetails = async (req, res, next) => {
  try {
    const { pollId } = req.params;
    const includeResults = req.query.includeResults !== 'false';
    const cacheKey = generatePollDetailsCacheKey(pollId, includeResults);
    
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Poll details retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 180; // 3 minutes (shorter for poll results that change frequently)
    next();
  } catch (error) {
    console.error('Poll details cache error:', error);
    next();
  }
};

// Cache poll results only
const cachePollResults = async (req, res, next) => {
  try {
    const { pollId } = req.params;
    const cacheKey = generatePollResultsCacheKey(pollId);
    
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Poll results retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 120; // 2 minutes (very short for live results)
    next();
  } catch (error) {
    console.error('Poll results cache error:', error);
    next();
  }
};

// Cache poll statistics
const cachePollStats = async (req, res, next) => {
  try {
    const cacheKey = generatePollStatsCacheKey();
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Poll statistics retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 900; // 15 minutes
    next();
  } catch (error) {
    console.error('Poll stats cache error:', error);
    next();
  }
};

// Cache user's created polls
const cacheUserPolls = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const cacheKey = generateUserPollsCacheKey(userId, req.query);
    
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'User polls retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 600; // 10 minutes
    next();
  } catch (error) {
    console.error('User polls cache error:', error);
    next();
  }
};

// Cache user's vote history
const cacheUserVotes = async (req, res, next) => {
  try {
    const userId = req.user.id; // From authenticated user
    const cacheKey = generateUserVotesCacheKey(userId, req.query);
    
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'User votes retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 600; // 10 minutes
    next();
  } catch (error) {
    console.error('User votes cache error:', error);
    next();
  }
};

// Cache active polls list
const cacheActivePolls = async (req, res, next) => {
  try {
    const cacheKey = generateActivePollsCacheKey();
    const cached = await CacheService.get(cacheKey);

    if (cached) {
      return successResponse(
        res,
        cached,
        'Active polls retrieved successfully (cached)',
        200,
        { cached: true }
      );
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = 600; // 10 minutes
    next();
  } catch (error) {
    console.error('Active polls cache error:', error);
    next();
  }
};

// ============================================
// CACHE INVALIDATION FUNCTIONS
// ============================================

// Auto-invalidate poll caches after modifications
const autoInvalidatePollCaches = async (req, res, next) => {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = function(data) {
    // Call original res.json first
    originalJson.call(this, data);
    
    // Then perform cache invalidation asynchronously
    setImmediate(async () => {
      try {
        await invalidatePollCaches(req);
      } catch (error) {
        console.error('Cache invalidation error:', error);
      }
    });
  };

  next();
};

// Invalidate all poll-related caches
const invalidatePollCaches = async (req) => {
  try {
    const { pollId } = req.params || {};
    const userId = req.user?.id;
    
    // Get all cache keys to invalidate
    const patterns = [
      'polls:list:*',
      'polls:statistics',
      'polls:active:*'
    ];

    // Add specific poll caches if pollId exists
    if (pollId) {
      patterns.push(`polls:details:${pollId}:*`);
      patterns.push(`polls:results:${pollId}`);
    }

    // Add user-specific caches if userId exists
    if (userId) {
      patterns.push(`polls:user:${userId}:*`);
      patterns.push(`polls:votes:user:${userId}:*`);
    }

    // Delete cache keys by pattern using CacheService
    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated poll caches for patterns:`, patterns);
  } catch (error) {
    console.error('Poll cache invalidation error:', error);
  }
};

// Invalidate specific poll vote caches (after voting)
const invalidatePollVoteCaches = async (req) => {
  try {
    const { pollId } = req.params || {};
    const userId = req.user?.id;
    
    if (!pollId) return;

    const patterns = [
      `polls:details:${pollId}:*`,
      `polls:results:${pollId}`,
      'polls:list:*',
      'polls:statistics',
      'polls:active:*'
    ];

    // Add user vote caches
    if (userId) {
      patterns.push(`polls:votes:user:${userId}:*`);
    }

    for (const pattern of patterns) {
      await CacheService.delPattern(pattern);
    }

    console.log(`Invalidated poll vote caches for poll: ${pollId}`);
  } catch (error) {
    console.error('Poll vote cache invalidation error:', error);
  }
};

// Auto-invalidate vote caches
const autoInvalidatePollVoteCaches = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    originalJson.call(this, data);
    
    setImmediate(async () => {
      try {
        await invalidatePollVoteCaches(req);
      } catch (error) {
        console.error('Vote cache invalidation error:', error);
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
  cachePollsList,
  cachePollDetails,
  cachePollResults,
  cachePollStats,
  cacheUserPolls,
  cacheUserVotes,
  cacheActivePolls,

  // Cache invalidation middleware
  autoInvalidatePollCaches,
  autoInvalidatePollVoteCaches,

  // Manual cache operations
  invalidatePollCaches,
  invalidatePollVoteCaches,
  setCacheData,

  // Cache key generators (for use in controllers)
  generatePollsCacheKey,
  generatePollDetailsCacheKey,
  generatePollResultsCacheKey,
  generatePollStatsCacheKey,
  generateUserPollsCacheKey,
  generateUserVotesCacheKey,
  generateActivePollsCacheKey
};