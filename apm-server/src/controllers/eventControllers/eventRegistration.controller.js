// src/controllers/eventRegistration.controller.js
const { prisma } = require("../../config/database");
const {
	successResponse,
	errorResponse,
	paginatedResponse,
	getPaginationParams,
	calculatePagination,
} = require("../../utils/response");
const eventService = require("../../services/event.service");
const emailManager = require("../../services/email/EmailManager");

// ==========================================
// ADMIN REGISTRATION MANAGEMENT
// (Keep existing admin methods unchanged)
// ==========================================

// Get all registrations for an event (Super Admin only) - EXISTING METHOD
const getEventRegistrations = async (req, res) => {
	const { eventId } = req.params;
	const { status, search } = req.query;
	const { page, limit, skip } = getPaginationParams(req.query, 20);

	try {
		// Check if event exists
		const event = await prisma.event.findUnique({
			where: { id: eventId },
			select: { id: true, title: true },
		});

		if (!event) {
			return errorResponse(res, "Event not found", 404);
		}

		// Build where clause
		const whereClause = { eventId };

		if (status) {
			whereClause.status = status;
		}

		if (search) {
			whereClause.user = {
				fullName: { contains: search, mode: "insensitive" },
			};
		}

		// Get total count
		const total = await prisma.eventRegistration.count({ where: whereClause });

		// Get registrations
		const registrations = await prisma.eventRegistration.findMany({
			where: whereClause,
			include: {
				user: {
					select: {
						id: true,
						fullName: true,
						email: true,
						profileImage: true,
						batch: true,
						whatsappNumber: true,
					},
				},
				guests: {
					select: {
						id: true,
						name: true,
						email: true,
						phone: true,
						mealPreference: true,
						status: true,
					},
				},
				formResponses: {
					include: {
						field: {
							select: {
								fieldName: true,
								fieldLabel: true,
								fieldType: true,
							},
						},
					},
				},
			},
			orderBy: { registrationDate: "desc" },
			skip,
			take: limit,
		});

		const pagination = calculatePagination(total, page, limit);

		return paginatedResponse(
			res,
			registrations,
			pagination,
			"Event registrations retrieved successfully"
		);
	} catch (error) {
		console.error("Get event registrations error:", error);
		return errorResponse(res, "Failed to retrieve event registrations", 500);
	}
};

// Get registration statistics for an event (Super Admin only) - EXISTING METHOD
const getRegistrationStats = async (req, res) => {
	const { eventId } = req.params;

	try {
		// Check if event exists
		const event = await prisma.event.findUnique({
			where: { id: eventId },
			select: {
				id: true,
				title: true,
				maxCapacity: true,
				registrationFee: true,
				guestFee: true,
				hasMeals: true,
				hasGuests: true,
			},
		});

		if (!event) {
			return errorResponse(res, "Event not found", 404);
		}

		// Get registration statistics
		const stats = await eventService.getEventRegistrationStats(eventId);

		return successResponse(
			res,
			{
				event: {
					id: event.id,
					title: event.title,
					maxCapacity: event.maxCapacity,
				},
				stats,
			},
			"Registration statistics retrieved successfully"
		);
	} catch (error) {
		console.error("Get registration stats error:", error);
		return errorResponse(
			res,
			"Failed to retrieve registration statistics",
			500
		);
	}
};

// ==========================================
// USER REGISTRATION SYSTEM
// (New user-facing methods for Phase 2)
// ==========================================

