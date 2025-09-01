// src/services/event.service.js
const { prisma } = require("../../config/database");

/**
 * Event utility service for common operations
 */
class EventService {
	/**
	 * Check if event registration is open
	 */
	static checkRegistrationStatus(event) {
		const now = new Date();
		const eventDate = new Date(event.eventDate);
		const regStart = event.registrationStartDate
			? new Date(event.registrationStartDate)
			: null;
		const regEnd = event.registrationEndDate
			? new Date(event.registrationEndDate)
			: null;

		// Basic availability check
		if (!event.hasRegistration || event.hasExternalLink) {
			return {
				status: event.hasExternalLink ? "EXTERNAL" : "CLOSED",
				canRegister: false,
				message: event.hasExternalLink
					? "Registration available via external link"
					: "Registration not available",
			};
		}

		// Check if event is in the past
		if (eventDate < now) {
			return {
				status: "CLOSED",
				canRegister: false,
				message: "Event has already passed",
			};
		}

		// Check registration period
		if (regStart && now < regStart) {
			return {
				status: "NOT_STARTED",
				canRegister: false,
				message: `Registration opens on ${regStart.toLocaleDateString()}`,
			};
		}

		if (regEnd && now > regEnd) {
			return {
				status: "CLOSED",
				canRegister: false,
				message: "Registration period has ended",
			};
		}

		// Check capacity
		if (event.maxCapacity && event._count?.registrations >= event.maxCapacity) {
			return {
				status: "FULL",
				canRegister: false,
				message: "Event is full",
			};
		}

		return {
			status: "OPEN",
			canRegister: true,
			message: "Registration is open",
		};
	}

	/**
	 * Calculate event fees
	 */
	static calculateEventFees(
		event,
		guestCount = 0,
		merchandiseItems = [],
		donationAmount = 0
	) {
		const registrationFee = parseFloat(event.registrationFee) || 0;
		const guestFee = parseFloat(event.guestFee) || 0;

		// Calculate guest fees
		const totalGuestFees = guestCount * guestFee;

		// Calculate merchandise total
		const merchandiseTotal = merchandiseItems.reduce((total, item) => {
			return total + parseFloat(item.price) * parseInt(item.quantity);
		}, 0);

		// Total amount
		const totalAmount =
			registrationFee +
			totalGuestFees +
			merchandiseTotal +
			parseFloat(donationAmount);

		return {
			registrationFee,
			guestCount,
			guestFee,
			totalGuestFees,
			merchandiseTotal,
			donationAmount: parseFloat(donationAmount),
			totalAmount,
			breakdown: {
				registration: registrationFee,
				guests: totalGuestFees,
				merchandise: merchandiseTotal,
				donation: parseFloat(donationAmount),
			},
		};
	}

	/**
	 * Get event statistics
	 */
	static async getEventStatistics(eventId) {
		try {
			const [event, registrationStats, guestStats, merchandiseStats] =
				await Promise.all([
					prisma.event.findUnique({
						where: { id: eventId },
						select: {
							id: true,
							title: true,
							maxCapacity: true,
							registrationFee: true,
							guestFee: true,
							eventDate: true,
						},
					}),

					// Registration statistics
					prisma.eventRegistration.groupBy({
						by: ["status"],
						where: { eventId },
						_count: true,
						_sum: {
							totalAmount: true,
							registrationFeePaid: true,
							guestFeesPaid: true,
							merchandiseTotal: true,
							donationAmount: true,
						},
					}),

					// Guest statistics
					prisma.eventGuest.groupBy({
						by: ["status"],
						where: {
							registration: { eventId },
						},
						_count: true,
					}),

					// Merchandise statistics
					prisma.eventMerchandiseOrder.groupBy({
						by: ["merchandiseId"],
						where: {
							registration: { eventId },
						},
						_count: true,
						_sum: {
							quantity: true,
							totalPrice: true,
						},
					}),
				]);

			if (!event) {
				throw new Error("Event not found");
			}

			// Process registration stats
			const registrations = {
				total: registrationStats.reduce((sum, stat) => sum + stat._count, 0),
				confirmed:
					registrationStats.find((s) => s.status === "CONFIRMED")?._count || 0,
				cancelled:
					registrationStats.find((s) => s.status === "CANCELLED")?._count || 0,
				waitlist:
					registrationStats.find((s) => s.status === "WAITLIST")?._count || 0,
			};

			// Process guest stats
			const guests = {
				total: guestStats.reduce((sum, stat) => sum + stat._count, 0),
				active: guestStats.find((s) => s.status === "ACTIVE")?._count || 0,
				cancelled:
					guestStats.find((s) => s.status === "CANCELLED")?._count || 0,
			};

			// Process financial stats
			const revenue = registrationStats.reduce(
				(totals, stat) => {
					return {
						total: totals.total + (stat._sum.totalAmount || 0),
						registration:
							totals.registration + (stat._sum.registrationFeePaid || 0),
						guests: totals.guests + (stat._sum.guestFeesPaid || 0),
						merchandise: totals.merchandise + (stat._sum.merchandiseTotal || 0),
						donations: totals.donations + (stat._sum.donationAmount || 0),
					};
				},
				{ total: 0, registration: 0, guests: 0, merchandise: 0, donations: 0 }
			);

			// Calculate capacity utilization
			const capacityUtilization = event.maxCapacity
				? Math.round((registrations.confirmed / event.maxCapacity) * 100)
				: null;

			return {
				event: {
					id: event.id,
					title: event.title,
					maxCapacity: event.maxCapacity,
					eventDate: event.eventDate,
				},
				registrations,
				guests,
				revenue,
				capacityUtilization,
				merchandise: {
					itemsSold: merchandiseStats.length,
					totalQuantity: merchandiseStats.reduce(
						(sum, stat) => sum + (stat._sum.quantity || 0),
						0
					),
					totalRevenue: merchandiseStats.reduce(
						(sum, stat) => sum + (stat._sum.totalPrice || 0),
						0
					),
				},
			};
		} catch (error) {
			console.error("Get event statistics error:", error);
			throw error;
		}
	}

