// src/utils/cache-analytics.js
const { redis } = require('../config/redis');

class CacheAnalytics {
  
  // Track cache performance metrics
  static async trackCacheHit(key) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await redis.incr(`cache:hits:${date}`);
    await redis.incr(`cache:hits:key:${key.split(':')[0]}:${date}`);
    await redis.expire(`cache:hits:${date}`, 30 * 24 * 60 * 60); // 30 days
  }
  
  static async trackCacheMiss(key) {
    const date = new Date().toISOString().split('T')[0];
    await redis.incr(`cache:misses:${date}`);
    await redis.incr(`cache:misses:key:${key.split(':')[0]}:${date}`);
    await redis.expire(`cache:misses:${date}`, 30 * 24 * 60 * 60);
  }
  
  // Get cache performance stats
  static async getCacheStats(days = 7) {
    const stats = {};
    const dates = [];
    
    // Generate date range
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    // Get hits and misses for each date
    for (const date of dates) {
      const hits = await redis.get(`cache:hits:${date}`) || 0;
      const misses = await redis.get(`cache:misses:${date}`) || 0;
      const total = parseInt(hits) + parseInt(misses);
      const hitRatio = total > 0 ? (parseInt(hits) / total * 100).toFixed(2) : 0;
      
      stats[date] = {
        hits: parseInt(hits),
        misses: parseInt(misses),
        total,
        hitRatio: parseFloat(hitRatio)
      };
    }
    
    return stats;
  }
  
  // Get cache memory usage
  static async getMemoryStats() {
    const info = await redis.memory('usage');
    const memInfo = await redis.info('memory');
    
    const memoryData = {};
    memInfo.split('\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        memoryData[key] = value.trim();
      }
    });
    
    return {
      usedMemory: memoryData.used_memory_human,
      usedMemoryPeak: memoryData.used_memory_peak_human,
      totalSystemMemory: memoryData.total_system_memory_human,
      memoryFragmentationRatio: parseFloat(memoryData.mem_fragmentation_ratio),
      keyspaceHits: parseInt(memoryData.keyspace_hits || 0),
      keyspaceMisses: parseInt(memoryData.keyspace_misses || 0),
      connectedClients: parseInt(memoryData.connected_clients || 0),
    };
  }
  
  // Get top cached keys by access frequency
  static async getTopKeys(limit = 10) {
    const today = new Date().toISOString().split('T')[0];
    const pattern = `cache:hits:key:*:${today}`;
    const keys = await redis.keys(pattern);
    
    const keyStats = [];
    for (const key of keys) {
      const hits = await redis.get(key);
      const keyName = key.replace(`cache:hits:key:`, '').replace(`:${today}`, '');
      keyStats.push({
        key: keyName,
        hits: parseInt(hits || 0)
      });
    }
    
    return keyStats
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }
  
  // Performance monitoring dashboard endpoint
  static async getDashboardStats() {
    const [cacheStats, memoryStats, topKeys] = await Promise.all([
      this.getCacheStats(7),
      this.getMemoryStats(),
      this.getTopKeys(10)
    ]);
    
    // Calculate overall metrics
    const totalHits = Object.values(cacheStats).reduce((sum, day) => sum + day.hits, 0);
    const totalMisses = Object.values(cacheStats).reduce((sum, day) => sum + day.misses, 0);
    const totalRequests = totalHits + totalMisses;
    const overallHitRatio = totalRequests > 0 ? (totalHits / totalRequests * 100).toFixed(2) : 0;
    
    return {
      overview: {
        totalHits,
        totalMisses,
        totalRequests,
        hitRatio: parseFloat(overallHitRatio),
        memoryUsage: memoryStats.usedMemory,
        connectedClients: memoryStats.connectedClients,
      },
      daily: cacheStats,
      memory: memoryStats,
      topKeys,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Enhanced Cache Service with analytics
class AnalyticsEnabledCache {
  
  static async get(key) {
    try {
      const cachedValue = await redis.get(key);
      if (cachedValue) {
        await CacheAnalytics.trackCacheHit(key);
        console.log(`🎯 Cache hit: ${key}`);
        return JSON.parse(cachedValue);
      }
      await CacheAnalytics.trackCacheMiss(key);
      console.log(`❌ Cache miss: ${key}`);
      return null;
    } catch (error) {
      await CacheAnalytics.trackCacheMiss(key);
      console.error('Cache get error:', error);
      return null;
    }
  }
  
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
}

// Cache monitoring middleware
const cacheMonitoring = (req, res, next) => {
  // Track request timing
  req.startTime = Date.now();
  
  // Override res.json to track response times
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - req.startTime;
    
    // Log performance metrics
    console.log(`📊 ${req.method} ${req.path} - ${responseTime}ms - Cache: ${req.cacheHit ? 'HIT' : 'MISS'}`);
    
    return originalJson.call(this, data);
  };
  
  next();
};

module.exports = {
  CacheAnalytics,
  AnalyticsEnabledCache,
  cacheMonitoring,
};