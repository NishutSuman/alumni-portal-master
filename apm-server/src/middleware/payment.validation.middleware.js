// src/middleware/payment.validation.middleware.js
// Payment validation middleware following existing patterns

const Joi = require("joi");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// =============================================
// PAYMENT VALIDATION SCHEMAS
// =============================================

const paymentSchemas = {
	// Payment initiation validation
	initiatePayment: Joi.object({
		referenceType: Joi.string()
			.valid(
				"EVENT_REGISTRATION",
				"MERCHANDISE",
				"GUEST_FEES",
				"ADDITIONAL_FEES",
				"DONATION"
			)
			.required()
			.messages({
				"any.only":
					"Reference type must be one of: EVENT_REGISTRATION, MERCHANDISE, GUEST_FEES, ADDITIONAL_FEES, DONATION",
				"any.required": "Reference type is required",
			}),

		referenceId: Joi.string().uuid().required().messages({
			"string.uuid": "Reference ID must be a valid UUID",
			"any.required": "Reference ID is required",
		}),

		description: Joi.string().trim().min(5).max(200).optional().messages({
			"string.min": "Description must be at least 5 characters",
			"string.max": "Description cannot exceed 200 characters",
		}),
	}),

	// Payment verification validation
	verifyPayment: Joi.object({
		razorpay_order_id: Joi.string().required().messages({
			"any.required": "Razorpay order ID is required",
		}),

		razorpay_payment_id: Joi.string().required().messages({
			"any.required": "Razorpay payment ID is required",
		}),

		razorpay_signature: Joi.string().required().messages({
			"any.required": "Razorpay signature is required",
		}),
	}),

	// Payment calculation validation
	calculatePayment: Joi.object({
		referenceType: Joi.string()
			.valid("EVENT_REGISTRATION", "MERCHANDISE")
			.required()
			.messages({
				"any.only": "Reference type must be EVENT_REGISTRATION or MERCHANDISE",
				"any.required": "Reference type is required",
			}),

		referenceId: Joi.string().uuid().required().messages({
			"string.uuid": "Reference ID must be a valid UUID",
			"any.required": "Reference ID is required",
		}),
	}),

	// Admin payment list validation
	adminPaymentList: Joi.object({
		page: Joi.number().integer().min(1).optional().default(1),

		limit: Joi.number().integer().min(1).max(100).optional().default(10),

		status: Joi.string()
			.valid(
				"PENDING",
				"PROCESSING",
				"COMPLETED",
				"FAILED",
				"CANCELLED",
				"REFUNDED",
				"PARTIALLY_REFUNDED",
				"EXPIRED"
			)
			.optional(),

		provider: Joi.string()
			.valid("RAZORPAY", "PAYTM", "PHONEPE", "STRIPE")
			.optional(),

		referenceType: Joi.string()
			.valid(
				"EVENT_REGISTRATION",
				"MERCHANDISE",
				"GUEST_FEES",
				"ADDITIONAL_FEES",
				"DONATION"
			)
			.optional(),

		search: Joi.string().trim().max(100).optional(),

		fromDate: Joi.date().optional(),

		toDate: Joi.date().min(Joi.ref("fromDate")).optional().messages({
			"date.min": "To date must be after from date",
		}),
	}),

	// Payment analytics validation
	paymentAnalytics: Joi.object({
		fromDate: Joi.date().optional(),

		toDate: Joi.date().min(Joi.ref("fromDate")).optional().messages({
			"date.min": "To date must be after from date",
		}),

		groupBy: Joi.string()
			.valid("day", "week", "month")
			.optional()
			.default("day"),
	}),

	// Parameter validation schemas
	transactionIdParam: Joi.object({
		transactionId: Joi.string().uuid().required().messages({
			"string.uuid": "Transaction ID must be a valid UUID",
			"any.required": "Transaction ID is required",
		}),
	}),

	providerParam: Joi.object({
		provider: Joi.string()
			.valid("razorpay", "paytm", "phonepe")
			.required()
			.messages({
				"any.only": "Provider must be one of: razorpay, paytm, phonepe",
				"any.required": "Provider is required",
			}),
	}),

	// Invoice email resend validation
	resendInvoiceEmail: Joi.object({
		email: Joi.string().email().optional().messages({
			"string.email": "Email must be a valid email address",
		}),
	}),
};