// Register user for an event (Authenticated users)
const registerForEvent = async (req, res) => {
	const { eventId } = req.params;
	const { mealPreference, formResponses = [], agreeToTerms } = req.body;
	const userId = req.user.id;

	try {
		// Get event details with form fields
		const event = await prisma.event.findUnique({
			where: { id: eventId },
			include: {
				form: {
					include: {
						fields: {
							where: { isRequired: true },
							select: {
								id: true,
								fieldName: true,
								fieldLabel: true,
								isRequired: true,
							},
						},
					},
				},
			},
		});

		if (!event) {
			return errorResponse(res, "Event not found", 404);
		}

		// Validate event registration eligibility
		const registrationValidation = await eventService.validateEventRegistration(
			event,
			userId
		);
		if (!registrationValidation.canRegister) {
			return errorResponse(res, registrationValidation.reason, 400);
		}

		// Check if user is already registered
		const existingRegistration = await prisma.eventRegistration.findUnique({
			where: {
				eventId_userId: {
					eventId,
					userId,
				},
			},
		});

		if (existingRegistration) {
			return errorResponse(
				res,
				"You are already registered for this event",
				409
			);
		}

		// Validate meal preference if required
		if (event.hasMeals && !mealPreference) {
			return errorResponse(
				res,
				"Meal preference is required for this event",
				400
			);
		}

		// Validate required form fields
		if (event.form && event.form.fields.length > 0) {
			const requiredFieldIds = event.form.fields.map((field) => field.id);
			const providedFieldIds = formResponses.map(
				(response) => response.fieldId
			);

			const missingFields = requiredFieldIds.filter(
				(fieldId) => !providedFieldIds.includes(fieldId)
			);

			if (missingFields.length > 0) {
				const missingFieldLabels = event.form.fields
					.filter((field) => missingFields.includes(field.id))
					.map((field) => field.fieldLabel);

				return errorResponse(
					res,
					`Missing required fields: ${missingFieldLabels.join(", ")}`,
					400
				);
			}
		}

		// Calculate fees
		const feeCalculation = eventService.calculateRegistrationFees({
			registrationFee: event.registrationFee || 0,
			guestCount: 0,
			guestFee: event.guestFee || 0,
			merchandiseTotal: 0,
			donationAmount: 0,
		});

		// Create registration with form responses in a transaction
		const result = await prisma.$transaction(async (tx) => {
			// Create registration
			const registration = await tx.eventRegistration.create({
				data: {
					eventId,
					userId,
					status: "CONFIRMED",
					totalAmount: feeCalculation.totalAmount,
					registrationFeePaid: feeCalculation.registrationFee,
					paymentStatus:
						feeCalculation.totalAmount > 0 ? "PENDING" : "COMPLETED",
					mealPreference: event.hasMeals ? mealPreference : null,
					totalGuests: 0,
					activeGuests: 0,
				},
			});

			// Create form responses if provided
			if (formResponses.length > 0) {
				const formResponseData = formResponses.map((response) => ({
					registrationId: registration.id,
					fieldId: response.fieldId,
					response: response.response,
					version: 1,
				}));

				await tx.eventFormResponse.createMany({
					data: formResponseData,
				});
			}

			return registration;
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "event_registration_create",
				details: {
					eventId,
					registrationId: result.id,
					eventTitle: event.title,
					totalAmount: feeCalculation.totalAmount,
					mealPreference,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		// Get complete registration data to return
		const completeRegistration = await prisma.eventRegistration.findUnique({
			where: { id: result.id },
			include: {
				formResponses: {
					include: {
						field: {
							select: {
								fieldName: true,
								fieldLabel: true,
								fieldType: true,
							},
						},
					},
				},
			},
		});

    // ✅ ADD THIS: Send registration confirmation email
		try {
			if (emailManager.isInitialized) {
				const emailService = emailManager.getService();
				await emailService.sendRegistrationConfirmation(
					req.user,
					event,
					completeRegistration
				);
			}
		} catch (emailError) {
			console.error("Registration confirmation email failed:", emailError);
			// Don't fail the registration if email fails
		}

		return successResponse(
			res,
			{
				registration: completeRegistration,
				paymentRequired: feeCalculation.totalAmount > 0,
				paymentAmount: feeCalculation.totalAmount,
			},
			"Successfully registered for event"
		);


	} catch (error) {
		console.error("Register for event error:", error);
		return errorResponse(res, "Failed to register for event", 500);
	}
};

// Get user's registration for an event (Authenticated users)
const getMyRegistration = async (req, res) => {
	const { eventId } = req.params;
	const userId = req.user.id;

	try {
		// Get user's registration
		const registration = await prisma.eventRegistration.findUnique({
			where: {
				eventId_userId: {
					eventId,
					userId,
				},
			},
			include: {
				event: {
					select: {
						id: true,
						title: true,
						eventDate: true,
						venue: true,
						meetingLink: true,
						eventMode: true,
						allowFormModification: true,
						formModificationDeadlineHours: true,
					},
				},
				formResponses: {
					include: {
						field: {
							select: {
								id: true,
								fieldName: true,
								fieldLabel: true,
								fieldType: true,
								options: true,
								isRequired: true,
							},
						},
					},
					orderBy: {
						field: {
							orderIndex: "asc",
						},
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
						feesPaid: true,
					},
				},
			},
		});

		if (!registration) {
			return errorResponse(res, "Registration not found", 404);
		}

		// Check if modification is allowed
		const canModify = eventService.canModifyRegistration(registration);

		return successResponse(
			res,
			{
				registration: {
					...registration,
					canModify,
					modificationDeadline: canModify.deadline,
				},
			},
			"Registration details retrieved successfully"
		);
	} catch (error) {
		console.error("Get my registration error:", error);
		return errorResponse(res, "Failed to retrieve registration", 500);
	}
};

// Update user's registration (Authenticated users)
const updateMyRegistration = async (req, res) => {
	const { eventId } = req.params;
	const { mealPreference, formResponses = [] } = req.body;
	const userId = req.user.id;

	try {
		// Get current registration
		const registration = await prisma.eventRegistration.findUnique({
			where: {
				eventId_userId: {
					eventId,
					userId,
				},
			},
			include: {
				event: {
					select: {
						id: true,
						title: true,
						hasMeals: true,
						allowFormModification: true,
						formModificationDeadlineHours: true,
					},
				},
			},
		});

		if (!registration) {
			return errorResponse(res, "Registration not found", 404);
		}

		// Check if modification is allowed
		const modificationCheck = eventService.canModifyRegistration(registration);
		if (!modificationCheck.allowed) {
			return errorResponse(res, modificationCheck.reason, 400);
		}

		// Validate meal preference if provided
		if (mealPreference && registration.event.hasMeals) {
			if (!["VEG", "NON_VEG"].includes(mealPreference)) {
				return errorResponse(res, "Invalid meal preference", 400);
			}
		}

		// Update registration and form responses in transaction
		const result = await prisma.$transaction(async (tx) => {
			// Prepare update data
			const updateData = {
				lastModifiedAt: new Date(),
				modificationCount: registration.modificationCount + 1,
			};

			if (mealPreference && registration.event.hasMeals) {
				updateData.mealPreference = mealPreference;
			}

			// Update registration
			const updatedRegistration = await tx.eventRegistration.update({
				where: { id: registration.id },
				data: updateData,
			});

			// Update form responses if provided
			if (formResponses.length > 0) {
				// Delete existing responses and create new ones for simplicity
				await tx.eventFormResponse.deleteMany({
					where: { registrationId: registration.id },
				});

				const newFormResponseData = formResponses.map((response) => ({
					registrationId: registration.id,
					fieldId: response.fieldId,
					response: response.response,
					version: updateData.modificationCount,
				}));

				await tx.eventFormResponse.createMany({
					data: newFormResponseData,
				});
			}

			return updatedRegistration;
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "event_registration_update",
				details: {
					eventId,
					registrationId: registration.id,
					eventTitle: registration.event.title,
					modificationCount: result.modificationCount,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		// Get updated registration with all details
		const updatedRegistration = await prisma.eventRegistration.findUnique({
			where: { id: registration.id },
			include: {
				formResponses: {
					include: {
						field: {
							select: {
								fieldName: true,
								fieldLabel: true,
								fieldType: true,
							},
						},
					},
				},
			},
		});

		return successResponse(
			res,
			{
				registration: updatedRegistration,
			},
			"Registration updated successfully"
		);
	} catch (error) {
		console.error("Update my registration error:", error);
		return errorResponse(res, "Failed to update registration", 500);
	}
};

// Cancel user's registration (Authenticated users)
const cancelMyRegistration = async (req, res) => {
	const { eventId } = req.params;
	const userId = req.user.id;

	try {
		// Get current registration
		const registration = await prisma.eventRegistration.findUnique({
			where: {
				eventId_userId: {
					eventId,
					userId,
				},
			},
			include: {
				event: {
					select: {
						id: true,
						title: true,
						eventDate: true,
						allowFormModification: true,
						formModificationDeadlineHours: true,
					},
				},
				guests: {
					where: { status: "ACTIVE" },
				},
			},
		});

		if (!registration) {
			return errorResponse(res, "Registration not found", 404);
		}

		if (registration.status === "CANCELLED") {
			return errorResponse(res, "Registration is already cancelled", 400);
		}

		// Check if cancellation is allowed (same rules as modification)
		const modificationCheck = eventService.canModifyRegistration(registration);
		if (!modificationCheck.allowed) {
			return errorResponse(
				res,
				"Registration cancellation deadline has passed",
				400
			);
		}

		// Cancel registration and guests in transaction
		await prisma.$transaction(async (tx) => {
			// Cancel registration
			await tx.eventRegistration.update({
				where: { id: registration.id },
				data: {
					status: "CANCELLED",
					lastModifiedAt: new Date(),
				},
			});

			// Cancel all active guests
			if (registration.guests.length > 0) {
				await tx.eventGuest.updateMany({
					where: {
						registrationId: registration.id,
						status: "ACTIVE",
					},
					data: {
						status: "CANCELLED",
					},
				});
			}
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "event_registration_cancel",
				details: {
					eventId,
					registrationId: registration.id,
					eventTitle: registration.event.title,
					guestsCancelled: registration.guests.length,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(res, null, "Registration cancelled successfully");
	} catch (error) {
		console.error("Cancel my registration error:", error);
		return errorResponse(res, "Failed to cancel registration", 500);
	}
};

module.exports = {
	// Existing admin methods
	getEventRegistrations,
	getRegistrationStats,

	// New user registration methods
	registerForEvent,
	getMyRegistration,
	updateMyRegistration,
	cancelMyRegistration,
};
