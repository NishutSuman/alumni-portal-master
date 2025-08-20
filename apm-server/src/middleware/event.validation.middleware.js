// src/middleware/event.validation.js
const Joi = require("joi");

// Event validation schemas
const eventSchemas = {
	// Event Category validation
	createEventCategory: Joi.object({
		name: Joi.string().trim().min(2).max(50).required().messages({
			"string.empty": "Category name is required",
			"string.min": "Category name must be at least 2 characters long",
			"string.max": "Category name must be less than 50 characters",
		}),

		description: Joi.string()
			.trim()
			.max(500)
			.optional()
			.allow(null, "")
			.messages({
				"string.max": "Description must be less than 500 characters",
			}),
	}),

	updateEventCategory: Joi.object({
		name: Joi.string().trim().min(2).max(50).optional(),
		description: Joi.string().trim().max(500).optional().allow(null, ""),
		isActive: Joi.boolean().optional(),
	}),

	// Event validation
	createEvent: Joi.object({
		title: Joi.string().trim().min(3).max(200).required().messages({
			"string.empty": "Event title is required",
			"string.min": "Event title must be at least 3 characters long",
			"string.max": "Event title must be less than 200 characters",
		}),

		description: Joi.string().trim().min(10).max(10000).required().messages({
			"string.empty": "Event description is required",
			"string.min": "Event description must be at least 10 characters long",
			"string.max": "Event description must be less than 10,000 characters",
		}),

		categoryId: Joi.string().uuid().required().messages({
			"string.uuid": "Invalid category ID format",
			"any.required": "Category is required",
		}),

		eventDate: Joi.date().min("now").required().messages({
			"date.min": "Event date cannot be in the past",
			"any.required": "Event date is required",
		}),

		startTime: Joi.string()
			.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
			.optional()
			.allow(null, "")
			.messages({
				"string.pattern.base": "Start time must be in HH:MM format",
			}),

		endTime: Joi.string()
			.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
			.optional()
			.allow(null, "")
			.messages({
				"string.pattern.base": "End time must be in HH:MM format",
			}),

		registrationStartDate: Joi.date().optional().allow(null),
		registrationEndDate: Joi.date().optional().allow(null),

		venue: Joi.string().trim().max(300).optional().allow(null, ""),
		meetingLink: Joi.string().uri().optional().allow(null, ""),

		maxCapacity: Joi.number()
			.integer()
			.min(1)
			.max(50000)
			.optional()
			.allow(null),

		eventMode: Joi.string()
			.valid("PHYSICAL", "VIRTUAL", "HYBRID")
			.default("PHYSICAL")
			.optional(),

		status: Joi.string()
			.valid(
				"DRAFT",
				"PUBLISHED",
				"REGISTRATION_OPEN",
				"REGISTRATION_CLOSED",
				"ONGOING",
				"COMPLETED",
				"CANCELLED",
				"ARCHIVED"
			)
			.default("DRAFT")
			.optional(),

		// Feature flags
		hasRegistration: Joi.boolean().default(true).optional(),
		hasExternalLink: Joi.boolean().default(false).optional(),
		externalRegistrationLink: Joi.string().uri().optional().allow(null, ""),
		hasCustomForm: Joi.boolean().default(false).optional(),
		hasMeals: Joi.boolean().default(false).optional(),
		hasGuests: Joi.boolean().default(false).optional(),
		hasDonations: Joi.boolean().default(false).optional(),
		hasMerchandise: Joi.boolean().default(false).optional(),
		hasPrizes: Joi.boolean().default(false).optional(),
		hasSponsors: Joi.boolean().default(false).optional(),
		hasOrganizers: Joi.boolean().default(false).optional(),

		// Settings
		allowFormModification: Joi.boolean().default(true).optional(),
		formModificationDeadlineHours: Joi.number()
			.integer()
			.min(0)
			.max(168)
			.default(24)
			.optional(), // Max 1 week

		// Fees
		registrationFee: Joi.number().min(0).max(100000).default(0).optional(),
		guestFee: Joi.number().min(0).max(100000).default(0).optional(),
	}),

	updateEvent: Joi.object({
		title: Joi.string().trim().min(3).max(200).optional(),
		description: Joi.string().trim().min(10).max(10000).optional(),
		categoryId: Joi.string().uuid().optional(),
		eventDate: Joi.date().optional(),
		startTime: Joi.string()
			.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
			.optional()
			.allow(null, ""),
		endTime: Joi.string()
			.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
			.optional()
			.allow(null, ""),
		registrationStartDate: Joi.date().optional().allow(null),
		registrationEndDate: Joi.date().optional().allow(null),
		venue: Joi.string().trim().max(300).optional().allow(null, ""),
		meetingLink: Joi.string().uri().optional().allow(null, ""),
		maxCapacity: Joi.number()
			.integer()
			.min(1)
			.max(50000)
			.optional()
			.allow(null),
		eventMode: Joi.string().valid("PHYSICAL", "VIRTUAL", "HYBRID").optional(),
		status: Joi.string()
			.valid(
				"DRAFT",
				"PUBLISHED",
				"REGISTRATION_OPEN",
				"REGISTRATION_CLOSED",
				"ONGOING",
				"COMPLETED",
				"CANCELLED",
				"ARCHIVED"
			)
			.optional(),
		hasRegistration: Joi.boolean().optional(),
		hasExternalLink: Joi.boolean().optional(),
		externalRegistrationLink: Joi.string().uri().optional().allow(null, ""),
		hasCustomForm: Joi.boolean().optional(),
		hasMeals: Joi.boolean().optional(),
		hasGuests: Joi.boolean().optional(),
		hasDonations: Joi.boolean().optional(),
		hasMerchandise: Joi.boolean().optional(),
		hasPrizes: Joi.boolean().optional(),
		hasSponsors: Joi.boolean().optional(),
		hasOrganizers: Joi.boolean().optional(),
		allowFormModification: Joi.boolean().optional(),
		formModificationDeadlineHours: Joi.number()
			.integer()
			.min(0)
			.max(168)
			.optional(),
		registrationFee: Joi.number().min(0).max(100000).optional(),
		guestFee: Joi.number().min(0).max(100000).optional(),
	}),

	updateEventStatus: Joi.object({
		status: Joi.string()
			.valid(
				"DRAFT",
				"PUBLISHED",
				"REGISTRATION_OPEN",
				"REGISTRATION_CLOSED",
				"ONGOING",
				"COMPLETED",
				"CANCELLED",
				"ARCHIVED"
			)
			.required()
			.messages({
				"any.only": "Invalid event status",
				"any.required": "Status is required",
			}),
	}),

	// Event Section validation
	createEventSection: Joi.object({
		sectionType: Joi.string()
			.valid(
				"SCHEDULE",
				"ORGANIZERS",
				"LOCATION",
				"PRIZES",
				"SPONSORS",
				"DONATIONS",
				"MERCHANDISE",
				"CUSTOM"
			)
			.required()
			.messages({
				"any.only": "Invalid section type",
				"any.required": "Section type is required",
			}),

		title: Joi.string().trim().min(2).max(100).required().messages({
			"string.empty": "Section title is required",
			"string.min": "Section title must be at least 2 characters long",
			"string.max": "Section title must be less than 100 characters",
		}),

		content: Joi.string().trim().min(5).max(10000).required().messages({
			"string.empty": "Section content is required",
			"string.min": "Section content must be at least 5 characters long",
			"string.max": "Section content must be less than 10,000 characters",
		}),

		orderIndex: Joi.number().integer().min(0).max(1000).default(0).optional(),
		isVisible: Joi.boolean().default(true).optional(),
	}),

	updateEventSection: Joi.object({
		sectionType: Joi.string()
			.valid(
				"SCHEDULE",
				"ORGANIZERS",
				"LOCATION",
				"PRIZES",
				"SPONSORS",
				"DONATIONS",
				"MERCHANDISE",
				"CUSTOM"
			)
			.optional(),

		title: Joi.string().trim().min(2).max(100).optional(),
		content: Joi.string().trim().min(5).max(10000).optional(),
		orderIndex: Joi.number().integer().min(0).max(1000).optional(),
		isVisible: Joi.boolean().optional(),
	}),

	reorderEventSections: Joi.object({
		sectionOrders: Joi.array()
			.items(
				Joi.object({
					sectionId: Joi.string().uuid().required(),
					orderIndex: Joi.number().integer().min(0).max(1000).required(),
				})
			)
			.min(1)
			.required()
			.messages({
				"array.min": "At least one section order is required",
				"any.required": "Section orders array is required",
			}),
	}),

	// User Registration validation schemas
	userRegistration: Joi.object({
		mealPreference: Joi.string()
			.valid("VEG", "NON_VEG")
			.optional()
			.allow(null)
			.messages({
				"any.only": "Meal preference must be either VEG or NON_VEG",
			}),

		formResponses: Joi.array()
			.items(
				Joi.object({
					fieldId: Joi.string().uuid().required().messages({
						"string.uuid": "Invalid field ID format",
						"any.required": "Field ID is required",
					}),
					response: Joi.string().trim().required().messages({
						"string.empty": "Response cannot be empty",
						"any.required": "Response is required",
					}),
				})
			)
			.optional()
			.default([])
			.messages({
				"array.base": "Form responses must be an array",
			}),

		agreeToTerms: Joi.boolean().valid(true).required().messages({
			"any.only": "You must agree to the terms and conditions",
			"any.required": "Agreement to terms is required",
		}),

		// Event Form validation schemas (ADD TO EXISTING eventSchemas object)
		createEventForm: Joi.object({
			title: Joi.string()
				.trim()
				.min(3)
				.max(200)
				.optional()
				.default("Registration Form")
				.messages({
					"string.min": "Form title must be at least 3 characters long",
					"string.max": "Form title must be less than 200 characters",
				}),

			description: Joi.string()
				.trim()
				.max(1000)
				.optional()
				.allow(null, "")
				.messages({
					"string.max": "Form description must be less than 1000 characters",
				}),

			isActive: Joi.boolean().optional().default(true),
		}),

		updateEventForm: Joi.object({
			title: Joi.string().trim().min(3).max(200).optional(),
			description: Joi.string().trim().max(1000).optional().allow(null, ""),
			isActive: Joi.boolean().optional(),
		}),

		createEventFormField: Joi.object({
			fieldName: Joi.string()
				.trim()
				.pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
				.min(2)
				.max(50)
				.required()
				.messages({
					"string.empty": "Field name is required",
					"string.pattern.base":
						"Field name must start with a letter and contain only letters, numbers, and underscores",
					"string.min": "Field name must be at least 2 characters long",
					"string.max": "Field name must be less than 50 characters",
				}),

			fieldLabel: Joi.string().trim().min(2).max(200).required().messages({
				"string.empty": "Field label is required",
				"string.min": "Field label must be at least 2 characters long",
				"string.max": "Field label must be less than 200 characters",
			}),

			fieldType: Joi.string()
				.valid(
					"TEXT",
					"EMAIL",
					"PHONE",
					"TEXTAREA",
					"SELECT",
					"RADIO",
					"CHECKBOX"
				)
				.required()
				.messages({
					"any.only": "Invalid field type",
					"any.required": "Field type is required",
				}),

			options: Joi.when("fieldType", {
				is: Joi.string().valid("SELECT", "RADIO", "CHECKBOX"),
				then: Joi.array()
					.items(Joi.string().trim().min(1).max(100))
					.min(1)
					.max(20)
					.required()
					.messages({
						"array.min": "At least one option is required for this field type",
						"array.max": "Maximum 20 options allowed",
						"any.required": "Options are required for this field type",
					}),
				otherwise: Joi.optional().allow(null),
			}),

			isRequired: Joi.boolean().optional().default(false),

			orderIndex: Joi.number().integer().min(0).max(1000).optional().default(0),

			validation: Joi.object({
				minLength: Joi.number().integer().min(0).max(1000).optional(),
				maxLength: Joi.number().integer().min(0).max(10000).optional(),
				pattern: Joi.string().optional(),
				min: Joi.number().optional(),
				max: Joi.number().optional(),
			})
				.optional()
				.allow(null),
		}),

		updateEventFormField: Joi.object({
			fieldLabel: Joi.string().trim().min(2).max(200).optional(),
			fieldType: Joi.string()
				.valid(
					"TEXT",
					"EMAIL",
					"PHONE",
					"TEXTAREA",
					"SELECT",
					"RADIO",
					"CHECKBOX"
				)
				.optional(),
			options: Joi.when("fieldType", {
				is: Joi.string().valid("SELECT", "RADIO", "CHECKBOX"),
				then: Joi.array()
					.items(Joi.string().trim().min(1).max(100))
					.min(1)
					.max(20)
					.optional(),
				otherwise: Joi.optional().allow(null),
			}),
			isRequired: Joi.boolean().optional(),
			orderIndex: Joi.number().integer().min(0).max(1000).optional(),
			validation: Joi.object({
				minLength: Joi.number().integer().min(0).max(1000).optional(),
				maxLength: Joi.number().integer().min(0).max(10000).optional(),
				pattern: Joi.string().optional(),
				min: Joi.number().optional(),
				max: Joi.number().optional(),
			})
				.optional()
				.allow(null),
		}),

		reorderEventFormFields: Joi.object({
			fieldOrders: Joi.array()
				.items(
					Joi.object({
						fieldId: Joi.string().uuid().required(),
						orderIndex: Joi.number().integer().min(0).max(1000).required(),
					})
				)
				.min(1)
				.required()
				.messages({
					"array.min": "At least one field order is required",
					"any.required": "Field orders array is required",
				}),
		}),
	}),

	updateUserRegistration: Joi.object({
		mealPreference: Joi.string().valid("VEG", "NON_VEG").optional().allow(null),

		formResponses: Joi.array()
			.items(
				Joi.object({
					fieldId: Joi.string().uuid().required(),
					response: Joi.string().trim().required(),
				})
			)
			.optional(),
	}),

	// Guest Management validation schemas (ADD TO EXISTING eventSchemas object)
	addGuest: Joi.object({
		name: Joi.string().trim().min(2).max(100).required().messages({
			"string.empty": "Guest name is required",
			"string.min": "Guest name must be at least 2 characters long",
			"string.max": "Guest name must be less than 100 characters",
		}),

		email: Joi.string().trim().email().optional().allow(null, "").messages({
			"string.email": "Guest email must be a valid email address",
		}),

		phone: Joi.string()
			.trim()
			.pattern(/^[\+]?[1-9][\d]{0,15}$/)
			.optional()
			.allow(null, "")
			.messages({
				"string.pattern.base": "Guest phone number must be valid",
			}),

		mealPreference: Joi.string()
			.valid("VEG", "NON_VEG")
			.optional()
			.allow(null)
			.messages({
				"any.only": "Meal preference must be either VEG or NON_VEG",
			}),
	}),

	updateGuest: Joi.object({
		name: Joi.string().trim().min(2).max(100).optional().messages({
			"string.min": "Guest name must be at least 2 characters long",
			"string.max": "Guest name must be less than 100 characters",
		}),

		email: Joi.string().trim().email().optional().allow(null, "").messages({
			"string.email": "Guest email must be a valid email address",
		}),

		phone: Joi.string()
			.trim()
			.pattern(/^[\+]?[1-9][\d]{0,15}$/)
			.optional()
			.allow(null, "")
			.messages({
				"string.pattern.base": "Guest phone number must be valid",
			}),

		mealPreference: Joi.string()
			.valid("VEG", "NON_VEG")
			.optional()
			.allow(null)
			.messages({
				"any.only": "Meal preference must be either VEG or NON_VEG",
			}),
	}),

	guestFormResponse: Joi.object({
		formResponses: Joi.array()
			.items(
				Joi.object({
					fieldId: Joi.string().uuid().required().messages({
						"string.uuid": "Invalid field ID format",
						"any.required": "Field ID is required",
					}),
					response: Joi.string().trim().required().messages({
						"string.empty": "Response cannot be empty",
						"any.required": "Response is required",
					}),
				})
			)
			.required()
			.min(1)
			.messages({
				"array.base": "Form responses must be an array",
				"array.min": "At least one form response is required",
				"any.required": "Form responses are required",
			}),
	}),

	updateGuestFormResponse: Joi.object({
		formResponses: Joi.array()
			.items(
				Joi.object({
					fieldId: Joi.string().uuid().required(),
					response: Joi.string().trim().required(),
				})
			)
			.optional()
			.messages({
				"array.base": "Form responses must be an array",
			}),
	}),

	// Parameter validation for guest routes
	guestParams: Joi.object({
		eventId: Joi.string().required().messages({
			"any.required": "Event ID is required",
		}),
		guestId: Joi.string().uuid().required().messages({
			"string.uuid": "Invalid guest ID format",
			"any.required": "Guest ID is required",
		}),
	}),
};

