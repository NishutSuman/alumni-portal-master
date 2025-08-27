// src/routes/events.route.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
	authenticateToken,
	requireRole,
	optionalAuth,
} = require("../middleware/auth.middleware");
const { asyncHandler } = require("../utils/response");
const {
	uploadEventImages,
	handleUploadError,
} = require("../middleware/upload.middleware");

const { checkMembershipStatus } = require('../middleware/membership.middleware');

// ==========================================
// CACHING MIDDLEWARE IMPORTS (MISSING!)
// ==========================================
const {
	EventCacheKeys,
	cacheEvent,
	cacheEventCategories,
	cacheEventCategory,
	cacheEventsList,
	cacheEventDetails,
	cacheEventSections,
	cacheEventSection,
	cacheEventStats,
	cacheEventForm,
	cacheEventFormFields,
	cacheRegistrationStats,
	cacheAdminRegistrationsList,
	cacheGuestStats,
	cacheGuestSummary,
	cacheRegistrationGuestSummary,
	cacheAdminGuestsList,
	cacheCombinedEventStats,
	EventCacheInvalidator,
	autoInvalidateFormCaches,
	autoInvalidateRegistrationCaches,
	autoInvalidateGuestCaches,
	cacheEventMerchandise,
	cacheMerchandiseItem,
	cacheUserCart,
	cacheUserOrders,
	cacheMerchandiseStats,
	cacheAdminMerchandiseOrders,
	autoInvalidateMerchandiseCaches,
	autoInvalidateCartCaches,
	autoInvalidateOrderCaches,
} = require("../middleware/event.cache.middleware");

// ==========================================
// VALIDATION MIDDLEWARE IMPORTS (COMPLETE)
// ==========================================
const {
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

	// Phase 2: User registration validation
	validateUserRegistration,
	validateUpdateUserRegistration,
	validateRegistrationBusinessRules,

	// Phase 2: Event form validation
	validateCreateEventForm,
	validateUpdateEventForm,
	validateCreateEventFormField,
	validateUpdateEventFormField,
	validateReorderEventFormFields,
	validateFormFieldOptions,

	// Phase 3: Guest validation
	validateAddGuest,
	validateUpdateGuest,
	validateGuestFormResponse,
	validateUpdateGuestFormResponse,
	validateGuestParams,
	validateGuestBusinessRules,
	validateGuestFormBusinessRules,

	// Merchandise Validation
	validateAddMerchandise,
	validateUpdateMerchandise,
	validateReorderMerchandise,
	validateAddToCart,
	validateUpdateCartItem,
	validateCheckoutCart,
	validateMerchandiseParams,
	validateCartParams,
	validateMerchandiseBusinessRules,
	validateCartBusinessRules,
} = require("../middleware/event.validation.middleware");

// ==========================================
// FEEDBACK MIDDLEWARE IMPORTS
// ==========================================
const {
	validateCreateOrUpdateFeedbackForm,
	validateAddFeedbackField,
	validateUpdateFeedbackField,
	validateReorderFeedbackFields,
	validateSubmitFeedback,
	validateFeedbackFormAccess,
	validateFeedbackSubmission,
	validateFieldModification,
} = require("../middleware/feedback.validation.middleware");

const {
	cacheFeedbackForm,
	cacheFeedbackAnalytics,
	cacheFeedbackResponses,
	cacheUserFeedbackResponse,
	cacheFeedbackSummary,
	cacheFeedbackExport,
	invalidateFeedbackFormCache,
	invalidateResponseCache,
	invalidateAnalyticsCache,
} = require("../middleware/feedback.cache.middleware");

// ==========================================
// CONTROLLER IMPORTS (COMPLETE)
// ==========================================
const eventCategoryController = require("../controllers/eventControllers/eventCategory.controller");
const eventController = require("../controllers/eventControllers/event.controller");
const eventSectionController = require("../controllers/eventControllers/eventSection.controller");
const eventRegistrationController = require("../controllers/eventControllers/eventRegistration.controller");
const eventFormController = require("../controllers/eventControllers/eventForm.controller");
const eventGuestController = require("../controllers/eventControllers/eventGuest.controller");
const merchandiseController = require("../controllers/eventControllers/eventMerchandise.controller");
const merchandiseCartController = require("../controllers/eventControllers/merchandiseCart.controller");
const feedbackController = require("../controllers/eventControllers/eventFeedback.controller");
const QRCodeController = require("../controllers/qr/qrCode.controller");
const MerchandiseDeliveryController = require("../controllers/merchandise/merchandiseDelivery.controller");
const ExportController = require("../controllers/export/export.controller");
const RegistrationDashboardController = require('../controllers/dashboard/registrationDashboard.controller');

// ==========================================
// MULTER CONFIGURATION (EXISTING)
// ==========================================
const eventUploadStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadPath = "./public/uploads/events/";
		if (!fs.existsSync(uploadPath)) {
			fs.mkdirSync(uploadPath, { recursive: true });
		}
		cb(null, uploadPath);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const extension = path.extname(file.originalname);
		const baseName = path.basename(file.originalname, extension);
		const cleanBaseName = baseName
			.replace(/[^a-zA-Z0-9]/g, "_")
			.substring(0, 50);
		const filename = `${cleanBaseName}_${uniqueSuffix}${extension}`;
		cb(null, filename);
	},
});

