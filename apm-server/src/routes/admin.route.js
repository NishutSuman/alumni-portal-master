// src/routes/admin.route.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/response');
const adminController = require('../controllers/admin.controller');
const ExportController = require('../controllers/export/export.controller');



// All admin routes require SUPER_ADMIN role
router.use(authenticateToken);
router.use(requireRole('SUPER_ADMIN'));

// Cache management routes
router.get('/cache/dashboard', asyncHandler(adminController.getCacheDashboard));
router.get('/cache/stats', asyncHandler(adminController.getCacheStats));
router.get('/cache/health', asyncHandler(adminController.getCacheHealth));
router.post('/cache/clear', asyncHandler(adminController.clearCache));
router.post('/cache/warmup', asyncHandler(adminController.warmUpCache));

// ==========================================  
// NEW ANALYTICS DASHBOARD ROUTES
// ==========================================

// System overview - CACHED
router.get('/dashboard/overview', 
  asyncHandler(adminController.getDashboardOverview)
);

// Events analytics with pagination - CACHED  
router.get('/dashboard/events-analytics',
  asyncHandler(adminController.getEventsAnalytics)  
);

// Revenue breakdown - CACHED
router.get('/dashboard/revenue-breakdown',
  asyncHandler(adminController.getRevenueBreakdown)
);

// Batch participation - CACHED
router.get('/dashboard/batch-participation',
  asyncHandler(adminController.getBatchParticipation)
);

// Live registration stats - SHORT CACHE
router.get('/dashboard/live-registrations/:eventId',
  asyncHandler(adminController.getLiveRegistrations)
);

// Refresh analytics cache
router.post('/dashboard/refresh-analytics',
  asyncHandler(adminController.refreshAnalytics)
);


// Batch-wise Report Export
router.get('/events/batch-report/:batchYear',
  asyncHandler(ExportController.exportBatchReport)
);

module.exports = router;

// ==========================================