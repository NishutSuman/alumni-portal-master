
// src/routes/alumni.route.js
const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../middleware/auth.middleware");
const { asyncHandler } = require('../utils/response');
const { 
  cacheAlumniDirectory, 
  cacheAlumniStats,
  cacheUserProfile 
} = require('../middleware/cache.middleware');
const alumniController = require('../controllers/alumni.controller');

// Public alumni directory routes
router.get('/search', optionalAuth, cacheAlumniDirectory, asyncHandler(alumniController.searchAlumni));
router.get('/stats', cacheAlumniStats, asyncHandler(alumniController.getAlumniStats));
router.get('/:userId', cacheUserProfile, optionalAuth, asyncHandler(alumniController.getAlumniProfile));

module.exports = router;