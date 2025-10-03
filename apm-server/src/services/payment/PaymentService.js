// =============================================
// FILE 5: src/services/payment/PaymentService.js
// =============================================
// Create this file: src/services/payment/PaymentService.js

const { PrismaClient } = require("@prisma/client");
const PaymentProviderFactory = require("./PaymentProviderFactory");
const paymentConfig = require("../../config/payment");
const emailManager = require("../email/EmailManager");
const MembershipService = require("../membership/membership.service");
const BatchPaymentService = require("./batchPayment.service");
const NotificationService = require("../notification.service");

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

	// Calculate total payment for event payment (before registration exists)
	async calculateEventPaymentTotal(eventId, userId, registrationData = {}) {
		try {
			const event = await prisma.event.findUnique({
				where: { id: eventId },
				select: {
					id: true,
					title: true,
					registrationFee: true,
					guestFee: true,
					status: true,
					registrationStartDate: true,
					registrationEndDate: true,
					eventDate: true,
					maxCapacity: true,
				},
			});

			if (!event) {
				throw new Error("Event not found");
			}

			// Check if event is active and accepting registrations
			const validStatusesForRegistration = ["PUBLISHED", "REGISTRATION_OPEN"];
			if (!validStatusesForRegistration.includes(event.status)) {
				throw new Error(`Event status '${event.status}' does not allow registration. Event must be PUBLISHED or REGISTRATION_OPEN.`);
			}

			const now = new Date();
			if (event.registrationStartDate && now < new Date(event.registrationStartDate)) {
				throw new Error("Registration has not started yet");
			}

			if (event.registrationEndDate && now > new Date(event.registrationEndDate)) {
				throw new Error("Registration deadline has passed");
			}

			// Check capacity
			if (event.maxCapacity) {
				const currentRegistrationCount = await prisma.eventRegistration.count({
					where: {
						eventId: eventId,
						status: "CONFIRMED"
					}
				});
				
				if (currentRegistrationCount >= event.maxCapacity) {
					throw new Error("Event is full");
				}
			}

			// Check if user is already registered
			const existingRegistration = await prisma.eventRegistration.findFirst({
				where: {
					eventId,
					userId,
					status: "CONFIRMED",
				},
			});

			if (existingRegistration) {
				throw new Error("You are already registered for this event");
			}

			// Get user data
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					fullName: true,
					email: true,
					whatsappNumber: true,
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			// Calculate fees
			const registrationFee = parseFloat(event.registrationFee || 0);
			const guestCount = registrationData?.guests ? registrationData.guests.length : 0;
			const guestFees = guestCount * parseFloat(event.guestFee || 0);
			const donationAmount = parseFloat(registrationData?.donationAmount || 0);

			const subtotal = registrationFee + guestFees + donationAmount;
			const processingFee = this.calculateProcessingFee(subtotal);
			const total = subtotal + processingFee;

			return {
				success: true,
				breakdown: {
					registrationFee,
					guestCount,
					guestFees,
					donationAmount,
					subtotal,
					processingFee,
					total,
				},
				items: [
					{
						type: "registration",
						description: `Event Registration - ${event.title}`,
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
					...(donationAmount > 0
						? [
								{
									type: "donation",
									description: "Event Support Donation",
									amount: donationAmount,
								},
							]
						: []),
				],
				user,
				metadata: {
					eventId,
					hasGuests: guestCount > 0,
					registrationData,
				},
			};
		} catch (error) {
			console.error("Event payment calculation failed:", error);
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

	// Standalone Merchandise Calculation
	async calculateStandaloneMerchandiseTotal(userId) {
		try {
			// Get user's cart items from standalone merchandise system
			const cartItems = await prisma.merchandiseCartItem.findMany({
				where: { userId },
				include: {
					merchandise: {
						select: {
							id: true,
							name: true,
							price: true,
							stock: true,
							isActive: true,
						},
					},
				},
			});

			if (cartItems.length === 0) {
				throw new Error("Cart is empty");
			}

			// Validate cart items
			for (const item of cartItems) {
				if (!item.merchandise.isActive) {
					throw new Error(`${item.merchandise.name} is no longer available`);
				}
				if (item.merchandise.stock < item.quantity) {
					throw new Error(`Insufficient stock for ${item.merchandise.name}`);
				}
			}

			// Calculate totals
			const subtotal = cartItems.reduce((sum, item) => {
				return sum + item.merchandise.price * item.quantity;
			}, 0);

			const processingFee = this.calculateProcessingFee(subtotal);
			const total = subtotal + processingFee;

			return {
				success: true,
				breakdown: {
					subtotal: parseFloat(subtotal.toFixed(2)),
					processingFee: parseFloat(processingFee.toFixed(2)),
					total: parseFloat(total.toFixed(2)),
				},
				items: cartItems.map((item) => ({
					type: "merchandise",
					description: `${item.merchandise.name} ${item.selectedSize ? `(${item.selectedSize})` : ""} x${item.quantity}`,
					amount: parseFloat(
						(item.merchandise.price * item.quantity).toFixed(2)
					),
					merchandiseId: item.merchandise.id,
					quantity: item.quantity,
					selectedSize: item.selectedSize,
				})),
				user: await prisma.user.findUnique({
					where: { id: userId },
					select: {
						fullName: true,
						email: true,
						whatsappNumber: true,
					},
				}),
			};
		} catch (error) {
			console.error("Calculate standalone merchandise total error:", error);
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
				case "EVENT_PAYMENT":
					console.log('=== INITIATE PAYMENT - EVENT_PAYMENT CASE ===');
					console.log('Calling calculateEventPaymentTotal with:', { referenceId, userId, registrationData: paymentData.registrationData });
					calculation = await this.calculateEventPaymentTotal(referenceId, userId, paymentData.registrationData);
					console.log('Calculation result:', calculation);
					console.log('============================================');
					break;
				case "MERCHANDISE":
					calculation = await this.calculateMerchandiseTotal(referenceId);
					break;
				case "MEMBERSHIP":
					calculation = await this.calculateMembershipTotal(userId);
					break;
				case "MERCHANDISE_ORDER": // STANDALONE MERCHANDISE
					calculation =
						await this.calculateStandaloneMerchandiseTotal(referenceId); // referenceId = userId for standalone
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

			// Handle post-transaction operations (QR code, invoice generation)
			if (transaction._postTransactionOps) {
				const ops = transaction._postTransactionOps;
				
				// Generate QR code for EVENT_PAYMENT registrations
				if (ops.type === 'EVENT_PAYMENT') {
					try {
						console.log(`🔄 Generating QR code for registration: ${ops.registrationId}`);
						const QRCodeService = require("../qr/QRCodeService");
						await QRCodeService.generateQRCode(ops.registrationId);
						console.log("✅ QR code generated successfully after payment");
					} catch (qrError) {
						console.error("❌ Post-transaction QR code generation failed:", qrError);
					}

					// Generate invoice for EVENT_PAYMENT
					try {
						console.log(`🔄 Generating invoice for transaction: ${ops.transactionId}`);
						const InvoiceService = require("./InvoiceService");
						await InvoiceService.generateInvoice(ops.transactionId);
						console.log("✅ Invoice generated successfully after payment");
					} catch (invoiceError) {
						console.error("❌ Post-transaction invoice generation failed:", invoiceError);
					}
				}
			}

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

				// 🚨 Generate QR code for event registration
				setTimeout(async () => {
					try {
						const QRCodeService = require("../qr/QRCodeService");
						await QRCodeService.generateQRCode(referenceId); // referenceId = registrationId
						console.log("✅ Event registration QR code generated successfully");
					} catch (qrError) {
						console.error(
							"❌ Event registration QR code generation failed:",
							qrError
						);
					}
				}, 200);

				// Send payment confirmation email
				try {
					if (emailManager.isInitialized) {
						const emailService = emailManager.getService();

						// Get registration and event details for email
						const registrationDetails = await tx.eventRegistration.findUnique({
							where: { id: referenceId },
							include: {
								event: {
									select: {
										id: true,
										title: true,
										eventDate: true,
										venue: true,
										eventMode: true,
									},
								},
								user: {
									select: {
										id: true,
										fullName: true,
										email: true,
									},
								},
							},
						});

						if (registrationDetails) {
							await emailService.sendPaymentConfirmation(
								registrationDetails.user,
								transaction,
								registrationDetails.event
							);
							console.log(
								"✅ Event registration payment confirmation email sent"
							);
						}
					}
				} catch (emailError) {
					console.error("❌ Payment confirmation email failed:", emailError);
				}

				// 🎯 ENHANCEMENT: Create success notification
				setTimeout(async () => {
					try {
						await NotificationService.createAndSendNotification({
							recipientIds: [transaction.userId],
							type: "PAYMENT_SUCCESS",
							title: "✅ Event Registration Confirmed!",
							message: `Your payment of ₹${transaction.amount.toLocaleString("en-IN")} was successful. QR code has been generated for event check-in.`,
							data: {
								transactionId: transaction.id,
								transactionNumber: transaction.transactionNumber,
								registrationId: referenceId,
								amount: transaction.amount,
								paymentDate: new Date().toISOString(),
							},
							priority: "HIGH",
							channels: ["PUSH", "IN_APP"],
							relatedEntityType: "EVENT_REGISTRATION",
							relatedEntityId: referenceId,
						});

						console.log("✅ Event registration success notification sent");
					} catch (notificationError) {
						console.error("❌ Success notification failed:", notificationError);
					}
				}, 300);

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

				// Send merchandise payment confirmation email
				try {
					if (emailManager.isInitialized) {
						const emailService = emailManager.getService();
						const user = await tx.user.findUnique({
							where: { id: transaction.userId },
							select: {
								id: true,
								fullName: true,
								email: true,
								batchYear: true,
							},
						});

						if (user) {
							await emailService.sendPaymentConfirmation(
								user,
								transaction,
								null
							);
							console.log("✅ Merchandise payment confirmation email sent");
						}
					}
				} catch (emailError) {
					console.error(
						"Merchandise payment confirmation email failed:",
						emailError
					);
				}

				// ADD: Send push notification
				await this.sendPaymentSuccessNotification(transaction, tx);

				break;

			case "MEMBERSHIP":
				// Process membership payment
				await MembershipService.processMembershipPayment(
					transaction.userId,
					transaction.id,
					transaction.amount
				);

				// Send membership confirmation email
				try {
					if (emailManager.isInitialized) {
						const emailService = emailManager.getService();
						const user = await tx.user.findUnique({
							where: { id: transaction.userId },
							select: {
								id: true,
								fullName: true,
								email: true,
								batchYear: true,
							},
						});

						if (user) {
							await emailService.sendMembershipConfirmation(
								user,
								transaction,
								null
							);
							console.log("✅ Membership confirmation email sent");
						}
					}
				} catch (emailError) {
					console.error("Membership confirmation email failed:", emailError);
				}

				// ADD: Send push notification
				await this.sendPaymentSuccessNotification(transaction, tx);

				console.log(`✅ Membership activated for user: ${transaction.userId}`);
				break;

			case "BATCH_ADMIN_PAYMENT":
				await BatchPaymentService.processBatchPaymentSuccess(
					transaction.id,
					data
				);

				// Send batch payment confirmation email
				try {
					if (emailManager.isInitialized) {
						const emailService = emailManager.getService();
						const user = await tx.user.findUnique({
							where: { id: transaction.userId },
							select: {
								id: true,
								fullName: true,
								email: true,
								batchYear: true,
							},
						});

						if (user) {
							await emailService.sendPaymentConfirmation(
								user,
								transaction,
								null
							);
							console.log("✅ Batch payment confirmation email sent");
						}
					}
				} catch (emailError) {
					console.error("Batch payment confirmation email failed:", emailError);
				}

				// ADD: Send push notification
				await this.sendPaymentSuccessNotification(transaction, tx);

				console.log(`✅ Batch admin payment processed: ${transaction.userId}`);
				break;

			// STANDALONE MERCHANDISE
			case "MERCHANDISE_ORDER":
				// Find the order by ID
				const order = await tx.merchandiseOrder.findUnique({
					where: { id: referenceId },
					include: {
						items: {
							include: {
								merchandise: { select: { id: true } },
							},
						},
					},
				});

				if (order) {
					// Update order status
					await tx.merchandiseOrder.update({
						where: { id: referenceId },
						data: {
							status: "CONFIRMED",
							paymentStatus: "COMPLETED",
							paymentTransactionId: transaction.id,
						},
					});

					// Update stock quantities
					for (const item of order.items) {
						await tx.merchandise.update({
							where: { id: item.merchandiseId },
							data: {
								stock: { decrement: item.quantity },
							},
						});
					}

					// Clear user cart
					await tx.merchandiseCartItem.deleteMany({
						where: { userId: transaction.userId },
					});

					// Generate QR code for delivery tracking
					setTimeout(async () => {
						try {
							const QRCodeService = require("../qr/QRCodeService");
							await QRCodeService.generateMerchandiseOrderQR(referenceId);
							console.log("✅ Merchandise order QR code generated");
						} catch (qrError) {
							console.error("QR code generation failed:", qrError);
						}
					}, 200);

					// Send confirmation email (async, don't wait)
					setTimeout(async () => {
						try {
							const MerchandiseNotificationService = require("../../merchandiseNotification.service");
							await MerchandiseNotificationService.sendOrderConfirmationEmail(
								referenceId
							);
						} catch (emailError) {
							console.error("Order confirmation email failed:", emailError);
						}
					}, 100);
				}

				// Send push notification
				await this.sendPaymentSuccessNotification(transaction, tx);

				break;

			case "DONATION":
				// Send donation confirmation email
				try {
					if (emailManager.isInitialized) {
						const emailService = emailManager.getService();
						const user = await tx.user.findUnique({
							where: { id: transaction.userId },
							select: {
								id: true,
								fullName: true,
								email: true,
								batchYear: true,
							},
						});

						if (user) {
							await emailService.sendDonationConfirmation(
								user,
								transaction,
								null
							);
							console.log("✅ Donation confirmation email sent");
						}
					}
				} catch (emailError) {
					console.error("Donation confirmation email failed:", emailError);
				}

				// Log donation activity for analytics
				await tx.activityLog.create({
					data: {
						userId: transaction.userId,
						action: "donation_completed",
						details: {
							transactionId: transaction.id,
							amount: transaction.amount,
							donationType:
								transaction.metadata?.donationType || "ORGANIZATION",
							message: transaction.metadata?.message || null,
						},
						ipAddress: null,
						userAgent: null,
					},
				});

				// ADD: Send push notification
				await this.sendPaymentSuccessNotification(transaction, tx);

				console.log(
					`✅ Donation processed: ₹${transaction.amount} from user ${transaction.userId}`
				);
				break;

			case "EVENT_PAYMENT":
				// Create event registration after successful payment
				const { eventId, registrationData } = transaction.metadata;
				
				// Create the registration
				const guestCount = registrationData?.guests?.length || 0;
				const newRegistration = await tx.eventRegistration.create({
					data: {
						userId: transaction.userId,
						eventId: referenceId, // referenceId is the event ID for EVENT_PAYMENT
						status: "CONFIRMED",
						paymentStatus: "COMPLETED",
						paymentTransactionId: transaction.id,
						totalAmountPaid: transaction.amount,
						lastPaymentAt: new Date(),
						mealPreference: registrationData?.mealPreference || null,
						donationAmount: parseFloat(registrationData?.donationAmount || 0),
						totalAmount: transaction.amount,
						registrationFeePaid: parseFloat(transaction.breakdown?.registrationFee || 0),
						guestFeesPaid: parseFloat(transaction.breakdown?.guestFees || 0),
						totalGuests: guestCount,
						activeGuests: guestCount,
					},
				});

				// Create guest registrations if any
				if (registrationData?.guests && registrationData.guests.length > 0) {
					const guestData = registrationData.guests.map(guest => ({
						registrationId: newRegistration.id,
						name: guest.name,
						email: guest.email || null,
						phone: guest.phone || null,
						mealPreference: guest.mealPreference || null,
						status: "ACTIVE",
						createdAt: new Date(),
					}));

					await tx.eventGuest.createMany({
						data: guestData,
					});
				}

				// Note: Event registration count is now calculated dynamically via COUNT queries when needed

				// Store registration ID for post-transaction operations
				const registrationId = newRegistration.id;

				// Send payment confirmation email
				try {
					if (emailManager.isInitialized) {
						const emailService = emailManager.getService();

						// Get event details for email
						const eventDetails = await tx.event.findUnique({
							where: { id: referenceId },
							select: {
								id: true,
								title: true,
								eventDate: true,
								startTime: true,
								endTime: true,
								venue: true,
								eventMode: true,
								meetingLink: true,
							},
						});

						const user = await tx.user.findUnique({
							where: { id: transaction.userId },
							select: {
								id: true,
								fullName: true,
								email: true,
							},
						});

						if (eventDetails && user) {
							// Fetch the complete registration with guest details for email
							const registrationForEmail = await tx.eventRegistration.findUnique({
								where: { id: newRegistration.id },
								include: {
									guests: true,
									event: true,
									user: {
										select: {
											id: true,
											fullName: true,
											email: true
										}
									}
								}
							});

							if (registrationForEmail) {
								console.log("📧 About to call sendRegistrationConfirmation with:", {
									userId: user.id,
									userEmail: user.email,
									eventTitle: eventDetails.title,
									registrationId: registrationForEmail.id
								});
								
								await emailService.sendRegistrationConfirmation(
									user,
									eventDetails,
									registrationForEmail
								);
							} else {
								console.error("❌ Failed to fetch registration for email");
							}
							console.log("✅ Event registration confirmation email sent successfully");

							// Send push notification for successful registration
							try {
								const PushNotificationService = require("../../utils/push-notification.util");
								
								// Send push notification using sendToToken method (mock mode for development)
								const pushResult = await PushNotificationService.sendToToken({
									token: 'mock-device-token', // In production, fetch actual device token from user
									title: '🎉 Registration Confirmed!',
									body: `You're successfully registered for ${eventDetails.title}. Check your email for details.`,
									data: {
										type: 'EVENT_REGISTRATION_SUCCESS',
										eventId: eventDetails.id,
										registrationId: newRegistration.id,
									},
									priority: 'normal'
								});
								
								if (pushResult.success) {
									console.log("✅ Event registration push notification sent successfully");
								} else {
									console.error("⚠️ Push notification failed:");
									console.error("Error details:", pushResult.error);
									console.error("Error message:", pushResult.message);
								}
							} catch (pushError) {
								console.error("❌ Event registration push notification failed:", pushError);
							}
						}
					}
				} catch (emailError) {
					console.error("❌ Event payment confirmation email failed:");
					console.error("Error details:", emailError.message);
					console.error("Stack trace:", emailError.stack);
					console.error("Email manager initialized:", emailManager.isInitialized);
				}

				// Send success notification
				setTimeout(async () => {
					try {
						await NotificationService.createAndSendNotification({
							recipientIds: [transaction.userId],
							type: "PAYMENT_SUCCESS",
							title: "✅ Event Registration Confirmed!",
							message: `Your payment of ₹${transaction.amount.toLocaleString("en-IN")} was successful. You are now registered for the event!`,
							data: {
								transactionId: transaction.id,
								transactionNumber: transaction.transactionNumber,
								registrationId: newRegistration.id,
								amount: transaction.amount,
								paymentDate: new Date().toISOString(),
							},
							priority: "HIGH",
							channels: ["PUSH", "IN_APP"],
							relatedEntityType: "EVENT_REGISTRATION",
							relatedEntityId: newRegistration.id,
						});

						console.log("✅ Event payment success notification sent");
					} catch (notificationError) {
						console.error("❌ Event payment success notification failed:", notificationError);
					}
				}, 300);

				console.log(`✅ Event payment processed and registration created: ${newRegistration.id}`);
				
				// Store for post-transaction operations
				transaction._postTransactionOps = {
					type: 'EVENT_PAYMENT',
					registrationId: newRegistration.id,
					transactionId: transaction.id
				};
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
			// Skip logging if userId is null for now to avoid constraint issues
			if (!userId) {
				console.log(`Activity skipped (no userId): ${action}`, details);
				return;
			}
			
			await prisma.activityLog.create({
				data: {
					userId,
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
	async calculateBatchAdminPaymentTotal(batchCollectionId, amount) {
		try {
			// Validate the batch collection exists
			const collection = await prisma.batchEventCollection.findUnique({
				where: { id: batchCollectionId },
				include: {
					event: { select: { title: true } },
					batch: { select: { batchYear: true } },
				},
			});

			if (!collection) {
				throw new Error("Batch collection not found");
			}

			if (collection.status !== "ACTIVE") {
				throw new Error("Batch collection is not accepting payments");
			}

			const remainingAmount =
				collection.targetAmount - collection.collectedAmount;
			if (amount > remainingAmount) {
				throw new Error(
					`Payment amount exceeds remaining target (₹${remainingAmount})`
				);
			}

			return {
				breakdown: {
					paymentAmount: parseFloat(amount),
					total: parseFloat(amount),
				},
				items: [
					{
						type: "batch_admin_payment",
						description: `Batch collection - ${collection.event.title} (Batch ${collection.batch.batchYear})`,
						amount: parseFloat(amount),
					},
				],
				metadata: {
					batchCollectionId: collection.id,
					eventTitle: collection.event.title,
					batchYear: collection.batch.batchYear,
				},
			};
		} catch (error) {
			console.error("Calculate batch admin payment total error:", error);
			throw error;
		}
	}

	async initiateDonationPayment(donationData) {
		try {
			const {
				referenceType,
				referenceId,
				userId,
				description,
				calculation,
				metadata,
			} = donationData;

			// Generate transaction number
			const provider = PaymentProviderFactory.create();
			const transactionNumber = provider.generateTransactionNumber();

			// Create payment transaction record
			const transaction = await prisma.paymentTransaction.create({
				data: {
					transactionNumber,
					amount: calculation.breakdown.total,
					currency: "INR",
					description,
					referenceType,
					referenceId,
					breakdown: calculation.breakdown,
					userId,
					status: "PENDING",
					provider: "RAZORPAY",
					metadata: metadata || null,
					expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
				},
			});

			// Create payment order with provider
			const orderData = await provider.createOrder({
				amount: calculation.breakdown.total * 100, // Convert to paise
				currency: "INR",
				receipt: transactionNumber,
				notes: {
					transactionId: transaction.id,
					referenceType,
					referenceId,
					userId,
					donationType: metadata?.donationType || "ORGANIZATION",
				},
			});

			// Update transaction with provider order data
			await prisma.paymentTransaction.update({
				where: { id: transaction.id },
				data: {
					razorpayOrderId: orderData.id,
					providerOrderData: orderData,
				},
			});

			// Generate payment URL
			const paymentUrl = provider.generatePaymentUrl({
				orderId: orderData.id,
				amount: calculation.breakdown.total * 100,
				currency: "INR",
				name: "JNV Alumni Organization",
				description,
				prefill: {
					name: calculation.user.fullName,
					email: calculation.user.email,
					contact: calculation.user.whatsappNumber,
				},
				notes: orderData.notes,
				callback_url: `${process.env.BASE_URL}/api/payments/${transaction.id}/verify`,
				cancel_url: `${process.env.BASE_URL}/donation/cancelled`,
			});

			return {
				success: true,
				transaction: {
					id: transaction.id,
					transactionNumber,
					amount: transaction.amount,
					razorpayOrderId: orderData.id,
				},
				paymentUrl,
			};
		} catch (error) {
			console.error("Initiate donation payment error:", error);
			throw error;
		}
	}

	async sendPaymentSuccessNotification(transaction, tx) {
		try {
			// Get payment type display name
			const paymentTypeNames = {
				EVENT_REGISTRATION: "Event Registration",
				MERCHANDISE: "Merchandise Purchase",
				MEMBERSHIP: "Membership Fee",
				BATCH_ADMIN_PAYMENT: "Batch Payment",
				MERCHANDISE_ORDER: "Merchandise Order",
				DONATION: "Donation",
			};

			const paymentTypeName =
				paymentTypeNames[transaction.referenceType] || "Payment";

			// Create push notification
			await NotificationService.createAndSendNotification({
				recipientIds: [transaction.userId],
				type: "PAYMENT_SUCCESS",
				title: "✅ Payment Successful",
				message: `Your ${paymentTypeName} payment of ₹${transaction.amount.toLocaleString("en-IN")} was successful!`,
				data: {
					transactionId: transaction.id,
					transactionNumber: transaction.transactionNumber,
					amount: transaction.amount,
					referenceType: transaction.referenceType,
					referenceId: transaction.referenceId,
					paymentDate: new Date().toISOString(),
				},
				priority: "HIGH",
				channels: ["PUSH", "IN_APP"],
				relatedEntityType: "PAYMENT_TRANSACTION",
				relatedEntityId: transaction.id,
			});

			console.log(
				`✅ Push notification sent for ${transaction.referenceType} payment`
			);
			return true;
		} catch (pushError) {
			console.error("Push notification failed:", pushError);
			return false;
		}
	}
}

module.exports = new PaymentService();
