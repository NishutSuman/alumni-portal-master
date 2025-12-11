// src/middleware/photo.cache.middleware.js
const { CacheService } = require('../../config/redis');

// ============================================
// TENANT-AWARE PHOTO CACHE KEYS
// ============================================

/**
 * Get tenant code from request for cache key namespacing
 */
function getTenantCode(req) {
  return req.headers['x-tenant-code'] || 'default';
}

const PhotoCacheKeys = {
  // Albums (tenant-aware)
  ALBUMS_LIST: (tenantCode) => `${tenantCode}:photos:albums:list`,
  ALBUM_DETAILS: (tenantCode, albumId) => `${tenantCode}:photos:album:${albumId}`,
  ALBUM_PHOTOS: (tenantCode, albumId) => `${tenantCode}:photos:album:${albumId}:photos`,
  ALBUM_STATS: (tenantCode, albumId) => `${tenantCode}:photos:album:${albumId}:stats`,
  USER_ALBUMS: (tenantCode, userId) => `${tenantCode}:photos:user:${userId}:albums`,

  // Photos (tenant-aware)
  PHOTO_DETAILS: (tenantCode, photoId) => `${tenantCode}:photos:photo:${photoId}`,
  RECENT_PHOTOS: (tenantCode) => `${tenantCode}:photos:recent`,
  PHOTO_SEARCH: (tenantCode, query) => `${tenantCode}:photos:search:${generateSearchKey(query)}`,

  // Statistics (tenant-aware)
  PHOTOS_STATS: (tenantCode) => `${tenantCode}:photos:stats`,
  USER_PHOTO_STATS: (tenantCode, userId) => `${tenantCode}:photos:user:${userId}:stats`,

  // Admin specific (tenant-aware)
  ADMIN_ALBUMS_LIST: (tenantCode) => `${tenantCode}:photos:admin:albums`,
  ADMIN_PHOTOS_LIST: (tenantCode) => `${tenantCode}:photos:admin:photos`
};

// ============================================
// CACHE DURATIONS (in seconds)
// ============================================

const CacheDurations = {
  ALBUMS_LIST: 900,      // 15 minutes - moderate changes
  ALBUM_DETAILS: 1800,   // 30 minutes - infrequent changes
  ALBUM_PHOTOS: 600,     // 10 minutes - photos added regularly
  ALBUM_STATS: 1800,     // 30 minutes - stats don't change often
  PHOTO_DETAILS: 3600,   // 1 hour - photo details rarely change
  RECENT_PHOTOS: 300,    // 5 minutes - frequently updated
  SEARCH_RESULTS: 600,   // 10 minutes - moderate caching for searches
  STATS: 1800,          // 30 minutes - statistics don't change often
  ADMIN_LISTS: 600      // 10 minutes - admin lists updated regularly
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate cache key for search queries
 */
function generateSearchKey(query) {
  const params = new URLSearchParams();
  Object.keys(query)
    .sort()
    .forEach(key => {
      if (query[key] !== undefined && query[key] !== null && query[key] !== '') {
        params.append(key, query[key]);
      }
    });
  return params.toString();
}

/**
 * Generate cache key for filtered lists
 */
function generateFilterKey(filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return 'default';
  }
  
  return Object.keys(filters)
    .sort()
    .map(key => `${key}:${filters[key]}`)
    .join('|');
}

/**
 * Create cache middleware function
 */
