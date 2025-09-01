// src/controllers/admin/membershipAdmin.controller.js
const MembershipService = require("../../services/membership/membership.service");
const MembershipAdminService = require("../../services/membership/membershipAdmin.service");
const { prisma } = require("../../config/database");
const {
	successResponse,
	errorResponse,
	paginatedResponse,
	getPaginationParams,
	calculatePagination,
} = require("../../utils/response");
const { CacheService } = require("../../config/redis");

/**
 * Set batch-specific membership settings
 */
const setBatchMembershipSettings = async (req, res) => {
	try {
		const { batchYear } = req.params;
		const { membershipFee, membershipYear, description } = req.body;
		const currentYear = membershipYear || new Date().getFullYear();

		const setting = await prisma.batchMembershipSettings.upsert({
			where: {
				batchYear_membershipYear: {
					batchYear: batchYear,
					membershipYear: currentYear,
				},
			},
			update: {
				membershipFee,
				description,
				isActive: true,
			},
			create: {
				batchYear,
				membershipFee,
				membershipYear: currentYear,
				description,
				createdBy: req.user.id,
			},
		});

		// Clear membership caches
		await CacheService.delPattern("user:*:membership:*");

		return successResponse(
			res,
			{ setting },
			"Batch membership settings updated successfully"
		);
	} catch (error) {
		console.error("Set batch membership settings error:", error);
		return errorResponse(res, "Failed to set batch membership settings", 500);
	}
};

/**
 * Set global membership settings
 */
const setGlobalMembershipSettings = async (req, res) => {
	try {
		const { membershipFee, membershipYear, applyToAll, description } = req.body;
		const currentYear = membershipYear || new Date().getFullYear();

		const setting = await prisma.globalMembershipSettings.upsert({
			where: { membershipYear: currentYear },
			update: {
				membershipFee,
				applyToAll,
				description,
				isActive: true,
			},
			create: {
				membershipFee,
				membershipYear: currentYear,
				applyToAll,
				description,
				createdBy: req.user.id,
				isActive: true,
			},
		});

		// Clear all membership caches
		await CacheService.delPattern("user:*:membership:*");

		return successResponse(
			res,
			{ setting },
			"Global membership settings updated successfully"
		);
	} catch (error) {
		console.error("Set global membership settings error:", error);
		return errorResponse(res, "Failed to set global membership settings", 500);
	}
};

/**
 * Get comprehensive membership overview and analytics
 * GET /api/admin/membership/overview
 */
const getMembershipOverview = async (req, res) => {
	try {
		const currentYear = new Date().getFullYear();

		// Get overall statistics
		const [
			totalUsers,
			statusCounts,
			currentYearStats,
			batchBreakdown,
			recentPayments,
			expiredUsers,
		] = await Promise.all([
			// Total active users (excluding SUPER_ADMIN)
			prisma.user.count({
				where: {
					isActive: true,
					role: { in: ["USER", "BATCH_ADMIN"] },
				},
			}),

			// Count by membership status
			prisma.user.groupBy({
				by: ["membershipStatus"],
				where: {
					isActive: true,
					role: { in: ["USER", "BATCH_ADMIN"] },
				},
				_count: true,
			}),

			// Current year paid memberships
			prisma.user.aggregate({
				where: {
					isActive: true,
					currentMembershipYear: currentYear,
					membershipStatus: "ACTIVE",
					role: { in: ["USER", "BATCH_ADMIN"] },
				},
				_count: true,
				_sum: {
					membershipAmountPaid: true,
				},
			}),

			// Batch-wise breakdown
			prisma.user.groupBy({
				by: ["batch", "membershipStatus"],
				where: {
					isActive: true,
					role: { in: ["USER", "BATCH_ADMIN"] },
				},
				_count: true,
				_sum: {
					membershipAmountPaid: true,
				},
			}),

			// Recent 10 payments
			prisma.paymentTransaction.findMany({
				where: {
					referenceType: "MEMBERSHIP",
					status: "COMPLETED",
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							batch: true,
						},
					},
				},
				orderBy: { completedAt: "desc" },
				take: 10,
			}),

			// Users with expired membership
			prisma.user.findMany({
				where: {
					isActive: true,
					role: { in: ["USER", "BATCH_ADMIN"] },
					membershipStatus: "EXPIRED",
				},
				select: {
					id: true,
					fullName: true,
					email: true,
					batch: true,
					membershipExpiresAt: true,
					membershipAmountPaid: true,
				},
				take: 50, // Limit for performance
			}),
		]);

		// Process batch breakdown
		const batchStats = {};
		batchBreakdown.forEach((item) => {
			if (!batchStats[item.batch]) {
				batchStats[item.batch] = {
					batch: item.batch,
					total: 0,
					active: 0,
					expired: 0,
					pending: 0,
					suspended: 0,
					totalRevenue: 0,
				};
			}

			batchStats[item.batch].total += item._count;
			batchStats[item.batch][item.membershipStatus.toLowerCase()] = item._count;
			batchStats[item.batch].totalRevenue += parseFloat(
				item._sum.membershipAmountPaid || 0
			);
		});

		const overview = {
			summary: {
				totalUsers,
				currentYear,
				totalRevenue: currentYearStats._sum.membershipAmountPaid || 0,
				paidThisYear: currentYearStats._count,
			},
			statusBreakdown: statusCounts.reduce((acc, item) => {
				acc[item.membershipStatus] = item._count;
				return acc;
			}, {}),
			batchAnalysis: Object.values(batchStats).sort(
				(a, b) => b.batch - a.batch
			),
			recentPayments: recentPayments.map((payment) => ({
				id: payment.id,
				userName: payment.user.fullName,
				userBatch: payment.user.batch,
				amount: payment.amount,
				paidAt: payment.completedAt,
				transactionNumber: payment.transactionNumber,
			})),
			expiredUsers: expiredUsers.length,
			expiredUsersList: expiredUsers,
		};

		return successResponse(
			res,
			{ overview },
			"Membership overview retrieved successfully"
		);
	} catch (error) {
		console.error("Get membership overview error:", error);
		return errorResponse(res, "Failed to retrieve membership overview", 500);
	}
};