const eventFileFilter = (req, file, cb) => {
	const imageTypes = [
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
	];
	const documentTypes = [
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	];

	const allowedTypes = [...imageTypes, ...documentTypes];

	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error("Invalid file type. Only images and documents are allowed."),
			false
		);
	}
};

const uploadEventFiles = multer({
	storage: eventUploadStorage,
	fileFilter: eventFileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
		files: 10, // Maximum 10 files
	},
});

// ==========================================
// EVENT CATEGORY ROUTES (PHASE 1)
// ==========================================

// Public event category routes (CACHED!)
router.get(
	"/categories",
	cacheEventCategories, // 🆕 CACHE: 2 hours
	asyncHandler(eventCategoryController.getAllCategories)
);

router.get(
	"/categories/:categoryId",
	validateCategoryIdParam,
	cacheEventCategory, // 🆕 CACHE: 1 hour with events
	asyncHandler(eventCategoryController.getCategoryById)
);

// Super Admin only routes (category management) - with cache invalidation
router.post(
	"/categories",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateCreateEventCategory,
	// Auto-invalidate category caches after successful creation
	asyncHandler(async (req, res, next) => {
		const result = await eventCategoryController.createCategory(req, res);
		if (res.statusCode === 201) {
			EventCacheInvalidator.invalidateAdminDashboardCaches();
		}
		return result;
	})
);

router.put(
	"/categories/:categoryId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateCategoryIdParam,
	validateUpdateEventCategory,
	// Auto-invalidate category caches after successful update
	asyncHandler(async (req, res, next) => {
		const result = await eventCategoryController.updateCategory(req, res);
		if (res.statusCode === 200) {
			EventCacheInvalidator.invalidateAdminDashboardCaches();
		}
		return result;
	})
);

router.delete(
	"/categories/:categoryId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateCategoryIdParam,
	// Auto-invalidate category caches after successful deletion
	asyncHandler(async (req, res, next) => {
		const result = await eventCategoryController.deleteCategory(req, res);
		if (res.statusCode === 200) {
			EventCacheInvalidator.invalidateAdminDashboardCaches();
		}
		return result;
	})
);

// ==========================================
// EVENT MANAGEMENT ROUTES (PHASE 1)
// ==========================================

// Public event routes (CACHED!)
router.get(
	"/",
	optionalAuth,
	cacheEventsList, // 🆕 CACHE: 30 minutes with filters
	asyncHandler(eventController.getAllEvents)
);

router.get(
	"/:eventId",
	optionalAuth,
	validateEventIdParam,
	cacheEventDetails, // 🆕 CACHE: 45 minutes
	asyncHandler(eventController.getEventById)
);

// Super Admin only routes (event management) - with cache invalidation
router.post(
	"/",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	uploadEventFiles.fields([
		{ name: "heroImage", maxCount: 1 },
		{ name: "galleryImages", maxCount: 10 },
	]),
	validateCreateEvent,
	validateEventDates,
	handleUploadError,
	// Auto-invalidate event caches after successful creation
	asyncHandler(async (req, res, next) => {
		const result = await eventController.createEvent(req, res);
		if (res.statusCode === 201) {
			EventCacheInvalidator.invalidateAdminDashboardCaches();
		}
		return result;
	})
);

router.put(
	"/:eventId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	uploadEventFiles.fields([
		{ name: "heroImage", maxCount: 1 },
		{ name: "galleryImages", maxCount: 10 },
	]),
	validateUpdateEvent,
	validateEventDates,
	handleUploadError,
	// Auto-invalidate all event caches after successful update
	asyncHandler(async (req, res, next) => {
		const result = await eventController.updateEvent(req, res);
		if (res.statusCode === 200) {
			const eventId = req.params.eventId;
			EventCacheInvalidator.invalidateAllEventCaches(eventId);
		}
		return result;
	})
);

router.patch(
	"/:eventId/status",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateUpdateEventStatus,
	// Auto-invalidate event caches after status change
	asyncHandler(async (req, res, next) => {
		const result = await eventController.updateEventStatus(req, res);
		if (res.statusCode === 200) {
			const eventId = req.params.eventId;
			EventCacheInvalidator.invalidateAllEventCaches(eventId);
		}
		return result;
	})
);

router.delete(
	"/:eventId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	// Auto-invalidate all caches after successful deletion
	asyncHandler(async (req, res, next) => {
		const result = await eventController.deleteEvent(req, res);
		if (res.statusCode === 200) {
			const eventId = req.params.eventId;
			EventCacheInvalidator.invalidateAllEventCaches(eventId);
			EventCacheInvalidator.invalidateAdminDashboardCaches();
		}
		return result;
	})
);

// ==========================================
// EVENT SECTIONS MANAGEMENT (PHASE 1)
// ==========================================

// Public section routes (CACHED!)
router.get(
	"/:eventId/sections",
	validateEventIdParam,
	cacheEventSections, // 🆕 CACHE: 1 hour
	asyncHandler(eventSectionController.getEventSections)
);

router.get(
	"/:eventId/sections/:sectionId",
	validateEventAndSectionParams,
	cacheEventSection, // 🆕 CACHE: 1 hour
	asyncHandler(eventSectionController.getEventSectionById)
);

