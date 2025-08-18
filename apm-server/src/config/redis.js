// src/config/redis.js
const Redis = require('ioredis');

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  db: 0,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  
  // Connection pool settings
  family: 4,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

// Create Redis client
const redis = new Redis(redisConfig);

// Connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

// Cache utility functions
class CacheService {
  
  // Set cache with expiration
  static async set(key, value, expireInSeconds = 3600) {
    try {
      const serializedValue = JSON.stringify(value);
      await redis.setex(key, expireInSeconds, serializedValue);
      console.log(`📦 Cached: ${key} (expires in ${expireInSeconds}s)`);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }
  
  // Get cache
  static async get(key) {
    try {
      const cachedValue = await redis.get(key);
      if (cachedValue) {
        console.log(`🎯 Cache hit: ${key}`);
        return JSON.parse(cachedValue);
      }
      console.log(`❌ Cache miss: ${key}`);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  // Delete cache
  static async del(key) {
    try {
      await redis.del(key);
      console.log(`🗑️ Cache deleted: ${key}`);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }
  
  // Delete multiple keys by pattern
  static async delPattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`🗑️ Deleted ${keys.length} cache keys matching: ${pattern}`);
      }
      return true;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return false;
    }
  }
  
  // Set cache with hash (for complex objects)
  static async hset(hashKey, field, value, expireInSeconds = 3600) {
    try {
      await redis.hset(hashKey, field, JSON.stringify(value));
      await redis.expire(hashKey, expireInSeconds);
      return true;
    } catch (error) {
      console.error('Cache hset error:', error);
      return false;
    }
  }
  
  // Get cache from hash
  static async hget(hashKey, field) {
    try {
      const cachedValue = await redis.hget(hashKey, field);
      if (cachedValue) {
        return JSON.parse(cachedValue);
      }
      return null;
    } catch (error) {
      console.error('Cache hget error:', error);
      return null;
    }
  }
  
  // Cache list data with pagination
  static async setList(key, data, page, limit, expireInSeconds = 1800) {
    try {
      const listKey = `${key}:page:${page}:limit:${limit}`;
      await this.set(listKey, data, expireInSeconds);
      return true;
    } catch (error) {
      console.error('Cache set list error:', error);
      return false;
    }
  }
  
  // Get cached list
  static async getList(key, page, limit) {
    try {
      const listKey = `${key}:page:${page}:limit:${limit}`;
      return await this.get(listKey);
    } catch (error) {
      console.error('Cache get list error:', error);
      return null;
    }
  }
  
  // Increment counter (for analytics)
  static async incr(key, expireInSeconds = 86400) {
    try {
      const result = await redis.incr(key);
      if (result === 1) {
        await redis.expire(key, expireInSeconds);
      }
      return result;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }
  
  // Check if cache exists
  static async exists(key) {
    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }
  
  // Get remaining TTL
  static async ttl(key) {
    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }
}

// Cache key generators (consistent naming)
class CacheKeys {
  
  // User-related cache keys
  static user(userId) {
    return `user:${userId}`;
  }
  
  static userProfile(userId) {
    return `user:profile:${userId}`;
  }
  
  static userPosts(userId, page = 1, limit = 10) {
    return `user:posts:${userId}:page:${page}:limit:${limit}`;
  }
  
  // Post-related cache keys
  static post(postId) {
    return `post:${postId}`;
  }
  
  static posts(category = 'all', page = 1, limit = 10) {
    return `posts:${category}:page:${page}:limit:${limit}`;
  }
  
  static postComments(postId, page = 1, limit = 10) {
    return `post:comments:${postId}:page:${page}:limit:${limit}`;
  }
  
  // Batch-related cache keys
  static batch(year) {
    return `batch:${year}`;
  }
  
  static batchMembers(year, page = 1, limit = 20) {
    return `batch:members:${year}:page:${page}:limit:${limit}`;
  }
  
  static batchStats(year) {
    return `batch:stats:${year}`;
  }
  
  // Alumni directory cache keys
  static alumniDirectory(searchParams) {
    const paramString = Object.keys(searchParams)
      .sort()
      .map(key => `${key}:${searchParams[key]}`)
      .join(':');
    return `alumni:directory:${paramString}`;
  }
  
  static alumniStats() {
    return 'alumni:stats';
  }
  
  // Session cache keys
  static userSession(userId) {
    return `session:${userId}`;
  }
  
  static refreshToken(userId) {
    return `refresh:${userId}`;
  }
  
  // Analytics cache keys
  static dailyStats(date) {
    return `stats:daily:${date}`;
  }
  
  static monthlyStats(yearMonth) {
    return `stats:monthly:${yearMonth}`;
  }
}

module.exports = {
  redis,
  CacheService,
  CacheKeys,
};