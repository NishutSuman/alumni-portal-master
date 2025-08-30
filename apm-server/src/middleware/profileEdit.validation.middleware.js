// ==========================================
// PROFILE EDIT VALIDATION MIDDLEWARE WITH BATCH CORRECTION
// File: apm-server/src/middleware/profileEdit.validation.middleware.js
// ==========================================

const { prisma } = require('../config/database');
const { errorResponse } = require('../utils/response');
const SerialIdService = require('../services/serialID.service');

/**
 * Validate profile edit permissions and batch correction logic
 * Handles the complex logic of batch changes for unverified vs verified users
 */
const validateProfileEdit = async (req, res, next) => {
  try {
    const user = req.user;
    const updates = req.body;
    const { batch, ...otherUpdates } = updates;
    
    // ==========================================
    // BATCH CHANGE VALIDATION
    // ==========================================
    
    if (batch !== undefined) {
      console.log(`📝 Batch change request: User ${user.fullName} (${user.batch}) → ${batch}`);
      
      // Validate batch year format
      const batchYear = parseInt(batch);
      const batchValidation = SerialIdService.validateAndParseBatchYear(batchYear);
      
      if (!batchValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: batchValidation.error,
          field: 'batch',
          currentBatch: user.batch,
          providedBatch: batch
        });
      }
      
      const { admissionYear, passoutYear } = batchValidation;
      
      // ==========================================
      // VERIFIED USER: BATCH LOCKED
      // ==========================================
      
      if (user.isAlumniVerified && user.role === 'USER') {
        return res.status(403).json({
          success: false,
          message: 'Batch cannot be changed after alumni verification',
          verification: {
            isVerified: true,
            verifiedAt: user.alumniVerifiedAt,
            batchLocked: true,
            currentBatch: {
              year: user.batch,
              displayName: `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`,
              admissionYear: user.admissionYear,
              passoutYear: user.passoutYear
            },
            serialId: user.serialId,
            helpMessage: 'If you believe your batch information is incorrect, please contact the administration with proper documentation.'
          }
        });
      }
      
      // ==========================================
      // ADMIN USERS: BATCH CHANGE ALLOWED (WITH WARNING)
      // ==========================================
      
      if (user.role === 'SUPER_ADMIN' || user.role === 'BATCH_ADMIN') {
        console.log(`⚠️ Admin ${user.fullName} (${user.role}) changing their own batch: ${user.batch} → ${batchYear}`);
        
        // Add warning context but allow the change
        req.adminBatchChange = {
          isAdmin: true,
          role: user.role,
          oldBatch: user.batch,
          newBatch: batchYear,
          admissionYear,
          passoutYear,
          warning: 'Admin batch change - will affect admin permissions if batch admin assignments exist'
        };
      }
      
      // ==========================================
      // UNVERIFIED USER: BATCH CORRECTION ALLOWED
      // ==========================================
      
      else if (!user.isAlumniVerified || user.pendingVerification) {
        console.log(`✅ Unverified user ${user.fullName} correcting batch: ${user.batch} → ${batchYear}`);
        
        // Check if this is actually a change
        if (batchYear !== user.batch) {
          req.batchCorrectionRequested = {
            oldBatch: user.batch,
            newBatch: batchYear,
            admissionYear,
            passoutYear,
            requiresReVerification: true,
            batchDisplayName: `${admissionYear}-${passoutYear.toString().slice(-2)}`
          };
          
          // Add batch years to updates
          req.body.admissionYear = admissionYear;
          req.body.passoutYear = passoutYear;
          
          // Reset verification status for re-evaluation with correct batch
          req.body.pendingVerification = true;
          req.body.isAlumniVerified = false;
          req.body.isRejected = false;
          req.body.rejectionReason = null;
          req.body.rejectedBy = null;
          req.body.rejectedAt = null;
          req.body.verificationNotes = null;
        }
      }
    }
    
    // ==========================================
    // OTHER FIELD RESTRICTIONS FOR UNVERIFIED USERS
    // ==========================================
    
    if (!user.isAlumniVerified && user.pendingVerification && user.role === 'USER') {
      // Fields that unverified users CANNOT change
      const lockedFields = [
        'role', 'isActive', 'serialId', 'isAlumniVerified', 
        'pendingVerification', 'isRejected', 'membershipStatus'
      ];
      
      const attemptedLockedUpdates = lockedFields.filter(field => field in updates);
      
      if (attemptedLockedUpdates.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Some profile fields are locked until alumni verification',
          lockedFields: attemptedLockedUpdates,
          verification: {
            isPending: true,
            allowedFields: ['fullName', 'bio', 'batch', 'profileImage', 'social links', 'contact information'],
            message: 'You can update basic profile information and correct your batch year while verification is pending'
          }
        });
      }
      
      // Fields that require special validation for unverified users
      const sensitiveFields = ['fullName', 'email'];
      const attemptedSensitiveUpdates = sensitiveFields.filter(field => field in updates);
      
      if (attemptedSensitiveUpdates.length > 0) {
        // Allow but add warning context
        req.sensitiveFieldUpdate = {
          fields: attemptedSensitiveUpdates,
          warning: 'Changing name or email may affect verification process'
        };
      }
    }
    
    // ==========================================
    // VALIDATION FOR ALL USERS
    // ==========================================
    
    // Validate full name if being updated
    if (updates.fullName) {
      const fullName = updates.fullName.trim();
      if (fullName.length < 2 || fullName.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Full name must be between 2 and 100 characters',
          field: 'fullName'
        });
      }
      req.body.fullName = fullName;
    }
    
    // Validate bio if being updated
    if (updates.bio && updates.bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Bio must be less than 500 characters',
        field: 'bio'
      });
    }
    
    // Validate social URLs if being updated
    const socialFields = ['linkedinUrl', 'instagramUrl', 'facebookUrl', 'twitterUrl', 'youtubeUrl', 'portfolioUrl'];
    for (const field of socialFields) {
      if (updates[field]) {
        const url = updates[field].trim();
        if (url && !isValidUrl(url)) {
          return res.status(400).json({
            success: false,
            message: `Invalid URL format for ${field}`,
            field: field,
            providedValue: url
          });
        }
        req.body[field] = url || null;
      }
    }
    
    // ==========================================
    // ADD CONTEXT TO REQUEST FOR CONTROLLER
    // ==========================================
    
    req.profileEditContext = {
      hasBatchChange: !!req.batchCorrectionRequested || !!req.adminBatchChange,
      batchCorrection: req.batchCorrectionRequested || null,
      adminBatchChange: req.adminBatchChange || null,
      sensitiveFieldUpdate: req.sensitiveFieldUpdate || null,
      isUnverifiedUser: !user.isAlumniVerified && user.pendingVerification,
      isVerifiedUser: user.isAlumniVerified,
      isAdmin: user.role === 'SUPER_ADMIN' || user.role === 'BATCH_ADMIN'
    };
    
    next();
  } catch (error) {
    console.error('Profile edit validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Profile validation failed'
    });
  }
};

