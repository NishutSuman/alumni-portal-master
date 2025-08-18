// src/routes/batches.js
const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/response');
const batchController = require('../controllers/batch.controller');

// Public batch routes
router.get('/', asyncHandler(batchController.getAllBatches));
router.get('/:year/members', optionalAuth, asyncHandler(batchController.getBatchMembers));
router.get('/:year/stats', asyncHandler(batchController.getBatchStats));
router.get('/:year', asyncHandler(batchController.getBatchDetails));

module.exports = router;