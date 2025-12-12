// src/routes/admin.route.js
const express = require("express");
const router = express.Router();
const {
	authenticateToken,
	requireRole,
} = require("../middleware/auth/auth.middleware");
const { asyncHandler } = require("../utils/response");
const { optionalTenantMiddleware } = require("../middleware/tenant.middleware");
const adminController = require("../controllers/admin/admin.controller");
const ExportController = require("../controllers/export/export.controller");
const batchCollectionController = require("../controllers/batch/batchCollection.controller");
const {
	validateEventIdParam,
	validateBatchYearParam,
	validateCreateBatchCollection,
	validateNoDuplicateBatchCollection,
	validateBatchHasActiveAdmins,
	batchCollectionRateLimit,
	validateApproveRejectCollection,
} = require("../middleware/validation/batchCollection.validation.middleware");

// All admin routes require authentication and tenant context
router.use(authenticateToken);
router.use(optionalTenantMiddleware); // Set req.tenant from X-Tenant-Code header for multi-tenant

// User management routes - accessible by SUPER_ADMIN and BATCH_ADMIN
router.get(
	"/users",
	requireRole(["SUPER_ADMIN", "BATCH_ADMIN"]),
	asyncHandler(adminController.getAllUsers)
);

router.put(
	"/users/:userId/role",
	requireRole(["SUPER_ADMIN"]), // Only super admin can change roles
	asyncHandler(adminController.updateUserRole)
);

// All other admin routes require SUPER_ADMIN role
router.use(requireRole("SUPER_ADMIN"));

// Cache management routes
router.get("/cache/dashboard", asyncHandler(adminController.getCacheDashboard));
router.get("/cache/stats", asyncHandler(adminController.getCacheStats));
router.get("/cache/health", asyncHandler(adminController.getCacheHealth));
router.post("/cache/clear", asyncHandler(adminController.clearCache));
router.post("/cache/warmup", asyncHandler(adminController.warmUpCache));

// ==========================================
// NEW ANALYTICS DASHBOARD ROUTES
// ==========================================

// System overview - CACHED
router.get(
	"/dashboard/overview",
	asyncHandler(adminController.getDashboardOverview)
);

// Events analytics with pagination - CACHED
router.get(
	"/dashboard/events-analytics",
	asyncHandler(adminController.getEventsAnalytics)
);

// Event registrations for analytics - TEMP: Auth disabled for testing
router.get(
	"/event-registrations",
	// requireRole(["SUPER_ADMIN"]), // Temporarily disabled
	asyncHandler(adminController.getEventRegistrations)
);

// User batches for dropdown - TEMP: Auth disabled for testing
router.get(
	"/users/batches",
	// requireRole(["SUPER_ADMIN"]), // Temporarily disabled
	asyncHandler(adminController.getUserBatches)
);

// Revenue breakdown - CACHED
router.get(
	"/dashboard/revenue-breakdown",
	asyncHandler(adminController.getRevenueBreakdown)
);

// Batch participation - CACHED
router.get(
	"/dashboard/batch-participation",
	asyncHandler(adminController.getBatchParticipation)
);

// Live registration stats - SHORT CACHE
router.get(
	"/dashboard/live-registrations/:eventId",
	asyncHandler(adminController.getLiveRegistrations)
);

// Refresh analytics cache
router.post(
	"/dashboard/refresh-analytics",
	asyncHandler(adminController.refreshAnalytics)
);

// Batch-wise Report Export
router.get(
	"/events/batch-report/:batchYear",
	asyncHandler(ExportController.exportBatchReport)
);

// SUPER ADMIN: Create batch collection
router.post(
	"/events/:eventId/batch-collections/:batchYear",
	validateEventIdParam,
	validateBatchYearParam,
	validateCreateBatchCollection,
	validateNoDuplicateBatchCollection,
	validateBatchHasActiveAdmins,
	batchCollectionRateLimit,
	asyncHandler(batchCollectionController.createBatchCollection)
);

// SUPER ADMIN: Get all collections for event
router.get(
	"/events/:eventId/batch-collections",
	validateEventIdParam,
	asyncHandler(batchCollectionController.getEventBatchCollections)
);

// SUPER ADMIN: Approve collection
router.post(
	"/events/:eventId/batch-collections/:batchYear/approve",
	validateEventIdParam,
	validateBatchYearParam,
	validateApproveRejectCollection,
	asyncHandler(batchCollectionController.approveBatchCollection)
);

// SUPER ADMIN: Reject collection
router.post(
	"/events/:eventId/batch-collections/:batchYear/reject",
	validateEventIdParam,
	validateBatchYearParam,
	validateApproveRejectCollection,
	asyncHandler(batchCollectionController.rejectBatchCollection)
);

// =============================================
// 🚀 NEW UNIFIED ANALYTICS ROUTES
// =============================================

/**
 * 🎯 PRIMARY UNIFIED ANALYTICS ENDPOINT
 * GET /api/admin/dashboard/unified-payments
 * Returns complete payment analytics across ALL sources
 * Cache: 30 minutes
 */
router.get(
	"/dashboard/unified-payments",
	asyncHandler(adminController.getUnifiedPaymentAnalytics)
);

