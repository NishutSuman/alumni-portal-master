// src/controllers/eventControllers/eventGuest.controller.js
const { prisma } = require("../../config/database");
const {
	successResponse,
	errorResponse,
	paginatedResponse,
	getPaginationParams,
	calculatePagination,
} = require("../../utils/response");
const eventService = require("../../services/event/event.service");
const emailManager = require("../../services/email/EmailManager");
const { getTenantFilter, getTenantData } = require('../../utils/tenant.util');

// ==========================================
// USER GUEST MANAGEMENT
// ==========================================

// Add guest to user's registration (Authenticated users)
const addGuest = async (req, res) => {
	const { eventId } = req.params;
	const { name, email, phone, mealPreference } = req.body;
	const userId = req.user.id;
	const registration = req.userRegistration; // Set by validation middleware

	try {
		// Check modification eligibility
		const modificationCheck = eventService.canModifyRegistration(registration);
		if (!modificationCheck.allowed) {
			return errorResponse(res, modificationCheck.reason, 400);
		}

		// Calculate new fees with additional guest
		const currentGuestCount = await prisma.eventGuest.count({
			where: {
				registrationId: registration.id,
				status: "ACTIVE",
			},
		});

		const newGuestCount = currentGuestCount + 1;
		const feeCalculation = eventService.calculateRegistrationFees({
			registrationFee: registration.event.registrationFee || 0,
			guestCount: newGuestCount,
			guestFee: registration.event.guestFee || 0,
			merchandiseTotal: registration.merchandiseTotal || 0,
			donationAmount: registration.donationAmount || 0,
		});

		// Create guest and update registration in transaction
		const result = await prisma.$transaction(async (tx) => {
			// Create guest
			const guest = await tx.eventGuest.create({
				data: {
					registrationId: registration.id,
					name: name.trim(),
					email: email?.trim() || null,
					phone: phone?.trim() || null,
					mealPreference: registration.event.hasMeals ? mealPreference : null,
					feesPaid: registration.event.guestFee || 0,
					status: "ACTIVE",
				},
			});

			// Update registration totals
			const updatedRegistration = await tx.eventRegistration.update({
				where: { id: registration.id },
				data: {
					totalGuests: newGuestCount,
					activeGuests: newGuestCount,
					totalAmount: feeCalculation.totalAmount,
					guestFeesPaid: feeCalculation.guestFeesPaid,
					paymentStatus:
						feeCalculation.totalAmount > registration.totalAmount
							? "PENDING"
							: registration.paymentStatus,
					lastModifiedAt: new Date(),
					modificationCount: registration.modificationCount + 1,
				},
			});

			return { guest, updatedRegistration };
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "guest_add",
				details: {
					eventId,
					guestId: result.guest.id,
					registrationId: registration.id,
					guestName: name,
					additionalFee: registration.event.guestFee || 0,
					newTotalAmount: feeCalculation.totalAmount,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		// ✅ ADD THIS: Send guest addition notification email
		try {
			if (emailManager.isInitialized) {
				const emailService = emailManager.getService();
				await emailService.sendGuestAdditionNotification(
					req.user,
					result.guest,
					registration.event
				);
			}
		} catch (emailError) {
			console.error("Guest addition email failed:", emailError);
			// Don't fail the guest addition if email fails
		}
    
		return successResponse(
			res,
			{
				guest: result.guest,
				updatedTotals: {
					totalGuests: newGuestCount,
					totalAmount: feeCalculation.totalAmount,
					additionalPaymentRequired:
						feeCalculation.totalAmount > registration.totalAmount,
					additionalAmount:
						feeCalculation.totalAmount - registration.totalAmount,
				},
			},
			"Guest added successfully"
		);
	} catch (error) {
		console.error("Add guest error:", error);
		return errorResponse(res, "Failed to add guest", 500);
	}
};

// Get all guests for user's registration (Authenticated users)
const getMyGuests = async (req, res) => {
	const { eventId } = req.params;
	const userId = req.user.id;

	try {
		// Get user's registration with guests
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
						hasGuests: true,
						hasMeals: true,
						hasCustomForm: true,
						guestFee: true,
						allowFormModification: true,
						formModificationDeadlineHours: true,
						eventDate: true,
					},
				},
				guests: {
					where: { status: "ACTIVE" },
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
					orderBy: { createdAt: "asc" },
				},
			},
		});

		if (!registration) {
			return errorResponse(res, "Registration not found", 404);
		}

		if (!registration.event.hasGuests) {
			return errorResponse(res, "This event does not allow guests", 400);
		}

		// Check modification eligibility for guests
		const canModify = eventService.canModifyRegistration(registration);

		// Format guest data
		const formattedGuests = registration.guests.map((guest) => ({
			id: guest.id,
			name: guest.name,
			email: guest.email,
			phone: guest.phone,
			mealPreference: guest.mealPreference,
			feesPaid: guest.feesPaid,
			status: guest.status,
			hasFormResponses: guest.formResponses.length > 0,
			formResponsesCount: guest.formResponses.length,
			createdAt: guest.createdAt,
			canModify: canModify.allowed,
		}));

		return successResponse(
			res,
			{
				event: {
					id: registration.event.id,
					title: registration.event.title,
					hasCustomForm: registration.event.hasCustomForm,
					hasMeals: registration.event.hasMeals,
					guestFee: registration.event.guestFee,
				},
				guests: formattedGuests,
				summary: {
					totalGuests: formattedGuests.length,
					totalGuestFees:
						formattedGuests.length * (registration.event.guestFee || 0),
					canAddMoreGuests: canModify.allowed,
					modificationDeadline: canModify.deadline,
				},
			},
			"Guests retrieved successfully"
		);
	} catch (error) {
		console.error("Get my guests error:", error);
		return errorResponse(res, "Failed to retrieve guests", 500);
	}
};

