// =============================================
// FILE 5: src/services/payment/PaymentService.js
// =============================================
// Create this file: src/services/payment/PaymentService.js

const { PrismaClient } = require("@prisma/client");
const PaymentProviderFactory = require("./PaymentProviderFactory");
const paymentConfig = require("../../config/payment");
const emailManager = require("../email/EmailManager");
const MembershipService = require("../membership.service");
const BatchPaymentService = require("./batchPayment.service");

const prisma = new PrismaClient();

class PaymentService {
	constructor() {
		this.config = paymentConfig;
	}

	// Calculate total payment for event registration
	async calculateEventRegistrationTotal(registrationId) {
		try {
			const registration = await prisma.eventRegistration.findUnique({
				where: { id: registrationId },
				include: {
					event: {
						select: {
							registrationFee: true,
							guestFee: true,
							title: true,
						},
					},
					user: {
						select: {
							fullName: true,
							email: true,
							whatsappNumber: true,
						},
					},
					guests: {
						where: { status: "ACTIVE" },
						select: { id: true, name: true },
					},
					merchandiseOrders: {
						where: {
							paymentStatus: { in: ["PENDING"] },
						},
						select: {
							quantity: true,
							sizeSelected: true,
							priceAtTime: true,
							merchandise: {
								select: { name: true },
							},
						},
					},
				},
			});

			if (!registration) {
				throw new Error("Registration not found");
			}

			// Calculate breakdown
			const registrationFee = parseFloat(
				registration.event.registrationFee || 0
			);
			const guestCount = registration.guests.length;
			const guestFees =
				guestCount * parseFloat(registration.event.guestFee || 0);

			// Calculate pending merchandise total
			const merchandiseTotal = registration.merchandiseOrders.reduce(
				(total, order) => {
					return total + parseFloat(order.priceAtTime) * order.quantity;
				},
				0
			);

			const subtotal = registrationFee + guestFees + merchandiseTotal;
			const processingFee = this.calculateProcessingFee(subtotal);
			const total = subtotal + processingFee;

			return {
				success: true,
				breakdown: {
					registrationFee,
					guestCount,
					guestFees,
					merchandiseTotal,
					subtotal,
					processingFee,
					total,
				},
				items: [
					{
						type: "registration",
						description: `Event Registration - ${registration.event.title}`,
						amount: registrationFee,
					},
					...(guestCount > 0
						? [
								{
									type: "guests",
									description: `Guest Fees (${guestCount} guests)`,
									amount: guestFees,
								},
							]
						: []),
					...registration.merchandiseOrders.map((order) => ({
						type: "merchandise",
						description: `${order.merchandise.name} (${order.sizeSelected || "No Size"}) x${order.quantity}`,
						amount: parseFloat(order.priceAtTime) * order.quantity,
					})),
				],
				user: registration.user,
				metadata: {
					registrationId,
					eventId: registration.eventId,
					hasGuests: guestCount > 0,
					hasMerchandise: merchandiseTotal > 0,
				},
			};
		} catch (error) {
			console.error("Payment calculation failed:", error);
			throw error;
		}
	}

	// Calculate merchandise-only payment
	async calculateMerchandiseTotal(registrationId) {
		try {
			const registration = await prisma.eventRegistration.findUnique({
				where: { id: registrationId },
				include: {
					event: { select: { title: true } },
					user: {
						select: {
							fullName: true,
							email: true,
							whatsappNumber: true,
						},
					},
					merchandiseOrders: {
						where: {
							paymentStatus: "PENDING",
						},
						include: {
							merchandise: {
								select: { name: true },
							},
						},
					},
				},
			});

			if (!registration || registration.merchandiseOrders.length === 0) {
				throw new Error("No pending merchandise orders found");
			}

			const merchandiseTotal = registration.merchandiseOrders.reduce(
				(total, order) => {
					return total + parseFloat(order.priceAtTime) * order.quantity;
				},
				0
			);

			const processingFee = this.calculateProcessingFee(merchandiseTotal);
			const total = merchandiseTotal + processingFee;

			return {
				success: true,
				breakdown: {
					merchandiseTotal,
					processingFee,
					total,
				},
				items: registration.merchandiseOrders.map((order) => ({
					type: "merchandise",
					description: `${order.merchandise.name} (${order.sizeSelected || "No Size"}) x${order.quantity}`,
					amount: parseFloat(order.priceAtTime) * order.quantity,
					orderId: order.id,
				})),
				user: registration.user,
				metadata: {
					registrationId,
					eventId: registration.eventId,
					orderIds: registration.merchandiseOrders.map((o) => o.id),
				},
			};
		} catch (error) {
			console.error("Merchandise payment calculation failed:", error);
			throw error;
		}
	}

