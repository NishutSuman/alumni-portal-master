// src/middleware/payment.cache.middleware.js
// Payment caching middleware following existing patterns

const { CacheService } = require("../config/redis");


// =============================================
// PAYMENT CACHE KEYS (Following EventCacheKeys pattern)
// =============================================

class PaymentCacheKeys {
  // User payment history
  static userPayments(userId, page = 1, limit = 10, filters = {}) {
    const filterKey = Object.keys(filters).length > 0 
      ? `-${JSON.stringify(filters)}` 
      : '';
    return `user:${userId}:payments:page:${page}:limit:${limit}${filterKey}`;
  }

  // Payment transaction details
  static paymentTransaction(transactionId) {
    return `payment:transaction:${transactionId}`;
  }

  // Payment status
  static paymentStatus(transactionId) {
    return `payment:status:${transactionId}`;
  }

  // Payment calculation (for preview)
  static paymentCalculation(referenceType, referenceId) {
    return `payment:calculation:${referenceType}:${referenceId}`;
  }

  // Admin payment lists
  static adminPayments(page = 1, limit = 10, filters = {}) {
    const filterKey = Object.keys(filters).length > 0 
      ? `-${JSON.stringify(filters)}` 
      : '';
    return `admin:payments:page:${page}:limit:${limit}${filterKey}`;
  }

  // Payment analytics
  static paymentAnalytics(fromDate, toDate, groupBy = 'day') {
    const dateRange = `${fromDate || 'all'}-${toDate || 'all'}`;
    return `admin:payments:analytics:${dateRange}:${groupBy}`;
  }

  // Invoice data
  static invoice(transactionId) {
    return `payment:invoice:${transactionId}`;
  }

  // Provider-specific caches
  static providerOrder(provider, orderId) {
    return `payment:provider:${provider}:order:${orderId}`;
  }
}

// =============================================
// GENERIC PAYMENT CACHE MIDDLEWARE
// =============================================

const cachePayment = (keyGenerator, expireInSeconds = 300) => {
  return async (req, res, next) => {
    try {
      // Generate cache key
      const cacheKey = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : keyGenerator;

      // Try to get cached data
      const cachedData = await CacheService.get(cacheKey);

      if (cachedData) {
        // Cache hit - return cached data
        console.log(`🎯 Payment cache hit: ${cacheKey}`);
        req.cacheHit = true;
        return res.json(cachedData);
      }

      // Cache miss - continue to controller
      console.log(`❌ Payment cache miss: ${cacheKey}`);
      req.cacheHit = false;

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success) {
          CacheService.set(cacheKey, data, expireInSeconds).catch(err =>
            console.error('Failed to cache payment response:', err)
          );
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      // Attach cache key to request for manual cache invalidation
      req.cacheKey = cacheKey;
      next();

    } catch (error) {
      console.error('Payment cache middleware error:', error);
      // Don't let cache errors break the request
      req.cacheHit = false;
      next();
    }
  };
};

// =============================================
// SPECIFIC PAYMENT CACHING MIDDLEWARE
// =============================================

// Cache user payment history (5 minutes)
const cacheUserPayments = cachePayment((req) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, status, referenceType } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (referenceType) filters.referenceType = referenceType;
  
  return PaymentCacheKeys.userPayments(userId, page, limit, filters);
}, 5 * 60);

// Cache payment status (30 seconds - short due to real-time nature)
const cachePaymentStatus = cachePayment((req) =>
  PaymentCacheKeys.paymentStatus(req.params.transactionId),
  30
);

// Cache payment calculation (2 minutes)
const cachePaymentCalculation = cachePayment((req) => {
  const { referenceType, referenceId } = req.body;
  return PaymentCacheKeys.paymentCalculation(referenceType, referenceId);
}, 2 * 60);

// Cache admin payment list (3 minutes)
const cacheAdminPayments = cachePayment((req) => {
  const { page = 1, limit = 10, status, provider, referenceType, search, fromDate, toDate } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (provider) filters.provider = provider;
  if (referenceType) filters.referenceType = referenceType;
  if (search) filters.search = search;
  if (fromDate) filters.fromDate = fromDate;
  if (toDate) filters.toDate = toDate;
  
  return PaymentCacheKeys.adminPayments(page, limit, filters);
}, 3 * 60);

// Cache payment analytics (10 minutes)
const cachePaymentAnalytics = cachePayment((req) => {
  const { fromDate, toDate, groupBy = 'day' } = req.query;
  return PaymentCacheKeys.paymentAnalytics(fromDate, toDate, groupBy);
}, 10 * 60);

// Cache invoice data (1 hour - invoices don't change once generated)
const cacheInvoice = cachePayment((req) =>
  PaymentCacheKeys.invoice(req.params.transactionId),
  60 * 60
);

// =============================================
// PAYMENT CACHE INVALIDATION
// =============================================

class PaymentCacheInvalidator {
  // Invalidate user payment caches
  static async invalidateUserPaymentCaches(userId) {
    try {
      await CacheService.delPattern(`user:${userId}:payments:*`);
      console.log(`🗑️ Invalidated user payment caches: ${userId}`);
    } catch (error) {
      console.error('Failed to invalidate user payment caches:', error);
    }
  }

