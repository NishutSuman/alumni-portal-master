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

    description: Joi.string().trim().max(500).optional().allow(null, "").messages({
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

    maxCapacity: Joi.number().integer().min(1).max(50000).optional().allow(null),

    eventMode: Joi.string()
      .valid("PHYSICAL", "VIRTUAL", "HYBRID")
      .default("PHYSICAL")
      .optional(),

    status: Joi.string()
      .valid("DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED", "ARCHIVED")
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
    formModificationDeadlineHours: Joi.number().integer().min(0).max(168).default(24).optional(), // Max 1 week

    // Fees
    registrationFee: Joi.number().min(0).max(100000).default(0).optional(),
    guestFee: Joi.number().min(0).max(100000).default(0).optional(),
  }),

  updateEvent: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description: Joi.string().trim().min(10).max(10000).optional(),
    categoryId: Joi.string().uuid().optional(),
    eventDate: Joi.date().optional(),
    startTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().allow(null, ""),
    endTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().allow(null, ""),
    registrationStartDate: Joi.date().optional().allow(null),
    registrationEndDate: Joi.date().optional().allow(null),
    venue: Joi.string().trim().max(300).optional().allow(null, ""),
    meetingLink: Joi.string().uri().optional().allow(null, ""),
    maxCapacity: Joi.number().integer().min(1).max(50000).optional().allow(null),
    eventMode: Joi.string().valid("PHYSICAL", "VIRTUAL", "HYBRID").optional(),
    status: Joi.string().valid("DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED", "ARCHIVED").optional(),
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
    formModificationDeadlineHours: Joi.number().integer().min(0).max(168).optional(),
    registrationFee: Joi.number().min(0).max(100000).optional(),
    guestFee: Joi.number().min(0).max(100000).optional(),
  }),

  updateEventStatus: Joi.object({
    status: Joi.string()
      .valid("DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED", "ARCHIVED")
      .required()
      .messages({
        "any.only": "Invalid event status",
        "any.required": "Status is required",
      }),
  }),

  // Event Section validation
  createEventSection: Joi.object({
    sectionType: Joi.string()
      .valid("SCHEDULE", "ORGANIZERS", "LOCATION", "PRIZES", "SPONSORS", "DONATIONS", "MERCHANDISE", "CUSTOM")
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
      .valid("SCHEDULE", "ORGANIZERS", "LOCATION", "PRIZES", "SPONSORS", "DONATIONS", "MERCHANDISE", "CUSTOM")
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
  const { eventDate, registrationStartDate, registrationEndDate, startTime, endTime } = req.body;

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
        message: "External registration link is required when external link is enabled",
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
  eventSchemas,
};