/**
 * Validate specific profile fields
 */
const validateSpecificProfileFields = (req, res, next) => {
  try {
    const updates = req.body;
    const errors = [];
    
    // Email validation (if updating email)
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        errors.push({
          field: 'email',
          message: 'Invalid email format'
        });
      } else {
        req.body.email = updates.email.toLowerCase();
      }
    }
    
    // Phone number validation
    if (updates.whatsappNumber) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(updates.whatsappNumber.replace(/\s/g, ''))) {
        errors.push({
          field: 'whatsappNumber',
          message: 'Invalid phone number format'
        });
      } else {
        req.body.whatsappNumber = updates.whatsappNumber.replace(/\s/g, '');
      }
    }
    
    // Employment status validation
    if (updates.employmentStatus) {
      const validStatuses = ['WORKING', 'STUDYING', 'OPEN_TO_WORK', 'ENTREPRENEUR', 'RETIRED'];
      if (!validStatuses.includes(updates.employmentStatus)) {
        errors.push({
          field: 'employmentStatus',
          message: 'Invalid employment status'
        });
      }
    }
    
    // Privacy settings validation
    const booleanFields = ['isProfilePublic', 'showEmail', 'showPhone'];
    booleanFields.forEach(field => {
      if (updates[field] !== undefined) {
        if (typeof updates[field] !== 'boolean') {
          errors.push({
            field: field,
            message: 'Must be a boolean value'
          });
        }
      }
    });
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Profile field validation failed',
        errors
      });
    }
    
    next();
  } catch (error) {
    console.error('Specific profile fields validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Field validation failed'
    });
  }
};

/**
 * Check for duplicate email during profile update
 */
const checkEmailDuplicateOnUpdate = async (req, res, next) => {
  try {
    const { email } = req.body;
    const userId = req.user.id;
    
    if (!email) {
      return next(); // No email update requested
    }
    
    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        id: { not: userId } // Exclude current user
      },
      select: {
        id: true,
        fullName: true,
        isActive: true
      }
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered by another user',
        field: 'email',
        conflict: {
          existingUser: existingUser.isActive,
          suggestion: 'Please use a different email address'
        }
      });
    }
    
    // Check if email is blacklisted
    const blacklistedEmail = await prisma.blacklistedEmail.findFirst({
      where: { 
        email: email.toLowerCase(),
        isActive: true 
      }
    });
    
    if (blacklistedEmail) {
      return res.status(403).json({
        success: false,
        message: 'This email is not eligible for use',
        field: 'email',
        blacklisted: true,
        suggestion: 'Please contact administration if you believe this is an error'
      });
    }
    
    next();
  } catch (error) {
    console.error('Email duplicate check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Email validation failed'
    });
  }
};

