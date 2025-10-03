// src/services/email/EmailService.js
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const { prisma } = require("../../config/database");
const QRCodeService = require("../qr/QRCodeService");

class EmailService {
	constructor(provider) {
		this.provider = provider;
		this.templatesPath = path.join(__dirname, "../../templates/emails");
		this.compiledTemplates = new Map();
	}

	/**
	 * Initialize email service with provider
	 */
	static async create(provider) {
		const service = new EmailService(provider);
		await service.loadTemplates();
		return service;
	}

	/**
	 * Load and compile email templates
	 */
	async loadTemplates() {
		try {
			const templateFiles = [
				"registration-confirmation.html",
				"payment-confirmation.html",
				"guest-addition.html",
				"event-reminder.html",
				"bulk-announcement.html",
				"merchandise-confirmation.html",
				"birthday-wish.html",
				"festival-wish.html",
			];

			for (const fileName of templateFiles) {
				const filePath = path.join(this.templatesPath, fileName);
				if (fs.existsSync(filePath)) {
					const templateContent = fs.readFileSync(filePath, "utf8");
					const compiled = handlebars.compile(templateContent);
					const templateName = fileName.replace(".html", "");
					this.compiledTemplates.set(templateName, compiled);
				}
			}

			console.log(`✅ Loaded ${this.compiledTemplates.size} email templates`);
		} catch (error) {
			console.error("❌ Email template loading error:", error);
		}
	}

