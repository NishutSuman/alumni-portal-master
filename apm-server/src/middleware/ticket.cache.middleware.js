const CacheService = require('../config/redis');

// ==========================================
// CACHE KEY GENERATORS
// ==========================================

const TicketCacheKeys = {
  userTickets: (userId, page, filters) => {
    const filterHash = Buffer.from(JSON.stringify(filters)).toString('base64').slice(0, 8);
    return `tickets:user:${userId}:page:${page}:${filterHash}`;
  },
  
  adminTickets: (page, filters) => {
    const filterHash = Buffer.from(JSON.stringify(filters)).toString('base64').slice(0, 8);
    return `tickets:admin:page:${page}:${filterHash}`;
  },
  
  ticketDetails: (ticketId) => `tickets:details:${ticketId}`,
  
  userDashboard: (userId) => `tickets:user:${userId}:dashboard`,
  
  adminDashboard: (adminId) => `tickets:admin:${adminId}:dashboard`,
  
  categories: () => 'tickets:categories:active',
  
  availableAdmins: () => 'tickets:admins:available'
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
        console.log(`🎯 Ticket cache hit: ${cacheKey}`);
        req.cacheHit = true;
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return res.json(cachedData);
      }
      
      console.log(`❌ Ticket cache miss: ${cacheKey}`);
      req.cacheHit = false;
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache successful responses
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success !== false) {
          CacheService.set(cacheKey, data, expireInSeconds)
            .catch(err => console.error('Ticket cache set error:', err));
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
      console.error('Ticket cache middleware error:', error);
      req.cacheHit = false;
      next();
    }
  };
};

// ==========================================
// SPECIFIC CACHE MIDDLEWARE FUNCTIONS
// ==========================================

// Cache user tickets (5 minutes)
const cacheUserTickets = cache(
  (req) => {
    const { page = 1 } = req.query;
    const filters = { 
      status: req.query.status, 
      categoryId: req.query.categoryId,
      search: req.query.search 
    };
    return TicketCacheKeys.userTickets(req.user.id, page, filters);
  },
  5 * 60 // 5 minutes
);

// Cache admin tickets (3 minutes)
const cacheAdminTickets = cache(
  (req) => {
    const { page = 1 } = req.query;
    const filters = { 
      status: req.query.status, 
      categoryId: req.query.categoryId,
      assignedToMe: req.query.assignedToMe,
      priority: req.query.priority,
      search: req.query.search 
    };
    return TicketCacheKeys.adminTickets(page, filters);
  },
  3 * 60 // 3 minutes
);

// Cache ticket details (2 minutes - frequently updated)
const cacheTicketDetails = cache(
  (req) => TicketCacheKeys.ticketDetails(req.params.ticketId),
  2 * 60 // 2 minutes
);

// Cache user dashboard (5 minutes)
const cacheUserDashboard = cache(
  (req) => TicketCacheKeys.userDashboard(req.user.id),
  5 * 60 // 5 minutes
);

// Cache admin dashboard (5 minutes)
const cacheAdminDashboard = cache(
  (req) => TicketCacheKeys.adminDashboard(req.user.id),
  5 * 60 // 5 minutes
);

// Cache categories (1 hour - rarely change)
const cacheCategories = cache(
  () => TicketCacheKeys.categories(),
  60 * 60 // 1 hour
);

// Cache available admins (30 minutes)
const cacheAvailableAdmins = cache(
  () => TicketCacheKeys.availableAdmins(),
  30 * 60 // 30 minutes
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

// Invalidate ticket caches after operations
const invalidateTicketCaches = invalidateCache(async (req) => {
  const patterns = [
    `tickets:user:${req.user.id}:*`,
    'tickets:admin:*',
    'tickets:details:*'
  ];
  
  // Also invalidate assigned admin's cache if ticket has one
  if (req.ticket?.assignedToId) {
    patterns.push(`tickets:admin:${req.ticket.assignedToId}:*`);
  }
  
  await Promise.all(patterns.map(pattern => CacheService.delPattern(pattern)));
});

// ==========================================
// EXPORTED MIDDLEWARE
// ==========================================

module.exports = {
  // Cache middleware
  cacheUserTickets,
  cacheAdminTickets,
  cacheTicketDetails,
  cacheUserDashboard,
  cacheAdminDashboard,
  cacheCategories,
  cacheAvailableAdmins,
  
  // Cache invalidation middleware
  invalidateTicketCaches,
  
  // Cache utilities
  TicketCacheKeys
};