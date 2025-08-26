const CacheService = require('../config/redis');

// ==========================================
// CACHE KEY GENERATORS
// ==========================================

const MessageCacheKeys = {
  messageReactions: (messageId) => `tickets:messages:${messageId}:reactions`,
  messageEditHistory: (messageId) => `tickets:messages:${messageId}:history`,
  messageDraft: (ticketId, userId) => `tickets:${ticketId}:draft:${userId}`,
  filePreview: (attachmentId) => `tickets:files:${attachmentId}:preview`,
  fileMetadata: (attachmentId) => `tickets:files:${attachmentId}:metadata`,
  auditTrail: (ticketId) => `tickets:${ticketId}:audit`,
};

// ==========================================
// GENERIC CACHE MIDDLEWARE
// ==========================================

const cache = (keyGenerator, expireInSeconds = 300) => {
  return async (req, res, next) => {
    try {
      const cacheKey = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : keyGenerator;
      
      // Try to get cached data
      const cachedData = await CacheService.get(cacheKey);
      
      if (cachedData) {
        console.log(`🎯 Message cache hit: ${cacheKey}`);
        req.cacheHit = true;
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return res.json(cachedData);
      }
      
      console.log(`❌ Message cache miss: ${cacheKey}`);
      req.cacheHit = false;
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache successful responses
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success !== false) {
          CacheService.set(cacheKey, data, expireInSeconds)
            .catch(err => console.error('Message cache set error:', err));
        }
        
        // Add cache headers
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      // Attach cache key to request for manual invalidation
      req.cacheKey = cacheKey;
      
      next();
      
    } catch (error) {
      console.error('Message cache middleware error:', error);
      req.cacheHit = false;
      next();
    }
  };
};

// ==========================================
// SPECIFIC CACHE MIDDLEWARE FUNCTIONS
// ==========================================

// Cache message reactions (10 minutes)
const cacheMessageReactions = cache(
  (req) => MessageCacheKeys.messageReactions(req.params.messageId),
  10 * 60 // 10 minutes
);

// Cache message edit history (30 minutes)
const cacheMessageEditHistory = cache(
  (req) => MessageCacheKeys.messageEditHistory(req.params.messageId),
  30 * 60 // 30 minutes
);

// Cache file preview data (1 hour - rarely changes)
const cacheFilePreview = cache(
  (req) => MessageCacheKeys.filePreview(req.params.attachmentId),
  60 * 60 // 1 hour
);

// Cache file metadata (2 hours)
const cacheFileMetadata = cache(
  (req) => MessageCacheKeys.fileMetadata(req.params.attachmentId),
  2 * 60 * 60 // 2 hours
);

// Cache audit trail (5 minutes - frequently updated)
const cacheAuditTrail = cache(
  (req) => MessageCacheKeys.auditTrail(req.params.ticketId),
  5 * 60 // 5 minutes
);

// ==========================================
// CACHE INVALIDATION MIDDLEWARE
// ==========================================

const invalidateCache = (invalidationFunction) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to invalidate cache after successful response
    res.json = function(data) {
      // Only invalidate on successful operations
      if (res.statusCode < 300 && data.success) {
        invalidationFunction(req, res)
          .catch(err => console.error('Cache invalidation error:', err));
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Invalidate message-related caches
const invalidateMessageCaches = invalidateCache(async (req) => {
  const patterns = [
    `tickets:details:*`,
    `tickets:messages:*`,
    `tickets:user:*`,
    `tickets:admin:*`
  ];
  
  if (req.params.messageId) {
    patterns.push(`tickets:messages:${req.params.messageId}:*`);
  }
  
  if (req.params.ticketId) {
    patterns.push(`tickets:${req.params.ticketId}:*`);
  }
  
  await Promise.all(patterns.map(pattern => CacheService.delPattern(pattern)));
});

// ==========================================
// EXPORTED MIDDLEWARE
// ==========================================

module.exports = {
  // Cache middleware
  cacheMessageReactions,
  cacheMessageEditHistory,
  cacheFilePreview,
  cacheFileMetadata,
  cacheAuditTrail,
  
  // Cache invalidation middleware
  invalidateMessageCaches,
  
  // Cache utilities
  MessageCacheKeys
};