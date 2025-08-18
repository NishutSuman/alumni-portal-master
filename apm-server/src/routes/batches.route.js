// src/routes/batches.js
const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/response');
const { 
  cacheBatchStats, 
  cacheBatchMembers 
} = require('../middleware/cache.middleware');
const batchController = require('../controllers/batch.controller');

// Public batch routes
router.get('/', asyncHandler(batchController.getAllBatches));
router.get('/:year/members', cacheBatchMembers, optionalAuth, asyncHandler(batchController.getBatchMembers));
router.get('/:year/stats', cacheBatchStats, asyncHandler(batchController.getBatchStats));
router.get('/:year', asyncHandler(batchController.getBatchDetails));

module.exports = router;