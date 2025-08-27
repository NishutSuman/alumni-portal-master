// src/middleware/merchandise.cache.middleware.js
// Standalone Merchandise Caching - Independent of Events

const { CacheService } = require('../config/redis');

/**
 * Cache key generators for merchandise operations
 */
class MerchandiseCacheKeys {
  static catalog(page = 1, search = '', category = '', includeInactive = false) {
    return `merchandise:catalog:page:${page}:search:${encodeURIComponent(search)}:category:${category}:inactive:${includeInactive ? 'true' : 'false'}`;
  }

  static merchandiseItem(merchandiseId) {
    return `merchandise:item:${merchandiseId}`;
  }

  static userCart(userId) {
    return `user:${userId}:cart`;
  }

  static userOrders(userId, page = 1) {
    return `user:${userId}:orders:page:${page}`;
  }

  static orderDetails(orderNumber) {
    return `order:${orderNumber}:details`;
  }

  static merchandiseStats(category = '') {
    return `merchandise:stats${category ? `:category:${category}` : ''}`;
  }

  static adminOrders(page = 1, search = '', status = '', deliveryStatus = '') {
    return `admin:merchandise:orders:page:${page}:search:${encodeURIComponent(search)}:status:${status}:delivery:${deliveryStatus}`;
  }

  static categoryStats() {
    return 'merchandise:category:stats';
  }

  static stockAlerts() {
    return 'merchandise:stock:alerts';
  }
}

/**
 * Generic merchandise cache middleware
 */