	/**
	 * Send registration confirmation email
	 */
	async sendRegistrationConfirmation(user, event, registration) {
		try {
			// ✅ TRY TO GET EXISTING QR CODE FOR EMAIL 
			let qrCodeData = { hasQRCode: false };
			try {
				// First try to get existing QR code from database
				const { PrismaClient } = require('@prisma/client');
				const prisma = new PrismaClient();
				
				const existingQR = await prisma.registrationQR.findUnique({
					where: { registrationId: registration.id },
					select: {
						qrCode: true,
						qrImageUrl: true,
						isActive: true
					}
				});

				if (existingQR && existingQR.isActive) {
					qrCodeData = {
						qrImageUrl: existingQR.qrImageUrl,
						qrCode: existingQR.qrCode,
						hasQRCode: true,
						registrationNumber: registration.id.slice(-8).toUpperCase(),
						checkInInstructions: "Present this QR code at the event entrance for quick check-in"
					};
					console.log("✅ Found existing QR code for registration email");
				} else {
					console.log("ℹ️ No QR code available yet - will be generated after transaction completes");
					qrCodeData = { 
						hasQRCode: false,
						registrationNumber: registration.id.slice(-8).toUpperCase()
					};
				}
				
				await prisma.$disconnect();
			} catch (qrError) {
				console.error("QR code lookup failed for email:", qrError);
				qrCodeData = { 
					hasQRCode: false,
					registrationNumber: registration.id.slice(-8).toUpperCase()
				};
			}

			// Format event time properly
			let eventTime = "TBD";
			if (event.startTime && event.endTime) {
				eventTime = `${event.startTime} - ${event.endTime}`;
			} else if (event.startTime) {
				eventTime = `${event.startTime}`;
			}

			// Format guest details for email
			const guestDetails = registration.guests?.map((guest, index) => ({
				guestNumber: index + 1,
				name: guest.name,
				email: guest.email || 'N/A',
				phone: guest.phone || 'N/A',
				mealPreference: guest.mealPreference || 'N/A'
			})) || [];

			const templateData = {
				userName: user.fullName,
				userEmail: user.email,
				eventTitle: event.title,
				eventDate: new Date(event.eventDate).toLocaleDateString(),
				eventTime: eventTime,
				eventVenue: event.venue || "TBD",
				eventMode: event.eventMode,
				registrationId: registration.id,
				totalAmount: registration.totalAmount,
				guestCount: registration.totalGuests,
				hasGuests: registration.totalGuests > 0,
				guestDetails: guestDetails,
				meetingLink: event.meetingLink,
				hasMeals: event.hasMeals,
				mealPreference: registration.mealPreference,
				registrationDate: new Date(
					registration.registrationDate
				).toLocaleDateString(),

				// ✅ NEW QR CODE DATA
				...qrCodeData,

				// Enhanced event details
				eventDateFormatted: new Date(event.eventDate).toLocaleDateString(
					"en-US",
					{
						weekday: "long",
						year: "numeric",
						month: "long",
						day: "numeric",
					}
				),
				registrationNumber: `REG-${registration.id.substring(0, 8).toUpperCase()}`,
				paymentStatus: registration.paymentStatus,
				checkInInstructions:
					event.eventMode === "VIRTUAL"
						? "Join the event using the meeting link provided"
						: "Show this QR code at the event entrance for quick check-in",
			};

			const subject = `✅ Registration Confirmed: ${event.title}`;
			const htmlContent = this.compiledTemplates.get(
				"registration-confirmation"
			)(templateData);

			const result = await this.provider.sendEmail(
				user.email,
				subject,
				htmlContent,
				templateData
			);

			// Enhanced logging
			await this.logEmailActivity(user.id, "registration_confirmation", {
				eventId: event.id,
				registrationId: registration.id,
				hasQRCode: qrCodeData.hasQRCode,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error("Registration confirmation email error:", error);
			throw error;
		}
	}

	/**
	 * Send payment confirmation email
	 */
	async sendPaymentConfirmation(user, transaction, eventOrInvoice) {
		try {
			// Determine if third parameter is event details or invoice
			const isEventDetails = eventOrInvoice && eventOrInvoice.title;
			const event = isEventDetails ? eventOrInvoice : null;
			const invoice = !isEventDetails ? eventOrInvoice : null;

			const templateData = {
				userName: user.fullName,
				userEmail: user.email,
				transactionNumber: transaction.transactionNumber,
				amount: transaction.amount,
				currency: transaction.currency,
				paymentDate: new Date(transaction.completedAt).toLocaleDateString(),
				paymentTime: new Date(transaction.completedAt).toLocaleTimeString(),
				paymentMethod: "UPI/Card",
				invoiceNumber: invoice?.invoiceNumber,
				breakdown: transaction.breakdown,
				invoiceUrl: invoice?.pdfUrl,
				// Event details
				eventTitle: event?.title,
				eventDate: event ? new Date(event.eventDate).toLocaleDateString('en-IN', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				}) : null,
				eventTime: event?.startTime && event?.endTime ? 
					`${event.startTime} - ${event.endTime}` : 
					event?.startTime || "Time TBD",
				eventVenue: event?.venue || "Venue TBD",
				eventMode: event?.eventMode,
				meetingLink: event?.meetingLink,
				// Registration details
				referenceType: transaction.referenceType,
				isEventRegistration: transaction.referenceType === 'EVENT_PAYMENT' || transaction.referenceType === 'EVENT_REGISTRATION',
				guestCount: transaction.breakdown?.guestCount || 0,
				donationAmount: transaction.breakdown?.donationAmount || 0,
			};

			const subject = event ? 
				`Event Registration Confirmed - ${event.title}` : 
				`Payment Confirmation - ${transaction.transactionNumber}`;
				
			const templateName = event ? "event-registration-confirmation" : "payment-confirmation";
			const htmlContent = this.compiledTemplates.get(templateName)(templateData);

			const result = await this.provider.sendEmail(
				user.email,
				subject,
				htmlContent,
				templateData
			);

			// Log email activity
			await this.logEmailActivity(user.id, "payment_confirmation", {
				transactionId: transaction.id,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error("Payment confirmation email error:", error);
			throw error;
		}
	}

	/**
	 * Send guest addition notification
	 */
	async sendGuestAdditionNotification(user, guest, event) {
		try {
			const templateData = {
				userName: user.fullName,
				guestName: guest.name,
				guestEmail: guest.email,
				eventTitle: event.title,
				eventDate: new Date(event.eventDate).toLocaleDateString(),
				guestFee: guest.feesPaid,
				mealPreference: guest.mealPreference,
			};

			const subject = `Guest Added: ${guest.name} for ${event.title}`;
			const htmlContent =
				this.compiledTemplates.get("guest-addition")(templateData);

			const result = await this.provider.sendEmail(
				user.email,
				subject,
				htmlContent,
				templateData
			);

			// Log email activity
			await this.logEmailActivity(user.id, "guest_addition", {
				eventId: event.id,
				guestId: guest.id,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error("Guest addition email error:", error);
			throw error;
		}
	}

	/**
	 * Send event reminder email
	 */
	async sendEventReminder(user, event, registration) {
		try {
			const templateData = {
				userName: user.fullName,
				eventTitle: event.title,
				eventDate: new Date(event.eventDate).toLocaleDateString(),
				eventTime: event.startTime || "TBD",
				eventVenue: event.venue || "TBD",
				meetingLink: event.meetingLink,
				guestCount: registration.totalGuests,
				mealPreference: registration.mealPreference,
				eventMode: event.eventMode,
			};

			const subject = `Reminder: ${event.title} Tomorrow`;
			const htmlContent =
				this.compiledTemplates.get("event-reminder")(templateData);

			const result = await this.provider.sendEmail(
				user.email,
				subject,
				htmlContent,
				templateData
			);

			// Log email activity
			await this.logEmailActivity(user.id, "event_reminder", {
				eventId: event.id,
				registrationId: registration.id,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error("Event reminder email error:", error);
			throw error;
		}
	}

	/**
	 * Send bulk email to multiple recipients
	 */
	async sendBulkEmail(recipients, subject, templateName, templateData) {
		try {
			const htmlContent =
				this.compiledTemplates.get(templateName)(templateData);
			const results = [];

			// Send emails in batches to avoid rate limits
			const batchSize = 10;
			for (let i = 0; i < recipients.length; i += batchSize) {
				const batch = recipients.slice(i, i + batchSize);
				const batchPromises = batch.map((recipient) =>
					this.provider.sendEmail(recipient.email, subject, htmlContent, {
						...templateData,
						userName: recipient.fullName,
					})
				);

				const batchResults = await Promise.allSettled(batchPromises);
				results.push(...batchResults);

				// Add delay between batches to respect rate limits
				if (i + batchSize < recipients.length) {
					await this.delay(1000); // 1 second delay
				}
			}

			// Log bulk email activity
			const successCount = results.filter(
				(r) => r.status === "fulfilled"
			).length;
			const failureCount = results.filter(
				(r) => r.status === "rejected"
			).length;

			await this.logEmailActivity("system", "bulk_email", {
				templateName,
				totalRecipients: recipients.length,
				successCount,
				failureCount,
				subject,
			});

			return {
				success: true,
				totalSent: recipients.length,
				successCount,
				failureCount,
				results,
			};
		} catch (error) {
			console.error("Bulk email error:", error);
			throw error;
		}
	}

	/**
	 * Send merchandise order confirmation
	 */
	async sendMerchandiseConfirmation(user, order, event) {
		try {
			const templateData = {
				userName: user.fullName,
				eventTitle: event.title,
				orderItems: order.items,
				totalAmount: order.totalPrice,
				orderDate: new Date(order.createdAt).toLocaleDateString(),
			};

			const subject = `Merchandise Order Confirmed: ${event.title}`;
			const htmlContent = this.compiledTemplates.get(
				"merchandise-confirmation"
			)(templateData);

			const result = await this.provider.sendEmail(
				user.email,
				subject,
				htmlContent,
				templateData
			);

			// Log email activity
			await this.logEmailActivity(user.id, "merchandise_confirmation", {
				orderId: order.id,
				eventId: event.id,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error("Merchandise confirmation email error:", error);
			throw error;
		}
	}

	/**
	 * Log email activity to database
	 */
	async logEmailActivity(userId, emailType, details) {
		try {
			// Skip logging if userId is null, "system", or undefined
			if (!userId || userId === "system") {
				console.log(`📧 Skipping activity log for system email: ${emailType}`);
				return;
			}

			await prisma.activityLog.create({
				data: {
					userId: userId,
					action: `email_${emailType}`,
					details: {
						emailType,
						...details,
						sentAt: new Date().toISOString(),
					},
				},
			});
		} catch (error) {
			console.error("Email activity logging error:", error);
			// Don't throw error - email sending should continue even if logging fails
		}
	}

	/**
	 * Utility delay function
	 */
	delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get email statistics
	 */
	async getEmailStats(dateRange = 7) {
		try {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - dateRange);

			const emailLogs = await prisma.activityLog.findMany({
				where: {
					action: {
						startsWith: "email_",
					},
					createdAt: {
						gte: startDate,
					},
				},
			});

			const stats = {
				totalEmails: emailLogs.length,
				emailTypes: {},
				successRate: 0,
				dailyStats: {},
			};

			emailLogs.forEach((log) => {
				const emailType = log.action.replace("email_", "");
				stats.emailTypes[emailType] = (stats.emailTypes[emailType] || 0) + 1;

				const date = log.createdAt.toISOString().split("T")[0];
				stats.dailyStats[date] = (stats.dailyStats[date] || 0) + 1;
			});

			return stats;
		} catch (error) {
			console.error("Email stats error:", error);
			return null;
		}
	}

	/**
	 * Send email verification email
	 */
	async sendVerificationEmail({ to, name, verificationLink }) {
		try {
			const subject = 'Verify Your Email - Alumni Portal';
			const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #3b82f6; margin: 0; font-size: 28px; }
        .content { margin-bottom: 30px; }
        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: linear-gradient(135deg, #1d4ed8, #1e3a8a); color: #ffffff !important; }
        .button:visited { color: #ffffff !important; }
        .button:active { color: #ffffff !important; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        .warning { background: #fef3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #f59e0b; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 Welcome to Alumni Portal!</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Thank you for registering with Alumni Portal. To complete your registration and start connecting with your fellow alumni, please verify your email address.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" class="button" style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Verify My Email</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> This verification link will expire in 24 hours for security reasons. If the link doesn't work, you can request a new one from the login page.
            </div>
            
            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px;">
                ${verificationLink}
            </p>
            
            <p><strong>What happens next?</strong></p>
            <ul>
                <li>✅ Verify your email address (you're here!)</li>
                <li>⏳ Wait for alumni verification (admin approval)</li>
                <li>🎉 Start connecting with your batch mates and alumni</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>This email was sent to ${to} because you registered for Alumni Portal.</p>
            <p>If you didn't sign up for this account, you can safely ignore this email.</p>
            <p>© ${new Date().getFullYear()} Alumni Portal. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

			const result = await this.provider.sendEmail(to, subject, htmlContent, { name, verificationLink });

			// Log email activity
			await this.logEmailActivity('system', 'verification_email', {
				recipientEmail: to,
				recipientName: name,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error('Verification email error:', error);
			throw error;
		}
	}

	/**
	 * Send password reset email
	 */
	async sendPasswordResetEmail({ to, name, resetLink, expiryHours = 1 }) {
		try {
			const subject = 'Reset Your Password - Alumni Portal';
			const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #ef4444; margin: 0; font-size: 28px; }
        .content { margin-bottom: 30px; }
        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #1e40af, #3b82f6); color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: linear-gradient(135deg, #1e3a8a, #1e40af); }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        .warning { background: #fee2e2; padding: 15px; border-radius: 5px; border-left: 4px solid #ef4444; margin: 20px 0; }
        .security-notice { background: #f0f9ff; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset Request</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${name},</h2>
            <p>We received a request to reset your password for your Alumni Portal account. If you made this request, click the button below to reset your password.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" class="button">Reset My Password</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Security Notice:</strong> This password reset link will expire in ${expiryHours} hour${expiryHours > 1 ? 's' : ''} for your security. You'll need to request a new link if it expires.
            </div>
            
            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px;">
                ${resetLink}
            </p>
            
            <div class="security-notice">
                <strong>🛡️ Didn't request this?</strong>
                <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged, and no action is needed.</p>
            </div>
            
            <p><strong>Security Tips:</strong></p>
            <ul>
                <li>🔒 Choose a strong, unique password</li>
                <li>📱 Consider using a password manager</li>
                <li>🚫 Never share your password with anyone</li>
                <li>🔄 Log out of shared devices after use</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>This email was sent to ${to} because a password reset was requested.</p>
            <p>If you're having trouble, please contact our support team.</p>
            <p>© ${new Date().getFullYear()} Alumni Portal. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

			const result = await this.provider.sendEmail(to, subject, htmlContent, { name, resetLink });

			// Log email activity
			await this.logEmailActivity('system', 'password_reset_email', {
				recipientEmail: to,
				recipientName: name,
				expiryHours,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error('Password reset email error:', error);
			throw error;
		}
	}

	/**
	 * Generic method to send email with custom HTML content
	 */
	async sendEmail({ to, subject, html, text, templateData = {} }) {
		try {
			const result = await this.provider.sendEmail(to, subject, html, templateData);

			// Log email activity
			await this.logEmailActivity('system', 'custom_email', {
				recipientEmail: to,
				subject: subject,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error('Custom email error:', error);
			throw error;
		}
	}

	/**
	 * Test email configuration
	 */
	async testEmailConfig() {
		try {
			const testResult = await this.provider.testConnection();
			return {
				success: true,
				provider: this.provider.constructor.name,
				testResult,
			};
		} catch (error) {
			return {
				success: false,
				error: error.message,
			};
		}
	}

	/**
	 * Send donation confirmation email
	 */
	async sendDonationConfirmation(user, transaction, invoice) {
		try {
			const templateData = {
				userName: user.fullName,
				userEmail: user.email,
				userBatch: user.batchYear,
				donationAmount: transaction.amount,
				currency: transaction.currency,
				donationDate: new Date(transaction.completedAt).toLocaleDateString(),
				transactionNumber: transaction.transactionNumber,
				paymentMethod: "UPI",
				donationMessage: transaction.metadata?.message || null,
				donationType: transaction.metadata?.donationType || "ORGANIZATION",
				isAnonymous: transaction.metadata?.isAnonymous || false,
				invoiceNumber: invoice?.invoiceNumber,
				invoiceUrl: invoice?.pdfUrl,
				receiptUrl: `${process.env.BASE_URL}/api/payments/${transaction.id}/invoice/pdf`,
			};

			const subject = `🙏 Thank you for your donation - ${transaction.transactionNumber}`;
			const htmlContent = this.compiledTemplates.get("donation-confirmation")(
				templateData
			);

			const result = await this.provider.sendEmail(
				user.email,
				subject,
				htmlContent,
				templateData
			);

			// Log email activity
			await this.logEmailActivity(user.id, "donation_confirmation", {
				transactionId: transaction.id,
				donationAmount: transaction.amount,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error("Donation confirmation email error:", error);
			throw error;
		}
	}

	/**
	 * Send membership payment confirmation email
	 */
	async sendMembershipConfirmation(user, transaction, invoice) {
		try {
			const templateData = {
				userName: user.fullName,
				userEmail: user.email,
				userBatch: user.batchYear,
				membershipAmount: transaction.amount,
				membershipYear:
					transaction.metadata?.membershipYear || new Date().getFullYear(),
				currency: transaction.currency,
				paymentDate: new Date(transaction.completedAt).toLocaleDateString(),
				transactionNumber: transaction.transactionNumber,
				paymentMethod: "UPI",
				invoiceNumber: invoice?.invoiceNumber,
				invoiceUrl: invoice?.pdfUrl,
				membershipValidUntil: new Date(
					new Date().getFullYear() + 1,
					2,
					31
				).toLocaleDateString(), // Valid until March 31 next year
			};

			const subject = `✅ Membership Payment Confirmed - ${transaction.transactionNumber}`;
			const htmlContent = this.compiledTemplates.get("membership-confirmation")(
				templateData
			);

			const result = await this.provider.sendEmail(
				user.email,
				subject,
				htmlContent,
				templateData
			);

			// Log email activity
			await this.logEmailActivity(user.id, "membership_confirmation", {
				transactionId: transaction.id,
				membershipAmount: transaction.amount,
				membershipYear: templateData.membershipYear,
				emailResult: result,
			});

			return result;
		} catch (error) {
			console.error("Membership confirmation email error:", error);
			throw error;
		}
	}

	/**
	 * Send birthday wish email to birthday person
	 */
	async sendBirthdayWish(user, organizationData) {
		try {
			const template = this.compiledTemplates.get("birthday-wish");
			if (!template) {
				throw new Error("Birthday wish email template not found");
			}

			// Calculate age and ordinal suffix
			const age = this.calculateAge(user.dateOfBirth);
			const ordinalSuffix = this.getOrdinalSuffix(age);

			const templateData = {
				userName: user.fullName,
				age: age,
				ordinalSuffix: ordinalSuffix,
				batch: user.batch,
				organizationName: organizationData.name || 'Alumni Portal',
				customMessage: null, // Can be customized per user if needed
			};

			const htmlContent = template(templateData);

			const emailOptions = {
				to: user.email,
				subject: `🎂 Happy ${age}${ordinalSuffix} Birthday, ${user.fullName}!`,
				html: htmlContent,
			};

			const result = await this.provider.sendEmail(emailOptions);
			console.log(`✅ Birthday wish email sent to ${user.fullName} (${user.email})`);
			return result;

		} catch (error) {
			console.error("Birthday wish email error:", error);
			throw error;
		}
	}

	/**
	 * Send festival wish email to users
	 */
	async sendFestivalWish(user, festival, organizationData) {
		try {
			const template = this.compiledTemplates.get("festival-wish");
			if (!template) {
				throw new Error("Festival wish email template not found");
			}

			// Get festival styling and content
			const festivalColor = festival.styling?.backgroundColor || festival.backgroundColor || '#ff6b6b';
			const festivalColorSecondary = this.lightenColor(festivalColor, 20);
			const festivalTextColor = festival.styling?.textColor || festival.textColor || '#333';

			// Generate festival-specific content
			const festivalContent = this.getFestivalContent(festival);

			const templateData = {
				userName: user.fullName,
				festivalName: festival.name,
				festivalDate: new Date(festival.date).toLocaleDateString('en-US', {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				}),
				festivalGreeting: festivalContent.greeting,
				festivalEmoji: festivalContent.emoji,
				festivalDecorations: festivalContent.decorations,
				festivalSymbols: festivalContent.symbols,
				greetingMessage: festival.greetingMessage,
				festivalDescription: festival.description,
				organizationName: organizationData.name || 'Alumni Portal',
				festivalColor: festivalColor,
				festivalColorSecondary: festivalColorSecondary,
				festivalTextColor: festivalTextColor,
				festivalBackgroundStart: this.lightenColor(festivalColor, 40),
				festivalBackgroundEnd: this.lightenColor(festivalColor, 60),
				festivalWish: festivalContent.wish,
				festivalClosing: festivalContent.closing,
				festivalQuote: festivalContent.quote,
			};

			const htmlContent = template(templateData);

			const emailOptions = {
				to: user.email,
				subject: `🎊 ${festivalContent.greeting} - ${festival.name}`,
				html: htmlContent,
			};

			const result = await this.provider.sendEmail(emailOptions);
			console.log(`✅ Festival wish email sent to ${user.fullName} for ${festival.name}`);
			return result;

		} catch (error) {
			console.error("Festival wish email error:", error);
			throw error;
		}
	}

	/**
	 * Calculate age from birth date
	 */
	calculateAge(birthDate) {
		const today = new Date();
		const birth = new Date(birthDate);
		let age = today.getFullYear() - birth.getFullYear();
		
		const monthDiff = today.getMonth() - birth.getMonth();
		if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
			age--;
		}
		
		return age;
	}

	/**
	 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
	 */
	getOrdinalSuffix(num) {
		const ones = num % 10;
		const tens = Math.floor(num / 10) % 10;
		
		if (tens === 1) {
			return 'th';
		}
		
		switch (ones) {
			case 1: return 'st';
			case 2: return 'nd'; 
			case 3: return 'rd';
			default: return 'th';
		}
	}

	/**
	 * Get festival-specific content
	 */
	getFestivalContent(festival) {
		const festivalName = festival.name.toLowerCase();
		
		// Default content
		let content = {
			greeting: `Happy ${festival.name}`,
			emoji: '🎊',
			decorations: '✨ 🎊 ✨ 🎊 ✨ 🎊 ✨',
			symbols: '🎊 ✨ 🎉 ✨ 🎊',
			wish: 'May this festival bring joy and prosperity to your life!',
			closing: 'Wishing you and your family a blessed celebration!',
			quote: 'Festivals unite hearts and celebrate our shared heritage'
		};

		// Festival-specific customizations
		if (festivalName.includes('diwali')) {
			content = {
				...content,
				greeting: 'Happy Diwali',
				emoji: '🪔',
				decorations: '🪔 ✨ 🎊 ✨ 🪔 ✨ 🎊',
				symbols: '🪔 🎆 ✨ 🎊 ✨ 🎆 🪔',
				wish: 'May the festival of lights illuminate your path to success and happiness!',
				closing: 'Shubh Deepavali!',
				quote: 'Light a lamp of love, blast a chain of sorrow, shoot a rocket of prosperity, fire a flowerpot of happiness'
			};
		} else if (festivalName.includes('holi')) {
			content = {
				...content,
				greeting: 'Happy Holi',
				emoji: '🎨',
				decorations: '🎨 🌈 🎊 🌈 🎨 🌈 🎊',
				symbols: '🎨 🌈 💃 🎊 💃 🌈 🎨',
				wish: 'May your life be filled with colors of joy and happiness!',
				closing: 'Have a colorful and joyous Holi!',
				quote: 'Life is like Holi - colorful, joyful, and full of love'
			};
		} else if (festivalName.includes('christmas')) {
			content = {
				...content,
				greeting: 'Merry Christmas',
				emoji: '🎄',
				decorations: '🎄 ⭐ 🎁 ⭐ 🎄 ⭐ 🎁',
				symbols: '🎄 🎁 ⭐ 🔔 ⭐ 🎁 🎄',
				wish: 'May the magic of Christmas fill your heart with joy and peace!',
				closing: 'Merry Christmas and Happy New Year!',
				quote: 'Christmas is not just a day, but a feeling of joy and love'
			};
		} else if (festivalName.includes('gandhi')) {
			content = {
				...content,
				greeting: 'Gandhi Jayanti Greetings',
				emoji: '🕊️',
				decorations: '🕊️ 🌿 ✨ 🌿 🕊️ 🌿 ✨',
				symbols: '🇮🇳 🕊️ 🌿 ✨ 🌿 🕊️ 🇮🇳',
				wish: 'May the ideals of truth and non-violence guide us always!',
				closing: 'Remembering the Father of the Nation!',
				quote: 'Be the change you wish to see in the world - Mahatma Gandhi'
			};
		} else if (festivalName.includes('eid')) {
			content = {
				...content,
				greeting: 'Eid Mubarak',
				emoji: '🌙',
				decorations: '🌙 ⭐ 🎊 ⭐ 🌙 ⭐ 🎊',
				symbols: '🌙 ⭐ 🕌 🎊 🕌 ⭐ 🌙',
				wish: 'May Allah bless you with happiness, peace, and prosperity!',
				closing: 'Eid Mubarak to you and your family!',
				quote: 'Eid is a time of joy, reflection, and gratitude'
			};
		}

		return content;
	}

	/**
	 * Lighten a hex color
	 */
	lightenColor(color, percent) {
		// Remove # if present
		color = color.replace('#', '');
		
		// Convert to RGB
		const num = parseInt(color, 16);
		const amt = Math.round(2.55 * percent);
		const R = (num >> 16) + amt;
		const G = (num >> 8 & 0x00FF) + amt;
		const B = (num & 0x0000FF) + amt;
		
		return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
			(G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + 
			(B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
	}
}

module.exports = EmailService;
