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
const { uploadOrganizationFiles } = require('../../middleware/upload.middleware');
const { asyncHandler } = require('../../utils/response');
const { optionalTenantMiddleware } = require('../../middleware/tenant.middleware');

// Import controller
const organizationController = require('../../controllers/admin/organization.controller');


// ==========================================
// PUBLIC ROUTES (NO AUTHENTICATION REQUIRED)
// ==========================================

/**
 * Get public organization details
 * GET /api/organization
 * Access: PUBLIC
 */
router.get('/',
  optionalTenantMiddleware, // Set req.tenant from X-Tenant-Code header
  asyncHandler(organizationController.getOrganizationDetails)
);

// ==========================================
// ADMIN ROUTES (SUPER_ADMIN ONLY)
// ==========================================

// Apply authentication, tenant middleware, and super admin role to all admin routes
router.use(authenticateToken);
router.use(optionalTenantMiddleware); // Set req.tenant from X-Tenant-Code header
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
 * Upload organization logo (legacy route)
 * POST /api/admin/organization/upload/logo
 * Form-data: logo file
 * Access: SUPER_ADMIN only
 */
router.post('/admin/upload/logo',
  multer({
    storage: multer.diskStorage({
      destination: './public/uploads/organization',
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `logo_${timestamp}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      cb(null, allowedTypes.includes(file.mimetype));
    },
    limits: { fileSize: 5 * 1024 * 1024 }
  }).single('logo'),
  asyncHandler(organizationController.uploadOrganizationLogo)
);

/**
 * Upload organization documents (bylaw, certificate)
 * POST /api/admin/organization/upload/documents
 * Form-data: bylaw file, certificate file
 * Access: SUPER_ADMIN only
 */
router.post('/admin/upload/documents',
  multer({
    storage: multer.diskStorage({
      destination: './public/uploads/organization',
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}_${timestamp}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = {
        'bylaw': ['application/pdf'],
        'certificate': ['application/pdf', 'image/jpeg', 'image/png']
      };
      const fieldAllowedTypes = allowedTypes[file.fieldname] || [];
      cb(null, fieldAllowedTypes.includes(file.mimetype));
    },
    limits: { fileSize: 10 * 1024 * 1024 }
  }).fields([
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
 * Upload organization files with Cloudflare R2
 * POST /api/admin/organization/upload/files
 * Form-data: logoFile?, bylawFile?, certFile?
 * Access: SUPER_ADMIN only
 */
router.post('/admin/upload/files',
  uploadOrganizationFiles,
  asyncHandler(organizationController.uploadOrganizationFiles)
);

/**
 * Upload organization logo with Cloudflare R2 (single file)
 * POST /api/admin/organization/upload/logo-r2
 * Form-data: logoFile
 * Access: SUPER_ADMIN only
 */
router.post('/admin/upload/logo-r2',
  uploadOrganizationFiles,
  asyncHandler((req, res) => {
    // Ensure only logoFile is present for single logo upload
    if (req.files && req.files.logoFile) {
      req.file = req.files.logoFile[0];
      delete req.files;
    }
    return organizationController.uploadOrganizationLogo(req, res);
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

/**
 * View organization file through authenticated proxy
 * POST /api/admin/organization/files/view
 * Body: { fileUrl: string, fileType: string }
 * Access: SUPER_ADMIN only
 */
router.post('/files/view',
  asyncHandler(organizationController.viewOrganizationFile)
);

/**
 * Delete organization file
 * DELETE /api/admin/organization/files/delete
 * Body: { fileType: 'logo' | 'bylaw' | 'certificate' }
 * Access: SUPER_ADMIN only
 */
router.delete('/files/delete',
  asyncHandler(organizationController.deleteOrganizationFile)
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