// =============================================
// GENERIC VALIDATION MIDDLEWARE FACTORY
// =============================================

const validatePayment = (schemaName, property = "body") => {
	return (req, res, next) => {
		const schema = paymentSchemas[schemaName];

		if (!schema) {
			return res.status(500).json({
				success: false,
				message: "Payment validation schema not found",
			});
		}

		const { error, value } = schema.validate(req[property], {
			abortEarly: false,
			stripUnknown: true,
			convert: true,
		});

		if (error) {
			const errors = error.details.map((detail) => ({
				field: detail.path.join("."),
				message: detail.message,
			}));

			return res.status(400).json({
				success: false,
				message: "Payment validation failed",
				errors,
			});
		}

		req[property] = value;
		next();
	};
};

// =============================================
// PAYMENT PARAMETER VALIDATION
// =============================================

const validatePaymentParams = (schemaName) => {
	return (req, res, next) => {
		const schema = paymentSchemas[schemaName];

		if (!schema) {
			return res.status(500).json({
				success: false,
				message: "Payment parameter validation schema not found",
			});
		}

		const { error, value } = schema.validate(req.params, {
			abortEarly: false,
			stripUnknown: true,
		});

		if (error) {
			const errors = error.details.map((detail) => ({
				field: detail.path.join("."),
				message: detail.message,
			}));

			return res.status(400).json({
				success: false,
				message: "Payment parameter validation failed",
				errors,
			});
		}

		req.params = value;
		next();
	};
};

// =============================================
// BUSINESS RULES VALIDATION
// =============================================

/**
 * Validate payment initiation business rules
 */
const validatePaymentInitiationRules = async (req, res, next) => {
	const { referenceType, referenceId } = req.body;
	const userId = req.user.id;

	try {
		const errors = [];

		switch (referenceType) {
			case "EVENT_REGISTRATION":
				await validateEventRegistrationPayment(referenceId, userId, errors);
				break;

			case "MERCHANDISE":
				await validateMerchandisePayment(referenceId, userId, errors);
				break;

			default:
				errors.push({
					field: "referenceType",
					message: `Payment type ${referenceType} validation not implemented`,
				});
		}

		if (errors.length > 0) {
			return res.status(400).json({
				success: false,
				message: "Payment business rules validation failed",
				errors,
			});
		}

		next();
	} catch (error) {
		console.error("Payment business rules validation error:", error);
		return res.status(500).json({
			success: false,
			message: "Payment validation failed",
		});
	}
};

/**
 * Validate event registration payment eligibility
 */
async function validateEventRegistrationPayment(
	registrationId,
	userId,
	errors
) {
	const registration = await prisma.eventRegistration.findUnique({
		where: { id: registrationId },
		include: {
			event: {
				select: {
					title: true,
					status: true,
					eventDate: true,
					registrationEndDate: true,
				},
			},
		},
	});

	if (!registration) {
		errors.push({
			field: "referenceId",
			message: "Event registration not found",
		});
		return;
	}

	// Check ownership
	if (registration.userId !== userId) {
		errors.push({
			field: "referenceId",
			message: "You can only pay for your own registration",
		});
		return;
	}

	// Check if already paid
	if (registration.paymentStatus === "COMPLETED") {
		errors.push({
			field: "referenceId",
			message: "Registration payment already completed",
		});
		return;
	}

	// Check event status
	if (registration.event.status === "CANCELLED") {
		errors.push({
			field: "referenceId",
			message: "Cannot pay for cancelled event",
		});
		return;
	}

	// Check registration deadline
	if (
		registration.event.registrationEndDate &&
		new Date() > new Date(registration.event.registrationEndDate)
	) {
		errors.push({
			field: "referenceId",
			message: "Registration deadline has passed",
		});
		return;
	}
}