	/**
	 * Check if user can modify event registration
	 */
	static canModifyRegistration(event, registration) {
		if (!event.allowFormModification) {
			return {
				canModify: false,
				reason: "Form modification is not allowed for this event",
			};
		}

		const now = new Date();
		const eventDate = new Date(event.eventDate);
		const deadlineHours = event.formModificationDeadlineHours || 24;
		const modificationDeadline = new Date(
			eventDate.getTime() - deadlineHours * 60 * 60 * 1000
		);

		if (now > modificationDeadline) {
			return {
				canModify: false,
				reason: `Registration modification deadline has passed (${deadlineHours} hours before event)`,
			};
		}

		if (registration.status !== "CONFIRMED") {
			return {
				canModify: false,
				reason: "Only confirmed registrations can be modified",
			};
		}

		return {
			canModify: true,
			deadlineTime: modificationDeadline,
		};
	}

	/**
	 * Generate event slug from title
	 */
	static generateSlug(title, suffix = "") {
		const baseSlug = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");

		return suffix ? `${baseSlug}-${suffix}` : baseSlug;
	}

	/**
	 * Validate event business rules
	 */
	static validateEventData(eventData) {
		const errors = [];

		// Basic validation
		if (!eventData.title || eventData.title.trim().length < 3) {
			errors.push("Event title must be at least 3 characters long");
		}

		if (!eventData.description || eventData.description.trim().length < 10) {
			errors.push("Event description must be at least 10 characters long");
		}

		// Date validation
		if (eventData.eventDate) {
			const eventDate = new Date(eventData.eventDate);
			const now = new Date();

			if (eventDate < now) {
				errors.push("Event date cannot be in the past");
			}

			// Registration date validation
			if (eventData.registrationStartDate && eventData.registrationEndDate) {
				const regStart = new Date(eventData.registrationStartDate);
				const regEnd = new Date(eventData.registrationEndDate);

				if (regStart >= regEnd) {
					errors.push("Registration end date must be after start date");
				}

				if (regEnd > eventDate) {
					errors.push("Registration end date cannot be after event date");
				}
			}
		}

		// Time validation
		if (eventData.startTime && eventData.endTime) {
			const [startHour, startMin] = eventData.startTime.split(":").map(Number);
			const [endHour, endMin] = eventData.endTime.split(":").map(Number);

			const startMinutes = startHour * 60 + startMin;
			const endMinutes = endHour * 60 + endMin;

			if (startMinutes >= endMinutes) {
				errors.push("End time must be after start time");
			}
		}

		// External link validation
		if (eventData.hasExternalLink && !eventData.externalRegistrationLink) {
			errors.push(
				"External registration link is required when external link is enabled"
			);
		}

		// Capacity validation
		if (eventData.maxCapacity && eventData.maxCapacity < 1) {
			errors.push("Maximum capacity must be at least 1");
		}

		// Fee validation
		if (eventData.registrationFee && eventData.registrationFee < 0) {
			errors.push("Registration fee cannot be negative");
		}

		if (eventData.guestFee && eventData.guestFee < 0) {
			errors.push("Guest fee cannot be negative");
		}

		return errors;
	}

	/**
	 * Get upcoming events for user dashboard
	 */
	static async getUpcomingEvents(limit = 5) {
		try {
			const now = new Date();

			const events = await prisma.event.findMany({
				where: {
					eventDate: { gte: now },
					status: {
						in: [
							"PUBLISHED",
							"REGISTRATION_OPEN",
							"REGISTRATION_CLOSED",
							"ONGOING",
						],
					},
				},
				select: {
					id: true,
					title: true,
					slug: true,
					eventDate: true,
					startTime: true,
					venue: true,
					eventMode: true,
					hasRegistration: true,
					registrationFee: true,
					heroImage: true,
					category: {
						select: {
							id: true,
							name: true,
						},
					},
					_count: {
						select: {
							registrations: {
								where: { status: "CONFIRMED" },
							},
						},
					},
				},
				orderBy: { eventDate: "asc" },
				take: limit,
			});

			return events.map((event) => ({
				...event,
				registrationCount: event._count.registrations,
				_count: undefined,
			}));
		} catch (error) {
			console.error("Get upcoming events error:", error);
			throw error;
		}
	}