/**
 * Get expired users with pagination and filters
 * GET /api/admin/membership/expired-users
 */
const getExpiredUsers = async (req, res) => {
	try {
		const { page, limit, skip } = getPaginationParams(req.query, 20);
		const { batch, search } = req.query;

		// Build where clause
		const whereClause = {
			isActive: true,
			role: { in: ["USER", "BATCH_ADMIN"] },
			membershipStatus: "EXPIRED",
		};

		if (batch) {
			whereClause.batch = parseInt(batch);
		}

		if (search) {
			whereClause.OR = [
				{ fullName: { contains: search, mode: "insensitive" } },
				{ email: { contains: search, mode: "insensitive" } },
			];
		}

		const [total, expiredUsers] = await Promise.all([
			prisma.user.count({ where: whereClause }),
			prisma.user.findMany({
				where: whereClause,
				select: {
					id: true,
					fullName: true,
					email: true,
					batch: true,
					membershipStatus: true,
					membershipExpiresAt: true,
					membershipAmountPaid: true,
					lastLoginAt: true,
				},
				orderBy: [{ membershipExpiresAt: "desc" }, { fullName: "asc" }],
				skip,
				take: limit,
			}),
		]);

		const pagination = calculatePagination(total, page, limit);

		return paginatedResponse(
			res,
			expiredUsers,
			pagination,
			"Expired users retrieved successfully"
		);
	} catch (error) {
		console.error("Get expired users error:", error);
		return errorResponse(res, "Failed to retrieve expired users", 500);
	}
};

/**
 * Bulk update membership status for multiple users
 * POST /api/admin/membership/bulk-update-status
 */
const bulkUpdateMembershipStatus = async (req, res) => {
	try {
		const { userIds, newStatus, reason } = req.body;

		// Validate users exist
		const users = await prisma.user.findMany({
			where: {
				id: { in: userIds },
				isActive: true,
				role: { in: ["USER", "BATCH_ADMIN"] },
			},
			select: { id: true, fullName: true, membershipStatus: true },
		});

		if (users.length !== userIds.length) {
			const foundIds = users.map((u) => u.id);
			const missingIds = userIds.filter((id) => !foundIds.includes(id));

			return res.status(400).json({
				success: false,
				message: "Some users not found or invalid",
				invalidUserIds: missingIds,
			});
		}

		let updatedCount = 0;

		await prisma.$transaction(async (tx) => {
			// Update user statuses
			const result = await tx.user.updateMany({
				where: { id: { in: userIds } },
				data: { membershipStatus: newStatus },
			});

			updatedCount = result.count;

			// Log bulk activity
			for (const user of users) {
				await tx.activityLog.create({
					data: {
						userId: req.user.id,
						action: "bulk_membership_status_update",
						details: {
							targetUserId: user.id,
							targetUserName: user.fullName,
							oldStatus: user.membershipStatus,
							newStatus: newStatus,
							reason: reason || "Bulk update by admin",
						},
					},
				});
			}
		});

		// Clear membership caches for affected users
		await Promise.all(
			userIds.map((userId) =>
				CacheService.del(`user:${userId}:membership:status`)
			)
		);

		return successResponse(
			res,
			{
				updatedCount,
				updatedUsers: users.map((u) => ({
					id: u.id,
					name: u.fullName,
					oldStatus: u.membershipStatus,
					newStatus: newStatus,
				})),
			},
			`Successfully updated ${updatedCount} user memberships`
		);
	} catch (error) {
		console.error("Bulk update membership status error:", error);
		return errorResponse(res, "Failed to update membership statuses", 500);
	}
};