	// Initiate payment transaction
	async initiatePayment(paymentData) {
		try {
			const { referenceType, referenceId, userId, description } = paymentData;

			// Calculate payment total based on reference type
			let calculation;
			switch (referenceType) {
				case "EVENT_REGISTRATION":
					calculation = await this.calculateEventRegistrationTotal(referenceId);
					break;
				case "MERCHANDISE":
					calculation = await this.calculateMerchandiseTotal(referenceId);
					break;
				case "MEMBERSHIP":
					calculation = await this.calculateMembershipTotal(userId);
					break;
				default:
					throw new Error(`Unsupported reference type: ${referenceType}`);
			}

			if (calculation.breakdown.total <= 0) {
				throw new Error("Payment amount must be greater than 0");
			}

			// Generate transaction number
			const provider = PaymentProviderFactory.create();
			const transactionNumber = provider.generateTransactionNumber();

			// Create payment transaction record
			const transaction = await prisma.paymentTransaction.create({
				data: {
					transactionNumber,
					amount: calculation.breakdown.total,
					currency: "INR",
					description:
						description ||
						`Payment for ${referenceType.toLowerCase().replace("_", " ")}`,
					referenceType,
					referenceId,
					breakdown: calculation.breakdown,
					provider: this.config.defaultProvider,
					status: "PENDING",
					userId,
					expiresAt: new Date(
						Date.now() + this.config.settings.paymentTimeout * 60 * 1000
					),
					metadata: calculation.metadata,
				},
			});

			// Create order with payment provider
			const orderData = {
				transactionNumber,
				amount: calculation.breakdown.total,
				currency: "INR",
				description: transaction.description,
				referenceType,
				referenceId,
				userId,
				user: calculation.user,
			};

			const orderResult = await provider.createOrder(orderData);

			if (!orderResult.success) {
				throw new Error("Failed to create payment order");
			}

			// Update transaction with provider order data
			const updatedTransaction = await prisma.paymentTransaction.update({
				where: { id: transaction.id },
				data: {
					razorpayOrderId: orderResult.providerOrderId,
					providerOrderData: orderResult.providerOrderData,
					expiresAt: orderResult.expiresAt,
				},
				include: {
					user: {
						select: {
							fullName: true,
							email: true,
							whatsappNumber: true,
						},
					},
				},
			});

			// Generate payment link/options
			const paymentLink = await provider.generatePaymentLink({
				...orderData,
				providerOrderId: orderResult.providerOrderId,
				user: calculation.user,
			});

			// Log activity
			await this.logActivity(userId, "payment_initiated", {
				transactionId: transaction.id,
				transactionNumber,
				amount: calculation.breakdown.total,
				referenceType,
				referenceId,
			});

			return {
				success: true,
				transaction: {
					id: updatedTransaction.id,
					transactionNumber: updatedTransaction.transactionNumber,
					amount: updatedTransaction.amount,
					currency: updatedTransaction.currency,
					description: updatedTransaction.description,
					status: updatedTransaction.status,
					expiresAt: updatedTransaction.expiresAt,
				},
				breakdown: calculation.breakdown,
				items: calculation.items,
				provider: {
					name: this.config.defaultProvider,
					orderId: orderResult.providerOrderId,
					checkoutOptions: paymentLink.checkoutOptions,
				},
			};
		} catch (error) {
			console.error("Payment initiation failed:", error);
			throw error;
		}
	}

	// Calculate Membership Total
	async calculateMembershipTotal(userId) {
		try {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { batch: true, fullName: true, email: true },
			});

			if (!user) {
				throw new Error("User not found");
			}