// Generic validation middleware factory for events
const validateEvent = (schemaName, property = "body") => {
	return (req, res, next) => {
		const schema = eventSchemas[schemaName];

		if (!schema) {
			return res.status(500).json({
				success: false,
				message: "Event validation schema not found",
			});
		}

		const { error, value } = schema.validate(req[property], {
			abortEarly: false, // Return all errors
			stripUnknown: true, // Remove unknown fields
			convert: true, // Convert types when possible
		});

		if (error) {
			const errors = error.details.map((detail) => ({
				field: detail.path.join("."),
				message: detail.message,
			}));

			return res.status(400).json({
				success: false,
				message: "Event validation failed",
				errors,
			});
		}

		// Replace the property with validated and sanitized data
		req[property] = value;
		next();
	};
};

// Custom validation for event business logic
const validateEventDates = (req, res, next) => {
	const {
		eventDate,
		registrationStartDate,
		registrationEndDate,
		startTime,
		endTime,
	} = req.body;

	try {
		const errors = [];

		// Validate registration dates relationship
		if (registrationStartDate && registrationEndDate) {
			const regStart = new Date(registrationStartDate);
			const regEnd = new Date(registrationEndDate);

			if (regStart >= regEnd) {
				errors.push({
					field: "registrationEndDate",
					message: "Registration end date must be after start date",
				});
			}

			if (eventDate) {
				const eventDateTime = new Date(eventDate);
				if (regEnd > eventDateTime) {
					errors.push({
						field: "registrationEndDate",
						message: "Registration end date cannot be after event date",
					});
				}
			}
		}

		// Validate event start and end times
		if (startTime && endTime) {
			const [startHour, startMin] = startTime.split(":").map(Number);
			const [endHour, endMin] = endTime.split(":").map(Number);

			const startMinutes = startHour * 60 + startMin;
			const endMinutes = endHour * 60 + endMin;

			if (startMinutes >= endMinutes) {
				errors.push({
					field: "endTime",
					message: "End time must be after start time",
				});
			}
		}

		// Validate external link requirement
		const { hasExternalLink, externalRegistrationLink } = req.body;
		if (hasExternalLink && !externalRegistrationLink) {
			errors.push({
				field: "externalRegistrationLink",
				message:
					"External registration link is required when external link is enabled",
			});
		}

		if (errors.length > 0) {
			return res.status(400).json({
				success: false,
				message: "Event date validation failed",
				errors,
			});
		}

		next();
	} catch (error) {
		console.error("Event date validation error:", error);
		return res.status(500).json({
			success: false,
			message: "Date validation failed",
		});
	}
};

