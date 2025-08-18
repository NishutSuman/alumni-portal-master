// src/middleware/validation.middleware.js
const Joi = require("joi");

// Validation schemas
const schemas = {
	// Post validation schema
	createPost: Joi.object({
		title: Joi.string().trim().min(3).max(200).required().messages({
			"string.empty": "Title is required",
			"string.min": "Title must be at least 3 characters long",
			"string.max": "Title must be less than 200 characters",
		}),

		body: Joi.string().trim().min(10).max(50000).required().messages({
			"string.empty": "Body content is required",
			"string.min": "Body content must be at least 10 characters long",
			"string.max": "Body content must be less than 50,000 characters",
		}),

		category: Joi.string()
			.valid("MOM", "STORY", "POST", "NOTICE", "ANNOUNCEMENT")
			.required()
			.messages({
				"any.only":
					"Category must be one of: MOM, STORY, POST, NOTICE, ANNOUNCEMENT",
				"any.required": "Category is required",
			}),

		linkedEventId: Joi.string().uuid().optional().allow(null, ""),

		tags: Joi.alternatives()
			.try(Joi.array().items(Joi.string().uuid()), Joi.string())
			.optional(),

		allowComments: Joi.boolean().default(true).optional(),

		allowLikes: Joi.boolean().default(true).optional(),
	}),

	// Update post schema (all fields optional)
	updatePost: Joi.object({
		title: Joi.string().trim().min(3).max(200).optional(),

		body: Joi.string().trim().min(10).max(50000).optional(),

		category: Joi.string()
			.valid("MOM", "STORY", "POST", "NOTICE", "ANNOUNCEMENT")
			.optional(),

		linkedEventId: Joi.string().uuid().optional().allow(null, ""),

		tags: Joi.alternatives()
			.try(Joi.array().items(Joi.string().uuid()), Joi.string())
			.optional(),

		allowComments: Joi.boolean().optional(),

		allowLikes: Joi.boolean().optional(),
	}),

	// Post approval schema
	approvePost: Joi.object({
		action: Joi.string().valid("approve", "reject").required().messages({
			"any.only": 'Action must be either "approve" or "reject"',
			"any.required": "Action is required",
		}),

		reason: Joi.string().trim().max(500).optional().allow(""),
	}),

	// User profile update schema
	updateProfile: Joi.object({
		fullName: Joi.string().trim().min(2).max(100).optional(),

		dateOfBirth: Joi.date().max("now").optional().allow(null),

		whatsappNumber: Joi.string()
			.pattern(/^[+]?[1-9]\d{1,14}$/)
			.optional()
			.allow(null, "")
			.messages({
				"string.pattern.base": "Invalid WhatsApp number format",
			}),

		alternateNumber: Joi.string()
			.pattern(/^[+]?[1-9]\d{1,14}$/)
			.optional()
			.allow(null, "")
			.messages({
				"string.pattern.base": "Invalid phone number format",
			}),

		bio: Joi.string().trim().max(1000).optional().allow(null, ""),

		employmentStatus: Joi.string()
			.valid("WORKING", "STUDYING", "OPEN_TO_WORK", "ENTREPRENEUR", "RETIRED")
			.optional(),

		linkedinUrl: Joi.string().uri().optional().allow(null, ""),

		instagramUrl: Joi.string().uri().optional().allow(null, ""),

		facebookUrl: Joi.string().uri().optional().allow(null, ""),

		twitterUrl: Joi.string().uri().optional().allow(null, ""),

		youtubeUrl: Joi.string().uri().optional().allow(null, ""),

		portfolioUrl: Joi.string().uri().optional().allow(null, ""),

		isProfilePublic: Joi.boolean().optional(),

		showEmail: Joi.boolean().optional(),

		showPhone: Joi.boolean().optional(),
	}),

	// Address update schema
	updateAddress: Joi.object({
		addressLine1: Joi.string().trim().min(5).max(200).required(),

		addressLine2: Joi.string().trim().max(200).optional().allow(null, ""),

		city: Joi.string().trim().min(2).max(100).required(),

		state: Joi.string().trim().min(2).max(100).required(),

		postalCode: Joi.string()
			.trim()
			.pattern(/^[0-9]{6}$/)
			.required()
			.messages({
				"string.pattern.base": "Postal code must be 6 digits",
			}),

		country: Joi.string().trim().min(2).max(100).default("India").optional(),
	}),

	// Education schema
	addEducation: Joi.object({
		course: Joi.string().trim().min(2).max(100).required(),

		stream: Joi.string().trim().max(100).optional().allow(null, ""),

		institution: Joi.string().trim().min(2).max(200).required(),

		fromYear: Joi.number()
			.integer()
			.min(1950)
			.max(new Date().getFullYear())
			.required(),

		toYear: Joi.number()
			.integer()
			.min(Joi.ref("fromYear"))
			.max(new Date().getFullYear() + 10)
			.optional()
			.allow(null),

		isOngoing: Joi.boolean().default(false).optional(),

		description: Joi.string().trim().max(500).optional().allow(null, ""),
	}),

	// Work experience schema
	addWorkExperience: Joi.object({
		companyName: Joi.string().trim().min(2).max(200).required(),

		jobRole: Joi.string().trim().min(2).max(200).required(),

		companyType: Joi.string()
			.valid(
				"GOVERNMENT",
				"PRIVATE",
				"STARTUP",
				"NGO",
				"FREELANCE",
				"SELF_EMPLOYED"
			)
			.optional()
			.allow(null),

		workAddress: Joi.string().trim().max(300).optional().allow(null, ""),

		fromYear: Joi.number()
			.integer()
			.min(1950)
			.max(new Date().getFullYear())
			.required(),

		toYear: Joi.number()
			.integer()
			.min(Joi.ref("fromYear"))
			.max(new Date().getFullYear() + 1)
			.optional()
			.allow(null),

		isCurrentJob: Joi.boolean().default(false).optional(),

		description: Joi.string().trim().max(1000).optional().allow(null, ""),
	}),
};

