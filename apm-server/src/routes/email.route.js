const express = require("express");
const router = express.Router();
const {
	authenticateToken,
	requireRole,
} = require("../middleware/auth/auth.middleware");
const emailController = require("../controllers/email/email.controller");

// Bulk email routes (Admin only)
router.post(
	"/events/:eventId/send-bulk-email",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	emailController.sendBulkEmail
);

router.post(
	"/events/:eventId/send-reminders",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	emailController.sendEventReminders
);

router.get(
	"/events/:eventId/email-stats",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	emailController.getEmailStats
);

// System email routes (Admin only)
router.post(
	"/admin/test-email",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	emailController.testEmailSystem
);

module.exports = router;