// Event parameter validation schemas
const eventParamSchemas = {
	eventId: Joi.object({
		eventId: Joi.string().required().messages({
			"any.required": "Event ID is required",
		}),
	}),

	categoryId: Joi.object({
		categoryId: Joi.string().uuid().required().messages({
			"string.uuid": "Invalid category ID format",
			"any.required": "Category ID is required",
		}),
	}),

	eventAndSection: Joi.object({
		eventId: Joi.string().required().messages({
			"any.required": "Event ID is required",
		}),
		sectionId: Joi.string().uuid().required().messages({
			"string.uuid": "Invalid section ID format",
			"any.required": "Section ID is required",
		}),
	}),

	guestParams: Joi.object({
		eventId: Joi.string().required().messages({
			"any.required": "Event ID is required",
		}),
		guestId: Joi.string().uuid().required().messages({
			"string.uuid": "Invalid guest ID format",
			"any.required": "Guest ID is required",
		}),
	}),
};

// Parameter validation middleware
const validateEventParams = (schemaName) => {
	return (req, res, next) => {
		const schema = eventParamSchemas[schemaName];

		if (!schema) {
			return res.status(500).json({
				success: false,
				message: "Event parameter validation schema not found",
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
				message: "Event parameter validation failed",
				errors,
			});
		}

		req.params = value;
		next();
	};
};