// Generic validation middleware factory
const validate = (schemaName, property = "body") => {
	return (req, res, next) => {
		const schema = schemas[schemaName];

		if (!schema) {
			return res.status(500).json({
				success: false,
				message: "Validation schema not found",
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
				message: "Validation failed",
				errors,
			});
		}

		// Replace the property with validated and sanitized data
		req[property] = value;
		next();
	};
};

// Specific validation middlewares
const validateCreatePost = validate("createPost");
const validateUpdatePost = validate("updatePost");
const validateApprovePost = validate("approvePost");
const validateUpdateProfile = validate("updateProfile");
const validateUpdateAddress = validate("updateAddress");
const validateAddEducation = validate("addEducation");
const validateAddWorkExperience = validate("addWorkExperience");

// Custom validation for parameters
const validateParams = (schema) => {
	return (req, res, next) => {
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
				message: "Parameter validation failed",
				errors,
			});
		}

		req.params = value;
		next();
	};
};

// Common parameter schemas
const paramSchemas = {
	postId: Joi.object({
		postId: Joi.string().uuid().required(),
	}),

	userId: Joi.object({
		userId: Joi.string().uuid().required(),
	}),

	educationId: Joi.object({
		educationId: Joi.string().uuid().required(),
	}),

	workId: Joi.object({
		workId: Joi.string().uuid().required(),
	}),

	addressType: Joi.object({
		addressType: Joi.string().valid("permanent", "current").required(),
	}),
};

// Parameter validation middlewares
const validatePostIdParam = validateParams(paramSchemas.postId);
const validateUserIdParam = validateParams(paramSchemas.userId);
const validateEducationIdParam = validateParams(paramSchemas.educationId);
const validateWorkIdParam = validateParams(paramSchemas.workId);
const validateAddressTypeParam = validateParams(paramSchemas.addressType);

module.exports = {
	validate,
	validateCreatePost,
	validateUpdatePost,
	validateApprovePost,
	validateUpdateProfile,
	validateUpdateAddress,
	validateAddEducation,
	validateAddWorkExperience,
	validatePostIdParam,
	validateUserIdParam,
	validateEducationIdParam,
	validateWorkIdParam,
	validateAddressTypeParam,
	schemas,
};