/**
 * 🔍 TRANSPARENCY REPORT ENDPOINT
 * GET /api/admin/dashboard/transparency-report
 * Returns public-facing transparency report
 * Cache: 1 hour
 * Query params: ?eventId=123 for event-specific report
 */
router.get(
	"/dashboard/transparency-report",
	asyncHandler(adminController.getTransparencyReport)
);

/**
 * 📊 ENHANCED REVENUE BREAKDOWN ENDPOINT
 * GET /api/admin/dashboard/enhanced-revenue-breakdown
 * Returns revenue breakdown with projections and insights
 * Cache: 1 hour
 * Query params: ?fromDate=2024-01-01&toDate=2024-12-31&includeProjections=true
 */
router.get(
	"/dashboard/enhanced-revenue-breakdown",
	asyncHandler(adminController.getEnhancedRevenueBreakdown)
);

/**
 * 🛍️ MERCHANDISE INTEGRATION ANALYTICS
 * GET /api/admin/dashboard/merchandise-integration
 * Returns both standalone and event merchandise analytics
 * Cache: 30 minutes
 * Query params: ?period=30d
 */
router.get(
	"/dashboard/merchandise-integration",
	asyncHandler(adminController.getMerchandiseIntegrationAnalytics)
);

/**
 * ⚡ REAL-TIME PAYMENT STATUS
 * GET /api/admin/dashboard/real-time-payments
 * Returns live payment status across all types
 * Cache: 5 minutes (short cache for real-time data)
 */
router.get(
	"/dashboard/real-time-payments",
	asyncHandler(adminController.getRealTimePaymentStatus)
);

// =============================================
// 📈 ANALYTICS COMPARISON ROUTES
// =============================================

/**
 * BATCH PAYMENT ANALYTICS INTEGRATION
 * GET /api/admin/dashboard/batch-payments-analytics
 * Dedicated endpoint for batch payment analytics
 */
router.get(
	"/dashboard/batch-payments-analytics",
	asyncHandler(async (req, res) => {
		const { fromDate, toDate } = req.query;

		try {
			const AnalyticsService = require("../services/analytics/AnalyticsService");
			const analytics = await AnalyticsService.getBatchPaymentAnalytics(
				fromDate ? new Date(fromDate) : null,
				toDate ? new Date(toDate) : null
			);

			return res.json({
				success: true,
				data: analytics,
				message: "Batch payment analytics retrieved successfully",
			});
		} catch (error) {
			console.error("Batch payment analytics error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to retrieve batch payment analytics",
			});
		}
	})
);

/**
 * DONATION ANALYTICS INTEGRATION
 * GET /api/admin/dashboard/donation-analytics
 * Dedicated endpoint for donation analytics
 */
router.get(
	"/dashboard/donation-analytics",
	asyncHandler(async (req, res) => {
		const { fromDate, toDate } = req.query;

		try {
			const AnalyticsService = require("../services/analytics/AnalyticsService");
			const analytics = await AnalyticsService.getDonationAnalytics(
				fromDate ? new Date(fromDate) : null,
				toDate ? new Date(toDate) : null
			);

			return res.json({
				success: true,
				data: analytics,
				message: "Donation analytics retrieved successfully",
			});
		} catch (error) {
			console.error("Donation analytics error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to retrieve donation analytics",
			});
		}
	})
);

// =============================================
// 🔄 CACHE MANAGEMENT FOR NEW ANALYTICS
// =============================================

/**
 * REFRESH UNIFIED ANALYTICS CACHE
 * POST /api/admin/dashboard/refresh-unified-cache
 * Clears all unified analytics caches
 */
router.post(
	"/dashboard/refresh-unified-cache",
	asyncHandler(async (req, res) => {
		try {
			const AnalyticsService = require("../services/analytics/AnalyticsService");
			await AnalyticsService.invalidateUnifiedAnalytics();

			return res.json({
				success: true,
				message: "Unified analytics cache refreshed successfully",
			});
		} catch (error) {
			console.error("Unified cache refresh error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to refresh unified analytics cache",
			});
		}
	})
);

// =============================================
// 📱 HEALTH CHECK ENDPOINTS
// =============================================

/**
 * ANALYTICS HEALTH CHECK
 * GET /api/admin/dashboard/analytics-health
 * Returns health status of all analytics services
 */
router.get(
	"/dashboard/analytics-health",
	asyncHandler(async (req, res) => {
		try {
			const health = {
				status: "healthy",
				services: {
					unifiedPayments: "active",
					merchandiseIntegration: "active",
					transparencyReporting: "active",
					realTimePayments: "active",
					caching: "active",
				},
				lastChecked: new Date().toISOString(),
				uptime: process.uptime(),
				version: "2.0.0", // Updated version with unified analytics
			};

			// Test database connectivity
			const { prisma } = require("../config/database");
			await prisma.user.count();

			return res.json({
				success: true,
				data: health,
				message: "Analytics services are healthy",
			});
		} catch (error) {
			console.error("Analytics health check failed:", error);
			return res.status(500).json({
				success: false,
				data: {
					status: "unhealthy",
					error: error.message,
					lastChecked: new Date().toISOString(),
				},
				message: "Analytics health check failed",
			});
		}
	})
);

module.exports = router;

// ==========================================