// Additional custom validation for user registration
const validateRegistrationBusinessRules = (req, res, next) => {
	const { eventId } = req.params;

	try {
		const errors = [];

		// Validate event exists and registration is allowed (this will be checked in controller)
		// This middleware focuses on request structure validation

		if (!eventId) {
			errors.push({
				field: "eventId",
				message: "Event ID is required",
			});
		}

		if (errors.length > 0) {
			return res.status(400).json({
				success: false,
				message: "Registration validation failed",
				errors,
			});
		}

		next();
	} catch (error) {
		console.error("Registration business rules validation error:", error);
		return res.status(500).json({
			success: false,
			message: "Registration validation failed",
		});
	}
};

// Form field validation helper
const validateFormFieldOptions = (req, res, next) => {
	const { fieldType, options } = req.body;

	try {
		const errors = [];

		// Check if options are required but missing
		if (["SELECT", "RADIO", "CHECKBOX"].includes(fieldType)) {
			if (!options || !Array.isArray(options) || options.length === 0) {
				errors.push({
					field: "options",
					message: `Options are required for ${fieldType} field type`,
				});
			} else {
				// Validate option uniqueness
				const uniqueOptions = new Set(
					options.map((opt) => opt.trim().toLowerCase())
				);
				if (uniqueOptions.size !== options.length) {
					errors.push({
						field: "options",
						message: "Duplicate options are not allowed",
					});
				}
			}
		}

		if (errors.length > 0) {
			return res.status(400).json({
				success: false,
				message: "Form field validation failed",
				errors,
			});
		}

		next();
	} catch (error) {
		console.error("Form field options validation error:", error);
		return res.status(500).json({
			success: false,
			message: "Form field validation failed",
		});
	}
};

