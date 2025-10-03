// ==========================================
// STEP 4A: ALUMNI VERIFICATION MIDDLEWARE
// File: apm-server/src/middleware/alumniVerification.middleware.js
// ==========================================

const { prisma } = require('../../config/database');
const { errorResponse } = require('../../utils/response');
const { CacheService } = require('../../config/redis');

/**
 * Require alumni verification for protected routes
 * Blocks access for unverified users (except admins)
 */
const requireAlumniVerification = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Skip verification check for admins (they're pre-verified)
    if (user.role === 'SUPER_ADMIN' || user.role === 'BATCH_ADMIN') {
      return next();
    }
    
    // For regular users, check verification status with caching
    const cacheKey = `user:${user.id}:verification:status`;
    let verificationStatus = await CacheService.get(cacheKey);
    
    if (!verificationStatus) {
      // Get fresh verification status from database
      const userDetails = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          isAlumniVerified: true,
          pendingVerification: true,
          isRejected: true,
          rejectionReason: true,
          rejectedAt: true
        }
      });
      
      verificationStatus = userDetails;
      
      // Cache for 10 minutes
      await CacheService.set(cacheKey, verificationStatus, 600);
    }
    
    // Check if user is verified alumni
    if (!verificationStatus.isAlumniVerified) {
      return res.status(403).json({
        success: false,
        message: verificationStatus.isRejected 
          ? 'Your alumni verification was not approved. Contact admin for more information.'
          : 'Alumni verification required to access this feature. Your verification is pending admin approval.',
        verification: {
          status: verificationStatus.pendingVerification ? 'pending' : 'rejected',
          isAlumniVerified: false,
          isPending: verificationStatus.pendingVerification,
          isRejected: verificationStatus.isRejected,
          rejectionReason: verificationStatus.rejectionReason,
          rejectedAt: verificationStatus.rejectedAt,
          action: verificationStatus.pendingVerification ? 'await_admin_verification' : 'contact_admin',
          helpMessage: verificationStatus.isRejected 
            ? 'If you believe this is an error, please contact the administration with additional documentation.'
            : 'Please wait for admin approval. You will receive a notification once your verification is processed.'
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Alumni verification check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Verification check failed'
    });
  }
};

/**
 * Optional alumni verification check
 * Adds verification context to request without blocking
 */
const optionalAlumniVerification = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      req.alumniVerification = null;
      return next();
    }
    
    // Add verification status to request for controller use
    req.alumniVerification = {
      isVerified: user.isAlumniVerified || false,
      isPending: user.pendingVerification || false,
      isRejected: user.isRejected || false,
      isAdmin: user.role === 'SUPER_ADMIN' || user.role === 'BATCH_ADMIN',
      hasFullAccess: user.isAlumniVerified || user.role === 'SUPER_ADMIN' || user.role === 'BATCH_ADMIN'
    };
    
    next();
  } catch (error) {
    console.error('Optional alumni verification error:', error);
    req.alumniVerification = null;
    next(); // Don't block the request
  }
};

/**
 * Check blacklist during registration
 * Middleware for registration endpoint
 */
const checkEmailBlacklist = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(); // Let other validation handle missing email
    }
    
    const blacklistedEmail = await prisma.blacklistedEmail.findFirst({
      where: { 
        email: email.toLowerCase(),
        isActive: true 
      },
      select: {
        id: true,
        reason: true,
        blacklistedAt: true,
        blacklistedAdmin: {
          select: { fullName: true }
        }
      }
    });
    
    if (blacklistedEmail) {
      // Log blacklist attempt
      await prisma.activityLog.create({
        data: {
          userId: null,
          action: 'blacklisted_registration_attempt',
          details: {
            email: email.toLowerCase(),
            blacklistReason: blacklistedEmail.reason,
            blacklistedBy: blacklistedEmail.blacklistedAdmin.fullName
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'This email is not eligible for registration.',
        blacklisted: true,
        details: {
          blacklistedAt: blacklistedEmail.blacklistedAt,
          contactAdmin: true,
          helpMessage: 'If you believe this is an error, please contact the administration with proper documentation.'
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Email blacklist check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration validation failed'
    });
  }
};

/**
 * Validate batch admin permissions for verification
 * Ensures batch admin can only verify users from their managed batches
 */
const validateBatchAdminVerificationPermission = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role, id: adminId } = req.user;
    
    // Super admins have access to all users
    if (role === 'SUPER_ADMIN') {
      return next();
    }
    
    // For batch admins, check if they can verify this specific user
    if (role === 'BATCH_ADMIN') {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          batch: true, 
          fullName: true,
          email: true 
        }
      });
      
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if batch admin manages this user's batch
      const hasPermission = await prisma.batchAdminAssignment.findFirst({
        where: {
          userId: adminId,
          batchYear: targetUser.batch,
          isActive: true
        }
      });
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `You can only verify alumni from your managed batches. ${targetUser.fullName} is from batch ${targetUser.batch}.`,
          userBatch: targetUser.batch,
          adminRole: 'BATCH_ADMIN'
        });
      }
      
      // Add target user to request for controller use
      req.targetUser = targetUser;
    }
    
    next();
  } catch (error) {
    console.error('Batch admin verification permission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission validation failed'
    });
  }
};

