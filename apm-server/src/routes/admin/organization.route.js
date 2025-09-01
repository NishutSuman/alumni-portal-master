// ==========================================
// STEP 7B: ORGANIZATION MANAGEMENT ROUTES
// File: apm-server/src/routes/admin/organization.route.js
// ==========================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Import middleware
const { authenticateToken, requireRole } = require('../../middleware/auth/auth.middleware');
const { asyncHandler } = require('../../utils/response');

// Import controller
const organizationController = require('../../controllers/admin/organization.controller');

// ==========================================
// FILE UPLOAD CONFIGURATION FOR ORGANIZATION FILES
// ==========================================

// Configure multer for organization file uploads
const organizationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../../uploads/organization');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: type_timestamp_original
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const fieldName = file.fieldname; // 'logo', 'bylaw', 'certificate'
    const filename = `${fieldName}_${timestamp}${fileExtension}`;
    cb(null, filename);
  }
});

// File filter for organization uploads
const organizationFileFilter = (req, file, cb) => {
  const allowedTypes = {
    'logo': ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
    'bylaw': ['application/pdf'],
    'certificate': ['application/pdf', 'image/jpeg', 'image/png']
  };
  
  const fieldName = file.fieldname;
  const allowedMimeTypes = allowedTypes[fieldName];
  
  if (!allowedMimeTypes) {
    return cb(new Error('Invalid file field'), false);
  }
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${fieldName}. Allowed: ${allowedMimeTypes.join(', ')}`), false);
  }
};

const uploadOrganizationFiles = multer({
  storage: organizationStorage,
  fileFilter: organizationFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 3 // Max 3 files at once
  }
});

// ==========================================
// PUBLIC ROUTES (NO AUTHENTICATION REQUIRED)
// ==========================================

/**
 * Get public organization details
 * GET /api/organization
 * Access: PUBLIC
 */
router.get('/',
  asyncHandler(organizationController.getOrganizationDetails)
);

// ==========================================
// ADMIN ROUTES (SUPER_ADMIN ONLY)
// ==========================================

// Apply authentication and super admin role to all admin routes
router.use(authenticateToken);
router.use(requireRole('SUPER_ADMIN'));

/**
 * Get organization details for admin (includes all fields)
 * GET /api/admin/organization
 * Access: SUPER_ADMIN only
 */
router.get('/admin',
  asyncHandler(organizationController.getOrganizationDetailsAdmin)
);

/**
 * Get organization statistics
 * GET /api/admin/organization/stats
 * Access: SUPER_ADMIN only
 */
router.get('/admin/stats',
  asyncHandler(organizationController.getOrganizationStats)
);

/**
 * Initialize organization (first-time setup)
 * POST /api/admin/organization/initialize
 * Body: { name?, shortName?, foundationYear?, officialEmail, officialContactNumber?, officeAddress? }
 * Access: SUPER_ADMIN only
 */
router.post('/admin/initialize',
  asyncHandler(organizationController.initializeOrganization)
);

/**
 * Create or update organization details
 * PUT /api/admin/organization
 * Body: Complete organization data
 * Access: SUPER_ADMIN only
 */
router.put('/admin',
  asyncHandler(organizationController.upsertOrganizationDetails)
);

/**
 * Update organization social links only
 * PUT /api/admin/organization/social-links
 * Body: { websiteUrl?, instagramUrl?, facebookUrl?, youtubeUrl?, twitterUrl?, linkedinUrl? }
 * Access: SUPER_ADMIN only
 */
router.put('/admin/social-links',
  asyncHandler(organizationController.updateSocialLinks)
);

/**
 * Upload organization logo
 * POST /api/admin/organization/upload/logo
 * Form-data: logo file
 * Access: SUPER_ADMIN only
 */
router.post('/admin/upload/logo',
  uploadOrganizationFiles.single('logo'),
  asyncHandler(organizationController.uploadOrganizationLogo)
);

/**
 * Upload organization documents (bylaw, certificate)
 * POST /api/admin/organization/upload/documents
 * Form-data: bylaw file, certificate file
 * Access: SUPER_ADMIN only
 */
router.post('/admin/upload/documents',
  uploadOrganizationFiles.fields([
    { name: 'bylaw', maxCount: 1 },
    { name: 'certificate', maxCount: 1 }
  ]),
  asyncHandler(async (req, res) => {
    try {
      const { id: adminId } = req.user;
      const files = req.files;
      
      if (!files || (!files.bylaw && !files.certificate)) {
        return res.status(400).json({
          success: false,
          message: 'At least one document file is required'
        });
      }
      
      const organization = await prisma.organization.findFirst({
        where: { isActive: true }
      });
      
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not configured'
        });
      }
      
      const updateData = {
        lastUpdatedBy: adminId
      };
      
      if (files.bylaw) {
        updateData.bylawDocumentUrl = `/uploads/organization/${files.bylaw[0].filename}`;
      }
      
      if (files.certificate) {
        updateData.registrationCertUrl = `/uploads/organization/${files.certificate[0].filename}`;
      }
      
      const updated = await prisma.$transaction(async (tx) => {
        const updated = await tx.organization.update({
          where: { id: organization.id },
          data: updateData
        });
        
        await tx.activityLog.create({
          data: {
            userId: adminId,
            action: 'organization_documents_updated',
            details: {
              organizationId: organization.id,
              documentsUploaded: {
                bylaw: !!files.bylaw,
                certificate: !!files.certificate
              },
              filenames: {
                bylaw: files.bylaw?.[0]?.filename,
                certificate: files.certificate?.[0]?.filename
              }
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
        
        return updated;
      });
      
      // Clear caches
      await Promise.all([
        require('../../config/redis').CacheService.del('public:organization:details'),
        require('../../config/redis').CacheService.del('system:organization:details')
      ]);
      
      return res.status(200).json({
        success: true,
        message: 'Organization documents uploaded successfully',
        data: {
          organization: {
            id: updated.id,
            name: updated.name,
            bylawDocumentUrl: updated.bylawDocumentUrl,
            registrationCertUrl: updated.registrationCertUrl
          },
          uploadedFiles: {
            bylaw: files.bylaw?.[0]?.filename,
            certificate: files.certificate?.[0]?.filename
          }
        }
      });
      
    } catch (error) {
      console.error('Upload organization documents error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload organization documents'
      });
    }
  })
);

/**
 * Reset serial counter (EMERGENCY USE ONLY)
 * POST /api/admin/organization/reset-serial-counter
 * Body: { newCounter: number, confirmationText: "RESET_SERIAL_COUNTER_CONFIRMED" }
 * Access: SUPER_ADMIN only
 */
router.post('/admin/reset-serial-counter',
  asyncHandler(organizationController.resetSerialCounter)
);

module.exports = router;

// ==========================================
// ADDITIONAL ROUTE FILE: UPDATE MAIN AUTH ROUTES
// File: apm-server/src/routes/auth.route.js (UPDATE EXISTING)
// ==========================================

/*
ADD THIS TO YOUR EXISTING auth.route.js FILE:

// Import the new blacklist middleware
const { checkEmailBlacklist } = require('../middleware/alumniVerification.middleware');

// UPDATE the existing register route to include blacklist check:
router.post('/register', 
  checkEmailBlacklist,  // 🆕 ADD THIS BEFORE EXISTING MIDDLEWARE
  asyncHandler(authController.register)
);

// All other routes remain unchanged
*/

// ==========================================
// ROUTE INTEGRATION FILE
// File: apm-server/src/routes/index.js (UPDATE EXISTING)
// ==========================================

/*
ADD THESE LINES TO YOUR EXISTING routes/index.js:

// Import new admin routes
const alumniVerificationRoutes = require('./admin/alumniVerification.route');
const organizationRoutes = require('./admin/organization.route');

// Add to your app routing:
app.use('/api/admin/verification', alumniVerificationRoutes);
app.use('/api/organization', organizationRoutes);

*/