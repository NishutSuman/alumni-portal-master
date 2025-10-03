// src/controllers/payment.controller.js
// Payment controller following existing controller patterns

const { asyncHandler } = require("../../utils/response");
const PaymentService = require("../../services/payment/PaymentService");
const { PrismaClient } = require("@prisma/client");
const MembershipPaymentService = require("../../services/payment/membershipPayment.service");
const MerchandiseNotificationService = require("../../services/merchandise/merchandiseNotification.service");

const prisma = new PrismaClient();

/**
 * @desc    Initiate payment for event registration or merchandise
 * @route   POST /api/payments/initiate
 * @access  Private (User)
 */
const initiatePayment = asyncHandler(async (req, res) => {
	const { referenceType, referenceId, description, registrationData } = req.body;
	const userId = req.user.id;

	try {
		// Initiate payment through service
		const result = await PaymentService.initiatePayment({
			referenceType,
			referenceId,
			userId,
			description,
			registrationData,
		});

		// Log activity following existing pattern
		await prisma.activityLog.create({
			data: {
				userId,
				action: "payment_initiated",
				details: {
					transactionId: result.transaction.id,
					transactionNumber: result.transaction.transactionNumber,
					amount: result.transaction.amount,
					referenceType,
					referenceId,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		res.status(201).json({
			success: true,
			message: "Payment initiated successfully",
			data: {
				transaction: result.transaction,
				breakdown: result.breakdown,
				items: result.items,
				provider: result.provider,
			},
		});
	} catch (error) {
		console.error("Payment initiation error:", error);
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
});

/**
 * @desc    Verify payment completion
 * @route   POST /api/payments/:transactionId/verify
 * @access  Private (User)
 */
const verifyPayment = asyncHandler(async (req, res) => {
	const { transactionId } = req.params;
	const userId = req.user.id;
	const paymentData = req.body;

	try {
		// Check if user owns this transaction
		const transaction = await prisma.paymentTransaction.findFirst({
			where: {
				id: transactionId,
				userId,
			},
		});

		if (!transaction) {
			return res.status(404).json({
				success: false,
				message: "Transaction not found",
			});
		}

		// Verify payment through service
		const result = await PaymentService.verifyPayment({
			transactionId,
			...paymentData,
		});

		res.status(200).json({
			success: true,
			message: result.alreadyCompleted
				? "Payment already completed"
				: "Payment verified successfully",
			data: {
				transaction: result.transaction,
				verified: true,
			},
		});
	} catch (error) {
		console.error("Payment verification error:", error);
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
});

/**
 * @desc    Get payment status
 * @route   GET /api/payments/:transactionId/status
 * @access  Private (User)
 */
const getPaymentStatus = asyncHandler(async (req, res) => {
	const { transactionId } = req.params;
	const userId = req.user.id;

	try {
		const transaction = await prisma.paymentTransaction.findFirst({
			where: {
				id: transactionId,
				userId,
			},
			select: {
				id: true,
				transactionNumber: true,
				amount: true,
				currency: true,
				description: true,
				status: true,
				provider: true,
				breakdown: true,
				razorpayOrderId: true,
				razorpayPaymentId: true,
				initiatedAt: true,
				completedAt: true,
				expiresAt: true,
			},
		});

		if (!transaction) {
			return res.status(404).json({
				success: false,
				message: "Transaction not found",
			});
		}

		res.status(200).json({
			success: true,
			message: "Payment status retrieved successfully",
			data: { transaction },
		});
	} catch (error) {
		console.error("Get payment status error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to retrieve payment status",
		});
	}
});

/**
 * @desc    Get user's payment history
 * @route   GET /api/payments/my-payments
 * @access  Private (User)
 */
const getUserPayments = asyncHandler(async (req, res) => {
	const userId = req.user.id;
	const { page = 1, limit = 10, status, referenceType } = req.query;

	try {
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Build filter conditions
		const where = { userId };
		if (status) where.status = status;
		if (referenceType) where.referenceType = referenceType;

		// Get transactions with pagination
		const [transactions, total] = await Promise.all([
			prisma.paymentTransaction.findMany({
				where,
				select: {
					id: true,
					transactionNumber: true,
					amount: true,
					currency: true,
					description: true,
					status: true,
					provider: true,
					referenceType: true,
					razorpayPaymentId: true,
					initiatedAt: true,
					completedAt: true,
				},
				orderBy: { initiatedAt: "desc" },
				skip,
				take: parseInt(limit),
			}),
			prisma.paymentTransaction.count({ where }),
		]);

		const totalPages = Math.ceil(total / parseInt(limit));

		res.status(200).json({
			success: true,
			message: "Payment history retrieved successfully",
			data: {
				transactions,
				pagination: {
					currentPage: parseInt(page),
					totalPages,
					totalItems: total,
					itemsPerPage: parseInt(limit),
					hasNextPage: parseInt(page) < totalPages,
					hasPrevPage: parseInt(page) > 1,
				},
			},
		});
	} catch (error) {
		console.error("Get user payments error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to retrieve payment history",
		});
	}
});

/**
 * @desc    Handle webhook from payment provider
 * @route   POST /api/payments/webhook/:provider
 * @access  Public (but secured with signature verification)
 */
const handleWebhook = asyncHandler(async (req, res) => {
	const { provider } = req.params;
	const signature =
		req.headers["x-razorpay-signature"] || req.headers["x-webhook-signature"];
	const payload = req.body;

	try {
		// Process webhook through service
		const result = await PaymentService.processWebhook(
			provider,
			payload,
			signature
		);

		res.status(200).json({
			success: true,
			message: result.message,
			webhookId: result.webhookId,
		});
	} catch (error) {
		console.error("Webhook processing error:", error);

		// Return 200 to prevent webhook retries for invalid signatures
		res.status(200).json({
			success: false,
			message: error.message,
		});
	}
});

/**
 * @desc    Calculate payment total (for preview)
 * @route   POST /api/payments/calculate
 * @access  Private (User)
 */
const calculatePaymentTotal = asyncHandler(async (req, res) => {
	const { referenceType, referenceId } = req.body;
	const userId = req.user.id;

	try {
		let calculation;

		switch (referenceType) {
			case "EVENT_REGISTRATION":
				calculation =
					await PaymentService.calculateEventRegistrationTotal(referenceId);
				break;
			case "EVENT_PAYMENT":
				calculation = await PaymentService.calculateEventPaymentTotal(
					referenceId,
					req.user.id,
					req.body.registrationData
				);
				break;
			case "MERCHANDISE":
				calculation =
					await PaymentService.calculateMerchandiseTotal(referenceId);
				break;
			case "MERCHANDISE_ORDER": // STANDALONE MERCHANDISE
				calculation = await PaymentService.calculateStandaloneMerchandiseTotal(
					req.user.id
				); // Use userId, not referenceId
				break;

			case "MEMBERSHIP": // ADD THIS CASE
				calculation = await PaymentService.calculateMembershipTotal(
					req.user.id
				);
				break;
			case "BATCH_ADMIN_PAYMENT": // ADD THIS CASE
				// For batch admin payments, we just validate the amount from request
				// since it's a simple payment without complex calculations
				const { amount } = req.body;
				if (!amount || amount <= 0) {
					throw new Error("Valid payment amount is required");
				}
				calculation = {
					breakdown: {
						paymentAmount: parseFloat(amount),
						total: parseFloat(amount),
					},
					items: [
						{
							type: "batch_admin_payment",
							description: "Batch collection contribution",
							amount: parseFloat(amount),
						},
					],
				};
				break;

			case "DONATION":
				// For donations, amount should be provided in metadata
				const donationAmount = req.body.amount || req.body.customAmount;
				if (!donationAmount || donationAmount <= 0) {
					return res.status(400).json({
						success: false,
						message: "Donation amount is required and must be greater than 0",
					});
				}

				calculation = {
					success: true,
					breakdown: {
						donationAmount: parseFloat(donationAmount),
						subtotal: parseFloat(donationAmount),
						processingFee: 0, // No processing fee for donations
						total: parseFloat(donationAmount),
					},
					items: [
						{
							type: "donation",
							description: `Organization Donation${req.body.message ? " - " + req.body.message : ""}`,
							amount: parseFloat(donationAmount),
						},
					],
					user: await prisma.user.findUnique({
						where: { id: userId },
						select: {
							fullName: true,
							email: true,
							whatsappNumber: true,
							batchYear: true,
						},
					}),
				};
				break;

			default:
				return res.status(400).json({
					success: false,
					message: `Unsupported reference type: ${referenceType}`,
				});
		}

		res.status(200).json({
			success: true,
			message: "Payment calculation completed",
			data: calculation,
		});
	} catch (error) {
		console.error("Payment calculation error:", error);
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
});

// =============================================
// ADMIN CONTROLLERS
// =============================================

/**
 * @desc    Get all payments (Admin)
 * @route   GET /api/admin/payments
 * @access  Private (Admin)
 */
const getAdminPayments = asyncHandler(async (req, res) => {
	const {
		page = 1,
		limit = 10,
		status,
		provider,
		referenceType,
		search,
		fromDate,
		toDate,
	} = req.query;

	try {
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Build filter conditions
		const where = {};
		if (status) where.status = status;
		if (provider) where.provider = provider;
		if (referenceType) where.referenceType = referenceType;

		// Date range filter
		if (fromDate || toDate) {
			where.initiatedAt = {};
			if (fromDate) where.initiatedAt.gte = new Date(fromDate);
			if (toDate) where.initiatedAt.lte = new Date(toDate);
		}

		// Search filter
		if (search) {
			where.OR = [
				{ transactionNumber: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } },
				{ user: { fullName: { contains: search, mode: "insensitive" } } },
				{ user: { email: { contains: search, mode: "insensitive" } } },
			];
		}

		// Get transactions with user info
		const [transactions, total] = await Promise.all([
			prisma.paymentTransaction.findMany({
				where,
				include: {
					user: {
						select: {
							fullName: true,
							email: true,
							whatsappNumber: true,
						},
					},
				},
				orderBy: { initiatedAt: "desc" },
				skip,
				take: parseInt(limit),
			}),
			prisma.paymentTransaction.count({ where }),
		]);

		const totalPages = Math.ceil(total / parseInt(limit));

		res.status(200).json({
			success: true,
			message: "Admin payments retrieved successfully",
			data: {
				transactions,
				pagination: {
					currentPage: parseInt(page),
					totalPages,
					totalItems: total,
					itemsPerPage: parseInt(limit),
					hasNextPage: parseInt(page) < totalPages,
					hasPrevPage: parseInt(page) > 1,
				},
			},
		});
	} catch (error) {
		console.error("Get admin payments error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to retrieve payments",
		});
	}
});

/**
 * @desc    Get payment analytics (Admin)
 * @route   GET /api/admin/payments/analytics
 * @access  Private (Admin)
 */
const getPaymentAnalytics = asyncHandler(async (req, res) => {
	const { fromDate, toDate, groupBy = "day" } = req.query;

	try {
		// Date range setup
		const startDate = fromDate
			? new Date(fromDate)
			: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const endDate = toDate ? new Date(toDate) : new Date();

		// Get payment statistics
		const [statusStats, providerStats, referenceTypeStats, totalAmount] =
			await Promise.all([
				// Status distribution
				prisma.paymentTransaction.groupBy({
					by: ["status"],
					where: {
						initiatedAt: {
							gte: startDate,
							lte: endDate,
						},
					},
					_count: { _all: true },
					_sum: { amount: true },
				}),

				// Provider distribution
				prisma.paymentTransaction.groupBy({
					by: ["provider"],
					where: {
						initiatedAt: {
							gte: startDate,
							lte: endDate,
						},
					},
					_count: { _all: true },
					_sum: { amount: true },
				}),

				// Reference type distribution
				prisma.paymentTransaction.groupBy({
					by: ["referenceType"],
					where: {
						initiatedAt: {
							gte: startDate,
							lte: endDate,
						},
					},
					_count: { _all: true },
					_sum: { amount: true },
				}),

				// Total amount
				prisma.paymentTransaction.aggregate({
					where: {
						status: "COMPLETED",
						initiatedAt: {
							gte: startDate,
							lte: endDate,
						},
					},
					_sum: { amount: true },
					_count: { _all: true },
				}),
			]);

		res.status(200).json({
			success: true,
			message: "Payment analytics retrieved successfully",
			data: {
				overview: {
					totalAmount: totalAmount._sum.amount || 0,
					totalTransactions: totalAmount._count,
					dateRange: { fromDate: startDate, toDate: endDate },
				},
				statusDistribution: statusStats,
				providerDistribution: providerStats,
				referenceTypeDistribution: referenceTypeStats,
			},
		});
	} catch (error) {
		console.error("Get payment analytics error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to retrieve payment analytics",
		});
	}
});

/**
 * @desc    Get payment details (Admin)
 * @route   GET /api/admin/payments/:transactionId
 * @access  Private (Admin)
 */
const getAdminPaymentDetails = asyncHandler(async (req, res) => {
	const { transactionId } = req.params;

	try {
		const transaction = await prisma.paymentTransaction.findUnique({
			where: { id: transactionId },
			include: {
				user: {
					select: {
						fullName: true,
						email: true,
						whatsappNumber: true,
						batch: true,
					},
				},
				webhooks: {
					orderBy: { receivedAt: "desc" },
					take: 10,
				},
				invoices: true,
			},
		});

		if (!transaction) {
			return res.status(404).json({
				success: false,
				message: "Transaction not found",
			});
		}

		res.status(200).json({
			success: true,
			message: "Payment details retrieved successfully",
			data: { transaction },
		});
	} catch (error) {
		console.error("Get admin payment details error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to retrieve payment details",
		});
	}
});

module.exports = {
	// User payment endpoints
	initiatePayment,
	verifyPayment,
	getPaymentStatus,
	getUserPayments,
	calculatePaymentTotal,

	// Webhook endpoint
	handleWebhook,

	// Admin endpoints
	getAdminPayments,
	getPaymentAnalytics,
	getAdminPaymentDetails,
};