			const feeInfo = await MembershipService.getMembershipFee(user.batch);

			if (feeInfo.fee <= 0) {
				throw new Error("Membership fee not configured for your batch");
			}

			return {
				breakdown: {
					membershipFee: parseFloat(feeInfo.fee),
					total: parseFloat(feeInfo.fee),
				},
				user: user,
				metadata: {
					membershipYear: new Date().getFullYear(),
					batchYear: user.batch,
					feeType: feeInfo.type,
				},
			};
		} catch (error) {
			console.error("Membership payment calculation failed:", error);
			throw error;
		}
	}

	// Verify and complete payment
	async verifyPayment(verificationData) {
		const { transactionId, ...paymentData } = verificationData;

		try {
			// Fetch transaction
			const transaction = await prisma.paymentTransaction.findUnique({
				where: { id: transactionId },
				include: {
					user: {
						select: { fullName: true, email: true },
					},
				},
			});

			if (!transaction) {
				throw new Error("Transaction not found");
			}

			if (transaction.status === "COMPLETED") {
				return {
					success: true,
					alreadyCompleted: true,
					transaction,
				};
			}

			// Verify with payment provider
			const provider = PaymentProviderFactory.create(transaction.provider);
			const verificationResult = await provider.verifyPayment(paymentData);

			if (!verificationResult.success || !verificationResult.verified) {
				throw new Error(
					verificationResult.error || "Payment verification failed"
				);
			}

			// Update transaction in database transaction
			const result = await prisma.$transaction(async (tx) => {
				// Update payment transaction
				const updatedTransaction = await tx.paymentTransaction.update({
					where: { id: transactionId },
					data: {
						status: "COMPLETED",
						razorpayPaymentId: verificationResult.providerPaymentId,
						providerPaymentData: verificationResult.providerPaymentData,
						completedAt: verificationResult.completedAt || new Date(),
					},
				});

				// Update related records based on reference type
				await this.updateRelatedRecords(tx, transaction, verificationResult);

				return updatedTransaction;
			});

			// Log activity
			await this.logActivity(transaction.userId, "payment_completed", {
				transactionId,
				transactionNumber: transaction.transactionNumber,
				amount: transaction.amount,
				paymentId: verificationResult.providerPaymentId,
			});

			return {
				success: true,
				transaction: result,
				verificationResult,
			};
		} catch (error) {
			console.error("Payment verification failed:", error);

			// Log failed verification
			if (transactionId) {
				await this.logActivity(null, "payment_verification_failed", {
					transactionId,
					error: error.message,
				});
			}

			throw error;
		}
	}

	// Process webhook from payment provider
	async processWebhook(provider, payload, signature) {
		try {
			// Log webhook receipt
			const webhook = await prisma.paymentWebhook.create({
				data: {
					provider: provider.toUpperCase(),
					eventType: payload.event,
					eventId: payload.account_id || null,
					rawPayload: payload,
					signature,
					status: "RECEIVED",
					headers: {},
					receivedAt: new Date(),
				},
			});

			// Verify signature
			const paymentProvider = PaymentProviderFactory.create(provider);
			const isSignatureValid = await paymentProvider.verifyWebhookSignature(
				payload,
				signature
			);

			// Update webhook verification status
			await prisma.paymentWebhook.update({
				where: { id: webhook.id },
				data: {
					isSignatureValid,
					status: isSignatureValid ? "VERIFIED" : "FAILED",
				},
			});

			if (!isSignatureValid) {
				throw new Error("Webhook signature verification failed");
			}

			// Process webhook event
			const processingResult = await paymentProvider.processWebhook({
				event: payload.event,
				payload: payload.payload,
			});

			// Update related transaction if applicable
			if (processingResult.success && processingResult.data) {
				await this.handleWebhookUpdate(processingResult, webhook.id);
			}

			// Update webhook processing status
			await prisma.paymentWebhook.update({
				where: { id: webhook.id },
				data: {
					status: "PROCESSED",
					processedAt: new Date(),
				},
			});

			return {
				success: true,
				webhookId: webhook.id,
				action: processingResult.action,
				message: processingResult.message || "Webhook processed successfully",
			};
		} catch (error) {
			console.error("Webhook processing failed:", error);

			// Update webhook with error if webhook exists
			if (typeof webhook !== "undefined" && webhook?.id) {
				await prisma.paymentWebhook.update({
					where: { id: webhook.id },
					data: {
						status: "FAILED",
						errorMessage: error.message,
					},
				});
			}

			throw error;
		}
	}

	// Helper methods
	calculateProcessingFee(amount) {
		const fee = Math.max(amount * 0.02, 2); // 2% or minimum ₹2
		return Math.round(fee * 100) / 100;
	}

	async updateRelatedRecords(tx, transaction, verificationResult) {
		const { referenceType, referenceId } = transaction;

		switch (referenceType) {
			case "EVENT_REGISTRATION":
				await tx.eventRegistration.update({
					where: { id: referenceId },
					data: {
						paymentStatus: "COMPLETED",
						paymentTransactionId: transaction.id,
						totalAmountPaid: transaction.amount,
						lastPaymentAt: new Date(),
					},
				});

				// Update merchandise orders if any
				await tx.eventMerchandiseOrder.updateMany({
					where: {
						registrationId: referenceId,
						paymentStatus: "PENDING",
					},
					data: {
						paymentStatus: "COMPLETED",
						paymentTransactionId: transaction.id,
					},
				});

				// ✅ ADD THIS: Send payment confirmation email
				try {
					if (emailManager.isInitialized) {
						const emailService = emailManager.getService();

						// Get user and transaction details for email
						const user = await tx.user.findUnique({
							where: { id: transaction.userId },
							select: {
								id: true,
								fullName: true,
								email: true,
							},
						});

						if (user) {
							await emailService.sendPaymentConfirmation(
								user,
								transaction,
								null // invoice if available
							);
							console.log("✅ Payment confirmation email sent");
						}
					}
				} catch (emailError) {
					console.error("Payment confirmation email failed:", emailError);
				}
				break;

			case "MERCHANDISE":
				const orderIds = transaction.metadata?.orderIds || [];
				if (orderIds.length > 0) {
					await tx.eventMerchandiseOrder.updateMany({
						where: {
							id: { in: orderIds },
							paymentStatus: "PENDING",
						},
						data: {
							paymentStatus: "COMPLETED",
							paymentTransactionId: transaction.id,
						},
					});
				}
				break;

			case "MEMBERSHIP":
				// Process membership payment
				await MembershipService.processMembershipPayment(
					transaction.userId,
					transaction.id,
					transaction.amount
				);

				// Log membership activation
				console.log(`✅ Membership activated for user: ${transaction.userId}`);
				break;

			case "BATCH_ADMIN_PAYMENT":
				await BatchPaymentService.processBatchPaymentSuccess(
					transaction.id,
					data
				);
				console.log(`✅ Batch admin payment processed: ${transaction.userId}`);
				break;
		}
	}

	async handleWebhookUpdate(processingResult, webhookId) {
		const { action, data } = processingResult;

		if (action === "payment_captured" || action === "order_paid") {
			// Find transaction by provider order ID
			const transaction = await prisma.paymentTransaction.findFirst({
				where: { razorpayOrderId: data.providerOrderId },
			});

			if (transaction && transaction.status !== "COMPLETED") {
				await prisma.paymentTransaction.update({
					where: { id: transaction.id },
					data: {
						status: "COMPLETED",
						razorpayPaymentId: data.providerPaymentId,
						completedAt: data.completedAt || new Date(),
						providerPaymentData: data.providerData,
					},
				});

				// Update related records
				await this.updateRelatedRecords(prisma, transaction, data);
			}
		}
		if (
			action === "payment_failed" &&
			transaction.referenceType === "BATCH_ADMIN_PAYMENT"
		) {
			await BatchPaymentService.processBatchPaymentFailure(
				transaction.id,
				data
			);
		}
	}

	async logActivity(userId, action, details) {
		try {
			await prisma.activityLog.create({
				data: {
					userId: userId || "system",
					action,
					details,
					ipAddress: null,
					userAgent: null,
				},
			});
		} catch (error) {
			console.error("Failed to log activity:", error);
		}
	}
}

module.exports = new PaymentService();