	/**
	 * Get event dashboard statistics
	 */
	static async getDashboardStats() {
		try {
			const now = new Date();
			const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

			const [
				totalEvents,
				upcomingEvents,
				draftEvents,
				recentRegistrations,
				totalRevenue,
			] = await Promise.all([
				prisma.event.count(),

				prisma.event.count({
					where: {
						eventDate: { gte: now },
						status: {
							in: ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"],
						},
					},
				}),

				prisma.event.count({
					where: { status: "DRAFT" },
				}),

				prisma.eventRegistration.count({
					where: {
						createdAt: { gte: thirtyDaysAgo },
						status: "CONFIRMED",
					},
				}),

				prisma.eventRegistration.aggregate({
					where: { status: "CONFIRMED" },
					_sum: { totalAmount: true },
				}),
			]);

			return {
				totalEvents,
				upcomingEvents,
				draftEvents,
				recentRegistrations,
				totalRevenue: totalRevenue._sum.totalAmount || 0,
				generatedAt: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Get event dashboard stats error:", error);
			throw error;
		}
	}

	/**
	 * Validate if user can register for an event
	 */
	static async validateEventRegistration(event, userId) {
		try {
			const now = new Date();
			const eventDate = new Date(event.eventDate);

			// Check event status
			if (!["PUBLISHED", "REGISTRATION_OPEN"].includes(event.status)) {
				return {
					canRegister: false,
					reason: "Event registration is not open",
				};
			}

			// Check if event is in the past
			if (eventDate < now) {
				return {
					canRegister: false,
					reason: "Cannot register for past events",
				};
			}

			// Check if registration is enabled
			if (!event.hasRegistration) {
				return {
					canRegister: false,
					reason: "Event does not allow registration",
				};
			}

			// Check if external registration is required
			if (event.hasExternalLink) {
				return {
					canRegister: false,
					reason: "Please use the external registration link for this event",
				};
			}

			// Check registration period
			if (event.registrationStartDate) {
				const regStart = new Date(event.registrationStartDate);
				if (now < regStart) {
					return {
						canRegister: false,
						reason: `Registration opens on ${regStart.toLocaleDateString()}`,
					};
				}
			}

			if (event.registrationEndDate) {
				const regEnd = new Date(event.registrationEndDate);
				if (now > regEnd) {
					return {
						canRegister: false,
						reason: "Registration period has ended",
					};
				}
			}

			// Check capacity
			if (event.maxCapacity) {
				const currentRegistrations = await prisma.eventRegistration.count({
					where: {
						eventId: event.id,
						status: "CONFIRMED",
					},
				});

				if (currentRegistrations >= event.maxCapacity) {
					return {
						canRegister: false,
						reason: "Event is full",
					};
				}
			}

			// Check if user is already registered
			const existingRegistration = await prisma.eventRegistration.findUnique({
				where: {
					eventId_userId: {
						eventId: event.id,
						userId,
					},
				},
			});

			if (existingRegistration) {
				return {
					canRegister: false,
					reason: "You are already registered for this event",
				};
			}

			return {
				canRegister: true,
				reason: "Registration allowed",
			};
		} catch (error) {
			console.error("Validate event registration error:", error);
			return {
				canRegister: false,
				reason: "Unable to validate registration eligibility",
			};
		}
	}

	/**
	 * Calculate registration fees (Enhanced version)
	 */
	static calculateRegistrationFees(feeData) {
		const {
			registrationFee = 0,
			guestCount = 0,
			guestFee = 0,
			merchandiseTotal = 0,
			donationAmount = 0,
		} = feeData;

		const registrationFeePaid = Number(registrationFee);
		const guestFeesPaid = Number(guestCount) * Number(guestFee);
		const merchandiseAmount = Number(merchandiseTotal);
		const donation = Number(donationAmount);

		const totalAmount =
			registrationFeePaid + guestFeesPaid + merchandiseAmount + donation;

		return {
			registrationFee: registrationFeePaid,
			guestFeesPaid,
			merchandiseTotal: merchandiseAmount,
			donationAmount: donation,
			totalAmount,
			breakdown: {
				baseRegistration: registrationFeePaid,
				guests: {
					count: guestCount,
					feePerGuest: Number(guestFee),
					totalGuestFees: guestFeesPaid,
				},
				merchandise: merchandiseAmount,
				donation: donation,
			},
		};
	}

	/**
	 * Get event registration statistics (Enhanced version)
	 */
	static async getEventRegistrationStats(eventId) {
		try {
			// Get basic registration counts
			const registrationStats = await prisma.eventRegistration.groupBy({
				by: ["status"],
				where: { eventId },
				_count: { _all: true },
			});

			// Get payment status counts
			const paymentStats = await prisma.eventRegistration.groupBy({
				by: ["paymentStatus"],
				where: { eventId },
				_count: { _all: true },
			});

			// Get meal preference counts (if applicable)
			const mealStats = await prisma.eventRegistration.groupBy({
				by: ["mealPreference"],
				where: {
					eventId,
					mealPreference: { not: null },
				},
				_count: { _all: true },
			});

			// Get guest statistics
			const guestStats = await prisma.eventGuest.groupBy({
				by: ["status"],
				where: {
					registration: { eventId },
				},
				_count: { _all: true },
			});

			// Get financial summary
			const financialStats = await prisma.eventRegistration.aggregate({
				where: { eventId },
				_sum: {
					totalAmount: true,
					registrationFeePaid: true,
					guestFeesPaid: true,
					merchandiseTotal: true,
					donationAmount: true,
				},
				_avg: {
					totalAmount: true,
				},
			});

			// Get recent registrations
			const recentRegistrations = await prisma.eventRegistration.findMany({
				where: { eventId },
				include: {
					user: {
						select: {
							fullName: true,
							email: true,
						},
					},
				},
				orderBy: { registrationDate: "desc" },
				take: 5,
			});

			// Format statistics
			const formatStats = (stats) => {
				const result = {};
				stats.forEach((stat) => {
					result[stat.status || stat.paymentStatus || stat.mealPreference] =
						stat._count._all;
				});
				return result;
			};

			return {
				registrations: {
					total: registrationStats.reduce(
						(sum, stat) => sum + stat._count._all,
						0
					),
					byStatus: formatStats(registrationStats),
				},
				payments: {
					byStatus: formatStats(paymentStats),
				},
				meals: {
					byPreference: formatStats(mealStats),
				},
				guests: {
					total: guestStats.reduce((sum, stat) => sum + stat._count._all, 0),
					byStatus: formatStats(guestStats),
				},
				financial: {
					totalRevenue: Number(financialStats._sum.totalAmount || 0),
					averageAmount: Number(financialStats._avg.totalAmount || 0),
					breakdown: {
						registrationFees: Number(
							financialStats._sum.registrationFeePaid || 0
						),
						guestFees: Number(financialStats._sum.guestFeesPaid || 0),
						merchandise: Number(financialStats._sum.merchandiseTotal || 0),
						donations: Number(financialStats._sum.donationAmount || 0),
					},
				},
				recentRegistrations: recentRegistrations.map((reg) => ({
					id: reg.id,
					userName: reg.user.fullName,
					userEmail: reg.user.email,
					registrationDate: reg.registrationDate,
					status: reg.status,
					totalAmount: reg.totalAmount,
				})),
			};
		} catch (error) {
			console.error("Get event registration stats error:", error);
			throw new Error("Failed to get registration statistics");
		}
	}

	/**
	 * Check if registration can be modified (Enhanced version)
	 */
	static canModifyRegistration(registration) {
		try {
			const now = new Date();
			const event = registration.event;

			// Check if modification is enabled for the event
			if (!event.allowFormModification) {
				return {
					allowed: false,
					reason: "Registration modification is not allowed for this event",
					deadline: null,
				};
			}

			// Check if registration is cancelled
			if (registration.status === "CANCELLED") {
				return {
					allowed: false,
					reason: "Cannot modify a cancelled registration",
					deadline: null,
				};
			}

			// Calculate modification deadline
			const eventDate = new Date(event.eventDate);
			const deadlineHours = event.formModificationDeadlineHours || 24;
			const modificationDeadline = new Date(
				eventDate.getTime() - deadlineHours * 60 * 60 * 1000
			);

			// Check if modification deadline has passed
			if (now > modificationDeadline) {
				return {
					allowed: false,
					reason: `Modification deadline has passed (${deadlineHours} hours before event)`,
					deadline: modificationDeadline,
				};
			}

			// Check if event has already happened
			if (now > eventDate) {
				return {
					allowed: false,
					reason: "Cannot modify registration for past events",
					deadline: null,
				};
			}

			return {
				allowed: true,
				reason: "Modification allowed",
				deadline: modificationDeadline,
				hoursRemaining: Math.floor(
					(modificationDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)
				),
			};
		} catch (error) {
			console.error("Can modify registration error:", error);
			return {
				allowed: false,
				reason: "Unable to check modification eligibility",
				deadline: null,
			};
		}
	}

	/**
	 * Get registration status for display
	 */
	static getRegistrationStatusText(registration) {
		if (!registration) return "Not Registered";

		switch (registration.status) {
			case "CONFIRMED":
				if (registration.paymentStatus === "PENDING") {
					return "Registered - Payment Pending";
				} else if (registration.paymentStatus === "COMPLETED") {
					return "Registered - Payment Complete";
				} else {
					return "Registered";
				}
			case "CANCELLED":
				return "Registration Cancelled";
			case "WAITLIST":
				return "On Waitlist";
			default:
				return "Registration Status Unknown";
		}
	}

	/**
	 * Validate form responses against form fields
	 */
	static async validateFormResponses(formId, responses) {
		try {
			if (!responses || responses.length === 0) {
				return { valid: true, errors: [] };
			}

			// Get form fields
			const fields = await prisma.eventFormField.findMany({
				where: { formId },
				select: {
					id: true,
					fieldName: true,
					fieldLabel: true,
					fieldType: true,
					isRequired: true,
					options: true,
					validation: true,
				},
			});

			const errors = [];
			const responseMap = new Map(
				responses.map((r) => [r.fieldId, r.response])
			);

			// Check each field
			for (const field of fields) {
				const response = responseMap.get(field.id);

				// Check required fields
				if (field.isRequired && (!response || response.trim() === "")) {
					errors.push({
						fieldId: field.id,
						fieldName: field.fieldName,
						message: `${field.fieldLabel} is required`,
					});
					continue;
				}

				// Skip validation if no response and field is optional
				if (!response) continue;

				// Validate field type specific rules
				switch (field.fieldType) {
					case "EMAIL":
						const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
						if (!emailRegex.test(response)) {
							errors.push({
								fieldId: field.id,
								fieldName: field.fieldName,
								message: `${field.fieldLabel} must be a valid email address`,
							});
						}
						break;

					case "PHONE":
						const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
						if (!phoneRegex.test(response.replace(/[\s\-\(\)]/g, ""))) {
							errors.push({
								fieldId: field.id,
								fieldName: field.fieldName,
								message: `${field.fieldLabel} must be a valid phone number`,
							});
						}
						break;

					case "SELECT":
					case "RADIO":
						if (field.options && !field.options.includes(response)) {
							errors.push({
								fieldId: field.id,
								fieldName: field.fieldName,
								message: `${field.fieldLabel} must be one of the provided options`,
							});
						}
						break;

					case "CHECKBOX":
						try {
							const selectedOptions = JSON.parse(response);
							if (!Array.isArray(selectedOptions)) {
								throw new Error("Invalid format");
							}
							const invalidOptions = selectedOptions.filter(
								(opt) => !field.options.includes(opt)
							);
							if (invalidOptions.length > 0) {
								errors.push({
									fieldId: field.id,
									fieldName: field.fieldName,
									message: `${field.fieldLabel} contains invalid options`,
								});
							}
						} catch (e) {
							errors.push({
								fieldId: field.id,
								fieldName: field.fieldName,
								message: `${field.fieldLabel} must be a valid selection`,
							});
						}
						break;
				}

				// Apply custom validation rules
				if (field.validation) {
					const validation = field.validation;

					if (validation.minLength && response.length < validation.minLength) {
						errors.push({
							fieldId: field.id,
							fieldName: field.fieldName,
							message: `${field.fieldLabel} must be at least ${validation.minLength} characters`,
						});
					}

					if (validation.maxLength && response.length > validation.maxLength) {
						errors.push({
							fieldId: field.id,
							fieldName: field.fieldName,
							message: `${field.fieldLabel} must be no more than ${validation.maxLength} characters`,
						});
					}

					if (validation.pattern) {
						const regex = new RegExp(validation.pattern);
						if (!regex.test(response)) {
							errors.push({
								fieldId: field.id,
								fieldName: field.fieldName,
								message: `${field.fieldLabel} format is invalid`,
							});
						}
					}
				}
			}

			return {
				valid: errors.length === 0,
				errors,
			};
		} catch (error) {
			console.error("Validate form responses error:", error);
			return {
				valid: false,
				errors: [{ message: "Form validation failed" }],
			};
		}
	}

	/**
	 * Validate if user can add guests to registration
	 */
	static async validateGuestAddition(eventId, userId) {
		try {
			// Get user's registration with event details
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
							hasGuests: true,
							allowFormModification: true,
							formModificationDeadlineHours: true,
							eventDate: true,
							guestFee: true,
						},
					},
				},
			});

			if (!registration) {
				return {
					canAdd: false,
					reason: "You must be registered for this event to add guests",
				};
			}

			if (registration.status !== "CONFIRMED") {
				return {
					canAdd: false,
					reason: "Your registration must be confirmed to add guests",
				};
			}

			if (!registration.event.hasGuests) {
				return {
					canAdd: false,
					reason: "This event does not allow guests",
				};
			}

			// Check modification deadline
			const modificationCheck = this.canModifyRegistration(registration);
			if (!modificationCheck.allowed) {
				return {
					canAdd: false,
					reason: modificationCheck.reason,
				};
			}

			return {
				canAdd: true,
				registration,
				guestFee: registration.event.guestFee || 0,
			};
		} catch (error) {
			console.error("Validate guest addition error:", error);
			return {
				canAdd: false,
				reason: "Unable to validate guest addition eligibility",
			};
		}
	}

	/**
	 * Calculate updated fees after guest addition/removal
	 */
	static calculateUpdatedFeesWithGuests(
		currentRegistration,
		guestCountChange,
		guestFee
	) {
		const currentGuestCount = currentRegistration.activeGuests || 0;
		const newGuestCount = Math.max(0, currentGuestCount + guestCountChange);

		const baseRegistrationFee = currentRegistration.registrationFeePaid || 0;
		const newGuestFees = newGuestCount * (guestFee || 0);
		const merchandiseTotal = currentRegistration.merchandiseTotal || 0;
		const donationAmount = currentRegistration.donationAmount || 0;

		// If removing guest, the fee becomes donation (no refund policy)
		let adjustedDonation = donationAmount;
		if (guestCountChange < 0) {
			const removedGuestFees = Math.abs(guestCountChange) * (guestFee || 0);
			adjustedDonation += removedGuestFees;
		}

		const newTotalAmount =
			baseRegistrationFee + newGuestFees + merchandiseTotal + adjustedDonation;

		return {
			newGuestCount,
			newGuestFees,
			newDonationAmount: adjustedDonation,
			newTotalAmount,
			additionalPaymentRequired:
				newTotalAmount > currentRegistration.totalAmount,
			additionalAmount: Math.max(
				0,
				newTotalAmount - currentRegistration.totalAmount
			),
			breakdown: {
				baseRegistration: baseRegistrationFee,
				guestFees: newGuestFees,
				merchandise: merchandiseTotal,
				donations: adjustedDonation,
			},
		};
	}

	/**
	 * Get guest statistics for an event
	 */
	static async getEventGuestStats(eventId) {
		try {
			// Get basic guest counts
			const guestStats = await prisma.eventGuest.groupBy({
				by: ["status"],
				where: {
					registration: { eventId },
				},
				_count: { _all: true },
			});

			// Get meal preference stats
			const mealStats = await prisma.eventGuest.groupBy({
				by: ["mealPreference"],
				where: {
					registration: { eventId },
					mealPreference: { not: null },
					status: "ACTIVE",
				},
				_count: { _all: true },
			});

			// Get guest fees collected
			const guestFinancials = await prisma.eventGuest.aggregate({
				where: {
					registration: { eventId },
					status: "ACTIVE",
				},
				_sum: {
					feesPaid: true,
				},
				_count: {
					_all: true,
				},
			});

			// Get registrations with guests
			const registrationStats = await prisma.eventRegistration.aggregate({
				where: { eventId },
				_sum: {
					totalGuests: true,
					activeGuests: true,
					guestFeesPaid: true,
				},
				_avg: {
					activeGuests: true,
				},
			});

			// Get guest form completion stats
			const guestFormStats = await prisma.eventGuestFormResponse.groupBy({
				by: ["guestId"],
				where: {
					guest: {
						registration: { eventId },
						status: "ACTIVE",
					},
				},
				_count: { _all: true },
			});

			// Format statistics
			const formatGuestStats = (stats) => {
				const result = {};
				stats.forEach((stat) => {
					result[stat.status || stat.mealPreference] = stat._count._all;
				});
				return result;
			};

			return {
				guests: {
					total: guestStats.reduce((sum, stat) => sum + stat._count._all, 0),
					byStatus: formatGuestStats(guestStats),
					active:
						guestStats.find((s) => s.status === "ACTIVE")?._count._all || 0,
					cancelled:
						guestStats.find((s) => s.status === "CANCELLED")?._count._all || 0,
				},
				meals: {
					byPreference: formatGuestStats(mealStats),
					vegetarian:
						mealStats.find((s) => s.mealPreference === "VEG")?._count._all || 0,
					nonVegetarian:
						mealStats.find((s) => s.mealPreference === "NON_VEG")?._count
							._all || 0,
				},
				financial: {
					totalGuestFees: Number(guestFinancials._sum.feesPaid || 0),
					averageGuestsPerRegistration: Number(
						registrationStats._avg.activeGuests || 0
					),
					totalGuestRegistrations: Number(
						registrationStats._sum.totalGuests || 0
					),
					activeGuestRegistrations: Number(
						registrationStats._sum.activeGuests || 0
					),
				},
				formCompletion: {
					guestsWithFormResponses: guestFormStats.length,
					completionRate:
						guestFinancials._count._all > 0
							? Math.round(
									(guestFormStats.length / guestFinancials._count._all) * 100
								)
							: 0,
				},
			};
		} catch (error) {
			console.error("Get event guest stats error:", error);
			throw new Error("Failed to get guest statistics");
		}
	}

	/**
	 * Validate guest form responses (similar to user form validation but for guests)
	 */
	static async validateGuestFormResponses(guestId, formId, responses) {
		try {
			// Get guest details
			const guest = await prisma.eventGuest.findUnique({
				where: { id: guestId },
				select: {
					id: true,
					name: true,
					status: true,
				},
			});

			if (!guest) {
				return {
					valid: false,
					errors: [{ message: "Guest not found" }],
				};
			}

			if (guest.status !== "ACTIVE") {
				return {
					valid: false,
					errors: [{ message: "Cannot submit form for inactive guest" }],
				};
			}

			// Use the existing form validation logic
			return await this.validateFormResponses(formId, responses);
		} catch (error) {
			console.error("Validate guest form responses error:", error);
			return {
				valid: false,
				errors: [{ message: "Guest form validation failed" }],
			};
		}
	}

	/**
	 * Get guest summary for registration
	 */
	static async getRegistrationGuestSummary(registrationId) {
		try {
			const guests = await prisma.eventGuest.findMany({
				where: { registrationId },
				select: {
					id: true,
					name: true,
					email: true,
					phone: true,
					mealPreference: true,
					feesPaid: true,
					status: true,
					formResponses: {
						select: {
							id: true,
						},
					},
					createdAt: true,
				},
				orderBy: { createdAt: "asc" },
			});

			const activeGuests = guests.filter((g) => g.status === "ACTIVE");
			const cancelledGuests = guests.filter((g) => g.status === "CANCELLED");

			const totalGuestFees = activeGuests.reduce(
				(sum, guest) => sum + Number(guest.feesPaid),
				0
			);
			const guestsWithForms = activeGuests.filter(
				(g) => g.formResponses.length > 0
			);

			return {
				total: guests.length,
				active: activeGuests.length,
				cancelled: cancelledGuests.length,
				totalFees: totalGuestFees,
				formCompletion: {
					completed: guestsWithForms.length,
					pending: activeGuests.length - guestsWithForms.length,
					rate:
						activeGuests.length > 0
							? Math.round((guestsWithForms.length / activeGuests.length) * 100)
							: 0,
				},
				mealPreferences: {
					vegetarian: activeGuests.filter((g) => g.mealPreference === "VEG")
						.length,
					nonVegetarian: activeGuests.filter(
						(g) => g.mealPreference === "NON_VEG"
					).length,
					notSpecified: activeGuests.filter((g) => !g.mealPreference).length,
				},
				guests: guests,
			};
		} catch (error) {
			console.error("Get registration guest summary error:", error);
			throw new Error("Failed to get guest summary");
		}
	}

	/**
	 * Check if guest modification is allowed
	 */
	static canModifyGuest(guest, registration) {
		// Guest modification follows same rules as registration modification
		if (guest.status !== "ACTIVE") {
			return {
				canModify: false,
				reason: "Cannot modify inactive guest",
			};
		}

		// Use the registration modification check
		const registrationCheck = this.canModifyRegistration(registration);

		return {
			canModify: registrationCheck.allowed,
			reason: registrationCheck.reason,
			deadline: registrationCheck.deadline,
		};
	}

	/**
	 * Calculate guest fee impact on registration
	 */
	static calculateGuestFeeImpact(
		currentRegistration,
		action,
		guestCount = 1,
		guestFee = 0
	) {
		const multiplier = action === "add" ? 1 : -1;
		const feeChange = guestCount * guestFee * multiplier;

		let donationChange = 0;
		if (action === "remove") {
			// Removed guest fees become donations (no refund policy)
			donationChange = guestCount * guestFee;
		}

		return {
			feeChange,
			donationChange,
			newTotalAmount:
				currentRegistration.totalAmount + (action === "add" ? feeChange : 0),
			paymentRequired: action === "add" && feeChange > 0,
			refundAmount: 0, // No refunds as per policy
			message:
				action === "remove"
					? `Guest fee of ₹${guestCount * guestFee} converted to donation as per no-refund policy`
					: `Additional payment of ₹${feeChange} required for ${guestCount} guest(s)`,
		};
	}

	/**
	 * Validate merchandise stock availability
	 */
	static async validateMerchandiseStock(
		merchandiseId,
		requestedQuantity,
		selectedSize = null
	) {
		try {
			const merchandise = await prisma.eventMerchandise.findUnique({
				where: { id: merchandiseId },
				select: {
					id: true,
					name: true,
					stockQuantity: true,
					isActive: true,
					availableSizes: true,
				},
			});

			if (!merchandise) {
				return {
					valid: false,
					reason: "Merchandise item not found",
				};
			}

			if (!merchandise.isActive) {
				return {
					valid: false,
					reason: "Merchandise item is inactive",
				};
			}

			// Validate size if item has sizes
			if (merchandise.availableSizes.length > 0 && !selectedSize) {
				return {
					valid: false,
					reason: "Size selection is required for this item",
				};
			}

			if (selectedSize && !merchandise.availableSizes.includes(selectedSize)) {
				return {
					valid: false,
					reason: "Selected size is not available",
				};
			}

			// Check stock availability
			if (
				merchandise.stockQuantity !== null &&
				merchandise.stockQuantity < requestedQuantity
			) {
				return {
					valid: false,
					reason: `Insufficient stock. Only ${merchandise.stockQuantity} items available`,
					availableStock: merchandise.stockQuantity,
				};
			}

			return {
				valid: true,
				merchandise,
				availableStock: merchandise.stockQuantity,
			};
		} catch (error) {
			console.error("Validate merchandise stock error:", error);
			return {
				valid: false,
				reason: "Stock validation failed",
			};
		}
	}

	/**
	 * Calculate cart totals and summary
	 */
	static async calculateCartSummary(registrationId) {
		try {
			const cartItems = await prisma.eventMerchandiseOrder.findMany({
				where: { registrationId },
				include: {
					merchandise: {
						select: {
							name: true,
							stockQuantity: true,
							isActive: true,
						},
					},
				},
			});

			const summary = {
				itemCount: cartItems.length,
				totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
				totalAmount: cartItems.reduce(
					(sum, item) => sum + Number(item.totalPrice),
					0
				),
				items: cartItems.map((item) => ({
					id: item.id,
					merchandiseId: item.merchandiseId,
					name: item.merchandise.name,
					quantity: item.quantity,
					selectedSize: item.selectedSize,
					unitPrice: Number(item.unitPrice),
					totalPrice: Number(item.totalPrice),
					stockStatus:
						item.merchandise.stockQuantity !== null
							? item.merchandise.stockQuantity >= item.quantity
								? "AVAILABLE"
								: "INSUFFICIENT"
							: "UNLIMITED",
					isActive: item.merchandise.isActive,
				})),
				stockIssues: cartItems.filter(
					(item) =>
						!item.merchandise.isActive ||
						(item.merchandise.stockQuantity !== null &&
							item.merchandise.stockQuantity < item.quantity)
				).length,
			};

			return {
				success: true,
				summary,
			};
		} catch (error) {
			console.error("Calculate cart summary error:", error);
			return {
				success: false,
				error: "Failed to calculate cart summary",
			};
		}
	}

	/**
	 * Get merchandise statistics for event
	 */
	static async getEventMerchandiseStats(eventId) {
		try {
			// Get merchandise overview
			const merchandiseOverview = await prisma.eventMerchandise.findMany({
				where: { eventId },
				select: {
					id: true,
					name: true,
					price: true,
					stockQuantity: true,
					isActive: true,
					_count: {
						select: { orders: true },
					},
				},
			});

			// Get order statistics
			const orderStats = await prisma.eventMerchandiseOrder.aggregate({
				where: {
					registration: { eventId },
				},
				_sum: {
					quantity: true,
					totalPrice: true,
				},
				_count: {
					id: true,
				},
			});

			// Get revenue by merchandise
			const revenueByMerchandise = await prisma.eventMerchandiseOrder.groupBy({
				by: ["merchandiseId"],
				where: {
					registration: { eventId },
				},
				_sum: {
					quantity: true,
					totalPrice: true,
				},
				_count: {
					id: true,
				},
			});

			// Get customer statistics
			const customerStats = await prisma.eventMerchandiseOrder.findMany({
				where: {
					registration: { eventId },
				},
				select: {
					registrationId: true,
				},
				distinct: ["registrationId"],
			});

			// Calculate stock status
			const stockStatus = {
				lowStock: merchandiseOverview.filter(
					(item) => item.stockQuantity !== null && item.stockQuantity <= 5
				).length,
				outOfStock: merchandiseOverview.filter(
					(item) => item.stockQuantity !== null && item.stockQuantity === 0
				).length,
				unlimited: merchandiseOverview.filter(
					(item) => item.stockQuantity === null
				).length,
			};

			return {
				overview: {
					totalItems: merchandiseOverview.length,
					activeItems: merchandiseOverview.filter((item) => item.isActive)
						.length,
					totalOrders: orderStats._count.id || 0,
					totalQuantitySold: orderStats._sum.quantity || 0,
					totalRevenue: Number(orderStats._sum.totalPrice || 0),
					uniqueCustomers: customerStats.length,
				},
				stockStatus,
				merchandisePerformance: revenueByMerchandise
					.map((item) => {
						const merchandise = merchandiseOverview.find(
							(m) => m.id === item.merchandiseId
						);
						return {
							merchandiseId: item.merchandiseId,
							name: merchandise?.name || "Unknown",
							price: merchandise?.price || 0,
							orderCount: item._count.id,
							quantitySold: item._sum.quantity || 0,
							revenue: Number(item._sum.totalPrice || 0),
						};
					})
					.sort((a, b) => b.revenue - a.revenue),
				items: merchandiseOverview.map((item) => ({
					id: item.id,
					name: item.name,
					price: Number(item.price),
					stockQuantity: item.stockQuantity,
					isActive: item.isActive,
					orderCount: item._count.orders,
					stockStatus:
						item.stockQuantity === null
							? "UNLIMITED"
							: item.stockQuantity > 5
								? "GOOD"
								: item.stockQuantity > 0
									? "LOW"
									: "OUT_OF_STOCK",
				})),
			};
		} catch (error) {
			console.error("Get event merchandise stats error:", error);
			throw new Error("Failed to get merchandise statistics");
		}
	}

	/**
	 * Get user's order summary for event
	 */
	static async getUserOrderSummary(eventId, userId) {
		try {
			const registration = await prisma.eventRegistration.findUnique({
				where: {
					eventId_userId: { eventId, userId },
				},
				select: { id: true },
			});

			if (!registration) {
				return {
					hasOrders: false,
					summary: null,
				};
			}

			const orders = await prisma.eventMerchandiseOrder.findMany({
				where: { registrationId: registration.id },
				include: {
					merchandise: {
						select: {
							name: true,
							images: true,
						},
					},
				},
			});

			if (orders.length === 0) {
				return {
					hasOrders: false,
					summary: null,
				};
			}

			const summary = {
				totalOrders: orders.length,
				totalItems: orders.reduce((sum, order) => sum + order.quantity, 0),
				totalAmount: orders.reduce(
					(sum, order) => sum + Number(order.totalPrice),
					0
				),
				firstOrderDate: new Date(
					Math.min(...orders.map((o) => new Date(o.createdAt)))
				),
				lastOrderDate: new Date(
					Math.max(...orders.map((o) => new Date(o.createdAt)))
				),
				items: orders.map((order) => ({
					name: order.merchandise.name,
					quantity: order.quantity,
					selectedSize: order.selectedSize,
					totalPrice: Number(order.totalPrice),
					images: order.merchandise.images,
					orderDate: order.createdAt,
				})),
			};

			return {
				hasOrders: true,
				summary,
			};
		} catch (error) {
			console.error("Get user order summary error:", error);
			throw new Error("Failed to get user order summary");
		}
	}

	/**
	 * Validate checkout eligibility
	 */
	static async validateCheckoutEligibility(registrationId) {
		try {
			const registration = await prisma.eventRegistration.findUnique({
				where: { id: registrationId },
				include: {
					event: {
						select: {
							eventDate: true,
							allowFormModification: true,
							formModificationDeadlineHours: true,
							hasMerchandise: true,
						},
					},
				},
			});

			if (!registration) {
				return {
					canCheckout: false,
					reason: "Registration not found",
				};
			}

			if (!registration.event.hasMerchandise) {
				return {
					canCheckout: false,
					reason: "Merchandise not available for this event",
				};
			}

			if (registration.status !== "CONFIRMED") {
				return {
					canCheckout: false,
					reason: "Registration must be confirmed to purchase merchandise",
				};
			}

			// Check modification deadline (same rules as registration modification)
			const modificationCheck = this.canModifyRegistration(registration);
			if (!modificationCheck.allowed) {
				return {
					canCheckout: false,
					reason: modificationCheck.reason,
				};
			}

			// Get cart items and validate
			const cartItems = await prisma.eventMerchandiseOrder.findMany({
				where: { registrationId },
				include: {
					merchandise: {
						select: {
							stockQuantity: true,
							isActive: true,
							name: true,
						},
					},
				},
			});

			if (cartItems.length === 0) {
				return {
					canCheckout: false,
					reason: "Cart is empty",
				};
			}

			// Check stock availability for all items
			const stockIssues = [];
			for (const item of cartItems) {
				if (!item.merchandise.isActive) {
					stockIssues.push(`${item.merchandise.name} is no longer available`);
				} else if (
					item.merchandise.stockQuantity !== null &&
					item.merchandise.stockQuantity < item.quantity
				) {
					stockIssues.push(
						`Insufficient stock for ${item.merchandise.name}. Available: ${item.merchandise.stockQuantity}`
					);
				}
			}

			if (stockIssues.length > 0) {
				return {
					canCheckout: false,
					reason: "Stock issues found",
					stockIssues,
				};
			}

			return {
				canCheckout: true,
				cartItemCount: cartItems.length,
				totalAmount: cartItems.reduce(
					(sum, item) => sum + Number(item.totalPrice),
					0
				),
			};
		} catch (error) {
			console.error("Validate checkout eligibility error:", error);
			return {
				canCheckout: false,
				reason: "Checkout validation failed",
			};
		}
	}
}

module.exports = EventService;