// Additional custom validation for guest management
const validateGuestBusinessRules = async (req, res, next) => {
	const { eventId } = req.params;
	const userId = req.user.id;

	try {
		const errors = [];

		// Check if user has a confirmed registration for this event
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
					},
				},
			},
		});

		if (!registration) {
			errors.push({
				field: "registration",
				message: "You must be registered for this event to add guests",
			});
		} else {
			// Check if event allows guests
			if (!registration.event.hasGuests) {
				errors.push({
					field: "event",
					message: "This event does not allow guests",
				});
			}

			// Check if registration is confirmed
			if (registration.status !== "CONFIRMED") {
				errors.push({
					field: "registration",
					message: "Your registration must be confirmed to add guests",
				});
			}

			// Store registration in request for use in controller
			req.userRegistration = registration;
		}

		if (errors.length > 0) {
			return res.status(400).json({
				success: false,
				message: "Guest management validation failed",
				errors,
			});
		}

		next();
	} catch (error) {
		console.error("Guest business rules validation error:", error);
		return res.status(500).json({
			success: false,
			message: "Guest validation failed",
		});
	}
};

// Validation for guest form submission
const validateGuestFormBusinessRules = async (req, res, next) => {
	const { eventId, guestId } = req.params;
	const userId = req.user.id;

	try {
		const errors = [];

		// Check if guest belongs to user's registration
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
								hasCustomForm: true,
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
			errors.push({
				field: "guest",
				message: "Guest not found or does not belong to your registration",
			});
		} else {
			// Check if event has custom form
			if (!guest.registration.event.hasCustomForm) {
				errors.push({
					field: "event",
					message: "This event does not have a custom form",
				});
			}

			// Check if guest is active
			if (guest.status !== "ACTIVE") {
				errors.push({
					field: "guest",
					message: "Cannot submit form for inactive guest",
				});
			}

			// Store guest in request for use in controller
			req.guestData = guest;
		}

		if (errors.length > 0) {
			return res.status(400).json({
				success: false,
				message: "Guest form validation failed",
				errors,
			});
		}

		next();
	} catch (error) {
		console.error("Guest form business rules validation error:", error);
		return res.status(500).json({
			success: false,
			message: "Guest form validation failed",
		});
	}
};