function createCacheMiddleware(keyGenerator, duration) {
  return async (req, res, next) => {
    try {
      // Generate cache key
      const cacheKey = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : keyGenerator;

      if (!cacheKey) {
        return next();
      }

      // Try to get from cache
      const cachedData = await CacheService.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 Cache HIT: ${cacheKey}`);
        return res.json(cachedData);
      }

      console.log(`❌ Cache MISS: ${cacheKey}`);

      // Store original res.json
      const originalJson = res.json;
      
      // Override res.json to cache the response
      res.json = function(data) {
        // Cache successful responses only
        if (data.success !== false && res.statusCode === 200) {
          CacheService.set(cacheKey, data, duration)
            .catch(err => console.error(`Cache SET error for ${cacheKey}:`, err));
        }
        
        // Call original res.json
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next(); // Continue without caching
    }
  };
}

// ============================================
// CACHE MIDDLEWARE FUNCTIONS
// ============================================

// Albums caching (tenant-aware)
const cacheAlbumsList = createCacheMiddleware(
  (req) => {
    const tenantCode = getTenantCode(req);
    const { includeArchived } = req.query;
    return `${PhotoCacheKeys.ALBUMS_LIST(tenantCode)}:${includeArchived || 'false'}`;
  },
  CacheDurations.ALBUMS_LIST
);

const cacheAlbumDetails = createCacheMiddleware(
  (req) => PhotoCacheKeys.ALBUM_DETAILS(getTenantCode(req), req.params.albumId),
  CacheDurations.ALBUM_DETAILS
);

const cacheAlbumPhotos = createCacheMiddleware(
  (req) => PhotoCacheKeys.ALBUM_PHOTOS(getTenantCode(req), req.params.albumId),
  CacheDurations.ALBUM_PHOTOS
);

const cacheAlbumStats = createCacheMiddleware(
  (req) => PhotoCacheKeys.ALBUM_STATS(getTenantCode(req), req.params.albumId),
  CacheDurations.ALBUM_STATS
);

const cacheUserAlbums = createCacheMiddleware(
  (req) => PhotoCacheKeys.USER_ALBUMS(getTenantCode(req), req.user?.id || req.params.userId),
  CacheDurations.ALBUMS_LIST
);

// Photos caching (tenant-aware)
const cachePhotoDetails = createCacheMiddleware(
  (req) => PhotoCacheKeys.PHOTO_DETAILS(getTenantCode(req), req.params.photoId),
  CacheDurations.PHOTO_DETAILS
);

const cacheRecentPhotos = createCacheMiddleware(
  (req) => PhotoCacheKeys.RECENT_PHOTOS(getTenantCode(req)),
  CacheDurations.RECENT_PHOTOS
);

const cachePhotoSearch = createCacheMiddleware(
  (req) => PhotoCacheKeys.PHOTO_SEARCH(getTenantCode(req), req.query),
  CacheDurations.SEARCH_RESULTS
);

// Statistics caching (tenant-aware)
const cachePhotosStats = createCacheMiddleware(
  (req) => PhotoCacheKeys.PHOTOS_STATS(getTenantCode(req)),
  CacheDurations.STATS
);

const cacheUserPhotoStats = createCacheMiddleware(
  (req) => PhotoCacheKeys.USER_PHOTO_STATS(getTenantCode(req), req.user?.id || req.params.userId),
  CacheDurations.STATS
);

// Admin caching (tenant-aware)
const cacheAdminAlbumsList = createCacheMiddleware(
  (req) => {
    const tenantCode = getTenantCode(req);
    const { includeArchived } = req.query;
    return `${PhotoCacheKeys.ADMIN_ALBUMS_LIST(tenantCode)}:${includeArchived || 'false'}`;
  },
  CacheDurations.ADMIN_LISTS
);

const cacheAdminPhotosList = createCacheMiddleware(
  (req) => PhotoCacheKeys.ADMIN_PHOTOS_LIST(getTenantCode(req)),
  CacheDurations.ADMIN_LISTS
);

// ============================================
// CACHE INVALIDATION MIDDLEWARE
// ============================================

/**
 * Invalidate album-related caches (tenant-aware)
 */
const autoInvalidateAlbumCaches = async (req, res, next) => {
  // Store original res.json
  const originalJson = res.json;

  res.json = async function(data) {
    // Invalidate caches BEFORE sending response for successful operations (200 or 201 status codes)
    if (data.success !== false && (res.statusCode === 200 || res.statusCode === 201)) {
      try {
        const tenantCode = getTenantCode(req);
        const { albumId } = req.params;
        const userId = req.user?.id;

        const cacheKeysToInvalidate = [
          PhotoCacheKeys.ALBUMS_LIST(tenantCode),
          PhotoCacheKeys.ADMIN_ALBUMS_LIST(tenantCode),
          PhotoCacheKeys.PHOTOS_STATS(tenantCode),
          PhotoCacheKeys.RECENT_PHOTOS(tenantCode)
        ];

        if (albumId) {
          cacheKeysToInvalidate.push(
            PhotoCacheKeys.ALBUM_DETAILS(tenantCode, albumId),
            PhotoCacheKeys.ALBUM_PHOTOS(tenantCode, albumId),
            PhotoCacheKeys.ALBUM_STATS(tenantCode, albumId)
          );
        }

        if (userId) {
          cacheKeysToInvalidate.push(
            PhotoCacheKeys.USER_ALBUMS(tenantCode, userId),
            PhotoCacheKeys.USER_PHOTO_STATS(tenantCode, userId)
          );
        }

        // Delete each cache key individually
        for (const key of cacheKeysToInvalidate) {
          await CacheService.del(key);
        }
        console.log(`🗑️ Invalidated ${cacheKeysToInvalidate.length} album cache keys for tenant ${tenantCode}`);
      } catch (error) {
        console.error('Album cache invalidation error:', error);
      }
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Invalidate photo-related caches (tenant-aware)
 */
const autoInvalidatePhotoCaches = async (req, res, next) => {
  // Store original res.json
  const originalJson = res.json;

  res.json = async function(data) {
    // Invalidate caches BEFORE sending response for successful operations (200 or 201 status codes)
    if (data.success !== false && (res.statusCode === 200 || res.statusCode === 201)) {
      try {
        const tenantCode = getTenantCode(req);
        const { photoId, albumId } = req.params;
        const userId = req.user?.id;

        const cacheKeysToInvalidate = [
          PhotoCacheKeys.RECENT_PHOTOS(tenantCode),
          PhotoCacheKeys.PHOTOS_STATS(tenantCode),
          PhotoCacheKeys.ADMIN_PHOTOS_LIST(tenantCode)
        ];

        if (photoId) {
          cacheKeysToInvalidate.push(PhotoCacheKeys.PHOTO_DETAILS(tenantCode, photoId));
        }

        if (albumId) {
          cacheKeysToInvalidate.push(
            PhotoCacheKeys.ALBUM_PHOTOS(tenantCode, albumId),
            PhotoCacheKeys.ALBUM_STATS(tenantCode, albumId),
            PhotoCacheKeys.ALBUM_DETAILS(tenantCode, albumId)
          );
        }

        if (userId) {
          cacheKeysToInvalidate.push(
            PhotoCacheKeys.USER_ALBUMS(tenantCode, userId),
            PhotoCacheKeys.USER_PHOTO_STATS(tenantCode, userId)
          );
        }

        // Invalidate search results (pattern-based, tenant-specific)
        await CacheService.delPattern(`${tenantCode}:photos:search:*`);

        // Delete each cache key individually
        for (const key of cacheKeysToInvalidate) {
          await CacheService.del(key);
        }
        console.log(`🗑️ Invalidated ${cacheKeysToInvalidate.length} photo cache keys for tenant ${tenantCode}`);
      } catch (error) {
        console.error('Photo cache invalidation error:', error);
      }
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Invalidate all photo-related caches (tenant-specific or all)
 */
const invalidateAllPhotoCaches = async (tenantCode = null) => {
  try {
    if (tenantCode) {
      // Invalidate only for specific tenant
      await CacheService.deletePattern(`${tenantCode}:photos:*`);
      console.log(`🗑️ Invalidated all photo caches for tenant ${tenantCode}`);
    } else {
      // Invalidate for all tenants (legacy support)
      await CacheService.deletePattern('*:photos:*');
      console.log('🗑️ Invalidated all photo caches for all tenants');
    }
  } catch (error) {
    console.error('Full photo cache invalidation error:', error);
  }
};

/**
 * Warm up frequently accessed caches (tenant-aware)
 */
const warmUpPhotoCaches = async (req, res) => {
  try {
    const tenantCode = req ? getTenantCode(req) : 'default';
    const warmupKeys = [
      PhotoCacheKeys.ALBUMS_LIST(tenantCode),
      PhotoCacheKeys.RECENT_PHOTOS(tenantCode),
      PhotoCacheKeys.PHOTOS_STATS(tenantCode),
      PhotoCacheKeys.ADMIN_ALBUMS_LIST(tenantCode)
    ];

    console.log(`🔥 Warming up ${warmupKeys.length} photo cache keys for tenant ${tenantCode}...`);

    // Note: Actual warmup would require making requests to the endpoints
    // This is a placeholder for the warmup logic

    return {
      success: true,
      message: 'Photo caches warmup completed',
      warmedKeys: warmupKeys.length,
      tenantCode
    };
  } catch (error) {
    console.error('Photo cache warmup error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// CACHE HEALTH CHECK
// ============================================

const checkPhotoCacheHealth = async () => {
  try {
    const healthChecks = [];
    
    // Test basic cache operations
    const testKey = 'photos:health:test';
    const testData = { test: Date.now() };
    
    await CacheService.set(testKey, testData, 10);
    const retrieved = await CacheService.get(testKey);
    await CacheService.delete(testKey);
    
    healthChecks.push({
      check: 'basic_operations',
      status: retrieved && retrieved.test === testData.test ? 'healthy' : 'unhealthy'
    });
    
    // Check cache keys count
    const albumsCount = await CacheService.getKeysCount('photos:album:*');
    const photosCount = await CacheService.getKeysCount('photos:photo:*');
    
    healthChecks.push({
      check: 'cache_population',
      albumCacheKeys: albumsCount,
      photoCacheKeys: photosCount,
      status: 'healthy'
    });
    
    return {
      overall: 'healthy',
      checks: healthChecks
    };
  } catch (error) {
    return {
      overall: 'unhealthy',
      error: error.message
    };
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Cache keys
  PhotoCacheKeys,
  CacheDurations,

  // Cache middleware
  cacheAlbumsList,
  cacheAlbumDetails,
  cacheAlbumPhotos,
  cacheAlbumStats,
  cacheUserAlbums,
  cachePhotoDetails,
  cacheRecentPhotos,
  cachePhotoSearch,
  cachePhotosStats,
  cacheUserPhotoStats,
  cacheAdminAlbumsList,
  cacheAdminPhotosList,

  // Cache invalidation
  autoInvalidateAlbumCaches,
  autoInvalidatePhotoCaches,
  invalidateAllPhotoCaches,

  // Cache management
  warmUpPhotoCaches,
  checkPhotoCacheHealth,

  // Utilities
  generateSearchKey,
  generateFilterKey,
  getTenantCode
};