// Super Admin only routes (section management) - with cache invalidation
router.post(
	"/:eventId/sections",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateCreateEventSection,
	// Auto-invalidate section caches after successful creation
	asyncHandler(async (req, res, next) => {
		const result = await eventSectionController.addEventSection(req, res);
		if (res.statusCode === 201) {
			const eventId = req.params.eventId;
			EventCacheInvalidator.invalidateAllEventCaches(eventId);
		}
		return result;
	})
);

router.put(
	"/:eventId/sections/:sectionId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventAndSectionParams,
	validateUpdateEventSection,
	// Auto-invalidate section caches after successful update
	asyncHandler(async (req, res, next) => {
		const result = await eventSectionController.updateEventSection(req, res);
		if (res.statusCode === 200) {
			const eventId = req.params.eventId;
			EventCacheInvalidator.invalidateAllEventCaches(eventId);
		}
		return result;
	})
);

router.delete(
	"/:eventId/sections/:sectionId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventAndSectionParams,
	// Auto-invalidate section caches after successful deletion
	asyncHandler(async (req, res, next) => {
		const result = await eventSectionController.deleteEventSection(req, res);
		if (res.statusCode === 200) {
			const eventId = req.params.eventId;
			EventCacheInvalidator.invalidateAllEventCaches(eventId);
		}
		return result;
	})
);

router.post(
	"/:eventId/sections/reorder",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateReorderEventSections,
	// Auto-invalidate section caches after successful reorder
	asyncHandler(async (req, res, next) => {
		const result = await eventSectionController.reorderEventSections(req, res);
		if (res.statusCode === 200) {
			const eventId = req.params.eventId;
			EventCacheInvalidator.invalidateAllEventCaches(eventId);
		}
		return result;
	})
);

// ==========================================
// ADMIN REGISTRATION MANAGEMENT (PHASE 1)
// ==========================================

// Super Admin only routes (registration management) - CACHED!
router.get(
	"/:eventId/registrations",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	cacheAdminRegistrationsList, // 🆕 CACHE: 10 minutes
	asyncHandler(eventRegistrationController.getEventRegistrations)
);

router.get(
	"/:eventId/registrations/stats",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	cacheRegistrationStats, // 🆕 CACHE: 15 minutes
	asyncHandler(eventRegistrationController.getRegistrationStats)
);

// ==========================================
// USER REGISTRATION SYSTEM (PHASE 2)
// ==========================================

// User registration routes (authenticated users) - with cache invalidation
router.post(
	"/:eventId/register",
	authenticateToken,
	checkMembershipStatus,
	validateEventIdParam,
	validateUserRegistration,
	validateRegistrationBusinessRules,
	autoInvalidateRegistrationCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventRegistrationController.registerForEvent)
);

router.get(
	"/:eventId/my-registration",
	authenticateToken,
	validateEventIdParam,
	// NOT cached - user-specific data
	asyncHandler(eventRegistrationController.getMyRegistration)
);

router.put(
	"/:eventId/my-registration",
	authenticateToken,
	validateEventIdParam,
	validateUpdateUserRegistration,
	autoInvalidateRegistrationCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventRegistrationController.updateMyRegistration)
);

router.delete(
	"/:eventId/my-registration",
	authenticateToken,
	validateEventIdParam,
	autoInvalidateRegistrationCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventRegistrationController.cancelMyRegistration)
);

// ==========================================
// EVENT FORM MANAGEMENT (PHASE 2)
// ==========================================

// Public route to get event registration form - CACHED!
router.get(
	"/:eventId/form",
	validateEventIdParam,
	cacheEventForm, // 🆕 CACHE: 1 hour
	asyncHandler(eventFormController.getEventForm)
);

// Super Admin only routes (form management) - with cache invalidation
router.post(
	"/:eventId/form",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateCreateEventForm,
	autoInvalidateFormCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventFormController.createOrUpdateEventForm)
);

router.put(
	"/:eventId/form",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateUpdateEventForm,
	autoInvalidateFormCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventFormController.createOrUpdateEventForm)
);

router.delete(
	"/:eventId/form",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	autoInvalidateFormCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventFormController.deleteEventForm)
);

// ==========================================
// FORM FIELD MANAGEMENT (PHASE 2)
// ==========================================

// Super Admin only routes (form field management) - with cache invalidation
router.post(
	"/:eventId/form/fields",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateCreateEventFormField,
	validateFormFieldOptions,
	autoInvalidateFormCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventFormController.addFormField)
);

router.put(
	"/:eventId/form/fields/:fieldId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateUpdateEventFormField,
	validateFormFieldOptions,
	autoInvalidateFormCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventFormController.updateFormField)
);

router.delete(
	"/:eventId/form/fields/:fieldId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	autoInvalidateFormCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventFormController.deleteFormField)
);

router.post(
	"/:eventId/form/fields/reorder",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateReorderEventFormFields,
	autoInvalidateFormCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventFormController.reorderFormFields)
);

// ==========================================
// GUEST MANAGEMENT SYSTEM (PHASE 3)
// ==========================================

