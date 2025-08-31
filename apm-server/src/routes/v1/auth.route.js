// src/routes/auth.js
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth/auth.middleware.js");
const { asyncHandler } = require("../../utils/response.js");
const {
	checkEmailBlacklist,
} = require("../../middleware/auth/alumniVerification.middleware.js");

// Import auth controller (we'll create this next)
const authController = require("../../controllers/auth/auth.controller");

// Public routes
router.post(
	"/register",
	checkEmailBlacklist,
	asyncHandler(authController.register)
);
router.post("/login", asyncHandler(authController.login));
router.post("/refresh-token", asyncHandler(authController.refreshToken));
router.post("/forgot-password", asyncHandler(authController.forgotPassword));
router.post("/reset-password", asyncHandler(authController.resetPassword));
router.get("/verify-email/:token", asyncHandler(authController.verifyEmail));

// Protected routes
router.post("/logout", authenticateToken, asyncHandler(authController.logout));
router.post(
	"/change-password",
	authenticateToken,
	asyncHandler(authController.changePassword)
);
router.get(
	"/me",
	authenticateToken,
	asyncHandler(authController.getCurrentUser)
);

module.exports = router;