  // Invalidate specific payment transaction cache
  static async invalidatePaymentTransaction(transactionId) {
    try {
      await Promise.all([
        CacheService.del(PaymentCacheKeys.paymentTransaction(transactionId)),
        CacheService.del(PaymentCacheKeys.paymentStatus(transactionId)),
        CacheService.del(PaymentCacheKeys.invoice(transactionId))
      ]);
      console.log(`🗑️ Invalidated payment transaction cache: ${transactionId}`);
    } catch (error) {
      console.error('Failed to invalidate payment transaction cache:', error);
    }
  }

  // Invalidate payment calculation caches for reference
  static async invalidatePaymentCalculation(referenceType, referenceId) {
    try {
      await CacheService.del(PaymentCacheKeys.paymentCalculation(referenceType, referenceId));
      console.log(`🗑️ Invalidated payment calculation cache: ${referenceType}:${referenceId}`);
    } catch (error) {
      console.error('Failed to invalidate payment calculation cache:', error);
    }
  }

  // Invalidate admin payment caches
  static async invalidateAdminPaymentCaches() {
    try {
      await Promise.all([
        CacheService.delPattern('admin:payments:*'),
        CacheService.delPattern('admin:payments:analytics:*')
      ]);
      console.log('🗑️ Invalidated admin payment caches');
    } catch (error) {
      console.error('Failed to invalidate admin payment caches:', error);
    }
  }

  // Invalidate all payment-related caches for a user
  static async invalidateAllUserPaymentCaches(userId) {
    try {
      await Promise.all([
        this.invalidateUserPaymentCaches(userId),
        this.invalidateAdminPaymentCaches() // Admin caches might include this user's payments
      ]);
      console.log(`☢️ Invalidated ALL payment caches for user: ${userId}`);
    } catch (error) {
      console.error('Failed to invalidate all user payment caches:', error);
    }
  }
}

// =============================================
// CACHE INVALIDATION MIDDLEWARE
// =============================================

const invalidatePaymentCache = (invalidationFunction) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json;

    // Override json method to invalidate cache after successful response
    res.json = function(data) {
      // Only invalidate on successful operations
      if (res.statusCode < 300 && data.success) {
        invalidationFunction(req, res).catch(err =>
          console.error('Payment cache invalidation error:', err)
        );
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

// =============================================
// SPECIFIC INVALIDATION MIDDLEWARE
// =============================================

// Invalidate caches after payment initiation
const invalidateAfterPaymentInitiation = invalidatePaymentCache(async (req) => {
  const userId = req.user.id;
  const { referenceType, referenceId } = req.body;
  
  await Promise.all([
    PaymentCacheInvalidator.invalidateUserPaymentCaches(userId),
    PaymentCacheInvalidator.invalidatePaymentCalculation(referenceType, referenceId),
    PaymentCacheInvalidator.invalidateAdminPaymentCaches()
  ]);
});

// Invalidate caches after payment verification
const invalidateAfterPaymentVerification = invalidatePaymentCache(async (req) => {
  const transactionId = req.params.transactionId;
  const userId = req.user.id;
  
  await Promise.all([
    PaymentCacheInvalidator.invalidatePaymentTransaction(transactionId),
    PaymentCacheInvalidator.invalidateUserPaymentCaches(userId),
    PaymentCacheInvalidator.invalidateAdminPaymentCaches()
  ]);
});

// Invalidate caches after webhook processing
const invalidateAfterWebhookProcessing = invalidatePaymentCache(async (req) => {
  // For webhooks, we need to identify the transaction from the payload
  const payload = req.body;
  
  // This will depend on the webhook payload structure
  // For Razorpay, order_id is usually available
  const orderId = payload.payload?.payment?.entity?.order_id || 
                  payload.payload?.order?.entity?.id;
  
  if (orderId) {
    // Invalidate all payment caches since we don't know the user ID from webhook
    await PaymentCacheInvalidator.invalidateAdminPaymentCaches();
    console.log(`🗑️ Invalidated payment caches for webhook order: ${orderId}`);
  }
});

// =============================================
// AUTO-INVALIDATION MIDDLEWARE
// =============================================

// Automatically invalidate relevant caches based on the endpoint
const autoInvalidatePaymentCaches = (req, res, next) => {
  const method = req.method;
  const path = req.route?.path || req.path;

  // Only invalidate for write operations
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  // Choose appropriate invalidation strategy based on endpoint
  if (path.includes('/initiate')) {
    return invalidateAfterPaymentInitiation(req, res, next);
  } else if (path.includes('/verify')) {
    return invalidateAfterPaymentVerification(req, res, next);
  } else if (path.includes('/webhook')) {
    return invalidateAfterWebhookProcessing(req, res, next);
  }

  // Default invalidation for other endpoints
  return invalidatePaymentCache(async (req) => {
    if (req.user?.id) {
      await PaymentCacheInvalidator.invalidateAllUserPaymentCaches(req.user.id);
    }
  })(req, res, next);
};

// =============================================
// EXPORTS
// =============================================

module.exports = {
  // Cache keys
  PaymentCacheKeys,
  
  // Caching middleware
  cachePayment,
  cacheUserPayments,
  cachePaymentStatus,
  cachePaymentCalculation,
  cacheAdminPayments,
  cachePaymentAnalytics,
  cacheInvoice,
  
  // Cache invalidation
  PaymentCacheInvalidator,
  invalidatePaymentCache,
  invalidateAfterPaymentInitiation,
  invalidateAfterPaymentVerification,
  invalidateAfterWebhookProcessing,
  autoInvalidatePaymentCaches
};