// User guest management routes (authenticated users) - with cache invalidation
router.post(
	"/:eventId/guests",
	authenticateToken,
	validateEventIdParam,
	validateAddGuest,
	validateGuestBusinessRules,
	autoInvalidateGuestCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventGuestController.addGuest)
);

router.get(
	"/:eventId/guests",
	authenticateToken,
	validateEventIdParam,
	// NOT cached - user-specific data
	asyncHandler(eventGuestController.getMyGuests)
);

router.put(
	"/:eventId/guests/:guestId",
	authenticateToken,
	validateGuestParams,
	validateUpdateGuest,
	autoInvalidateGuestCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventGuestController.updateGuest)
);

router.delete(
	"/:eventId/guests/:guestId",
	authenticateToken,
	validateGuestParams,
	autoInvalidateGuestCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventGuestController.cancelGuest)
);

// ==========================================
// GUEST FORM MANAGEMENT (PHASE 3)
// ==========================================

// Guest form routes (authenticated users) - with cache invalidation
router.get(
	"/:eventId/guests/:guestId/form",
	authenticateToken,
	validateGuestParams,
	// NOT cached - user-specific data
	asyncHandler(eventGuestController.getGuestForm)
);

router.post(
	"/:eventId/guests/:guestId/form",
	authenticateToken,
	validateGuestParams,
	validateGuestFormResponse,
	validateGuestFormBusinessRules,
	autoInvalidateGuestCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventGuestController.submitGuestForm)
);

router.put(
	"/:eventId/guests/:guestId/form",
	authenticateToken,
	validateGuestParams,
	validateUpdateGuestFormResponse,
	validateGuestFormBusinessRules,
	autoInvalidateGuestCaches, // 🆕 AUTO INVALIDATE AFTER SUCCESS
	asyncHandler(eventGuestController.submitGuestForm)
);

// ==========================================
// ADMIN GUEST MANAGEMENT (PHASE 3)
// ==========================================

// Super Admin only routes (guest management) - CACHED!
router.get(
	"/:eventId/all-guests",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	cacheAdminGuestsList, // 🆕 CACHE: 10 minutes
	asyncHandler(eventGuestController.getAllEventGuests)
);

// =============================================================================
// MERCHANDISE MANAGEMENT ROUTES (Phase 4)
// =============================================================================

// PUBLIC: Get event merchandise (with caching)
router.get(
	"/:eventId/merchandise",
	[
		validateEventIdParam,
		validateMerchandiseBusinessRules,
		cacheEventMerchandise,
	],
	asyncHandler(merchandiseController.getEventMerchandise)
);

// PUBLIC: Get single merchandise item (with caching)
router.get(
	"/:eventId/merchandise/:itemId",
	[
		validateMerchandiseParams,
		validateMerchandiseBusinessRules,
		cacheMerchandiseItem,
	],
	asyncHandler(merchandiseController.getMerchandiseItem)
);

// ADMIN: Add merchandise item
router.post(
	"/:eventId/merchandise",
	[
		authenticateToken,
		requireRole("SUPER_ADMIN"),
		validateEventIdParam,
		validateAddMerchandise,
		validateMerchandiseBusinessRules,
		autoInvalidateMerchandiseCaches,
	],
	asyncHandler(merchandiseController.addMerchandise)
);

// ADMIN: Update merchandise item
router.put(
	"/:eventId/merchandise/:itemId",
	[
		authenticateToken,
		requireRole("SUPER_ADMIN"),
		validateMerchandiseParams,
		validateUpdateMerchandise,
		validateMerchandiseBusinessRules,
		autoInvalidateMerchandiseCaches,
	],
	asyncHandler(merchandiseController.updateMerchandise)
);

// ADMIN: Delete merchandise item
router.delete(
	"/:eventId/merchandise/:itemId",
	[
		authenticateToken,
		requireRole("SUPER_ADMIN"),
		validateMerchandiseParams,
		validateMerchandiseBusinessRules,
		autoInvalidateMerchandiseCaches,
	],
	asyncHandler(merchandiseController.deleteMerchandise)
);

// ADMIN: Reorder merchandise items
router.post(
	"/:eventId/merchandise/reorder",
	[
		authenticateToken,
		requireRole("SUPER_ADMIN"),
		validateEventIdParam,
		validateReorderMerchandise,
		validateMerchandiseBusinessRules,
		autoInvalidateMerchandiseCaches,
	],
	asyncHandler(merchandiseController.reorderMerchandise)
);