// Update guest details (Authenticated users)
const updateGuest = async (req, res) => {
	const { eventId, guestId } = req.params;
	const { name, email, phone, mealPreference } = req.body;
	const userId = req.user.id;

	try {
		// Get guest with registration details
		const guest = await prisma.eventGuest.findFirst({
			where: {
				id: guestId,
				registration: {
					eventId,
					userId,
				},
			},
			include: {
				registration: {
					include: {
						event: {
							select: {
								hasGuests: true,
								hasMeals: true,
								allowFormModification: true,
								formModificationDeadlineHours: true,
								eventDate: true,
							},
						},
					},
				},
			},
		});

		if (!guest) {
			return errorResponse(
				res,
				"Guest not found or does not belong to your registration",
				404
			);
		}

		if (guest.status !== "ACTIVE") {
			return errorResponse(res, "Cannot update inactive guest", 400);
		}

		// Check modification eligibility
		const modificationCheck = eventService.canModifyRegistration(
			guest.registration
		);
		if (!modificationCheck.allowed) {
			return errorResponse(res, modificationCheck.reason, 400);
		}

		// Prepare update data
		const updateData = {};

		if (name !== undefined) updateData.name = name.trim();
		if (email !== undefined) updateData.email = email?.trim() || null;
		if (phone !== undefined) updateData.phone = phone?.trim() || null;
		if (mealPreference !== undefined && guest.registration.event.hasMeals) {
			updateData.mealPreference = mealPreference;
		}

		// Update guest
		const updatedGuest = await prisma.eventGuest.update({
			where: { id: guestId },
			data: updateData,
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "guest_update",
				details: {
					eventId,
					guestId,
					registrationId: guest.registration.id,
					guestName: updatedGuest.name,
					changes: Object.keys(updateData),
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{ guest: updatedGuest },
			"Guest updated successfully"
		);
	} catch (error) {
		console.error("Update guest error:", error);
		return errorResponse(res, "Failed to update guest", 500);
	}
};

// Cancel/Remove guest (Authenticated users)
const cancelGuest = async (req, res) => {
	const { eventId, guestId } = req.params;
	const userId = req.user.id;

	try {
		// Get guest with registration details
		const guest = await prisma.eventGuest.findFirst({
			where: {
				id: guestId,
				registration: {
					eventId,
					userId,
				},
			},
			include: {
				registration: {
					include: {
						event: {
							select: {
								guestFee: true,
								allowFormModification: true,
								formModificationDeadlineHours: true,
								eventDate: true,
							},
						},
					},
				},
			},
		});

		if (!guest) {
			return errorResponse(
				res,
				"Guest not found or does not belong to your registration",
				404
			);
		}

		if (guest.status !== "ACTIVE") {
			return errorResponse(res, "Guest is already cancelled", 400);
		}

		// Check modification eligibility
		const modificationCheck = eventService.canModifyRegistration(
			guest.registration
		);
		if (!modificationCheck.allowed) {
			return errorResponse(res, "Guest cancellation deadline has passed", 400);
		}

		// Calculate new totals after guest removal
		const currentActiveGuests = await prisma.eventGuest.count({
			where: {
				registrationId: guest.registration.id,
				status: "ACTIVE",
			},
		});

		const newActiveGuests = currentActiveGuests - 1;
		const guestFee = guest.registration.event.guestFee || 0;

		// Update guest status and registration totals in transaction
		const result = await prisma.$transaction(async (tx) => {
			// Cancel guest
			const cancelledGuest = await tx.eventGuest.update({
				where: { id: guestId },
				data: { status: "CANCELLED" },
			});

			// Update registration totals (guest fee becomes donation as per no-refund policy)
			const updatedRegistration = await tx.eventRegistration.update({
				where: { id: guest.registration.id },
				data: {
					totalGuests: guest.registration.totalGuests,
					activeGuests: newActiveGuests,
					guestFeesPaid: newActiveGuests * guestFee,
					donationAmount: guest.registration.donationAmount + guestFee,
					lastModifiedAt: new Date(),
					modificationCount: guest.registration.modificationCount + 1,
				},
			});

			return { cancelledGuest, updatedRegistration };
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "guest_cancel",
				details: {
					eventId,
					guestId,
					registrationId: guest.registration.id,
					guestName: guest.name,
					feeConvertedToDonation: guestFee,
					newActiveGuests,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{
				message: "Guest cancelled successfully",
				feeHandling: {
					guestFee,
					convertedToDonation: true,
					reason: "No refund policy - guest fee converted to donation",
				},
				updatedTotals: {
					activeGuests: newActiveGuests,
					newDonationAmount: result.updatedRegistration.donationAmount,
				},
			},
			"Guest cancelled successfully"
		);
	} catch (error) {
		console.error("Cancel guest error:", error);
		return errorResponse(res, "Failed to cancel guest", 500);
	}
};

// ==========================================
// GUEST FORM MANAGEMENT
// ==========================================

// Get guest form (for guest to fill)
const getGuestForm = async (req, res) => {
	const { eventId, guestId } = req.params;
	const userId = req.user.id;

	try {
		// Get guest with form details
		const guest = await prisma.eventGuest.findFirst({
			where: {
				id: guestId,
				registration: {
					eventId,
					userId,
				},
			},
			include: {
				registration: {
					include: {
						event: {
							include: {
								form: {
									include: {
										fields: {
											orderBy: { orderIndex: "asc" },
											select: {
												id: true,
												fieldName: true,
												fieldLabel: true,
												fieldType: true,
												options: true,
												isRequired: true,
												orderIndex: true,
												validation: true,
											},
										},
									},
								},
							},
						},
					},
				},
				formResponses: {
					include: {
						field: {
							select: {
								id: true,
								fieldName: true,
								fieldLabel: true,
							},
						},
					},
				},
			},
		});

		if (!guest) {
			return errorResponse(
				res,
				"Guest not found or does not belong to your registration",
				404
			);
		}

		if (guest.status !== "ACTIVE") {
			return errorResponse(res, "Cannot access form for inactive guest", 400);
		}

		const event = guest.registration.event;

		if (!event.hasCustomForm || !event.form || !event.form.isActive) {
			return successResponse(
				res,
				{
					hasForm: false,
					form: null,
					message: "No form required for this guest",
				},
				"No form found for this event"
			);
		}

		// Check if modification is allowed
		const canModify = eventService.canModifyRegistration(guest.registration);

		// Map existing responses
		const existingResponses = {};
		guest.formResponses.forEach((response) => {
			existingResponses[response.field.id] = response.response;
		});

		// Add existing responses to fields
		const fieldsWithResponses = event.form.fields.map((field) => ({
			...field,
			currentResponse: existingResponses[field.id] || null,
		}));

		return successResponse(
			res,
			{
				hasForm: true,
				guest: {
					id: guest.id,
					name: guest.name,
					email: guest.email,
				},
				form: {
					id: event.form.id,
					title: event.form.title,
					description: event.form.description,
					fields: fieldsWithResponses,
				},
				canModify: canModify.allowed,
				modificationDeadline: canModify.deadline,
				hasExistingResponses: guest.formResponses.length > 0,
			},
			"Guest form retrieved successfully"
		);
	} catch (error) {
		console.error("Get guest form error:", error);
		return errorResponse(res, "Failed to retrieve guest form", 500);
	}
};

// Submit guest form responses (Authenticated users)
const submitGuestForm = async (req, res) => {
	const { eventId, guestId } = req.params;
	const { formResponses } = req.body;
	const userId = req.user.id;
	const guest = req.guestData; // Set by validation middleware

	try {
		// Check modification eligibility
		const modificationCheck = eventService.canModifyRegistration(
			guest.registration
		);
		if (!modificationCheck.allowed) {
			return errorResponse(res, modificationCheck.reason, 400);
		}

		// Get form to validate responses
		const form = await prisma.eventForm.findUnique({
			where: { eventId },
			include: {
				fields: {
					select: {
						id: true,
						fieldName: true,
						fieldLabel: true,
						isRequired: true,
					},
				},
			},
		});

		if (!form) {
			return errorResponse(res, "Event form not found", 404);
		}

		// Validate form responses
		const validation = await eventService.validateFormResponses(
			form.id,
			formResponses
		);
		if (!validation.valid) {
			return errorResponse(res, "Form validation failed", 400, {
				errors: validation.errors,
			});
		}

		// Submit form responses in transaction
		await prisma.$transaction(async (tx) => {
			// Delete existing responses
			await tx.eventGuestFormResponse.deleteMany({
				where: { guestId },
			});

			// Create new responses
			if (formResponses.length > 0) {
				const responseData = formResponses.map((response) => ({
					guestId,
					fieldId: response.fieldId,
					response: response.response,
				}));

				await tx.eventGuestFormResponse.createMany({
					data: responseData,
				});
			}
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "guest_form_submit",
				details: {
					eventId,
					guestId,
					guestName: guest.name,
					formResponsesCount: formResponses.length,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(res, null, "Guest form submitted successfully");
	} catch (error) {
		console.error("Submit guest form error:", error);
		return errorResponse(res, "Failed to submit guest form", 500);
	}
};

// ==========================================
// ADMIN GUEST MANAGEMENT
// ==========================================

// Get all guests for an event (Super Admin only)
const getAllEventGuests = async (req, res) => {
	const { eventId } = req.params;
	const { status, search, mealPreference } = req.query;
	const { page, limit, skip } = getPaginationParams(req.query, 20);

	try {
		// Check if event exists
		const event = await prisma.event.findFirst({
			where: {
				id: eventId,
				...getTenantFilter(req),
			},
			select: { id: true, title: true, hasGuests: true },
		});

		if (!event) {
			return errorResponse(res, "Event not found", 404);
		}

		if (!event.hasGuests) {
			return errorResponse(res, "Event does not allow guests", 400);
		}

		// Build where clause
		const whereClause = {
			registration: { eventId },
		};

		if (status) {
			whereClause.status = status;
		}

		if (mealPreference) {
			whereClause.mealPreference = mealPreference;
		}

		if (search) {
			whereClause.OR = [
				{ name: { contains: search, mode: "insensitive" } },
				{ email: { contains: search, mode: "insensitive" } },
				{
					registration: {
						user: { fullName: { contains: search, mode: "insensitive" } },
					},
				},
			];
		}

		// Get total count
		const total = await prisma.eventGuest.count({ where: whereClause });

		// Get guests
		const guests = await prisma.eventGuest.findMany({
			where: whereClause,
			include: {
				registration: {
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								email: true,
								batch: true,
							},
						},
					},
				},
				formResponses: {
					include: {
						field: {
							select: {
								fieldName: true,
								fieldLabel: true,
							},
						},
					},
				},
			},
			orderBy: { createdAt: "desc" },
			skip,
			take: limit,
		});

		const pagination = calculatePagination(total, page, limit);

		return paginatedResponse(
			res,
			guests,
			pagination,
			"Event guests retrieved successfully"
		);
	} catch (error) {
		console.error("Get all event guests error:", error);
		return errorResponse(res, "Failed to retrieve event guests", 500);
	}
};

module.exports = {
	// User guest management
	addGuest,
	getMyGuests,
	updateGuest,
	cancelGuest,

	// Guest form management
	getGuestForm,
	submitGuestForm,

	// Admin guest management
	getAllEventGuests,
};
