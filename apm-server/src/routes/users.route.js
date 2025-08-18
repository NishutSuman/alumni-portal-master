// src/routes/users.js - Updated with upload middleware
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const { asyncHandler } = require('../utils/response');
const { uploadProfilePicture, handleUploadError } = require('../middleware/upload.middleware');
const { 
  invalidateUserCache,
  cacheUserProfile 
} = require('../middleware/cache.middleware');
const userController = require('../controllers/user.controller');

// Profile management
router.put('/profile', authenticateToken, asyncHandler(userController.updateProfile));
router.get('/profile/:userId', 
  cacheUserProfile,      
  asyncHandler(userController.getPublicProfile)
);

// Address management
router.get('/addresses', authenticateToken, asyncHandler(userController.getAddresses));
router.put('/address/:addressType', authenticateToken, asyncHandler(userController.updateAddress));

// Profile picture management (with upload middleware)
router.post('/profile-picture', 
  authenticateToken, 
  uploadProfilePicture,
  handleUploadError,
  invalidateUserCache,
  asyncHandler(userController.uploadProfilePicture)
);

router.put('/profile-picture', 
  authenticateToken, 
  uploadProfilePicture,
  handleUploadError,
  asyncHandler(userController.updateProfilePicture)
);

router.delete('/profile-picture', 
  authenticateToken, 
  asyncHandler(userController.deleteProfilePicture)
);

// Education management
router.get('/education', authenticateToken, asyncHandler(userController.getEducationHistory));
router.post('/education', authenticateToken, invalidateUserCache, asyncHandler(userController.addEducation));
router.put('/education/:educationId', authenticateToken, asyncHandler(userController.updateEducation));
router.delete('/education/:educationId', authenticateToken, asyncHandler(userController.deleteEducation));

// Work experience management
router.get('/work-experience', authenticateToken, asyncHandler(userController.getWorkHistory));
router.post('/work-experience', authenticateToken, invalidateUserCache, asyncHandler(userController.addWorkExperience));
router.put('/work-experience/:workId', authenticateToken, asyncHandler(userController.updateWorkExperience));
router.delete('/work-experience/:workId', authenticateToken, asyncHandler(userController.deleteWorkExperience));

module.exports = router;