// ADMIN: Upload merchandise images (REUSE EXISTING UPLOAD MIDDLEWARE)
router.post(
	"/:eventId/merchandise/:itemId/images",
	[
		authenticateToken,
		requireRole("SUPER_ADMIN"),
		validateMerchandiseParams,
		validateMerchandiseBusinessRules,
		uploadEventImages, // REUSE existing upload middleware
		handleUploadError,
		autoInvalidateMerchandiseCaches,
	],
	asyncHandler(async (req, res) => {
		const { eventId, itemId } = req.params;
		const userId = req.user.id;
		const files = req.files;

		try {
			// Check if merchandise item exists
			const merchandise = await prisma.eventMerchandise.findFirst({
				where: {
					id: itemId,
					eventId,
				},
				select: {
					id: true,
					name: true,
					images: true,
				},
			});

			if (!merchandise) {
				return errorResponse(res, "Merchandise item not found", 404);
			}

			if (!files || files.length === 0) {
				return errorResponse(res, "No files uploaded", 400);
			}

			// Generate URLs for uploaded files using existing upload structure
			const baseUrl = `${req.protocol}://${req.get("host")}`;
			const newImageUrls = files.map((file) => {
				const relativePath = file.path
					.replace(process.cwd(), "")
					.replace(/\\/g, "/");
				return `${baseUrl}${relativePath}`;
			});

			// Update merchandise with new image URLs
			const existingImages = merchandise.images || [];
			const updatedImages = [...existingImages, ...newImageUrls];

			const updatedMerchandise = await prisma.eventMerchandise.update({
				where: { id: itemId },
				data: {
					images: updatedImages,
				},
				select: {
					id: true,
					name: true,
					images: true,
				},
			});

			// Log activity
			await prisma.activityLog.create({
				data: {
					userId,
					action: "merchandise_images_upload",
					details: {
						eventId,
						itemId,
						uploadedCount: files.length,
						totalImages: updatedImages.length,
					},
					ipAddress: req.ip,
					userAgent: req.get("User-Agent"),
				},
			});

			return successResponse(
				res,
				{
					merchandise: {
						id: updatedMerchandise.id,
						name: updatedMerchandise.name,
						images: updatedMerchandise.images,
					},
					uploadedImages: newImageUrls,
					uploadCount: files.length,
				},
				`${files.length} image(s) uploaded successfully`
			);
		} catch (error) {
			console.error("Upload merchandise images error:", error);
			return errorResponse(res, "Failed to upload images", 500);
		}
	})
);

// =============================================================================
// SHOPPING CART ROUTES (Phase 4)
// =============================================================================

// USER: Get my cart (with caching)
router.get(
	"/:eventId/cart",
	[
		authenticateToken,
		validateEventIdParam,
		validateMerchandiseBusinessRules,
		validateCartBusinessRules,
		cacheUserCart,
	],
	asyncHandler(merchandiseCartController.getCart)
);

// USER: Add item to cart
router.post(
	"/:eventId/cart",
	[
		authenticateToken,
		validateEventIdParam,
		validateAddToCart,
		validateMerchandiseBusinessRules,
		validateCartBusinessRules,
		autoInvalidateCartCaches,
	],
	asyncHandler(merchandiseCartController.addToCart)
);

// USER: Update cart item
router.put(
	"/:eventId/cart/:itemId",
	[
		authenticateToken,
		validateCartParams,
		validateUpdateCartItem,
		validateMerchandiseBusinessRules,
		validateCartBusinessRules,
		autoInvalidateCartCaches,
	],
	asyncHandler(merchandiseCartController.updateCartItem)
);

// USER: Remove item from cart
router.delete(
	"/:eventId/cart/:itemId",
	[
		authenticateToken,
		validateCartParams,
		validateMerchandiseBusinessRules,
		validateCartBusinessRules,
		autoInvalidateCartCaches,
	],
	asyncHandler(merchandiseCartController.removeFromCart)
);

// USER: Checkout cart (place order)
router.post(
	"/:eventId/checkout",
	[
		authenticateToken,
		validateEventIdParam,
		validateCheckoutCart,
		validateMerchandiseBusinessRules,
		validateCartBusinessRules,
		autoInvalidateOrderCaches,
	],
	asyncHandler(merchandiseCartController.checkoutCart)
);

// =============================================================================
// ORDER MANAGEMENT ROUTES (Phase 4)
// =============================================================================

// USER: Get my orders (with caching)
router.get(
	"/:eventId/my-orders",
	[
		authenticateToken,
		validateEventIdParam,
		validateMerchandiseBusinessRules,
		validateCartBusinessRules,
		cacheUserOrders,
	],
	asyncHandler(merchandiseCartController.getMyOrders)
);

// ADMIN: Get all event orders (with caching)
router.get(
	"/:eventId/orders",
	[
		authenticateToken,
		requireRole("SUPER_ADMIN"),
		validateEventIdParam,
		validateMerchandiseBusinessRules,
		cacheAdminMerchandiseOrders,
	],
	asyncHandler(merchandiseCartController.getAllEventOrders)
);

// ADMIN: Get merchandise statistics (with caching)
router.get(
	"/:eventId/merchandise/stats",
	[
		authenticateToken,
		requireRole("SUPER_ADMIN"),
		validateEventIdParam,
		validateMerchandiseBusinessRules,
		cacheMerchandiseStats,
	],
	asyncHandler(async (req, res) => {
		try {
			const { eventId } = req.params;
			const EventService = require("../services/event.service");

			const stats = await EventService.getEventMerchandiseStats(eventId);

			return successResponse(
				res,
				stats,
				"Merchandise statistics retrieved successfully"
			);
		} catch (error) {
			console.error("Get merchandise stats error:", error);
			return errorResponse(
				res,
				"Failed to retrieve merchandise statistics",
				500
			);
		}
	})
);

// =============================================================================
// PHASE 6: FEEDBACK SYSTEM ROUTES (ADD AFTER MERCHANDISE ROUTES)
// =============================================================================

