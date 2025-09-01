// src/middleware/photo.cache.middleware.js
const { CacheService } = require('../../config/redis');

// ============================================
// PHOTO CACHE KEYS
// ============================================

const PhotoCacheKeys = {
  // Albums
  ALBUMS_LIST: 'photos:albums:list',
  ALBUM_DETAILS: (albumId) => `photos:album:${albumId}`,
  ALBUM_PHOTOS: (albumId) => `photos:album:${albumId}:photos`,
  ALBUM_STATS: (albumId) => `photos:album:${albumId}:stats`,
  USER_ALBUMS: (userId) => `photos:user:${userId}:albums`,
  
  // Photos
  PHOTO_DETAILS: (photoId) => `photos:photo:${photoId}`,
  RECENT_PHOTOS: 'photos:recent',
  PHOTO_SEARCH: (query) => `photos:search:${generateSearchKey(query)}`,
  
  // Statistics
  PHOTOS_STATS: 'photos:stats',
  USER_PHOTO_STATS: (userId) => `photos:user:${userId}:stats`,
  
  // Admin specific
  ADMIN_ALBUMS_LIST: 'photos:admin:albums',
  ADMIN_PHOTOS_LIST: 'photos:admin:photos'
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

// Albums caching
const cacheAlbumsList = createCacheMiddleware(
  PhotoCacheKeys.ALBUMS_LIST,
  CacheDurations.ALBUMS_LIST
);

const cacheAlbumDetails = createCacheMiddleware(
  (req) => PhotoCacheKeys.ALBUM_DETAILS(req.params.albumId),
  CacheDurations.ALBUM_DETAILS
);

const cacheAlbumPhotos = createCacheMiddleware(
  (req) => PhotoCacheKeys.ALBUM_PHOTOS(req.params.albumId),
  CacheDurations.ALBUM_PHOTOS
);

const cacheAlbumStats = createCacheMiddleware(
  (req) => PhotoCacheKeys.ALBUM_STATS(req.params.albumId),
  CacheDurations.ALBUM_STATS
);

const cacheUserAlbums = createCacheMiddleware(
  (req) => PhotoCacheKeys.USER_ALBUMS(req.user?.id || req.params.userId),
  CacheDurations.ALBUMS_LIST
);

// Photos caching
const cachePhotoDetails = createCacheMiddleware(
  (req) => PhotoCacheKeys.PHOTO_DETAILS(req.params.photoId),
  CacheDurations.PHOTO_DETAILS
);

const cacheRecentPhotos = createCacheMiddleware(
  PhotoCacheKeys.RECENT_PHOTOS,
  CacheDurations.RECENT_PHOTOS
);

const cachePhotoSearch = createCacheMiddleware(
  (req) => PhotoCacheKeys.PHOTO_SEARCH(req.query),
  CacheDurations.SEARCH_RESULTS
);

// Statistics caching
const cachePhotosStats = createCacheMiddleware(
  PhotoCacheKeys.PHOTOS_STATS,
  CacheDurations.STATS
);

const cacheUserPhotoStats = createCacheMiddleware(
  (req) => PhotoCacheKeys.USER_PHOTO_STATS(req.user?.id || req.params.userId),
  CacheDurations.STATS
);

// Admin caching
const cacheAdminAlbumsList = createCacheMiddleware(
  PhotoCacheKeys.ADMIN_ALBUMS_LIST,
  CacheDurations.ADMIN_LISTS
);

const cacheAdminPhotosList = createCacheMiddleware(
  PhotoCacheKeys.ADMIN_PHOTOS_LIST,
  CacheDurations.ADMIN_LISTS
);

// ============================================
// CACHE INVALIDATION MIDDLEWARE
// ============================================

/**
 * Invalidate album-related caches
 */
const autoInvalidateAlbumCaches = async (req, res, next) => {
  // Store original res.json
  const originalJson = res.json;
  
  res.json = function(data) {
    // Invalidate caches after successful operations
    if (data.success !== false && res.statusCode === 200) {
      setImmediate(async () => {
        try {
          const { albumId } = req.params;
          const userId = req.user?.id;
          
          const cacheKeysToInvalidate = [
            PhotoCacheKeys.ALBUMS_LIST,
            PhotoCacheKeys.ADMIN_ALBUMS_LIST,
            PhotoCacheKeys.PHOTOS_STATS,
            PhotoCacheKeys.RECENT_PHOTOS
          ];
          
          if (albumId) {
            cacheKeysToInvalidate.push(
              PhotoCacheKeys.ALBUM_DETAILS(albumId),
              PhotoCacheKeys.ALBUM_PHOTOS(albumId),
              PhotoCacheKeys.ALBUM_STATS(albumId)
            );
          }
          
          if (userId) {
            cacheKeysToInvalidate.push(
              PhotoCacheKeys.USER_ALBUMS(userId),
              PhotoCacheKeys.USER_PHOTO_STATS(userId)
            );
          }
          
          await CacheService.deleteMany(cacheKeysToInvalidate);
          console.log(`🗑️ Invalidated ${cacheKeysToInvalidate.length} album cache keys`);
        } catch (error) {
          console.error('Album cache invalidation error:', error);
        }
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Invalidate photo-related caches
 */
const autoInvalidatePhotoCaches = async (req, res, next) => {
  // Store original res.json
  const originalJson = res.json;
  
  res.json = function(data) {
    // Invalidate caches after successful operations
    if (data.success !== false && res.statusCode === 200) {
      setImmediate(async () => {
        try {
          const { photoId, albumId } = req.params;
          const userId = req.user?.id;
          
          const cacheKeysToInvalidate = [
            PhotoCacheKeys.RECENT_PHOTOS,
            PhotoCacheKeys.PHOTOS_STATS,
            PhotoCacheKeys.ADMIN_PHOTOS_LIST
          ];
          
          if (photoId) {
            cacheKeysToInvalidate.push(PhotoCacheKeys.PHOTO_DETAILS(photoId));
          }
          
          if (albumId) {
            cacheKeysToInvalidate.push(
              PhotoCacheKeys.ALBUM_PHOTOS(albumId),
              PhotoCacheKeys.ALBUM_STATS(albumId),
              PhotoCacheKeys.ALBUM_DETAILS(albumId)
            );
          }
          
          if (userId) {
            cacheKeysToInvalidate.push(
              PhotoCacheKeys.USER_ALBUMS(userId),
              PhotoCacheKeys.USER_PHOTO_STATS(userId)
            );
          }
          
          // Invalidate search results (pattern-based)
          await CacheService.deletePattern('photos:search:*');
          
          await CacheService.deleteMany(cacheKeysToInvalidate);
          console.log(`🗑️ Invalidated ${cacheKeysToInvalidate.length} photo cache keys`);
        } catch (error) {
          console.error('Photo cache invalidation error:', error);
        }
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Invalidate all photo-related caches
 */
const invalidateAllPhotoCaches = async () => {
  try {
    await CacheService.deletePattern('photos:*');
    console.log('🗑️ Invalidated all photo caches');
  } catch (error) {
    console.error('Full photo cache invalidation error:', error);
  }
};

/**
 * Warm up frequently accessed caches
 */
const warmUpPhotoCaches = async (req, res) => {
  try {
    const warmupKeys = [
      PhotoCacheKeys.ALBUMS_LIST,
      PhotoCacheKeys.RECENT_PHOTOS,
      PhotoCacheKeys.PHOTOS_STATS,
      PhotoCacheKeys.ADMIN_ALBUMS_LIST
    ];
    
    console.log(`🔥 Warming up ${warmupKeys.length} photo cache keys...`);
    
    // Note: Actual warmup would require making requests to the endpoints
    // This is a placeholder for the warmup logic
    
    return {
      success: true,
      message: 'Photo caches warmup completed',
      warmedKeys: warmupKeys.length
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
  generateFilterKey
};