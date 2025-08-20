// src/routes/events.route.js
const express = require("express");
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { authenticateToken, requireRole, optionalAuth } = require("../middleware/auth.middleware");
const { asyncHandler } = require('../utils/response');
const { handleUploadError } = require('../middleware/upload.middleware');

// Event validation middleware
const {
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
  validateEventDates,
} = require('../middleware/event.validation.middleware');

// Controllers
const eventCategoryController = require('../controllers/eventControllers/eventCategory.controller');
const eventController = require('../controllers/eventControllers/event.controller');
const eventSectionController = require('../controllers/eventControllers/eventSection.controller');
const eventRegistrationController = require('../controllers/eventControllers/eventRegistration.controller');

// Configure multer for event uploads
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
  // Allowed file types for events
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
    cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX'), false);
  }
};

const uploadEventFiles = multer({
  storage: eventUploadStorage,
  fileFilter: eventFileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 10 // Maximum 10 files total
  }
}).fields([
  { name: 'heroImage', maxCount: 1 },
  { name: 'images', maxCount: 9 } // 9 additional images + 1 hero = 10 total
]);

// ==========================================
// EVENT CATEGORY ROUTES
// ==========================================

// Public routes
router.get('/categories', optionalAuth, asyncHandler(eventCategoryController.getAllCategories));
router.get('/categories/:categoryId', optionalAuth, validateCategoryIdParam, asyncHandler(eventCategoryController.getCategoryById));

// Super Admin only routes
router.post('/categories', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateCreateEventCategory,
  asyncHandler(eventCategoryController.createCategory)
);

router.put('/categories/:categoryId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateCategoryIdParam,
  validateUpdateEventCategory,
  asyncHandler(eventCategoryController.updateCategory)
);

router.delete('/categories/:categoryId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateCategoryIdParam,
  asyncHandler(eventCategoryController.deleteCategory)
);

// ==========================================
// EVENT ROUTES
// ==========================================

// Public routes (events discovery)
router.get('/', optionalAuth, asyncHandler(eventController.getAllEvents));
router.get('/:eventId', optionalAuth, validateEventIdParam, asyncHandler(eventController.getEventById));

// Super Admin only routes (event management)
router.post('/', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateCreateEvent,
  validateEventDates,
  uploadEventFiles,
  handleUploadError,
  asyncHandler(eventController.createEvent)
);

router.put('/:eventId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  validateUpdateEvent,
  validateEventDates,
  uploadEventFiles,
  handleUploadError,
  asyncHandler(eventController.updateEvent)
);

router.patch('/:eventId/status', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  validateUpdateEventStatus,
  asyncHandler(eventController.updateEventStatus)
);

router.delete('/:eventId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  asyncHandler(eventController.deleteEvent)
);

// ==========================================
// EVENT SECTION ROUTES
// ==========================================

// Public routes (view sections)
router.get('/:eventId/sections', 
  optionalAuth, 
  validateEventIdParam, 
  asyncHandler(eventSectionController.getEventSections)
);

router.get('/:eventId/sections/:sectionId', 
  optionalAuth, 
  validateEventAndSectionParams, 
  asyncHandler(eventSectionController.getSectionById)
);

// Super Admin only routes (section management)
router.post('/:eventId/sections', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  validateCreateEventSection,
  asyncHandler(eventSectionController.addEventSection)
);

router.put('/:eventId/sections/:sectionId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventAndSectionParams,
  validateUpdateEventSection,
  asyncHandler(eventSectionController.updateEventSection)
);

router.delete('/:eventId/sections/:sectionId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventAndSectionParams,
  asyncHandler(eventSectionController.deleteEventSection)
);

router.post('/:eventId/sections/reorder', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  validateReorderEventSections,
  asyncHandler(eventSectionController.reorderEventSections)
);


// ==========================================
// EVENT REGISTRATION MANAGEMENT (Admin)
// ==========================================

// Super Admin only routes (registration management)
router.get('/:eventId/registrations', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  asyncHandler(eventRegistrationController.getEventRegistrations)
);

router.get('/:eventId/registrations/stats', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validateEventIdParam,
  asyncHandler(eventRegistrationController.getRegistrationStats)
);


module.exports = router;