// ==========================================
// ADMIN FEEDBACK FORM MANAGEMENT
// ==========================================

/**
 * Create or update feedback form for an event
 * POST /api/events/:eventId/feedback/form
 * @access Admin only
 */
router.post(
	"/:eventId/feedback/form",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateCreateOrUpdateFeedbackForm,
	invalidateFeedbackFormCache,
	asyncHandler(feedbackController.createOrUpdateFeedbackForm)
);

/**
 * Get feedback form for an event
 * GET /api/events/:eventId/feedback/form
 * @access Public (with business rules) / Admin
 * @cache 30 minutes
 */
router.get(
	"/:eventId/feedback/form",
	// Optional authentication - allows both authenticated and anonymous access
	(req, res, next) => {
		if (req.headers.authorization) {
			authenticateToken(req, res, next);
		} else {
			req.user = null;
			next();
		}
	},
	validateEventIdParam,
	validateFeedbackFormAccess,
	cacheFeedbackForm,
	asyncHandler(feedbackController.getFeedbackForm)
);

// ==========================================
// ADMIN FEEDBACK FIELD MANAGEMENT
// ==========================================

/**
 * Add field to feedback form
 * POST /api/events/:eventId/feedback/fields
 * @access Admin only
 */
router.post(
	"/:eventId/feedback/fields",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateAddFeedbackField,
	validateFieldModification,
	invalidateFeedbackFormCache,
	asyncHandler(feedbackController.addFeedbackField)
);

/**
 * Update feedback field
 * PUT /api/events/:eventId/feedback/fields/:fieldId
 * @access Admin only
 */
router.put(
	"/:eventId/feedback/fields/:fieldId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateUpdateFeedbackField,
	validateFieldModification,
	invalidateFeedbackFormCache,
	asyncHandler(feedbackController.updateFeedbackField)
);

/**
 * Delete feedback field
 * DELETE /api/events/:eventId/feedback/fields/:fieldId
 * @access Admin only
 */
router.delete(
	"/:eventId/feedback/fields/:fieldId",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateFieldModification,
	invalidateFeedbackFormCache,
	asyncHandler(feedbackController.deleteFeedbackField)
);

/**
 * Reorder feedback fields
 * POST /api/events/:eventId/feedback/fields/reorder
 * @access Admin only
 */
router.post(
	"/:eventId/feedback/fields/reorder",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	validateReorderFeedbackFields,
	validateFieldModification,
	invalidateFeedbackFormCache,
	asyncHandler(feedbackController.reorderFeedbackFields)
);

// ==========================================
// PUBLIC FEEDBACK SUBMISSION
// ==========================================

/**
 * Submit feedback response
 * POST /api/events/:eventId/feedback/submit
 * @access Public (authenticated or anonymous based on form settings)
 */
router.post(
	"/:eventId/feedback/submit",
	// Optional authentication - allows anonymous submissions
	(req, res, next) => {
		if (req.headers.authorization) {
			authenticateToken(req, res, next);
		} else {
			req.user = null;
			next();
		}
	},
	validateEventIdParam,
	validateFeedbackFormAccess,
	validateSubmitFeedback,
	validateFeedbackSubmission,
	invalidateResponseCache,
	invalidateAnalyticsCache,
	asyncHandler(feedbackController.submitFeedback)
);

/**
 * Get user's own feedback response
 * GET /api/events/:eventId/feedback/my-response
 * @access Authenticated users only
 * @cache 1 hour
 */
router.get(
	"/:eventId/feedback/my-response",
	authenticateToken,
	validateEventIdParam,
	cacheUserFeedbackResponse,
	asyncHandler(feedbackController.getMyFeedbackResponse)
);

// ==========================================
// ADMIN ANALYTICS & REPORTING
// ==========================================

/**
 * Get comprehensive feedback analytics
 * GET /api/events/:eventId/feedback/analytics
 * @access Admin only
 * @cache 2 hours
 */
router.get(
	"/:eventId/feedback/analytics",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	cacheFeedbackAnalytics,
	asyncHandler(feedbackController.getFeedbackAnalytics)
);

/**
 * Get all feedback responses with filtering
 * GET /api/events/:eventId/feedback/responses
 * @access Admin only
 * @cache 15 minutes
 */
router.get(
	"/:eventId/feedback/responses",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	cacheFeedbackResponses,
	asyncHandler(feedbackController.getFeedbackResponses)
);

/**
 * Export feedback responses
 * GET /api/events/:eventId/feedback/export
 * @access Admin only
 * @cache 5 minutes
 */
router.get(
	"/:eventId/feedback/export",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	cacheFeedbackExport,
	asyncHandler(feedbackController.exportFeedbackResponses)
);

/**
 * Get feedback summary statistics
 * GET /api/events/:eventId/feedback/summary
 * @access Admin only
 * @cache 30 minutes
 */