/**
 * Rate limiting for verification actions
 * Prevents abuse of verification system
 */
const verificationRateLimit = async (req, res, next) => {
  try {
    const { id: adminId } = req.user;
    const action = req.path.includes('verify') ? 'verify' : 'reject';
    
    const rateLimitKey = `verification:${action}:${adminId}`;
    const currentCount = await CacheService.get(rateLimitKey) || 0;
    
    // Limit: 50 verifications per hour per admin
    const limit = 50;
    
    if (currentCount >= limit) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded. You can ${action} maximum ${limit} users per hour.`,
        retryAfter: 3600, // 1 hour
        currentCount
      });
    }
    
    // Increment counter
    await CacheService.setWithExpiry(rateLimitKey, currentCount + 1, 3600);
    
    next();
  } catch (error) {
    console.error('Verification rate limit error:', error);
    next(); // Don't block on rate limit errors
  }
};

/**
 * Validate verification request data
 */
const validateVerificationRequest = (req, res, next) => {
  try {
    const { userId } = req.params;
    const { notes, reason } = req.body;
    const isRejection = req.path.includes('reject');
    
    const errors = [];
    
    // Validate user ID format (CUID format: starts with 'c' followed by alphanumeric)
    if (!userId || !/^c[a-z0-9]{24}$/.test(userId)) {
      errors.push({
        field: 'userId',
        message: 'Valid user ID required'
      });
    }
    
    // Validation for rejection
    if (isRejection) {
      if (!reason || reason.trim().length < 5) {
        errors.push({
          field: 'reason',
          message: 'Rejection reason is required (minimum 5 characters)'
        });
      }
      
      if (reason && reason.length > 1000) {
        errors.push({
          field: 'reason',
          message: 'Rejection reason must be less than 1000 characters'
        });
      }
    }
    
    // Validation for approval notes (optional)
    if (notes && notes.length > 500) {
      errors.push({
        field: 'notes',
        message: 'Notes must be less than 500 characters'
      });
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${isRejection ? 'Rejection' : 'Verification'} validation failed`,
        errors
      });
    }
    
    // Sanitize input
    if (reason) {
      req.body.reason = reason.trim();
    }
    if (notes) {
      req.body.notes = notes.trim();
    }
    
    next();
  } catch (error) {
    console.error('Verification request validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Verification validation failed'
    });
  }
};

/**
 * Add verification statistics to request context
 * Useful for admin dashboard endpoints
 */
const addVerificationContext = async (req, res, next) => {
  try {
    const { role, id: adminId } = req.user;
    
    let batchFilter = {};
    
    // Batch admin can only see their batch statistics
    if (role === 'BATCH_ADMIN') {
      const managedBatches = await prisma.batchAdminAssignment.findMany({
        where: {
          userId: adminId,
          isActive: true
        },
        select: { batchYear: true }
      });
      
      const batchYears = managedBatches.map(b => b.batchYear);
      batchFilter = { batch: { in: batchYears } };
      
      req.managedBatches = batchYears;
    }
    
    // Add filter context to request
    req.verificationContext = {
      role,
      adminId,
      batchFilter,
      canViewAllBatches: role === 'SUPER_ADMIN'
    };
    
    next();
  } catch (error) {
    console.error('Add verification context error:', error);
    next(); // Don't block the request
  }
};

module.exports = {
  requireAlumniVerification,
  optionalAlumniVerification,
  checkEmailBlacklist,
  validateBatchAdminVerificationPermission,
  verificationRateLimit,
  validateVerificationRequest,
  addVerificationContext
};