/**
 * Validate merchandise payment eligibility
 */
async function validateMerchandisePayment(registrationId, userId, errors) {
	const registration = await prisma.eventRegistration.findUnique({
		where: { id: registrationId },
		include: {
			event: {
				select: {
					title: true,
					hasMerchandise: true,
					status: true,
					eventDate: true,
				},
			},
			merchandiseOrders: {
				where: { paymentStatus: "PENDING" },
				select: { id: true },
			},
		},
	});

	if (!registration) {
		errors.push({
			field: "referenceId",
			message: "Event registration not found",
		});
		return;
	}

	// Check ownership
	if (registration.userId !== userId) {
		errors.push({
			field: "referenceId",
			message: "You can only pay for your own merchandise orders",
		});
		return;
	}

	// Check if event has merchandise
	if (!registration.event.hasMerchandise) {
		errors.push({
			field: "referenceId",
			message: "This event does not have merchandise",
		});
		return;
	}

	// Check if there are pending orders
	if (registration.merchandiseOrders.length === 0) {
		errors.push({
			field: "referenceId",
			message: "No pending merchandise orders found",
		});
		return;
	}

	// Check event status
	if (registration.event.status === "CANCELLED") {
		errors.push({
			field: "referenceId",
			message: "Cannot pay for merchandise from cancelled event",
		});
		return;
	}
}

/**
 * Validate payment verification ownership
 */
const validatePaymentVerificationRules = async (req, res, next) => {
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
				status: true,
				expiresAt: true,
			},
		});

		if (!transaction) {
			return res.status(404).json({
				success: false,
				message: "Transaction not found or access denied",
			});
		}

		// Check if transaction is expired
		if (transaction.expiresAt && new Date() > new Date(transaction.expiresAt)) {
			return res.status(400).json({
				success: false,
				message: "Transaction has expired",
			});
		}

		// Store transaction data for controller use
		req.transactionData = transaction;
		next();
	} catch (error) {
		console.error("Payment verification rules validation error:", error);
		return res.status(500).json({
			success: false,
			message: "Payment verification validation failed",
		});
	}
};

/**
 * Validate webhook signature and headers
 */
const validateWebhookRequest = (req, res, next) => {
	const { provider } = req.params;

	// Check for required signature header
	const signature =
		req.headers["x-razorpay-signature"] || req.headers["x-webhook-signature"];

	if (!signature) {
		return res.status(400).json({
			success: false,
			message: "Webhook signature missing",
		});
	}

	// Validate webhook content type
	if (!req.is("application/json")) {
		return res.status(400).json({
			success: false,
			message: "Webhook must be application/json",
		});
	}

	// Store signature for controller use
	req.webhookSignature = signature;
	next();
};

// =============================================
// SPECIFIC VALIDATION MIDDLEWARE EXPORTS
// =============================================

// Payment operation validations
const validateInitiatePayment = validatePayment("initiatePayment");
const validateVerifyPayment = validatePayment("verifyPayment");
const validateCalculatePayment = validatePayment("calculatePayment");

// Parameter validations
const validateTransactionIdParam = validatePaymentParams("transactionIdParam");
const validateProviderParam = validatePaymentParams("providerParam");

// Admin validations
const validateAdminPaymentList = validatePayment("adminPaymentList", "query");
const validatePaymentAnalytics = validatePayment("paymentAnalytics", "query");

const validateResendInvoiceEmail = validatePayment('resendInvoiceEmail');

module.exports = {
	// Schema validation
	validatePayment,
	validatePaymentParams,

	// Business rules validation
	validatePaymentInitiationRules,
	validatePaymentVerificationRules,
	validateWebhookRequest,

	// Specific validations
	validateInitiatePayment,
	validateVerifyPayment,
	validateCalculatePayment,
	validateTransactionIdParam,
	validateProviderParam,
	validateAdminPaymentList,
	validatePaymentAnalytics,
	validateResendInvoiceEmail,

	// Export schemas for testing
	paymentSchemas,
};