router.get(
	"/:eventId/feedback/summary",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	cacheFeedbackSummary,
	asyncHandler(async (req, res) => {
		const { eventId } = req.params;

		try {
			// Get basic feedback statistics
			const { prisma } = require("../config/database");
			const feedbackForm = await prisma.eventFeedbackForm.findFirst({
				where: { eventId },
				include: {
					_count: {
						select: { responses: true },
					},
				},
			});

			if (!feedbackForm) {
				return res.status(404).json({
					success: false,
					message: "Feedback form not found",
				});
			}

			// Get analytics summary
			const FeedbackAnalyticsService = require("../services/feedback/FeedbackAnalyticsService");
			const analytics = await FeedbackAnalyticsService.getAnalytics(
				feedbackForm.id
			);

			const summary = {
				formId: feedbackForm.id,
				totalResponses: analytics.totalResponses || 0,
				completionRate: analytics.completionRate || 0,
				avgRating: analytics.avgRating || null,
				avgSentimentScore: analytics.avgSentimentScore || null,
				isActive: feedbackForm.isActive,
				lastUpdated: analytics.lastCalculatedAt || feedbackForm.updatedAt,
			};

			return res.json({
				success: true,
				data: summary,
				message: "Feedback summary retrieved successfully",
			});
		} catch (error) {
			console.error("Get feedback summary error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to retrieve feedback summary",
			});
		}
	})
);

// ==========================================
// ADMIN UTILITY ROUTES
// ==========================================

/**
 * Refresh analytics cache manually
 * POST /api/events/:eventId/feedback/refresh-analytics
 * @access Admin only
 */
router.post(
	"/:eventId/feedback/refresh-analytics",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(async (req, res) => {
		const { eventId } = req.params;

		try {
			const { prisma } = require("../config/database");

			// Get feedback form ID
			const feedbackForm = await prisma.eventFeedbackForm.findFirst({
				where: { eventId },
				select: { id: true },
			});

			if (!feedbackForm) {
				return res.status(404).json({
					success: false,
					message: "Feedback form not found",
				});
			}

			// Force refresh analytics
			const FeedbackAnalyticsService = require("../services/feedback/FeedbackAnalyticsService");
			const analytics = await FeedbackAnalyticsService.getAnalytics(
				feedbackForm.id,
				true
			);

			return res.json({
				success: true,
				data: analytics,
				message: "Analytics refreshed successfully",
			});
		} catch (error) {
			console.error("Refresh analytics error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to refresh analytics",
			});
		}
	})
);

/**
 * Schedule feedback reminders for event
 * POST /api/events/:eventId/feedback/schedule-reminders
 * @access Admin only
 */
router.post(
	"/:eventId/feedback/schedule-reminders",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(async (req, res) => {
		const { eventId } = req.params;

		try {
			const { prisma } = require("../config/database");

			// Get feedback form
			const feedbackForm = await prisma.eventFeedbackForm.findFirst({
				where: { eventId },
				select: { id: true },
			});

			if (!feedbackForm) {
				return res.status(404).json({
					success: false,
					message: "Feedback form not found",
				});
			}

			// Schedule reminders
			const FeedbackService = require("../services/feedback/FeedbackService");
			await FeedbackService.scheduleFeedbackReminders(feedbackForm.id);

			return res.json({
				success: true,
				message: "Feedback reminders scheduled successfully",
			});
		} catch (error) {
			console.error("Schedule reminders error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to schedule reminders",
			});
		}
	})
);

// ==========================================
// BULK OPERATIONS (ADMIN ONLY)
// ==========================================

/**
 * Create feedback forms for multiple events
 * POST /api/events/feedback/bulk-create
 * @access Admin only
 */
router.post(
	"/feedback/bulk-create",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	asyncHandler(async (req, res) => {
		const { eventIds, formTemplate } = req.body;

		try {
			if (!Array.isArray(eventIds) || eventIds.length === 0) {
				return res.status(400).json({
					success: false,
					message: "Event IDs array is required",
				});
			}

			const { prisma } = require("../config/database");
			const results = [];

			for (const eventId of eventIds) {
				try {
					// Check if event exists
					const event = await prisma.event.findUnique({
						where: { id: eventId },
						select: { id: true, title: true },
					});

					if (!event) {
						results.push({
							eventId,
							success: false,
							error: "Event not found",
						});
						continue;
					}

					// Create feedback form
					const form = await prisma.eventFeedbackForm.create({
						data: {
							eventId,
							title: formTemplate?.title || "Event Feedback",
							description: formTemplate?.description,
							allowAnonymous: formTemplate?.allowAnonymous ?? true,
							showAfterEvent: formTemplate?.showAfterEvent ?? true,
							autoSendReminders: formTemplate?.autoSendReminders ?? false,
							reminderDelayHours: formTemplate?.reminderDelayHours ?? 24,
							closeAfterHours: formTemplate?.closeAfterHours ?? 168,
						},
					});

					results.push({
						eventId,
						success: true,
						formId: form.id,
						eventTitle: event.title,
					});
				} catch (error) {
					results.push({
						eventId,
						success: false,
						error: error.message,
					});
				}
			}

			// Log bulk operation
			await prisma.activityLog.create({
				data: {
					userId: req.user.id,
					action: "bulk_feedback_forms_create",
					details: {
						eventIds,
						totalProcessed: eventIds.length,
						successful: results.filter((r) => r.success).length,
						failed: results.filter((r) => !r.success).length,
						results,
					},
					ipAddress: req.ip,
					userAgent: req.get("User-Agent"),
				},
			});

			return res.json({
				success: true,
				data: {
					results,
					summary: {
						totalProcessed: eventIds.length,
						successful: results.filter((r) => r.success).length,
						failed: results.filter((r) => !r.success).length,
					},
				},
				message: "Bulk feedback form creation completed",
			});
		} catch (error) {
			console.error("Bulk create feedback forms error:", error);
			return res.status(500).json({
				success: false,
				message: "Bulk operation failed",
			});
		}
	})
);