/**
 * URL validation helper function
 */
const isValidUrl = (string) => {
  try {
    const url = new URL(string);
    return ['http:', 'https:'].includes(url.protocol);
  } catch (error) {
    return false;
  }
};

/**
 * Rate limiting for profile updates
 * Prevents spam profile updates
 */
const profileUpdateRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rateLimitKey = `profile:update:${userId}`;
    
    const { CacheService } = require('../config/redis');
    const currentCount = await CacheService.get(rateLimitKey) || 0;
    
    // Limit: 10 profile updates per hour
    const limit = 10;
    
    if (currentCount >= limit) {
      return res.status(429).json({
        success: false,
        message: `Profile update limit exceeded. You can update your profile maximum ${limit} times per hour.`,
        retryAfter: 3600,
        currentCount,
        suggestion: 'Please wait before making more profile changes'
      });
    }
    
    // Increment counter
    await CacheService.setWithExpiry(rateLimitKey, currentCount + 1, 3600);
    
    next();
  } catch (error) {
    console.error('Profile update rate limit error:', error);
    next(); // Don't block on rate limit errors
  }
};

/**
 * Validate admin permissions for editing other user's profile
 * This middleware should be used when admin is updating another user's profile
 */
const validateAdminProfileEditPermission = async (req, res, next) => {
  try {
    const adminUser = req.user;
    const { userId } = req.params; // User being edited
    const { batch } = req.body;
    
    // If no userId param, it means user is editing their own profile
    if (!userId) {
      return next();
    }
    
    // Only admins can edit other user's profiles
    if (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'BATCH_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own profile',
        adminRequired: true
      });
    }
    
    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        batch: true,
        isAlumniVerified: true,
        role: true
      }
    });
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Batch admin can only edit users from their managed batches
    if (adminUser.role === 'BATCH_ADMIN') {
      const hasPermission = await prisma.batchAdminAssignment.findFirst({
        where: {
          userId: adminUser.id,
          batchYear: targetUser.batch,
          isActive: true
        }
      });
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `You can only edit profiles of users from your managed batches`,
          targetUserBatch: targetUser.batch,
          userRole: 'BATCH_ADMIN'
        });
      }
    }
    
    // If admin is changing batch of verified user, add special context
    if (batch && targetUser.isAlumniVerified && parseInt(batch) !== targetUser.batch) {
      req.adminBatchChangeVerifiedUser = {
        targetUserId: userId,
        targetUserName: targetUser.fullName,
        currentBatch: targetUser.batch,
        newBatch: parseInt(batch),
        isVerifiedUser: true,
        requiresJustification: true,
        warning: 'Changing batch of verified alumni - this is a critical operation'
      };
    }
    
    req.targetUser = targetUser;
    next();
  } catch (error) {
    console.error('Admin profile edit permission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission validation failed'
    });
  }
};

/**
 * Log profile changes for audit trail
 */
const logProfileChanges = async (req, res, next) => {
  try {
    const updates = req.body;
    const user = req.user;
    const context = req.profileEditContext;
    
    // Store original user data for comparison
    const originalUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        fullName: true,
        batch: true,
        bio: true,
        email: true,
        linkedinUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        twitterUrl: true,
        youtubeUrl: true,
        portfolioUrl: true,
        whatsappNumber: true,
        alternateNumber: true,
        employmentStatus: true,
        isProfilePublic: true,
        showEmail: true,
        showPhone: true
      }
    });
    
    // Determine what fields are actually changing
    const changedFields = {};
    Object.keys(updates).forEach(field => {
      if (originalUser[field] !== updates[field]) {
        changedFields[field] = {
          from: originalUser[field],
          to: updates[field]
        };
      }
    });
    
    // Add change context to request for controller
    req.profileChangeContext = {
      changedFields,
      totalFieldsChanged: Object.keys(changedFields).length,
      hasBatchChange: !!changedFields.batch,
      hasSensitiveChanges: Object.keys(changedFields).some(field => 
        ['fullName', 'email', 'batch'].includes(field)
      )
    };
    
    next();
  } catch (error) {
    console.error('Profile change logging error:', error);
    next(); // Don't block the update
  }
};

module.exports = {
  validateProfileEdit,
  validateSpecificProfileFields,
  checkEmailDuplicateOnUpdate,
  profileUpdateRateLimit,
  validateAdminProfileEditPermission,
  logProfileChanges
};