const cacheMerchandise = (keyGenerator, expireInSeconds = 1800) => {
  return async (req, res, next) => {
    try {
      // Generate cache key based on request
      const cacheKey = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : keyGenerator;

      // Try to get from cache
      const cachedData = await CacheService.get(cacheKey);

      if (cachedData) {
        console.log(`🎯 Cache HIT: ${cacheKey}`);
        return res.json(cachedData);
      }

      console.log(`💾 Cache MISS: ${cacheKey}`);

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache successful responses
      res.json = function(data) {
        if (res.statusCode < 300 && data.success) {
          // Cache successful responses asynchronously
          CacheService.set(cacheKey, data, expireInSeconds)
            .catch(err => console.error('Cache set error:', err));
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };

      next();

    } catch (error) {
      console.error('Cache middleware error:', error);
      next(); // Continue without cache if there's an error
    }
  };
};

/**
 * Cache middleware functions for specific merchandise operations
 */

// Cache merchandise catalog (30 minutes)
const cacheMerchandiseCatalog = cacheMerchandise(
  (req) => MerchandiseCacheKeys.catalog(
    req.query.page,
    req.query.search,
    req.query.category,
    req.query.includeInactive
  ),
  30 * 60
);

// Cache single merchandise item (1 hour - longer since product details change less frequently)
const cacheMerchandiseItem = cacheMerchandise(
  (req) => MerchandiseCacheKeys.merchandiseItem(req.params.merchandiseId),
  60 * 60
);

// Cache user cart (2 minutes - shorter due to frequent updates)
const cacheUserCart = cacheMerchandise(
  (req) => MerchandiseCacheKeys.userCart(req.user.id),
  2 * 60
);

// Cache user orders (15 minutes)
const cacheUserOrders = cacheMerchandise(
  (req) => MerchandiseCacheKeys.userOrders(req.user.id, req.query.page),
  15 * 60
);

// Cache order details (30 minutes)
const cacheOrderDetails = cacheMerchandise(
  (req) => MerchandiseCacheKeys.orderDetails(req.params.orderNumber),
  30 * 60
);

// Cache merchandise statistics (10 minutes)
const cacheMerchandiseStats = cacheMerchandise(
  (req) => MerchandiseCacheKeys.merchandiseStats(req.query.category),
  10 * 60
);

// Cache admin orders list (5 minutes)
const cacheAdminOrders = cacheMerchandise(
  (req) => MerchandiseCacheKeys.adminOrders(
    req.query.page,
    req.query.search,
    req.query.status,
    req.query.deliveryStatus
  ),
  5 * 60
);

// Cache category statistics (1 hour)
const cacheCategoryStats = cacheMerchandise(
  MerchandiseCacheKeys.categoryStats(),
  60 * 60
);

// Cache stock alerts (5 minutes)
const cacheStockAlerts = cacheMerchandise(
  MerchandiseCacheKeys.stockAlerts(),
  5 * 60
);

/**
 * Cache invalidation utility class
 */
class MerchandiseCacheInvalidator {
  /**
   * Invalidate merchandise catalog caches
   */
  static async invalidateCatalogCaches() {
    try {
      await Promise.all([
        CacheService.delPattern('merchandise:catalog:*'),
        CacheService.del(MerchandiseCacheKeys.categoryStats()),
        CacheService.delPattern('merchandise:stats*')
      ]);
      console.log('🗑️ Invalidated merchandise catalog caches');
    } catch (error) {
      console.error('Failed to invalidate catalog caches:', error);
    }
  }

  /**
   * Invalidate specific merchandise item caches
   */
  static async invalidateMerchandiseItem(merchandiseId) {
    try {
      await Promise.all([
        CacheService.del(MerchandiseCacheKeys.merchandiseItem(merchandiseId)),
        this.invalidateCatalogCaches(), // Catalog might show this item
        CacheService.delPattern('user:*:cart') // User carts might contain this item
      ]);
      console.log(`🗑️ Invalidated caches for merchandise ${merchandiseId}`);
    } catch (error) {
      console.error('Failed to invalidate merchandise item caches:', error);
    }
  }

  /**
   * Invalidate user cart caches
   */
  static async invalidateUserCartCaches(userId) {
    try {
      await Promise.all([
        CacheService.del(MerchandiseCacheKeys.userCart(userId)),
        CacheService.delPattern(`user:${userId}:orders:*`)
      ]);
      console.log(`🗑️ Invalidated cart caches for user ${userId}`);
    } catch (error) {
      console.error('Failed to invalidate user cart caches:', error);
    }
  }

  /**
   * Invalidate order caches
   */
  static async invalidateOrderCaches(orderNumber = null) {
    try {
      const patterns = [
        'admin:merchandise:orders:*',
        'merchandise:stats*'
      ];

      if (orderNumber) {
        patterns.push(`order:${orderNumber}:*`);
      } else {
        patterns.push('order:*');
      }

      await Promise.all(
        patterns.map(pattern => CacheService.delPattern(pattern))
      );
      
      console.log(`🗑️ Invalidated order caches${orderNumber ? ` for ${orderNumber}` : ''}`);
    } catch (error) {
      console.error('Failed to invalidate order caches:', error);
    }
  }

  /**
   * Invalidate stock-related caches
   */
  static async invalidateStockCaches(merchandiseId = null) {
    try {
      const patterns = [
        'merchandise:stock:alerts',
        'merchandise:stats*',
        'merchandise:catalog:*'
      ];

      if (merchandiseId) {
        patterns.push(`merchandise:item:${merchandiseId}`);
      }

      await Promise.all(
        patterns.map(pattern => CacheService.delPattern(pattern))
      );

      console.log(`🗑️ Invalidated stock caches${merchandiseId ? ` for ${merchandiseId}` : ''}`);
    } catch (error) {
      console.error('Failed to invalidate stock caches:', error);
    }
  }

  /**
   * Invalidate all merchandise caches (use sparingly)
   */
  static async invalidateAllMerchandiseCaches() {
    try {
      await Promise.all([
        CacheService.delPattern('merchandise:*'),
        CacheService.delPattern('user:*:cart'),
        CacheService.delPattern('user:*:orders:*'),
        CacheService.delPattern('order:*'),
        CacheService.delPattern('admin:merchandise:*')
      ]);
      console.log('☢️ Invalidated ALL merchandise caches');
    } catch (error) {
      console.error('Failed to invalidate all merchandise caches:', error);
    }
  }
}

/**
 * Auto-invalidation middleware for merchandise operations
 */
const autoInvalidateMerchandiseCaches = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    // If operation was successful, invalidate relevant caches
    if (res.statusCode < 300 && data.success) {
      const merchandiseId = req.params.merchandiseId;
      const method = req.method.toUpperCase();
      const path = req.route.path;

      // Async invalidation - don't wait for it
      if (path.includes('/merchandise') && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        if (merchandiseId) {
          MerchandiseCacheInvalidator.invalidateMerchandiseItem(merchandiseId);
        } else {
          MerchandiseCacheInvalidator.invalidateCatalogCaches();
        }
      }
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Auto-invalidation middleware for cart operations
 */
const autoInvalidateCartCaches = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    // If operation was successful, invalidate cart caches
    if (res.statusCode < 300 && data.success) {
      const userId = req.user?.id;
      
      if (userId) {
        // Async invalidation - don't wait for it
        MerchandiseCacheInvalidator.invalidateUserCartCaches(userId);
      }
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Auto-invalidation middleware for order operations
 */
const autoInvalidateOrderCaches = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    // If operation was successful, invalidate order caches
    if (res.statusCode < 300 && data.success) {
      const orderNumber = req.params.orderNumber || data.data?.order?.orderNumber;
      
      // Async invalidation - don't wait for it
      MerchandiseCacheInvalidator.invalidateOrderCaches(orderNumber);
      
      // Also invalidate user cart if this was an order creation
      if (req.method === 'POST' && req.user?.id) {
        MerchandiseCacheInvalidator.invalidateUserCartCaches(req.user.id);
      }
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Auto-invalidation middleware for stock operations
 */
const autoInvalidateStockCaches = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    // If operation was successful, invalidate stock caches
    if (res.statusCode < 300 && data.success) {
      const merchandiseId = req.params.merchandiseId;
      
      // Async invalidation - don't wait for it
      MerchandiseCacheInvalidator.invalidateStockCaches(merchandiseId);
    }

    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  // Cache middleware functions
  cacheMerchandiseCatalog,
  cacheMerchandiseItem,
  cacheUserCart,
  cacheUserOrders,
  cacheOrderDetails,
  cacheMerchandiseStats,
  cacheAdminOrders,
  cacheCategoryStats,
  cacheStockAlerts,
  
  // Auto-invalidation middleware
  autoInvalidateMerchandiseCaches,
  autoInvalidateCartCaches,
  autoInvalidateOrderCaches,
  autoInvalidateStockCaches,
  
  // Cache utilities
  MerchandiseCacheKeys,
  MerchandiseCacheInvalidator
};