// ==========================================
// QR CODE & CHECK-IN ROUTES (Phase 7B)
// ==========================================

// USER: Get QR code for my registration
router.get(
	"/:eventId/my-registration/qr-code",
	authenticateToken,
	validateEventIdParam,
	asyncHandler(QRCodeController.generateMyQRCode)
);

// ADMIN: Generate QR code for any registration
router.post(
	"/admin/:eventId/registrations/:registrationId/qr-code",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(QRCodeController.generateRegistrationQRCode)
);

// ADMIN: Process check-in via QR scan
router.post(
	"/:eventId/check-in",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(QRCodeController.processCheckIn)
);

// ADMIN: Get check-in statistics
router.get(
	"/:eventId/check-in-stats",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(QRCodeController.getCheckInStats)
);

// ADMIN: Get live check-in count
router.get(
	"/:eventId/live-checkin-count",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(QRCodeController.getLiveCheckInCount)
);

// ADMIN: Get check-in history
router.get(
	"/:eventId/check-in-history",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(QRCodeController.getCheckInHistory)
);

// ==========================================
// MERCHANDISE DELIVERY ROUTES (Phase 7B)
// ==========================================

// ADMIN: Mark merchandise as delivered
router.post(
	"/merchandise/orders/:orderId/deliver",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	asyncHandler(MerchandiseDeliveryController.markAsDelivered)
);

// ADMIN: Get event merchandise deliveries
router.get(
	"/:eventId/merchandise-deliveries",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(MerchandiseDeliveryController.getEventDeliveries)
);

// ADMIN: Get delivery statistics
router.get(
	"/:eventId/delivery-stats",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(MerchandiseDeliveryController.getDeliveryStats)
);

// ==========================================
// EXPORT SYSTEM ROUTES (Phase 7C) - ADMIN ONLY
// ==========================================

// Complete Event Report Export
router.get(
	"/:eventId/export/complete-report",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(ExportController.exportCompleteEventReport)
);

// Registration List Export
router.get(
	"/:eventId/export/registrations",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(ExportController.exportRegistrationList)
);

// Financial Report Export
router.get(
	"/:eventId/export/financial-report",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(ExportController.exportFinancialReport)
);

// Attendance Report Export
router.get(
	"/:eventId/export/attendance-report",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(ExportController.exportAttendanceReport)
);

// Merchandise Report Export
router.get(
	"/:eventId/export/merchandise-report",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validateEventIdParam,
	asyncHandler(ExportController.exportMerchandiseReport)
);


// ==========================================
// REGISTRATION DASHBOARD ROUTES (Phase 7D)
// ==========================================

// PUBLIC: Get public registration dashboard (NO AUTH REQUIRED)
router.get('/:eventId/registrations/public',
  validateEventIdParam,
  asyncHandler(RegistrationDashboardController.getPublicRegistrationDashboard)
);

// ADMIN: Get admin registration dashboard with advanced features
router.get('/:eventId/registrations/admin',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  asyncHandler(RegistrationDashboardController.getAdminRegistrationDashboard)
);

// ADMIN: Get batch-wise registration breakdown
router.get('/:eventId/registrations/batch-wise',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  asyncHandler(RegistrationDashboardController.getBatchWiseRegistrations)
);

// ADMIN: Get privacy settings
router.get('/:eventId/privacy-settings',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  asyncHandler(RegistrationDashboardController.getPrivacySettings)
);

// ADMIN: Update privacy settings
router.put('/:eventId/privacy-settings',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  asyncHandler(RegistrationDashboardController.updatePrivacySettings)
);

// ADMIN: Quick toggle payment visibility
router.post('/:eventId/toggle-payment-visibility',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  asyncHandler(RegistrationDashboardController.togglePaymentVisibility)
);

module.exports = router;



// Event Export Endpoints (Super-Admin)
// GET /api/events/:eventId/export/complete-report?format=csv|xlsx
// GET /api/events/:eventId/export/registrations?format=csv|xlsx&includeGuests=true&status=CONFIRMED
// GET /api/events/:eventId/export/financial-report?format=csv|xlsx  
// GET /api/events/:eventId/export/attendance-report?format=csv|xlsx
// GET /api/events/:eventId/export/merchandise-report?format=csv|xlsx

// Event Export Endpoints (Super-Admin)
// GET /api/admin/events/batch-report/:batchYear?format=csv|xlsx

// 🎯 New API Endpoints

// Public Endpoints (No Auth Required):
// GET /api/events/:eventId/registrations/public

// Admin Endpoints (SUPER_ADMIN only):
// GET /api/events/:eventId/registrations/admin?page=1&limit=20&search=john&batch=2020
// GET /api/events/:eventId/registrations/batch-wise
// GET /api/events/:eventId/privacy-settings
// PUT /api/events/:eventId/privacy-settings
// POST /api/events/:eventId/toggle-payment-visibility