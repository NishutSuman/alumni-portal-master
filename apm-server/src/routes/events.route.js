// src/routes/events.route.js
const express = require("express");
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { authenticateToken, requireRole, optionalAuth } = require("../middleware/auth.middleware");
const { asyncHandler } = require('../utils/response');
const { handleUploadError } = require('../middleware/upload.middleware');

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
} = require('../middleware/event.cache.middleware');

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
} = require('../middleware/event.validation.middleware');

// ==========================================
// CONTROLLER IMPORTS (COMPLETE)
// ==========================================
const eventCategoryController = require('../controllers/eventControllers/eventCategory.controller');
const eventController = require('../controllers/eventControllers/event.controller');
const eventSectionController = require('../controllers/eventControllers/eventSection.controller');
const eventRegistrationController = require('../controllers/eventControllers/eventRegistration.controller');
const eventFormController = require('../controllers/eventControllers/eventForm.controller');
const eventGuestController = require('../controllers/eventControllers/eventGuest.controller');

// ==========================================
// MULTER CONFIGURATION (EXISTING)
// ==========================================
const eventUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './public/uploads/events/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `${cleanBaseName}_${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

const eventFileFilter = (req, file, cb) => {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const documentTypes = [
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const allowedTypes = [...imageTypes, ...documentTypes];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and documents are allowed.'), false);
  }
};

const uploadEventFiles = multer({
  storage: eventUploadStorage,
  fileFilter: eventFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  }
});

// ==========================================
// EVENT CATEGORY ROUTES (PHASE 1)
// ==========================================

// Public event category routes (CACHED!)
router.get('/categories', 
  cacheEventCategories,  // 🆕 CACHE: 2 hours
  asyncHandler(eventCategoryController.getAllCategories)
);

router.get('/categories/:categoryId', 
  validateCategoryIdParam,
  cacheEventCategory,  // 🆕 CACHE: 1 hour with events
  asyncHandler(eventCategoryController.getCategoryById)
);

