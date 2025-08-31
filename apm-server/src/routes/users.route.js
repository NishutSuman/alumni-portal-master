// src/routes/users.route.js - Updated with Alumni Verification Integration
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const { asyncHandler } = require('../utils/response');
const { uploadProfilePicture, handleUploadError } = require('../middleware/upload.middleware');

// ==========================================
// ALUMNI VERIFICATION MIDDLEWARE IMPORTS
// ==========================================
const { 
  optionalAlumniVerification, 
  requireAlumniVerification 
} = require('../middleware/alumniVerification.middleware');

// ==========================================
// PROFILE EDIT VALIDATION MIDDLEWARE IMPORTS  
// ==========================================
const {
  validateProfileEdit,
  validateSpecificProfileFields,
  checkEmailDuplicateOnUpdate,
  profileUpdateRateLimit,
  validateAdminProfileEditPermission,
  logProfileChanges
} = require('../middleware/profileEdit.validation.middleware');

// ==========================================
// CACHE MIDDLEWARE IMPORTS
// ==========================================
const { 
  invalidateUserCache,
  cacheUserProfile 
} = require('../middleware/cache.middleware');

const userController = require('../controllers/user.controller');

// ==========================================
// PROFILE MANAGEMENT - UNVERIFIED USERS ALLOWED
// ==========================================

// Get current user profile (allow unverified users)
router.get('/profile', 
  authenticateToken,
  optionalAlumniVerification, // 🆕 ALLOWS UNVERIFIED ACCESS
  asyncHandler(userController.getProfile)
);

// CRITICAL: Allow profile editing for unverified users (for batch correction)
router.put('/profile', 
  authenticateToken,
  optionalAlumniVerification, // 🆕 ALLOWS UNVERIFIED ACCESS  
  profileUpdateRateLimit, // Rate limiting
  validateProfileEdit, // 🆕 CUSTOM VALIDATION (handles batch correction)
  logProfileChanges, // Audit logging
  invalidateUserCache, // Cache invalidation
  asyncHandler(userController.updateProfile)
);

// Get public profile (cached)
router.get('/profile/:userId', 
  cacheUserProfile,      
  asyncHandler(userController.getPublicProfile)
);

// View membership status (even if unverified)
router.get('/membership-status',
  authenticateToken,
  optionalAlumniVerification, // 🆕 ALLOWS UNVERIFIED ACCESS
  asyncHandler(userController.getMembershipStatus)
);

// ==========================================
// ADDRESS MANAGEMENT - UNVERIFIED USERS ALLOWED
// ==========================================

router.get('/addresses', 
  authenticateToken, 
  optionalAlumniVerification, // Allow unverified users
  asyncHandler(userController.getAddresses)
);

router.put('/address/:addressType', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users 
  invalidateUserCache,
  asyncHandler(userController.updateAddress)
);

// ==========================================
// PROFILE PICTURE MANAGEMENT - UNVERIFIED USERS ALLOWED
// ==========================================

router.post('/profile-picture', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  uploadProfilePicture,
  handleUploadError,
  invalidateUserCache,
  asyncHandler(userController.uploadProfilePicture)
);

router.put('/profile-picture', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  uploadProfilePicture,
  handleUploadError,
  invalidateUserCache,
  asyncHandler(userController.updateProfilePicture)
);

router.delete('/profile-picture', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  invalidateUserCache,
  asyncHandler(userController.deleteProfilePicture)
);

// ==========================================
// EDUCATION MANAGEMENT - UNVERIFIED USERS ALLOWED
// ==========================================

router.get('/education', 
  authenticateToken, 
  optionalAlumniVerification, // Allow unverified users
  asyncHandler(userController.getEducationHistory)
);

router.post('/education', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  invalidateUserCache, 
  asyncHandler(userController.addEducation)
);

router.put('/education/:educationId', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  invalidateUserCache,
  asyncHandler(userController.updateEducation)
);

router.delete('/education/:educationId', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  invalidateUserCache,
  asyncHandler(userController.deleteEducation)
);

// ==========================================
// WORK EXPERIENCE MANAGEMENT - UNVERIFIED USERS ALLOWED
// ==========================================

router.get('/work-experience', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  asyncHandler(userController.getWorkHistory)
);

router.post('/work-experience', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  invalidateUserCache, 
  asyncHandler(userController.addWorkExperience)
);

router.put('/work-experience/:workId', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  invalidateUserCache,
  asyncHandler(userController.updateWorkExperience)
);

router.delete('/work-experience/:workId', 
  authenticateToken,
  optionalAlumniVerification, // Allow unverified users
  invalidateUserCache,
  asyncHandler(userController.deleteWorkExperience)
);

// ==========================================
// PREMIUM FEATURES - REQUIRE VERIFICATION
// ==========================================

// Get user settings/preferences (premium feature)
router.get('/settings',
  authenticateToken,
  requireAlumniVerification, // 🔒 VERIFIED USERS ONLY
  asyncHandler(userController.getUserSettings)
);

// Update user settings (premium feature)  
router.put('/settings',
  authenticateToken,
  requireAlumniVerification, // 🔒 VERIFIED USERS ONLY
  asyncHandler(userController.updateUserSettings)
);

// Get user activity/history (premium feature)
router.get('/activity',
  authenticateToken,
  requireAlumniVerification, // 🔒 VERIFIED USERS ONLY
  asyncHandler(userController.getUserActivity)
);

module.exports = router;