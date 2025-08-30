// ==========================================
// STEP 6: ORGANIZATION MANAGEMENT CONTROLLER
// File: apm-server/src/controllers/admin/organization.controller.js
// ==========================================

const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { CacheService } = require('../../config/redis');
const SerialIdService = require('../../services/serialID.service');

/**
 * Get organization details
 * Public endpoint - no authentication required
 */
const getOrganizationDetails = async (req, res) => {
  try {
    const cacheKey = 'public:organization:details';
    let organization = await CacheService.get(cacheKey);
    
    if (!organization) {
      organization = await prisma.organization.findFirst({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          shortName: true,
          foundationYear: true,
          officialEmail: true,
          officialContactNumber: true,
          officeAddress: true,
          logoUrl: true,
          websiteUrl: true,
          instagramUrl: true,
          facebookUrl: true,
          youtubeUrl: true,
          twitterUrl: true,
          linkedinUrl: true,
          foundingMembers: true,
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
      return errorResponse(res, 'Organization details not configured', 404);
    }
    
    return successResponse(res, {
      organization: {
        ...organization,
        // Hide sensitive details in public endpoint
        serialCounter: undefined, // Don't expose counter
        lastUpdatedBy: undefined
      }
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
    const organization = await prisma.organization.findFirst({
      where: { isActive: true },
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
      return errorResponse(res, 'Organization details not configured', 404);
    }
    
    // Get additional statistics
    const [totalUsers, totalVerified, totalBatches] = await Promise.all([
      prisma.user.count({ where: { isActive: true, role: 'USER' } }),
      prisma.user.count({ where: { isActive: true, isAlumniVerified: true } }),
      prisma.batch.count()
    ]);
    
    return successResponse(res, {
      organization,
      statistics: {
        totalUsers,
        totalVerified,
        totalBatches,
        currentSerialCounter: organization.serialCounter,
        verificationRate: totalUsers > 0 ? ((totalVerified / totalUsers) * 100).toFixed(1) : 0
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
      foundingMembers
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
    
    // Check if organization already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { isActive: true }
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
 * Upload organization logo
 * SUPER_ADMIN only
 */
const uploadOrganizationLogo = async (req, res) => {
  try {
    const { id: adminId } = req.user;
    
    if (!req.file) {
      return errorResponse(res, 'Logo file is required', 400);
    }
    
    // File validation would be handled by multer middleware
    const logoUrl = `/uploads/organization/${req.file.filename}`;
    
    const organization = await prisma.organization.findFirst({
      where: { isActive: true }
    });
    
    if (!organization) {
      return errorResponse(res, 'Organization not configured. Please set up organization details first.', 404);
    }
    
    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organization.id },
        data: {
          logoUrl: logoUrl,
          lastUpdatedBy: adminId
        }
      });
      
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'organization_logo_updated',
          details: {
            organizationId: organization.id,
            logoUrl: logoUrl,
            originalLogoUrl: organization.logoUrl
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
      message: 'Organization logo updated successfully',
      logoUrl: updated.logoUrl,
      organization: {
        id: updated.id,
        name: updated.name,
        logoUrl: updated.logoUrl
      }
    });
    
  } catch (error) {
    console.error('Upload organization logo error:', error);
    return errorResponse(res, 'Failed to upload organization logo', 500);
  }
};

/**
 * Get organization statistics for admin dashboard
 * SUPER_ADMIN only
 */
const getOrganizationStats = async (req, res) => {
  try {
    const cacheKey = 'admin:organization:stats';
    let stats = await CacheService.get(cacheKey);
    
    if (!stats) {
      const organization = await prisma.organization.findFirst({
        where: { isActive: true },
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
          where: { isActive: true, role: 'USER' } 
        }),
        
        prisma.user.count({ 
          where: { isActive: true, isAlumniVerified: true } 
        }),
        
        prisma.user.count({ 
          where: { isActive: true, pendingVerification: true } 
        }),
        
        prisma.user.count({ 
          where: { isActive: true, isRejected: true } 
        }),
        
        // Batch statistics
        prisma.batch.count(),
        
        prisma.batch.count({ 
          where: { totalMembers: { gt: 0 } } 
        }),
        
        // Recent activity
        prisma.user.count({
          where: {
            createdAt: { 
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
            },
            role: 'USER'
          }
        }),
        
        // Batch range
        prisma.batch.findFirst({
          orderBy: { year: 'asc' },
          select: { year: true, name: true }
        }),
        
        prisma.batch.findFirst({
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
    
    // Check if organization already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { isActive: true }
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
    
    const organization = await prisma.organization.findFirst({
      where: { isActive: true }
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
    
    const organization = await prisma.organization.findFirst({
      where: { isActive: true },
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

module.exports = {
  getOrganizationDetails,      // Public endpoint
  getOrganizationDetailsAdmin, // Admin endpoint with full details
  upsertOrganizationDetails,   // Create/Update organization  
  updateSocialLinks,           // Update social media links
  uploadOrganizationLogo,      // Upload logo
  resetSerialCounter,          // Emergency serial counter reset
  getOrganizationStats         // Organization statistics
};