// Super Admin only routes (category management) - with cache invalidation
router.post('/categories', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
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

router.put('/categories/:categoryId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
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

router.delete('/categories/:categoryId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
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
router.get('/', 
  optionalAuth,
  cacheEventsList,  // 🆕 CACHE: 30 minutes with filters
  asyncHandler(eventController.getAllEvents)
);

router.get('/:eventId', 
  optionalAuth,
  validateEventIdParam,
  cacheEventDetails,  // 🆕 CACHE: 45 minutes
  asyncHandler(eventController.getEventById)
);

// Super Admin only routes (event management) - with cache invalidation
router.post('/', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  uploadEventFiles.fields([
    { name: 'heroImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 }
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

router.put('/:eventId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  uploadEventFiles.fields([
    { name: 'heroImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 }
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

router.patch('/:eventId/status', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
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

router.delete('/:eventId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
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
router.get('/:eventId/sections', 
  validateEventIdParam,
  cacheEventSections,  // 🆕 CACHE: 1 hour
  asyncHandler(eventSectionController.getEventSections)
);

router.get('/:eventId/sections/:sectionId', 
  validateEventAndSectionParams,
  cacheEventSection,  // 🆕 CACHE: 1 hour
  asyncHandler(eventSectionController.getEventSectionById)
);

// Super Admin only routes (section management) - with cache invalidation
router.post('/:eventId/sections', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
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

router.put('/:eventId/sections/:sectionId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
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

router.delete('/:eventId/sections/:sectionId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
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

router.post('/:eventId/sections/reorder', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
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
router.get('/:eventId/registrations', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  cacheAdminRegistrationsList,  // 🆕 CACHE: 10 minutes
  asyncHandler(eventRegistrationController.getEventRegistrations)
);

router.get('/:eventId/registrations/stats', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  cacheRegistrationStats,  // 🆕 CACHE: 15 minutes
  asyncHandler(eventRegistrationController.getRegistrationStats)
);

// ==========================================
// USER REGISTRATION SYSTEM (PHASE 2)
// ==========================================

// User registration routes (authenticated users) - with cache invalidation
router.post('/:eventId/register', 
  authenticateToken,
  validateEventIdParam,
  validateUserRegistration,
  validateRegistrationBusinessRules,
  autoInvalidateRegistrationCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventRegistrationController.registerForEvent)
);

router.get('/:eventId/my-registration', 
  authenticateToken,
  validateEventIdParam,
  // NOT cached - user-specific data
  asyncHandler(eventRegistrationController.getMyRegistration)
);

router.put('/:eventId/my-registration', 
  authenticateToken,
  validateEventIdParam,
  validateUpdateUserRegistration,
  autoInvalidateRegistrationCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventRegistrationController.updateMyRegistration)
);

router.delete('/:eventId/my-registration', 
  authenticateToken,
  validateEventIdParam,
  autoInvalidateRegistrationCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventRegistrationController.cancelMyRegistration)
);

// ==========================================
// EVENT FORM MANAGEMENT (PHASE 2)
// ==========================================

// Public route to get event registration form - CACHED!
router.get('/:eventId/form', 
  validateEventIdParam,
  cacheEventForm,  // 🆕 CACHE: 1 hour
  asyncHandler(eventFormController.getEventForm)
);

// Super Admin only routes (form management) - with cache invalidation
router.post('/:eventId/form', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  validateCreateEventForm,
  autoInvalidateFormCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventFormController.createOrUpdateEventForm)
);

router.put('/:eventId/form', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  validateUpdateEventForm,
  autoInvalidateFormCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventFormController.createOrUpdateEventForm)
);

router.delete('/:eventId/form', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  autoInvalidateFormCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventFormController.deleteEventForm)
);

// ==========================================
// FORM FIELD MANAGEMENT (PHASE 2)
// ==========================================

// Super Admin only routes (form field management) - with cache invalidation
router.post('/:eventId/form/fields', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  validateCreateEventFormField,
  validateFormFieldOptions,
  autoInvalidateFormCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventFormController.addFormField)
);

router.put('/:eventId/form/fields/:fieldId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  validateUpdateEventFormField,
  validateFormFieldOptions,
  autoInvalidateFormCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventFormController.updateFormField)
);

router.delete('/:eventId/form/fields/:fieldId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  autoInvalidateFormCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventFormController.deleteFormField)
);

router.post('/:eventId/form/fields/reorder', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  validateReorderEventFormFields,
  autoInvalidateFormCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventFormController.reorderFormFields)
);

// ==========================================
// GUEST MANAGEMENT SYSTEM (PHASE 3)
// ==========================================

// User guest management routes (authenticated users) - with cache invalidation
router.post('/:eventId/guests', 
  authenticateToken,
  validateEventIdParam,
  validateAddGuest,
  validateGuestBusinessRules,
  autoInvalidateGuestCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventGuestController.addGuest)
);

router.get('/:eventId/guests', 
  authenticateToken,
  validateEventIdParam,
  // NOT cached - user-specific data
  asyncHandler(eventGuestController.getMyGuests)
);

router.put('/:eventId/guests/:guestId', 
  authenticateToken,
  validateGuestParams,
  validateUpdateGuest,
  autoInvalidateGuestCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventGuestController.updateGuest)
);

router.delete('/:eventId/guests/:guestId', 
  authenticateToken,
  validateGuestParams,
  autoInvalidateGuestCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventGuestController.cancelGuest)
);

// ==========================================
// GUEST FORM MANAGEMENT (PHASE 3)
// ==========================================

// Guest form routes (authenticated users) - with cache invalidation
router.get('/:eventId/guests/:guestId/form', 
  authenticateToken,
  validateGuestParams,
  // NOT cached - user-specific data
  asyncHandler(eventGuestController.getGuestForm)
);

router.post('/:eventId/guests/:guestId/form', 
  authenticateToken,
  validateGuestParams,
  validateGuestFormResponse,
  validateGuestFormBusinessRules,
  autoInvalidateGuestCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventGuestController.submitGuestForm)
);

router.put('/:eventId/guests/:guestId/form', 
  authenticateToken,
  validateGuestParams,
  validateUpdateGuestFormResponse,
  validateGuestFormBusinessRules,
  autoInvalidateGuestCaches,  // 🆕 AUTO INVALIDATE AFTER SUCCESS
  asyncHandler(eventGuestController.submitGuestForm)
);

// ==========================================
// ADMIN GUEST MANAGEMENT (PHASE 3)
// ==========================================

// Super Admin only routes (guest management) - CACHED!
router.get('/:eventId/all-guests', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  cacheAdminGuestsList,  // 🆕 CACHE: 10 minutes
  asyncHandler(eventGuestController.getAllEventGuests)
);


module.exports = router;