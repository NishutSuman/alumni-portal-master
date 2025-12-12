// src/routes/auth.js
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth/auth.middleware.js");
const { asyncHandler } = require("../../utils/response.js");
const {
	checkEmailBlacklist,
} = require("../../middleware/auth/alumniVerification.middleware.js");
const { optionalTenantMiddleware } = require("../../middleware/tenant.middleware.js");

// Import auth controller (we'll create this next)
const authController = require("../../controllers/auth/auth.controller");

// Public routes - use optionalTenantMiddleware to set req.tenant from X-Tenant-Code header
// This ensures proper tenant isolation for multi-org users with same email
router.post(
	"/register",
	optionalTenantMiddleware,
	checkEmailBlacklist,
	asyncHandler(authController.register)
);
router.post("/login", optionalTenantMiddleware, asyncHandler(authController.login));
router.post("/refresh-token", optionalTenantMiddleware, asyncHandler(authController.refreshToken));
router.post("/forgot-password", optionalTenantMiddleware, asyncHandler(authController.forgotPassword));
router.get("/validate-reset-token", optionalTenantMiddleware, asyncHandler(authController.validateResetToken));
router.post("/reset-password", optionalTenantMiddleware, asyncHandler(authController.resetPassword));
router.get("/verify-email/:token", optionalTenantMiddleware, asyncHandler(authController.verifyEmail));
router.post("/resend-verification", optionalTenantMiddleware, asyncHandler(authController.resendVerificationEmail));
router.post("/test-email", optionalTenantMiddleware, asyncHandler(authController.testEmail));

// Reactivation routes (public - for deactivated users)
router.post("/request-reactivation", optionalTenantMiddleware, asyncHandler(authController.requestReactivation));
router.post("/verify-reactivation", optionalTenantMiddleware, asyncHandler(authController.verifyReactivation));

// Multi-org support routes (public)
router.post("/organizations-by-email", optionalTenantMiddleware, asyncHandler(authController.getOrganizationsByEmail));
router.get("/organizations", asyncHandler(authController.getAllOrganizations));
router.get("/organization-by-code/:code", asyncHandler(authController.getOrganizationByCode));

// Protected routes
router.post("/logout", authenticateToken, asyncHandler(authController.logout));
router.post(
	"/change-password",
	authenticateToken,
	asyncHandler(authController.changePassword)
);
router.post(
	"/deactivate-account",
	authenticateToken,
	asyncHandler(authController.deactivateAccount)
);
router.get(
	"/me",
	authenticateToken,
	asyncHandler(authController.getCurrentUser)
);

module.exports = router;
