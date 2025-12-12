// ==========================================
// STEP 6: ORGANIZATION MANAGEMENT CONTROLLER
// File: apm-server/src/controllers/admin/organization.controller.js
// ==========================================

const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { CacheService } = require('../../config/redis');
const SerialIdService = require('../../services/serialID.service');
const { cloudflareR2Service } = require('../../services/cloudflare-r2.service');
const { getTenantFilter, getOrganizationFilter } = require('../../utils/tenant.util');

/**
 * Get organization details
 * Public endpoint - no authentication required
 */
const getOrganizationDetails = async (req, res) => {
  try {
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    const tenantCode = req.headers['x-tenant-code'] || 'default';
    const cacheKey = `public:organization:details:${tenantCode}`;

    // Debug logging for tenant isolation
    console.log('🏢 getOrganizationDetails - Tenant debug:', {
      tenantCode,
      reqTenant: req.tenant ? { id: req.tenant.id, name: req.tenant.name, tenantCode: req.tenant.tenantCode } : null,
      orgFilter,
      cacheKey
    });

    let organization = await CacheService.get(cacheKey);
    const fromCache = !!organization;

    if (!organization) {
      organization = await prisma.organization.findFirst({
        where: { ...orgFilter, isActive: true },
        select: {
          id: true,
          name: true,
          shortName: true,
          foundationYear: true,
          officialEmail: true,
          officialContactNumber: true,
          officeAddress: true,
          logoUrl: true,
          bylawDocumentUrl: true,
          registrationCertUrl: true,
          websiteUrl: true,
          instagramUrl: true,
          facebookUrl: true,
          youtubeUrl: true,
          twitterUrl: true,
          linkedinUrl: true,
          foundingMembers: true,
          // About Organization fields
          description: true,
          mission: true,
          vision: true,
          presidentMessage: true,
          secretaryMessage: true,
          treasurerMessage: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      if (organization) {
        // Cache for 1 hour (public data)
        await CacheService.set(cacheKey, organization, 3600);
      }
    }
    
    if (!organization) {
      return successResponse(res, {
        organization: null,
        isConfigured: false
      });
    }

    // Log what org was found/returned
    console.log('🏢 getOrganizationDetails - Result:', {
      fromCache,
      foundOrgId: organization.id,
      foundOrgName: organization.name,
      requestedTenantCode: tenantCode
    });

    return successResponse(res, {
      organization: {
        ...organization,
        // Hide sensitive details in public endpoint
        serialCounter: undefined, // Don't expose counter
        lastUpdatedBy: undefined
      },
      isConfigured: true
    });
    
  } catch (error) {
    console.error('Get organization details error:', error);
    return errorResponse(res, 'Failed to fetch organization details', 500);
  }
};

/**
 * Get organization details for admin (includes all fields)
 * SUPER_ADMIN only
 */
const getOrganizationDetailsAdmin = async (req, res) => {
  try {
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    // For User/Batch queries, use getTenantFilter which returns { organizationId: ... }
    const tenantFilter = getTenantFilter(req);

    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      include: {
        lastUpdatedAdmin: {
          select: {
            fullName: true,
            role: true
          }
        }
      }
    });

    if (!organization) {
      // Get basic statistics even if no organization exists
      // Note: Batch model is global (not tenant-scoped), so count all batches
      const [totalUsers, totalVerified, totalBatches] = await Promise.all([
        prisma.user.count({ where: { ...tenantFilter, isActive: true, role: 'USER' } }),
        prisma.user.count({ where: { ...tenantFilter, isActive: true, isAlumniVerified: true } }),
        prisma.batch.count()
      ]);
      
      return successResponse(res, {
        organization: null,
        isConfigured: false,
        statistics: {
          totalUsers,
          totalVerified,
          totalBatches,
          currentSerialCounter: 0,
          verificationRate: totalUsers > 0 ? ((totalVerified / totalUsers) * 100).toFixed(1) : '0'
        }
      });
    }
    
    // Get additional statistics
    // Note: Batch model is global (not tenant-scoped), so count all batches
    const [totalUsers, totalVerified, totalBatches] = await Promise.all([
      prisma.user.count({ where: { ...tenantFilter, isActive: true, role: 'USER' } }),
      prisma.user.count({ where: { ...tenantFilter, isActive: true, isAlumniVerified: true } }),
      prisma.batch.count()
    ]);
    
    return successResponse(res, {
      organization,
      isConfigured: true,
      statistics: {
        totalUsers,
        totalVerified,
        totalBatches,
        currentSerialCounter: organization.serialCounter,
        verificationRate: totalUsers > 0 ? ((totalVerified / totalUsers) * 100).toFixed(1) : '0'
      }
    });
    
  } catch (error) {
    console.error('Get organization details admin error:', error);
    return errorResponse(res, 'Failed to fetch organization details', 500);
  }
};

/**
 * Create or update organization details
 * SUPER_ADMIN only
 */
const upsertOrganizationDetails = async (req, res) => {
  try {
    const {
      name,
      shortName,
      foundationYear,
      officialEmail,
      officialContactNumber,
      officeAddress,
      logoUrl,
      bylawDocumentUrl,
      registrationCertUrl,
      websiteUrl,
      instagramUrl,
      facebookUrl,
      youtubeUrl,
      twitterUrl,
      linkedinUrl,
      foundingMembers,
      // About Organization fields
      description,
      mission,
      vision,
      presidentMessage,
      secretaryMessage,
      treasurerMessage
    } = req.body;
    
    const { id: adminId, fullName: adminName } = req.user;
    
    // Validation
    if (!name || !shortName || !foundationYear || !officialEmail) {
      return errorResponse(res, 'Name, short name, foundation year, and official email are required', 400);
    }
    
    // Validate short name (3-10 characters, uppercase letters only)
    if (!/^[A-Z]{2,10}$/.test(shortName)) {
      return errorResponse(res, 'Short name must be 2-10 uppercase letters only', 400);
    }
    
    // Validate foundation year
    const currentYear = new Date().getFullYear();
    if (foundationYear < 1800 || foundationYear > currentYear) {
      return errorResponse(res, 'Invalid foundation year', 400);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(officialEmail)) {
      return errorResponse(res, 'Invalid official email format', 400);
    }
    
    // Parse founding members if provided
    let parsedFoundingMembers = null;
    if (foundingMembers) {
      try {
        if (typeof foundingMembers === 'string') {
          parsedFoundingMembers = JSON.parse(foundingMembers);
        } else {
          parsedFoundingMembers = foundingMembers;
        }
        
        // Validate founding members structure
        if (Array.isArray(parsedFoundingMembers)) {
          parsedFoundingMembers = parsedFoundingMembers.map(member => ({
            name: member.name || '',
            role: member.role || 'Founder',
            year: member.year || foundationYear
          }));
        }
      } catch (parseError) {
        return errorResponse(res, 'Invalid founding members format', 400);
      }
    }

    // Check if organization already exists for this tenant
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    const existingOrg = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true }
    });

    const organization = await prisma.$transaction(async (tx) => {
      let result;
      
      if (existingOrg) {
        // Update existing organization
        result = await tx.organization.update({
          where: { id: existingOrg.id },
          data: {
            name: name.trim(),
            shortName: shortName.trim().toUpperCase(),
            foundationYear,
            officialEmail: officialEmail.toLowerCase(),
            officialContactNumber: officialContactNumber?.trim(),
            officeAddress: officeAddress?.trim(),
            logoUrl: logoUrl?.trim(),
            bylawDocumentUrl: bylawDocumentUrl?.trim(),
            registrationCertUrl: registrationCertUrl?.trim(),
            websiteUrl: websiteUrl?.trim(),
            instagramUrl: instagramUrl?.trim(),
            facebookUrl: facebookUrl?.trim(),
            youtubeUrl: youtubeUrl?.trim(),
            twitterUrl: twitterUrl?.trim(),
            linkedinUrl: linkedinUrl?.trim(),
            foundingMembers: parsedFoundingMembers,
            // About Organization fields
            description: description?.trim(),
            mission: mission?.trim(),
            vision: vision?.trim(),
            presidentMessage: presidentMessage?.trim(),
            secretaryMessage: secretaryMessage?.trim(),
            treasurerMessage: treasurerMessage?.trim(),
            lastUpdatedBy: adminId
          }
        });
        
        // Log update activity
        await tx.activityLog.create({
          data: {
            userId: adminId,
            action: 'organization_updated',
            details: {
              organizationId: result.id,
              organizationName: result.name,
              shortName: result.shortName,
              updatedFields: Object.keys(req.body),
              updatedBy: adminName
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
        
      } else {
        // Create new organization
        result = await tx.organization.create({
          data: {
            name: name.trim(),
            shortName: shortName.trim().toUpperCase(),
            foundationYear,
            officialEmail: officialEmail.toLowerCase(),
            officialContactNumber: officialContactNumber?.trim(),
            officeAddress: officeAddress?.trim(),
            logoUrl: logoUrl?.trim(),
            bylawDocumentUrl: bylawDocumentUrl?.trim(),
            registrationCertUrl: registrationCertUrl?.trim(),
            websiteUrl: websiteUrl?.trim(),
            instagramUrl: instagramUrl?.trim(),
            facebookUrl: facebookUrl?.trim(),
            youtubeUrl: youtubeUrl?.trim(),
            twitterUrl: twitterUrl?.trim(),
            linkedinUrl: linkedinUrl?.trim(),
            foundingMembers: parsedFoundingMembers,
            // About Organization fields
            description: description?.trim(),
            mission: mission?.trim(),
            vision: vision?.trim(),
            presidentMessage: presidentMessage?.trim(),
            secretaryMessage: secretaryMessage?.trim(),
            treasurerMessage: treasurerMessage?.trim(),
            lastUpdatedBy: adminId,
            serialCounter: 0 // Start serial counter at 0
          }
        });
        
        // Log creation activity
        await tx.activityLog.create({
          data: {
            userId: adminId,
            action: 'organization_created',
            details: {
              organizationId: result.id,
              organizationName: result.name,
              shortName: result.shortName,
              foundationYear: result.foundationYear,
              createdBy: adminName
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
      }
      
      return result;
    });
    
    // Clear all organization-related caches
    await Promise.all([
      CacheService.del('public:organization:details'),
      CacheService.del('system:organization:details'),
      CacheService.del('system:organization:id')
    ]);
    
    return successResponse(res, {
      message: existingOrg ? 'Organization details updated successfully' : 'Organization details created successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        shortName: organization.shortName,
        foundationYear: organization.foundationYear,
        officialEmail: organization.officialEmail,
        updatedAt: organization.updatedAt
      },
      action: {
        type: existingOrg ? 'UPDATE' : 'CREATE',
        performedBy: adminName,
        performedAt: organization.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Upsert organization details error:', error);
    
    if (error.code === 'P2002') {
      return errorResponse(res, 'Organization name or short name already exists', 409);
    }
    
    return errorResponse(res, 'Failed to save organization details', 500);
  }
};


/**
 * Get organization statistics for admin dashboard
 * SUPER_ADMIN only
 */
const getOrganizationStats = async (req, res) => {
  try {
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    // getTenantFilter for User/Batch queries (uses 'organizationId')
    const tenantFilter = getTenantFilter(req);
    const tenantCode = req.headers['x-tenant-code'] || 'default';
    const cacheKey = `admin:organization:stats:${tenantCode}`;
    let stats = await CacheService.get(cacheKey);

    if (!stats) {
      const organization = await prisma.organization.findFirst({
        where: { ...orgFilter, isActive: true },
        select: {
          id: true,
          name: true,
          shortName: true,
          foundationYear: true,
          serialCounter: true,
          createdAt: true
        }
      });
      
      if (!organization) {
        return errorResponse(res, 'Organization not configured', 404);
      }
      
      const currentYear = new Date().getFullYear();
      const organizationAge = currentYear - organization.foundationYear;
      
      const [
        totalUsers,
        verifiedUsers,
        pendingUsers,
        rejectedUsers,
        totalBatches,
        activeBatches,
        recentRegistrations,
        oldestBatch,
        newestBatch
      ] = await Promise.all([
        // User statistics
        prisma.user.count({
          where: { ...tenantFilter, isActive: true, role: 'USER' }
        }),

        prisma.user.count({
          where: { ...tenantFilter, isActive: true, isAlumniVerified: true }
        }),

        prisma.user.count({
          where: { ...tenantFilter, isActive: true, pendingVerification: true }
        }),

        prisma.user.count({
          where: { ...tenantFilter, isActive: true, isRejected: true }
        }),

        // Batch statistics
        prisma.batch.count({ where: tenantFilter }),

        prisma.batch.count({
          where: { ...tenantFilter, totalMembers: { gt: 0 } }
        }),

        // Recent activity
        prisma.user.count({
          where: {
            ...tenantFilter,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            },
            role: 'USER'
          }
        }),

        // Batch range
        prisma.batch.findFirst({
          where: tenantFilter,
          orderBy: { year: 'asc' },
          select: { year: true, name: true }
        }),

        prisma.batch.findFirst({
          where: tenantFilter,
          orderBy: { year: 'desc' },
          select: { year: true, name: true }
        })
      ]);
      
      stats = {
        organization: {
          name: organization.name,
          shortName: organization.shortName,
          foundationYear: organization.foundationYear,
          age: organizationAge,
          currentSerialCounter: organization.serialCounter
        },
        
        userStatistics: {
          total: totalUsers,
          verified: verifiedUsers,
          pending: pendingUsers,
          rejected: rejectedUsers,
          verificationRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : 0
        },
        
        batchStatistics: {
          totalBatches,
          activeBatches, // Batches with members
          batchRange: {
            oldest: oldestBatch,
            newest: newestBatch,
            span: oldestBatch && newestBatch ? (newestBatch.year - oldestBatch.year + 1) : 0
          }
        },
        
        recentActivity: {
          newRegistrationsLast30Days: recentRegistrations,
          averageRegistrationsPerDay: (recentRegistrations / 30).toFixed(1)
        }
      };
      
      // Cache for 10 minutes
      await CacheService.set(cacheKey, stats, 600);
    }
    
    return successResponse(res, stats);
    
  } catch (error) {
    console.error('Get organization stats error:', error);
    return errorResponse(res, 'Failed to fetch organization statistics', 500);
  }
};

/**
 * Initialize organization details (first-time setup)
 * SUPER_ADMIN only
 */
const initializeOrganization = async (req, res) => {
  try {
    const {
      name = 'Jawahar Navodaya Vidyalaya Alumni',
      shortName = 'JNV',
      foundationYear = 1986,
      officialEmail,
      officialContactNumber,
      officeAddress
    } = req.body;
    
    const { id: adminId, fullName: adminName } = req.user;

    // Check if organization already exists for this tenant
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    const existingOrg = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true }
    });

    if (existingOrg) {
      return errorResponse(res, 'Organization is already configured. Use update endpoint instead.', 409);
    }
    
    // Validate required fields
    if (!officialEmail) {
      return errorResponse(res, 'Official email is required for initialization', 400);
    }
    
    const organization = await SerialIdService.initializeOrganization({
      name: name.trim(),
      shortName: shortName.trim().toUpperCase(),
      foundationYear,
      officialEmail: officialEmail.toLowerCase(),
      officialContactNumber: officialContactNumber?.trim(),
      officeAddress: officeAddress?.trim()
    });
    
    // Log initialization
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'organization_initialized',
        details: {
          organizationId: organization.id,
          organizationName: organization.name,
          shortName: organization.shortName,
          foundationYear: organization.foundationYear,
          initializedBy: adminName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(res, {
      message: 'Organization initialized successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        shortName: organization.shortName,
        foundationYear: organization.foundationYear,
        officialEmail: organization.officialEmail,
        serialCounter: organization.serialCounter
      },
      nextSteps: [
        'Upload organization logo',
        'Add founding members information',
        'Configure social media links',
        'Upload organization documents'
      ]
    });
    
  } catch (error) {
    console.error('Initialize organization error:', error);
    
    if (error.message.includes('already configured')) {
      return errorResponse(res, error.message, 409);
    }
    
    return errorResponse(res, 'Failed to initialize organization', 500);
  }
};

/**
 * Update organization social links
 * SUPER_ADMIN only
 */
const updateSocialLinks = async (req, res) => {
  try {
    const {
      websiteUrl,
      instagramUrl,
      facebookUrl,
      youtubeUrl,
      twitterUrl,
      linkedinUrl
    } = req.body;
    
    const { id: adminId } = req.user;

    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not configured', 404);
    }

    // URL validation helper
    const validateUrl = (url, platform) => {
      if (!url) return null;
      
      try {
        const urlObj = new URL(url);
        
        // Basic URL validation
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error(`${platform} URL must use HTTP or HTTPS`);
        }
        
        return url.trim();
      } catch (error) {
        throw new Error(`Invalid ${platform} URL format`);
      }
    };
    
    // Validate all URLs
    const validatedUrls = {
      websiteUrl: validateUrl(websiteUrl, 'Website'),
      instagramUrl: validateUrl(instagramUrl, 'Instagram'),
      facebookUrl: validateUrl(facebookUrl, 'Facebook'),
      youtubeUrl: validateUrl(youtubeUrl, 'YouTube'),
      twitterUrl: validateUrl(twitterUrl, 'Twitter'),
      linkedinUrl: validateUrl(linkedinUrl, 'LinkedIn')
    };
    
    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organization.id },
        data: {
          ...validatedUrls,
          lastUpdatedBy: adminId
        }
      });
      
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'organization_social_links_updated',
          details: {
            organizationId: organization.id,
            updatedLinks: Object.keys(validatedUrls).filter(key => validatedUrls[key])
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      return updated;
    });
    
    // Clear caches
    await Promise.all([
      CacheService.del('public:organization:details'),
      CacheService.del('system:organization:details')
    ]);
    
    return successResponse(res, {
      message: 'Social links updated successfully',
      socialLinks: {
        websiteUrl: updated.websiteUrl,
        instagramUrl: updated.instagramUrl,
        facebookUrl: updated.facebookUrl,
        youtubeUrl: updated.youtubeUrl,
        twitterUrl: updated.twitterUrl,
        linkedinUrl: updated.linkedinUrl
      }
    });
    
  } catch (error) {
    console.error('Update social links error:', error);
    return errorResponse(res, error.message || 'Failed to update social links', 500);
  }
};

