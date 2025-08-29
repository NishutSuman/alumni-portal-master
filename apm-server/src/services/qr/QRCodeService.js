// src/services/qr/QRCodeService.js
const QRCode = require("qrcode");
const crypto = require("crypto");
const { prisma } = require("../../config/database");
const { CacheService } = require("../../config/redis");

class QRCodeService {
	constructor() {
		this.cacheKeys = {
			qrCode: (registrationId) => `qr:registration:${registrationId}`,
			qrData: (qrCode) => `qr:data:${qrCode}`,
			checkInStats: (eventId) => `checkin:stats:${eventId}`,
		};
	}

	/**
	 * Generate QR code for registration
	 */
	async generateQRCode(registrationId) {
		try {
			// Get registration with all related data
			const registration = await prisma.eventRegistration.findUnique({
				where: { id: registrationId },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							batch: true,
							profileImage: true,
						},
					},
					event: {
						select: {
							id: true,
							title: true,
							eventDate: true,
							venue: true,
							eventMode: true,
						},
					},
					guests: {
						where: { status: "ACTIVE" },
						select: {
							id: true,
							name: true,
							email: true,
							phone: true,
							mealPreference: true,
						},
					},
					merchandiseOrders: {
						include: {
							merchandise: {
								select: {
									name: true,
									price: true,
								},
							},
						},
					},
				},
			});

			if (!registration) {
				throw new Error("Registration not found");
			}

			// Check if QR already exists and is active
			let existingQR = await prisma.registrationQR.findUnique({
				where: { registrationId },
			});

			if (existingQR && existingQR.isActive) {
				return {
					qrCode: existingQR.qrCode,
					qrData: existingQR.qrData,
					qrImageUrl: await this.generateQRImageURL(existingQR.qrCode),
					generatedAt: existingQR.generatedAt,
					isNew: false,
				};
			}

			// Create comprehensive QR data
			const qrData = {
				registrationId: registration.id,
				eventId: registration.eventId,
				userId: registration.userId,
				user: registration.user,
				event: registration.event,
				registration: {
					status: registration.status,
					registrationDate: registration.registrationDate,
					totalAmount: Number(registration.totalAmount),
					paymentStatus: registration.paymentStatus,
					mealPreference: registration.mealPreference,
				},
				guests: registration.guests,
				merchandise: registration.merchandiseOrders.map((order) => ({
					id: order.id,
					name: order.merchandise.name,
					quantity: order.quantity,
					selectedSize: order.selectedSize,
					totalPrice: Number(order.totalPrice),
				})),
				summary: {
					totalGuests: registration.totalGuests,
					totalAmount: Number(registration.totalAmount),
					hasMerchandise: registration.merchandiseOrders.length > 0,
					hasGuests: registration.guests.length > 0,
				},
				generatedAt: new Date().toISOString(),
				version: "1.0",
			};

			// Generate unique QR code hash
			const qrCode = this.generateQRHash(qrData);

			// Create or update QR record
			const qr = await prisma.registrationQR.upsert({
				where: { registrationId },
				update: {
					qrCode,
					qrData,
					generatedAt: new Date(),
					isActive: true,
					scanCount: 0,
				},
				create: {
					registrationId,
					qrCode,
					qrData,
					isActive: true,
				},
			});

			// Generate QR image URL
			const qrImageUrl = await this.generateQRImageURL(qrCode);

			// Cache the QR data
			await CacheService.set(
				this.cacheKeys.qrCode(registrationId),
				{ qrCode, qrData, qrImageUrl },
				60 * 60 // 1 hour
			);

			await CacheService.set(
				this.cacheKeys.qrData(qrCode),
				qrData,
				60 * 60 // 1 hour
			);

			return {
				qrCode: qr.qrCode,
				qrData: qr.qrData,
				qrImageUrl,
				generatedAt: qr.generatedAt,
				isNew: !existingQR,
			};
		} catch (error) {
			console.error("QR code generation error:", error);
			throw error;
		}
	}

	/**
	 * Generate QR code image URL/data
	 */
	async generateQRImageURL(qrCode) {
		try {
			// Generate QR code as data URL
			const qrImageData = await QRCode.toDataURL(qrCode, {
				errorCorrectionLevel: "M",
				type: "image/png",
				quality: 0.92,
				margin: 2,
				color: {
					dark: "#000000",
					light: "#FFFFFF",
				},
				width: 256,
			});

			return qrImageData;
		} catch (error) {
			console.error("QR image generation error:", error);
			return null;
		}
	}

	/**
	 * Validate and decode QR code
	 */
	async validateQRCode(qrCode) {
		try {
			// Try cache first
			const cachedData = await CacheService.get(this.cacheKeys.qrData(qrCode));
			if (cachedData) {
				return { isValid: true, data: cachedData, source: "cache" };
			}

			// Get from database
			const qr = await prisma.registrationQR.findUnique({
				where: { qrCode, isActive: true },
				include: {
					registration: {
						include: {
							user: true,
							event: true,
							guests: { where: { status: "ACTIVE" } },
						},
					},
				},
			});

			if (!qr) {
				return { isValid: false, error: "Invalid QR code" };
			}

			// Check if event is still valid for check-in
			const event = qr.registration.event;
			const eventDate = new Date(event.eventDate);
			const now = new Date();
			const timeDiff = now - eventDate;

			// Allow check-in from 2 hours before to 4 hours after event start
			const allowedWindow = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
			const startWindow = 2 * 60 * 60 * 1000; // 2 hours before

			if (timeDiff < -startWindow || timeDiff > allowedWindow) {
				return {
					isValid: false,
					error: "Check-in window is closed for this event",
				};
			}

			// Cache the data
			await CacheService.set(
				this.cacheKeys.qrData(qrCode),
				qr.qrData,
				30 * 60 // 30 minutes
			);

			return {
				isValid: true,
				data: qr.qrData,
				qrRecord: qr,
				source: "database",
			};
		} catch (error) {
			console.error("QR validation error:", error);
			return { isValid: false, error: "QR validation failed" };
		}
	}

	/**
	 * Get QR code analytics
	 */
	async getQRAnalytics(eventId) {
		try {
			const stats = await prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT qr.id) as total_qr_generated,
          COUNT(DISTINCT CASE WHEN qr.scan_count > 0 THEN qr.id END) as qr_scanned,
          AVG(qr.scan_count) as avg_scans_per_qr,
          COUNT(DISTINCT ci.id) as total_checkins,
          COUNT(DISTINCT ci.registration_id) as unique_registrations_checked_in
        FROM registration_qr qr
        JOIN event_registrations er ON qr.registration_id = er.id
        LEFT JOIN event_check_ins ci ON qr.registration_id = ci.registration_id
        WHERE er.event_id = ${eventId}
          AND qr.is_active = true
      `;

			return {
				qrGenerated: Number(stats[0]?.total_qr_generated || 0),
				qrScanned: Number(stats[0]?.qr_scanned || 0),
				averageScansPerQR: Number(stats[0]?.avg_scans_per_qr || 0),
				totalCheckIns: Number(stats[0]?.total_checkins || 0),
				uniqueCheckIns: Number(stats[0]?.unique_registrations_checked_in || 0),
			};
		} catch (error) {
			console.error("QR analytics error:", error);
			return null;
		}
	}

	/**
	 * Generate unique QR hash
	 */
	generateQRHash(qrData) {
		const dataString = JSON.stringify({
			registrationId: qrData.registrationId,
			eventId: qrData.eventId,
			userId: qrData.userId,
			timestamp: Date.now(),
		});

		return crypto
			.createHash("sha256")
			.update(dataString)
			.digest("hex")
			.substring(0, 32); // 32 character hash
	}

	/**
	 * Generate QR code for merchandise order (delivery tracking)
	 */
	async generateMerchandiseOrderQR(orderId) {
		try {
			// Get order with all related data
			const order = await prisma.merchandiseOrder.findUnique({
				where: { id: orderId },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							batchYear: true,
							profileImage: true,
						},
					},
					items: {
						include: {
							merchandise: {
								select: {
									id: true,
									name: true,
									price: true,
									images: true,
									category: true,
								},
							},
						},
					},
					paymentTransaction: {
						select: {
							id: true,
							transactionNumber: true,
							completedAt: true,
						},
					},
				},
			});

			if (!order) {
				throw new Error("Merchandise order not found");
			}

			// Check if QR already exists
			if (order.qrCode && order.qrData) {
				const qrImageUrl = await this.generateQRImageURL(order.qrCode);
				return {
					qrCode: order.qrCode,
					qrData: order.qrData,
					qrImageUrl,
					generatedAt: order.updatedAt,
					isNew: false,
				};
			}

			// Create comprehensive QR data for merchandise delivery
			const qrData = {
				orderId: order.id,
				orderNumber: order.orderNumber,
				userId: order.userId,
				user: {
					name: order.user.fullName,
					email: order.user.email,
					batch: order.user.batchYear,
				},
				order: {
					status: order.status,
					orderDate: order.createdAt,
					totalAmount: Number(order.totalAmount),
					paymentStatus: order.paymentStatus,
					deliveryStatus: order.deliveryStatus || "PENDING",
				},
				items: order.items.map((item) => ({
					id: item.id,
					name: item.merchandise.name,
					category: item.merchandise.category,
					quantity: item.quantity,
					selectedSize: item.selectedSize,
					unitPrice: Number(item.unitPrice),
					totalPrice: Number(item.totalPrice),
					image: item.merchandise.images[0] || null,
				})),
				payment: order.paymentTransaction
					? {
							transactionNumber: order.paymentTransaction.transactionNumber,
							paidAt: order.paymentTransaction.completedAt,
						}
					: null,
				summary: {
					totalItems: order.items.length,
					totalQuantity: order.items.reduce(
						(sum, item) => sum + item.quantity,
						0
					),
					totalAmount: Number(order.totalAmount),
				},
				generatedAt: new Date().toISOString(),
				version: "1.0",
				type: "MERCHANDISE_DELIVERY",
			};

			// Generate unique QR code hash
			const qrCode = this.generateQRHash(qrData);

			// Update order with QR code data using existing fields
			const updatedOrder = await prisma.merchandiseOrder.update({
				where: { id: orderId },
				data: {
					qrCode: qrCode,
					qrData: qrData,
				},
			});

			// Generate QR image URL
			const qrImageUrl = await this.generateQRImageURL(qrCode);

			// Cache the QR data
			await CacheService.set(
				`qr:merchandise_order:${orderId}`,
				{ qrCode, qrData, qrImageUrl },
				60 * 60 // 1 hour
			);

			await CacheService.set(
				`qr:merchandise_delivery:${qrCode}`,
				qrData,
				60 * 60 // 1 hour
			);

			return {
				qrCode: updatedOrder.qrCode,
				qrData: updatedOrder.qrData,
				qrImageUrl,
				generatedAt: updatedOrder.updatedAt,
				isNew: true,
			};
		} catch (error) {
			console.error("Generate merchandise order QR error:", error);
			throw error;
		}
	}

	/**
	 * Get QR code data for merchandise order
	 */
	async getMerchandiseOrderQR(orderId) {
		try {
			// Check cache first
			const cached = await CacheService.get(`qr:merchandise_order:${orderId}`);
			if (cached) {
				return cached;
			}

			// Get from database
			const order = await prisma.merchandiseOrder.findUnique({
				where: { id: orderId },
				select: {
					qrCode: true,
					qrData: true,
					updatedAt: true,
				},
			});

			if (!order || !order.qrCode) {
				return null;
			}

			const qrImageUrl = await this.generateQRImageURL(order.qrCode);
			const result = {
				qrCode: order.qrCode,
				qrData: order.qrData,
				qrImageUrl,
				generatedAt: order.updatedAt,
			};

			// Cache the result
			await CacheService.set(
				`qr:merchandise_order:${orderId}`,
				result,
				60 * 60
			);

			return result;
		} catch (error) {
			console.error("Get merchandise order QR error:", error);
			throw error;
		}
	}

	/**
	 * Scan QR code for merchandise delivery
	 */
	async scanMerchandiseQR(qrCode, scannedBy) {
		try {
			// Get QR data from cache or database
			let qrData = await CacheService.get(`qr:merchandise_delivery:${qrCode}`);

			if (!qrData) {
				const order = await prisma.merchandiseOrder.findFirst({
					where: { qrCode },
					select: { id: true, qrData: true },
				});

				if (!order) {
					throw new Error("Invalid QR code");
				}

				qrData = order.qrData;
			}

			// Update order with scan information (optional)
			await prisma.merchandiseOrder.update({
				where: { id: qrData.orderId },
				data: {
					// You can add scan tracking fields if needed
					updatedAt: new Date(),
				},
			});

			// Log scan activity
			await prisma.activityLog.create({
				data: {
					userId: scannedBy,
					action: "merchandise_qr_scanned",
					details: {
						qrCode,
						orderId: qrData.orderId,
						orderNumber: qrData.orderNumber,
						scannedAt: new Date(),
					},
				},
			});

			return {
				success: true,
				orderData: qrData,
				message: "QR code scanned successfully",
			};
		} catch (error) {
			console.error("Scan merchandise QR error:", error);
			throw error;
		}
	}
}

module.exports = new QRCodeService();