// Specific validation middlewares
const validateCreateEventCategory = validateEvent("createEventCategory");
const validateUpdateEventCategory = validateEvent("updateEventCategory");
const validateCreateEvent = validateEvent("createEvent");
const validateUpdateEvent = validateEvent("updateEvent");
const validateUpdateEventStatus = validateEvent("updateEventStatus");
const validateCreateEventSection = validateEvent("createEventSection");
const validateUpdateEventSection = validateEvent("updateEventSection");
const validateReorderEventSections = validateEvent("reorderEventSections");

// Parameter validation middlewares
const validateEventIdParam = validateEventParams("eventId");
const validateCategoryIdParam = validateEventParams("categoryId");
const validateEventAndSectionParams = validateEventParams("eventAndSection");

// User Registration Middleware
const validateUserRegistration = validateEvent("userRegistration");
const validateUpdateUserRegistration = validateEvent("updateUserRegistration");
const validateCreateEventForm = validateEvent("createEventForm");
const validateUpdateEventForm = validateEvent("updateEventForm");
const validateCreateEventFormField = validateEvent("createEventFormField");
const validateUpdateEventFormField = validateEvent("updateEventFormField");
const validateReorderEventFormFields = validateEvent("reorderEventFormFields");

// Guest validation middleware
const validateAddGuest = validateEvent("addGuest");
const validateUpdateGuest = validateEvent("updateGuest");
const validateGuestFormResponse = validateEvent("guestFormResponse");
const validateUpdateGuestFormResponse = validateEvent(
	"updateGuestFormResponse"
);

// Parameter validation middleware for guest routes
const validateGuestParams = validateEventParams("guestParams");

module.exports = {
	validateEvent,
	validateEventDates,
	validateCreateEventCategory,
	validateUpdateEventCategory,
	validateCreateEvent,
	validateUpdateEvent,
	validateUpdateEventStatus,
	validateCreateEventSection,
	validateUpdateEventSection,
	validateReorderEventSections,
	validateEventIdParam,
	validateCategoryIdParam,
	validateEventAndSectionParams,

	// NEW: User registration validation
	validateUserRegistration,
	validateUpdateUserRegistration,
	validateRegistrationBusinessRules,

	// NEW: Event form validation
	validateCreateEventForm,
	validateUpdateEventForm,
	validateCreateEventFormField,
	validateUpdateEventFormField,
	validateReorderEventFormFields,
	validateFormFieldOptions,

	// NEW: Guest validation
	validateAddGuest,
	validateUpdateGuest,
	validateGuestFormResponse,
	validateUpdateGuestFormResponse,
	validateGuestParams,
	validateGuestBusinessRules,
	validateGuestFormBusinessRules,

	eventSchemas,
};
