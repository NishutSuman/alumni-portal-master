// src/middleware/membership.middleware.js
const MembershipService = require('../services/membership.service');
const { CacheService } = require('../config/redis');
const { errorResponse } = require('../utils/response');

/**
 * Check if user has active membership (if required)
 * Apply this middleware to routes that require active membership
 */
const checkMembershipStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = `user:${userId}:membership:status`;
    
    // Check cache first
    let membershipStatus = await CacheService.get(cacheKey);
    
    if (!membershipStatus) {
      membershipStatus = await MembershipService.getUserMembershipStatus(userId);
      // Cache for 30 minutes
      await CacheService.set(cacheKey, membershipStatus, 30 * 60);
    }
    
    // If membership is not required, proceed
    if (!membershipStatus.isRequired) {
      return next();
    }
    
    // If membership is required but not active
    if (membershipStatus.status !== 'ACTIVE') {
      const userBatch = req.user.batch;
      const feeInfo = await MembershipService.getMembershipFee(userBatch);
      
      return res.status(403).json({
        success: false,
        message: 'Active membership required to access this feature',
        membershipRequired: true,
        membershipStatus: membershipStatus.status,
        membershipFee: feeInfo.fee,
        membershipYear: new Date().getFullYear(),
        paymentUrl: '/api/membership/pay',
        details: {
          currentStatus: membershipStatus.status,
          paidYear: membershipStatus.paidYear,
          expiresAt: membershipStatus.expiresAt,
          feeType: feeInfo.type,
          feeDescription: feeInfo.description
        }
      });
    }
    
    // Add membership info to request for use in controllers
    req.membershipStatus = membershipStatus;
    next();
    
  } catch (error) {
    console.error('Membership check error:', error);
    return errorResponse(res, 'Failed to verify membership status', 500);
  }
};

/**
 * Enhanced batch admin check for specific batch year
 * Use this for routes that require batch admin access
 */
const requireBatchAdminForYear = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const batchYear = parseInt(req.params.batchYear);
    
    if (!batchYear || isNaN(batchYear)) {
      return res.status(400).json({
        success: false,
        message: 'Valid batch year required'
      });
    }
    
    const isBatchAdmin = await MembershipService.isBatchAdmin(userId, batchYear);
    
    if (!isBatchAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized as batch admin for this batch',
        requiredRole: 'BATCH_ADMIN',
        requiredBatch: batchYear
      });
    }
    
    // Add batch year to request for controller use
    req.authorizedBatchYear = batchYear;
    next();
    
  } catch (error) {
    console.error('Batch admin check error:', error);
    return errorResponse(res, 'Failed to verify batch admin status', 500);
  }
};

/**
 * Optional membership check (doesn't block, just adds info)
 * Use this for routes that can benefit from membership info but don't require it
 */
const optionalMembershipCheck = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const membershipStatus = await MembershipService.getUserMembershipStatus(userId);
    req.membershipStatus = membershipStatus;
    
    next();
  } catch (error) {
    console.error('Optional membership check error:', error);
    // Don't block request, just proceed without membership info
    next();
  }
};

/**
 * Check if any batch admin exists for a batch (for batch operations)
 * Use this to ensure batch has at least one admin before certain operations
 */
const ensureBatchHasAdmins = async (req, res, next) => {
  try {
    const batchYear = parseInt(req.params.batchYear);
    
    if (!batchYear || isNaN(batchYear)) {
      return res.status(400).json({
        success: false,
        message: 'Valid batch year required'
      });
    }
    
    const batchAdmins = await MembershipService.getBatchAdmins(batchYear);
    
    if (batchAdmins.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No active batch admins found for batch ${batchYear}`,
        suggestion: 'Please assign batch admins before performing this operation'
      });
    }
    
    req.batchAdminCount = batchAdmins.length;
    next();
    
  } catch (error) {
    console.error('Ensure batch has admins error:', error);
    return errorResponse(res, 'Failed to verify batch admin requirements', 500);
  }
};

/**
 * Check if user can modify their own membership-related data
 * Use this for self-service membership operations
 */
const canModifyOwnMembership = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const targetUserId = req.params.userId;
    
    // Users can modify their own data, or super admins can modify anyone's
    if (userId === targetUserId || req.user.role === 'SUPER_ADMIN') {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: 'You can only modify your own membership information'
    });
    
  } catch (error) {
    console.error('Can modify own membership error:', error);
    return errorResponse(res, 'Failed to verify membership modification permissions', 500);
  }
};

/**
 * Rate limiting for membership operations
 * Prevent abuse of membership payment initiation
 */
const membershipRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const action = req.route.path;
    const rateLimitKey = `membership:ratelimit:${userId}:${action}`;
    
    // Check current attempts
    const attempts = await CacheService.get(rateLimitKey) || 0;
    
    // Allow 5 attempts per hour for membership operations
    if (attempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many membership operation attempts. Please try again later.',
        retryAfter: 3600 // 1 hour
      });
    }
    
    // Increment attempts counter
    await CacheService.set(rateLimitKey, attempts + 1, 3600); // 1 hour TTL
    
    next();
    
  } catch (error) {
    console.error('Membership rate limit error:', error);
    // Don't block request if rate limiting fails
    next();
  }
};

module.exports = {
  checkMembershipStatus,
  requireBatchAdminForYear,
  optionalMembershipCheck,
  ensureBatchHasAdmins,
  canModifyOwnMembership,
  membershipRateLimit
};