/**
 * Reset serial counter (SUPER_ADMIN only - emergency use)
 * This is a dangerous operation and should be used carefully
 */
const resetSerialCounter = async (req, res) => {
  try {
    const { newCounter = 0, confirmationText } = req.body;
    const { id: adminId, fullName: adminName } = req.user;
    
    // Safety confirmation
    if (confirmationText !== 'RESET_SERIAL_COUNTER_CONFIRMED') {
      return errorResponse(res, 'Confirmation text required: RESET_SERIAL_COUNTER_CONFIRMED', 400);
    }
    
    if (newCounter < 0 || newCounter > 999999) {
      return errorResponse(res, 'New counter must be between 0 and 999999', 400);
    }

    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      select: { id: true, serialCounter: true, name: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not configured', 404);
    }
    
    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organization.id },
        data: {
          serialCounter: newCounter,
          lastUpdatedBy: adminId
        }
      });
      
      // Log this critical operation
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'serial_counter_reset',
          details: {
            organizationId: organization.id,
            previousCounter: organization.serialCounter,
            newCounter: newCounter,
            resetBy: adminName,
            confirmationProvided: true,
            warning: 'Critical system operation - serial counter reset'
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      return updated;
    });
    
    // Clear all serial ID related caches
    await Promise.all([
      CacheService.del('system:serial_counter'),
      CacheService.del('system:organization:details'),
      CacheService.del('admin:organization:stats')
    ]);
    
    return successResponse(res, {
      message: 'Serial counter has been reset successfully',
      warning: 'This is a critical operation. Ensure no concurrent registrations are happening.',
      counter: {
        previous: organization.serialCounter,
        current: updated.serialCounter,
        resetBy: adminName,
        resetAt: updated.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Reset serial counter error:', error);
    return errorResponse(res, 'Failed to reset serial counter', 500);
  }
};

/**
 * Upload organization files (logo, bylaws, certificate)
 * SUPER_ADMIN only
 */
const uploadOrganizationFiles = async (req, res) => {
  try {
    console.log('Upload request received:');
    console.log('- Content-Type:', req.get('Content-Type'));
    console.log('- Files object:', req.files);
    console.log('- Body:', req.body);
    console.log('- File keys:', req.files ? Object.keys(req.files) : 'no files object');
    
    const { id: adminId, fullName: adminName } = req.user;
    const files = req.files;
    
    if (!files || Object.keys(files).length === 0) {
      console.log('❌ No files found in request');
      return errorResponse(res, 'No files provided for upload', 400);
    }
    
    // Check if Cloudflare R2 is configured
    if (!cloudflareR2Service.isConfigured()) {
      return errorResponse(res, 'File storage (Cloudflare R2) is not configured. Please set up R2 environment variables: CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL', 500);
    }

    // Get existing organization for this tenant
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    const existingOrg = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true }
    });

    if (!existingOrg) {
      return errorResponse(res, 'Organization not found. Please initialize first.', 404);
    }

    const uploadResults = {};
    const updateData = {};
    const oldFiles = {}; // For cleanup if upload fails
    
    try {
      // Upload logo file
      if (files.logoFile && files.logoFile[0]) {
        const logoFile = files.logoFile[0];
        const validation = cloudflareR2Service.validateOrganizationFile(logoFile, 'logo');
        
        if (!validation.isValid) {
          return errorResponse(res, `Logo validation failed: ${validation.errors.join(', ')}`, 400);
        }
        
        oldFiles.logoUrl = existingOrg.logoUrl;
        const logoResult = await cloudflareR2Service.uploadOrganizationLogo(logoFile);
        uploadResults.logo = logoResult;
        updateData.logoUrl = logoResult.url;
      }
      
      // Upload bylaw document
      if (files.bylawFile && files.bylawFile[0]) {
        const bylawFile = files.bylawFile[0];
        const validation = cloudflareR2Service.validateOrganizationFile(bylawFile, 'bylaw');
        
        if (!validation.isValid) {
          return errorResponse(res, `Bylaw document validation failed: ${validation.errors.join(', ')}`, 400);
        }
        
        oldFiles.bylawDocumentUrl = existingOrg.bylawDocumentUrl;
        const bylawResult = await cloudflareR2Service.uploadOrganizationBylaw(bylawFile);
        uploadResults.bylaw = bylawResult;
        updateData.bylawDocumentUrl = bylawResult.url;
      }
      
      // Upload certificate document
      if (files.certFile && files.certFile[0]) {
        const certFile = files.certFile[0];
        const validation = cloudflareR2Service.validateOrganizationFile(certFile, 'certificate');
        
        if (!validation.isValid) {
          return errorResponse(res, `Certificate validation failed: ${validation.errors.join(', ')}`, 400);
        }
        
        oldFiles.registrationCertUrl = existingOrg.registrationCertUrl;
        const certResult = await cloudflareR2Service.uploadOrganizationCertificate(certFile);
        uploadResults.certificate = certResult;
        updateData.registrationCertUrl = certResult.url;
      }
      
      // Update organization with new file URLs
      const updatedOrg = await prisma.organization.update({
        where: { id: existingOrg.id },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });
      
      // Delete old files from R2 (cleanup)
      for (const [field, oldUrl] of Object.entries(oldFiles)) {
        if (oldUrl) {
          try {
            const oldKey = cloudflareR2Service.extractKeyFromUrl(oldUrl);
            if (oldKey) {
              await cloudflareR2Service.deleteFile(oldKey);
            }
          } catch (cleanupError) {
            console.warn(`Failed to cleanup old file ${field}:`, cleanupError);
          }
        }
      }
      
      // Clear cache
      await CacheService.delPattern('organization:*');
      await CacheService.delPattern('public:organization:*');
      
      // Log file uploads
      await prisma.activityLog.create({
        data: {
          userId: adminId,
          action: 'organization_files_uploaded',
          details: {
            organizationId: existingOrg.id,
            uploadedFiles: Object.keys(uploadResults),
            uploadResults: Object.keys(uploadResults).reduce((acc, key) => ({
              ...acc,
              [key]: {
                filename: uploadResults[key].filename,
                size: uploadResults[key].size,
                url: uploadResults[key].url
              }
            }), {}),
            uploadedBy: adminName
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      return successResponse(res, {
        message: 'Organization files uploaded successfully',
        uploadedFiles: uploadResults,
        organization: {
          id: updatedOrg.id,
          logoUrl: updatedOrg.logoUrl,
          bylawDocumentUrl: updatedOrg.bylawDocumentUrl,
          registrationCertUrl: updatedOrg.registrationCertUrl,
          updatedAt: updatedOrg.updatedAt
        }
      });
      
    } catch (uploadError) {
      // Cleanup any successfully uploaded files if there's an error
      for (const result of Object.values(uploadResults)) {
        if (result.key) {
          try {
            await cloudflareR2Service.deleteFile(result.key);
          } catch (cleanupError) {
            console.warn('Failed to cleanup uploaded file:', cleanupError);
          }
        }
      }
      throw uploadError;
    }
    
  } catch (error) {
    console.error('Organization file upload error:', error);
    return errorResponse(res, error.message || 'Failed to upload organization files', 500);
  }
};

/**
 * Upload organization logo only
 * SUPER_ADMIN only
 */
const uploadOrganizationLogo = async (req, res) => {
  try {
    const { id: adminId, fullName: adminName } = req.user;
    const file = req.file;
    
    if (!file) {
      return errorResponse(res, 'No logo file provided', 400);
    }
    
    // Check if Cloudflare R2 is configured
    if (!cloudflareR2Service.isConfigured()) {
      return errorResponse(res, 'File storage (Cloudflare R2) is not configured. Please set up R2 environment variables: CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL', 500);
    }
    
    // Validate logo file
    const validation = cloudflareR2Service.validateOrganizationFile(file, 'logo');
    if (!validation.isValid) {
      return errorResponse(res, `Logo validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Get existing organization for this tenant
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    const existingOrg = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true }
    });

    if (!existingOrg) {
      return errorResponse(res, 'Organization not found. Please initialize first.', 404);
    }
    
    // Upload new logo
    const uploadResult = await cloudflareR2Service.uploadOrganizationLogo(file);
    
    // Update organization with new logo URL
    const updatedOrg = await prisma.organization.update({
      where: { id: existingOrg.id },
      data: {
        logoUrl: uploadResult.url,
        updatedAt: new Date()
      }
    });
    
    // Delete old logo if exists
    if (existingOrg.logoUrl) {
      try {
        const oldKey = cloudflareR2Service.extractKeyFromUrl(existingOrg.logoUrl);
        if (oldKey) {
          await cloudflareR2Service.deleteFile(oldKey);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup old logo:', cleanupError);
      }
    }
    
    // Clear cache
    await CacheService.delPattern('organization:*');
    await CacheService.delPattern('public:organization:*');
    
    // Log logo upload
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'organization_logo_uploaded',
        details: {
          organizationId: existingOrg.id,
          filename: uploadResult.filename,
          size: uploadResult.size,
          url: uploadResult.url,
          uploadedBy: adminName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(res, {
      message: 'Organization logo uploaded successfully',
      logo: uploadResult,
      organization: {
        id: updatedOrg.id,
        logoUrl: updatedOrg.logoUrl,
        updatedAt: updatedOrg.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Organization logo upload error:', error);
    return errorResponse(res, error.message || 'Failed to upload organization logo', 500);
  }
};

/**
 * View organization file through authenticated proxy
 * POST /api/admin/organization/files/view
 * Body: { fileUrl: string, fileType: string }
 * Access: SUPER_ADMIN only
 */
const viewOrganizationFile = async (req, res) => {
  try {
    const { fileUrl, fileType } = req.body;
    
    if (!fileUrl || !fileType) {
      return errorResponse(res, 'File URL and file type are required', 400);
    }

    // Verify the file belongs to this organization (with tenant filtering)
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }
    
    // Verify the file URL belongs to this organization
    const validUrls = [
      organization.logoUrl,
      organization.bylawDocumentUrl,
      organization.registrationCertUrl
    ].filter(Boolean);
    
    if (!validUrls.includes(fileUrl)) {
      return errorResponse(res, 'Unauthorized file access', 403);
    }
    
    // Fetch the file from R2
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      return errorResponse(res, 'File not found or inaccessible', 404);
    }
    
    // Get the file blob and determine content type
    const fileBuffer = await fileResponse.arrayBuffer();
    let contentType = fileResponse.headers.get('content-type');
    
    // Fallback content type detection
    if (!contentType) {
      if (fileUrl.includes('.pdf')) contentType = 'application/pdf';
      else if (fileUrl.includes('.png')) contentType = 'image/png';
      else if (fileUrl.includes('.jpg') || fileUrl.includes('.jpeg')) contentType = 'image/jpeg';
      else if (fileUrl.includes('.webp')) contentType = 'image/webp';
      else contentType = 'application/octet-stream';
    }
    
    // Set appropriate headers and send the file
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${fileType}_${Date.now()}"`,
      'Cache-Control': 'private, max-age=300'
    });
    
    return res.send(Buffer.from(fileBuffer));
    
  } catch (error) {
    console.error('View organization file error:', error);
    return errorResponse(res, 'Failed to load file', 500);
  }
};

/**
 * Delete organization file
 * DELETE /api/admin/organization/files/delete
 * Body: { fileType: 'logo' | 'bylaw' | 'certificate' }
 * Access: SUPER_ADMIN only
 */
const deleteOrganizationFile = async (req, res) => {
  try {
    const { fileType } = req.body;
    const { id: adminId } = req.user;
    
    if (!fileType || !['logo', 'bylaw', 'certificate'].includes(fileType)) {
      return errorResponse(res, 'Invalid file type. Must be logo, bylaw, or certificate', 400);
    }

    // Get current organization for this tenant
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }
    
    // Determine which field to update and get the file URL for deletion
    let updateData = { lastUpdatedBy: adminId };
    let fileUrlToDelete = null;
    
    switch (fileType) {
      case 'logo':
        fileUrlToDelete = organization.logoUrl;
        updateData.logoUrl = null;
        break;
      case 'bylaw':
        fileUrlToDelete = organization.bylawDocumentUrl;
        updateData.bylawDocumentUrl = null;
        break;
      case 'certificate':
        fileUrlToDelete = organization.registrationCertUrl;
        updateData.registrationCertUrl = null;
        break;
    }
    
    if (!fileUrlToDelete) {
      return errorResponse(res, 'No file found to delete', 404);
    }
    
    // Update database and delete from R2 in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update organization record
      const updatedOrg = await tx.organization.update({
        where: { id: organization.id },
        data: updateData
      });
      
      // Log the deletion
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: `organization_${fileType}_deleted`,
          details: {
            organizationId: organization.id,
            deletedFileUrl: fileUrlToDelete,
            fileType
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      return updatedOrg;
    });
    
    // Delete file from R2 (don't fail the request if this fails)
    try {
      if (fileType === 'logo') {
        await cloudflareR2Service.deleteOrganizationLogo(fileUrlToDelete);
      } else if (fileType === 'bylaw') {
        await cloudflareR2Service.deleteOrganizationBylaw(fileUrlToDelete);
      } else if (fileType === 'certificate') {
        await cloudflareR2Service.deleteOrganizationCertificate(fileUrlToDelete);
      }
    } catch (deleteError) {
      console.warn('Failed to delete file from R2 storage:', deleteError);
      // Continue - database is updated, file deletion from R2 can be handled separately
    }
    
    // Clear caches
    await Promise.all([
      CacheService.delPattern('organization:*'),
      CacheService.delPattern('public:organization:*')
    ]);
    
    return successResponse(res, {
      message: `${fileType} deleted successfully`,
      organization: {
        id: result.id,
        logoUrl: result.logoUrl,
        bylawDocumentUrl: result.bylawDocumentUrl,
        registrationCertUrl: result.registrationCertUrl
      }
    });
    
  } catch (error) {
    console.error('Delete organization file error:', error);
    return errorResponse(res, 'Failed to delete file', 500);
  }
};

module.exports = {
  getOrganizationDetails,      // Public endpoint
  getOrganizationDetailsAdmin, // Admin endpoint with full details
  upsertOrganizationDetails,   // Create/Update organization  
  updateSocialLinks,           // Update social media links
  uploadOrganizationLogo,      // Upload logo only
  uploadOrganizationFiles,     // Upload multiple files (logo, bylaw, certificate)
  resetSerialCounter,          // Emergency serial counter reset
  getOrganizationStats,        // Organization statistics
  initializeOrganization,      // Initialize organization
  viewOrganizationFile,        // View file through authenticated proxy
  deleteOrganizationFile       // Delete organization file
};