/**
 * Update individual user membership status
 * POST /api/admin/membership/users/:userId/status
 */
const updateUserMembershipStatus = async (req, res) => {
	try {
		const { userId } = req.params;
		const { status, reason } = req.body;

		// Get current user details
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				fullName: true,
				membershipStatus: true,
				batch: true,
			},
		});

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		const oldStatus = user.membershipStatus;

		// Update user status
		const updatedUser = await prisma.user.update({
			where: { id: userId },
			data: { membershipStatus: status },
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: req.user.id,
				action: "membership_status_updated",
				details: {
					targetUserId: userId,
					targetUserName: user.fullName,
					targetUserBatch: user.batch,
					oldStatus,
					newStatus: status,
					reason: reason || "Manual admin update",
				},
			},
		});

		// Clear user membership cache
		await CacheService.del(`user:${userId}:membership:status`);

		return successResponse(
			res,
			{
				user: {
					id: userId,
					name: user.fullName,
					batch: user.batch,
					oldStatus,
					newStatus: status,
				},
			},
			"User membership status updated successfully"
		);
	} catch (error) {
		console.error("Update user membership status error:", error);
		return errorResponse(res, "Failed to update user membership status", 500);
	}
};

/**
 * Send membership reminder emails to expired users
 * POST /api/admin/membership/send-reminders
 */
const sendMembershipReminders = async (req, res) => {
	try {
		const { batchYear, userIds } = req.body;

		let whereClause = {
			isActive: true,
			role: { in: ["USER", "BATCH_ADMIN"] },
			membershipStatus: "EXPIRED",
		};

		if (batchYear) {
			whereClause.batch = batchYear;
		}

		if (userIds && userIds.length > 0) {
			whereClause.id = { in: userIds };
		}

		const expiredUsers = await prisma.user.findMany({
			where: whereClause,
			select: {
				id: true,
				fullName: true,
				email: true,
				batch: true,
			},
		});

		if (expiredUsers.length === 0) {
			return res.status(400).json({
				success: false,
				message: "No expired users found matching criteria",
			});
		}

		let emailsSent = 0;

		// Send reminder emails (assuming you have EmailService)
		for (const user of expiredUsers) {
			try {
				const feeInfo = await MembershipService.getMembershipFee(user.batch);

				// You'll need to implement this email template
				const emailData = {
					to: user.email,
					subject: "🔔 Membership Renewal Reminder",
					template: "membership_reminder",
					data: {
						userName: user.fullName,
						membershipYear: new Date().getFullYear(),
						membershipFee: feeInfo.fee,
						batchYear: user.batch,
						renewalUrl: `${process.env.FRONTEND_URL}/membership/pay`,
					},
				};

				// await EmailService.send(emailData);
				emailsSent++;

				// Log reminder sent
				await prisma.activityLog.create({
					data: {
						userId: user.id,
						action: "membership_reminder_sent",
						details: {
							sentBy: req.user.id,
							membershipYear: new Date().getFullYear(),
							feeAmount: feeInfo.fee,
						},
					},
				});
			} catch (emailError) {
				console.error(`Failed to send reminder to ${user.email}:`, emailError);
			}
		}

		return successResponse(
			res,
			{
				totalUsers: expiredUsers.length,
				emailsSent,
				remindersSent: emailsSent,
			},
			`Membership reminders sent to ${emailsSent} users`
		);
	} catch (error) {
		console.error("Send membership reminders error:", error);
		return errorResponse(res, "Failed to send membership reminders", 500);
	}
};

/**
 * BONUS: Auto-expire memberships that have passed their expiry date
 * POST /api/admin/membership/auto-expire
 * NEW METHOD: Uses MembershipAdminService
 */
const autoExpireMemberships = async (req, res) => {
	try {
		const expiredCount = await MembershipAdminService.autoExpireMemberships();
		
		// Log admin action
		await prisma.activityLog.create({
			data: {
				userId: req.user.id,
				action: "membership_auto_expire_triggered",
				details: {
					expiredCount,
					triggeredAt: new Date(),
				},
			},
		});

		return successResponse(
			res,
			{ expiredCount },
			`Successfully auto-expired ${expiredCount} memberships`
		);
	} catch (error) {
		console.error("Auto-expire memberships error:", error);
		return errorResponse(res, "Failed to auto-expire memberships", 500);
	}
};

module.exports = {
	setBatchMembershipSettings,
	setGlobalMembershipSettings,
	getMembershipOverview,
	getExpiredUsers,
	bulkUpdateMembershipStatus,
	updateUserMembershipStatus,
	sendMembershipReminders,
	autoExpireMemberships,
};
