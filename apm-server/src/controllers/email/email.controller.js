const emailManager = require("../../services/email/EmailManager");
const { prisma } = require("../../config/database");
const { successResponse, errorResponse } = require("../../utils/response");
const { asyncHandler } = require("../../utils/response");

/**
 * Send bulk email to event attendees
 * POST /api/events/:eventId/send-bulk-email
 */
const sendBulkEmail = asyncHandler(async (req, res) => {
	const { eventId } = req.params;
	const { subject, message, recipientType = "all" } = req.body;

	try {
		// Get event details
		const event = await prisma.event.findUnique({
			where: { id: eventId },
			select: { id: true, title: true },
		});

		if (!event) {
			return errorResponse(res, "Event not found", 404);
		}

		// Get recipients based on type
		let whereClause = { eventId };

		switch (recipientType) {
			case "paid":
				whereClause.paymentStatus = "COMPLETED";
				break;
			case "pending":
				whereClause.paymentStatus = "PENDING";
				break;
			case "confirmed":
				whereClause.status = "CONFIRMED";
				break;
			// 'all' includes everyone
		}

		const registrations = await prisma.eventRegistration.findMany({
			where: whereClause,
			include: {
				user: {
					select: { id: true, fullName: true, email: true },
				},
			},
		});

		if (registrations.length === 0) {
			return errorResponse(res, "No recipients found", 400);
		}

		// Prepare template data
		const templateData = {
			title: subject,
			message,
			eventTitle: event.title,
			senderName: req.user.fullName,
		};

		// Send bulk email
		const emailService = emailManager.getService();
		const recipients = registrations.map((reg) => reg.user);

		const result = await emailService.sendBulkEmail(
			recipients,
			subject,
			"bulk-announcement",
			templateData
		);

		// Log bulk email activity
		await prisma.activityLog.create({
			data: {
				userId: req.user.id,
				action: "bulk_email_sent",
				details: {
					eventId,
					subject,
					recipientCount: recipients.length,
					recipientType,
					successCount: result.successCount,
					failureCount: result.failureCount,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(res, result, "Bulk email sent successfully");
	} catch (error) {
		console.error("Bulk email error:", error);
		return errorResponse(res, "Failed to send bulk email", 500);
	}
});

/**
 * Get email statistics for an event
 * GET /api/events/:eventId/email-stats
 */
const getEmailStats = asyncHandler(async (req, res) => {
	const { eventId } = req.params;

	try {
		const emailStats = await prisma.activityLog.findMany({
			where: {
				action: { startsWith: "email_" },
				details: { path: ["eventId"], equals: eventId },
			},
			select: {
				action: true,
				createdAt: true,
				details: true,
			},
		});

		const stats = {
			totalEmails: emailStats.length,
			emailTypes: {},
			recentEmails: emailStats.slice(-10),
		};

		emailStats.forEach((log) => {
			const emailType = log.action.replace("email_", "");
			stats.emailTypes[emailType] = (stats.emailTypes[emailType] || 0) + 1;
		});

		return successResponse(res, stats, "Email statistics retrieved");
	} catch (error) {
		console.error("Email stats error:", error);
		return errorResponse(res, "Failed to retrieve email statistics", 500);
	}
});

/**
 * Test email system
 * POST /api/admin/test-email
 */
const testEmailSystem = asyncHandler(async (req, res) => {
	try {
		const testResult = await emailManager.testEmailSystem();

		if (testResult.success) {
			return successResponse(
				res,
				testResult,
				"Email system is working correctly"
			);
		} else {
			return errorResponse(
				res,
				`Email system test failed: ${testResult.error}`,
				500
			);
		}
	} catch (error) {
		console.error("Email system test error:", error);
		return errorResponse(res, "Email system test failed", 500);
	}
});

/**
 * Send event reminders
 * POST /api/events/:eventId/send-reminders
 */
const sendEventReminders = asyncHandler(async (req, res) => {
	const { eventId } = req.params;

	try {
		// Get event and registrations
		const event = await prisma.event.findUnique({
			where: { id: eventId },
			include: {
				registrations: {
					where: { status: "CONFIRMED" },
					include: {
						user: {
							select: { id: true, fullName: true, email: true },
						},
					},
				},
			},
		});

		if (!event) {
			return errorResponse(res, "Event not found", 404);
		}

		const emailService = emailManager.getService();
		const results = [];

		// Send reminder to each registered user
		for (const registration of event.registrations) {
			try {
				await emailService.sendEventReminder(
					registration.user,
					event,
					registration
				);
				results.push({
					userId: registration.userId,
					email: registration.user.email,
					success: true,
				});
			} catch (error) {
				results.push({
					userId: registration.userId,
					email: registration.user.email,
					success: false,
					error: error.message,
				});
			}
		}

		const successCount = results.filter((r) => r.success).length;
		const failureCount = results.filter((r) => !r.success).length;

		// Log reminder activity
		await prisma.activityLog.create({
			data: {
				userId: req.user.id,
				action: "event_reminders_sent",
				details: {
					eventId,
					totalRecipients: results.length,
					successCount,
					failureCount,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{
				totalSent: results.length,
				successCount,
				failureCount,
				results,
			},
			"Event reminders sent"
		);
	} catch (error) {
		console.error("Event reminders error:", error);
		return errorResponse(res, "Failed to send event reminders", 500);
	}
});

module.exports = {
	sendBulkEmail,
	getEmailStats,
	testEmailSystem,
	sendEventReminders,
};
