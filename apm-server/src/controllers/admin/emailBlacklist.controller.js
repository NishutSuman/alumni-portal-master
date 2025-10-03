// ==========================================
// STEP 5: EMAIL BLACKLIST MANAGEMENT CONTROLLER
// File: apm-server/src/controllers/admin/emailBlacklist.controller.js
// ==========================================

const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { CacheService } = require('../../config/redis');

/**
 * Get all blacklisted emails with pagination and search
 * Only SUPER_ADMIN can access this
 */
const getBlacklistedEmails = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      sortBy = 'blacklistedAt',
      sortOrder = 'desc',
      status = 'active' // 'active', 'removed', 'all'
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    let whereClause = {};
    
    // Filter by status
    if (status === 'active') {
      whereClause.isActive = true;
    } else if (status === 'removed') {
      whereClause.isActive = false;
    }
    // 'all' shows both active and removed
    
    // Add search filter
    if (search) {
      whereClause.OR = [
        { email: { contains: search.toLowerCase(), mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Validate sort parameters
    const validSortFields = ['blacklistedAt', 'removedAt', 'email'];
    const validSortOrders = ['asc', 'desc'];
    
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'blacklistedAt';
    const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';
    
    const [emails, totalCount] = await Promise.all([
      prisma.blacklistedEmail.findMany({
        where: whereClause,
        include: {
          blacklistedAdmin: {
            select: { 
              id: true,
              fullName: true, 
              role: true 
            }
          },
          removedAdmin: {
            select: { 
              id: true,
              fullName: true, 
              role: true 
            }
          }
        },
        orderBy: { [finalSortBy]: finalSortOrder },
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.blacklistedEmail.count({ where: whereClause })
    ]);
    
    // Get summary statistics
    const [activeCount, removedCount, totalCount24h] = await Promise.all([
      prisma.blacklistedEmail.count({ where: { isActive: true } }),
      prisma.blacklistedEmail.count({ where: { isActive: false } }),
      prisma.blacklistedEmail.count({
        where: {
          blacklistedAt: { 
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
          }
        }
      })
    ]);
    
    return successResponse(res, {
      emails: emails.map(email => ({
        id: email.id,
        email: email.email,
        reason: email.reason,
        isActive: email.isActive,
        
        // Blacklist information
        blacklistedAt: email.blacklistedAt,
        blacklistedBy: {
          id: email.blacklistedAdmin.id,
          name: email.blacklistedAdmin.fullName,
          role: email.blacklistedAdmin.role
        },
        
        // Removal information (if applicable)
        removedAt: email.removedAt,
        removedReason: email.removedReason,
        removedBy: email.removedAdmin ? {
          id: email.removedAdmin.id,
          name: email.removedAdmin.fullName,
          role: email.removedAdmin.role
        } : null,
        
        // Status indicators
        status: email.isActive ? 'ACTIVE' : 'REMOVED',
        daysSinceBlacklisted: Math.floor((Date.now() - email.blacklistedAt) / (1000 * 60 * 60 * 24))
      })),
      
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        limit: parseInt(limit),
        hasNextPage: (page * limit) < totalCount,
        hasPreviousPage: page > 1
      },
      
      summary: {
        activeBlacklist: activeCount,
        removedFromBlacklist: removedCount,
        totalBlacklisted: activeCount + removedCount,
        last24Hours: totalCount24h
      },
      
      filters: {
        search,
        status,
        sortBy: finalSortBy,
        sortOrder: finalSortOrder
      }
    });
    
  } catch (error) {
    console.error('Get blacklisted emails error:', error);
    return errorResponse(res, 'Failed to fetch blacklisted emails', 500);
  }
};

/**
 * Remove email from blacklist (reactivate email for registration)
 * Only SUPER_ADMIN can do this
 */
const removeFromBlacklist = async (req, res) => {
  try {
    const { emailId } = req.params;
    const { reason = 'Removed by admin decision' } = req.body;
    const { id: adminId, fullName: adminName } = req.user;
    
    // Validate email ID format
    if (!emailId || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(emailId)) {
      return errorResponse(res, 'Valid email ID required', 400);
    }
    
    const blacklistedEmail = await prisma.blacklistedEmail.findUnique({
      where: { id: emailId },
      select: {
        id: true,
        email: true,
        isActive: true,
        reason: true,
        blacklistedAt: true,
        blacklistedAdmin: {
          select: { fullName: true }
        }
      }
    });
    
    if (!blacklistedEmail) {
      return errorResponse(res, 'Blacklisted email record not found', 404);
    }
    
    if (!blacklistedEmail.isActive) {
      return errorResponse(res, 'This email has already been removed from blacklist', 400);
    }
    
    const updated = await prisma.$transaction(async (tx) => {
      // Remove from blacklist (mark as inactive)
      const updated = await tx.blacklistedEmail.update({
        where: { id: emailId },
        data: {
          isActive: false,
          removedBy: adminId,
          removedAt: new Date(),
          removedReason: reason.trim()
        }
      });
      
      // Also update user record if exists - reset rejection status
      await tx.user.updateMany({
        where: { 
          email: blacklistedEmail.email,
          isRejected: true
        },
        data: {
          isRejected: false,
          isEmailVerified: false,
          pendingVerification: true,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null
        }
      });
      
      // Log admin activity
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'email_blacklist_removed',
          details: {
            emailId: emailId,
            email: blacklistedEmail.email,
            originalReason: blacklistedEmail.reason,
            removalReason: reason.trim(),
            originallyBlacklistedBy: blacklistedEmail.blacklistedAdmin.fullName,
            originallyBlacklistedAt: blacklistedEmail.blacklistedAt,
            userReactivated: true
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      return updated;
    });
    
    // Clear caches
    await Promise.all([
      CacheService.del(`blacklist:check:${blacklistedEmail.email}`),
      CacheService.del(`blacklist:stats:summary`)
    ]);
    
    return successResponse(res, {
      message: `Email ${blacklistedEmail.email} has been successfully removed from blacklist`,
      email: {
        id: updated.id,
        email: updated.email,
        status: 'REMOVED',
        removedAt: updated.removedAt,
        removedBy: adminName,
        removalReason: updated.removedReason,
        canRegisterAgain: true
      },
      action: {
        performedBy: adminName,
        performedAt: updated.removedAt,
        notes: reason.trim()
      }
    });
    
  } catch (error) {
    console.error('Remove from blacklist error:', error);
    return errorResponse(res, 'Failed to remove email from blacklist', 500);
  }
};

/**
 * Add email to blacklist manually (SUPER_ADMIN only)
 * Useful for preemptive blocking
 */
const addToBlacklist = async (req, res) => {
  try {
    const { email, reason } = req.body;
    const { id: adminId, fullName: adminName } = req.user;
    
    // Validation
    if (!email || !reason) {
      return errorResponse(res, 'Email and reason are required', 400);
    }
    
    if (reason.trim().length < 5) {
      return errorResponse(res, 'Reason must be at least 5 characters', 400);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Invalid email format', 400);
    }
    
    // Check if email already blacklisted
    const existingBlacklist = await prisma.blacklistedEmail.findFirst({
      where: { 
        email: email.toLowerCase(),
        isActive: true
      }
    });
    
    if (existingBlacklist) {
      return errorResponse(res, 'Email is already blacklisted', 409);
    }
    
    // Check if user exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        fullName: true,
        isAlumniVerified: true,
        role: true
      }
    });
    
    // Prevent blacklisting verified alumni or admins
    if (existingUser) {
      if (existingUser.role === 'SUPER_ADMIN' || existingUser.role === 'BATCH_ADMIN') {
        return errorResponse(res, 'Cannot blacklist admin users', 403);
      }
      
      if (existingUser.isAlumniVerified) {
        return errorResponse(res, 'Cannot blacklist verified alumni. Please contact system administrator.', 403);
      }
    }
    
    const blacklistedEmail = await prisma.$transaction(async (tx) => {
      // Create blacklist entry
      const created = await tx.blacklistedEmail.create({
        data: {
          email: email.toLowerCase(),
          reason: reason.trim(),
          blacklistedBy: adminId
        }
      });
      
      // If user exists, mark as rejected
      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            isRejected: true,
            pendingVerification: false,
            rejectedBy: adminId,
            rejectedAt: new Date(),
            rejectionReason: `Account manually blacklisted: ${reason.trim()}`
          }
        });
      }
      
      // Log activity
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'email_manually_blacklisted',
          details: {
            email: email.toLowerCase(),
            reason: reason.trim(),
            existingUser: existingUser ? {
              id: existingUser.id,
              name: existingUser.fullName
            } : null
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      return created;
    });
    
    return successResponse(res, {
      message: `Email ${email} has been added to blacklist`,
      blacklist: {
        id: blacklistedEmail.id,
        email: blacklistedEmail.email,
        reason: blacklistedEmail.reason,
        blacklistedAt: blacklistedEmail.blacklistedAt,
        blacklistedBy: adminName,
        existingUserAffected: !!existingUser
      }
    });
    
  } catch (error) {
    console.error('Add to blacklist error:', error);
    
    if (error.code === 'P2002') {
      return errorResponse(res, 'Email is already in blacklist system', 409);
    }
    
    return errorResponse(res, 'Failed to add email to blacklist', 500);
  }
};

/**
 * Get blacklist statistics and analytics
 */
const getBlacklistStats = async (req, res) => {
  try {
    const cacheKey = 'blacklist:stats:summary';
    let stats = await CacheService.get(cacheKey);
    
    if (!stats) {
      const [
        totalBlacklisted,
        activeBlacklist,
        removedFromBlacklist,
        last7Days,
        last30Days,
        topReasons,
        recentActivity
      ] = await Promise.all([
        // Total blacklisted (ever)
        prisma.blacklistedEmail.count(),
        
        // Currently active blacklist
        prisma.blacklistedEmail.count({ where: { isActive: true } }),
        
        // Removed from blacklist
        prisma.blacklistedEmail.count({ where: { isActive: false } }),
        
        // Last 7 days
        prisma.blacklistedEmail.count({
          where: {
            blacklistedAt: { 
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            }
          }
        }),
        
        // Last 30 days
        prisma.blacklistedEmail.count({
          where: {
            blacklistedAt: { 
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
            }
          }
        }),
        
        // Top blacklist reasons
        prisma.blacklistedEmail.groupBy({
          by: ['reason'],
          where: { isActive: true },
          _count: { reason: true },
          orderBy: { _count: { reason: 'desc' } },
          take: 5
        }),
        
        // Recent blacklist activity
        prisma.blacklistedEmail.findMany({
          where: {
            OR: [
              { blacklistedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
              { removedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
            ]
          },
          include: {
            blacklistedAdmin: { select: { fullName: true } },
            removedAdmin: { select: { fullName: true } }
          },
          orderBy: [
            { blacklistedAt: 'desc' },
            { removedAt: 'desc' }
          ],
          take: 10
        })
      ]);
      
      stats = {
        summary: {
          total: totalBlacklisted,
          active: activeBlacklist,
          removed: removedFromBlacklist,
          last7Days,
          last30Days,
          removalRate: totalBlacklisted > 0 ? ((removedFromBlacklist / totalBlacklisted) * 100).toFixed(1) : 0
        },
        
        insights: {
          topReasons: topReasons.map(item => ({
            reason: item.reason || 'No reason provided',
            count: item._count.reason
          })),
          averagePerDay: (last30Days / 30).toFixed(1),
          trend: last7Days > (last30Days - last7Days) / 3 ? 'increasing' : 'stable'
        },
        
        recentActivity: recentActivity.map(item => ({
          id: item.id,
          email: item.email,
          action: item.isActive ? 'BLACKLISTED' : 'REMOVED',
          actionAt: item.isActive ? item.blacklistedAt : item.removedAt,
          performedBy: item.isActive 
            ? item.blacklistedAdmin.fullName 
            : item.removedAdmin?.fullName,
          reason: item.isActive ? item.reason : item.removedReason
        }))
      };
      
      // Cache for 15 minutes
      await CacheService.set(cacheKey, stats, 900);
    }
    
    return successResponse(res, stats);
    
  } catch (error) {
    console.error('Get blacklist stats error:', error);
    return errorResponse(res, 'Failed to fetch blacklist statistics', 500);
  }
};

/**
 * Check if specific email is blacklisted (utility endpoint)
 */
const checkEmailStatus = async (req, res) => {
  try {
    const { email } = req.params;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Invalid email format', 400);
    }
    
    const cacheKey = `blacklist:check:${email.toLowerCase()}`;
    let status = await CacheService.get(cacheKey);
    
    if (!status) {
      const blacklistEntry = await prisma.blacklistedEmail.findFirst({
        where: { 
          email: email.toLowerCase()
        },
        include: {
          blacklistedAdmin: { select: { fullName: true } },
          removedAdmin: { select: { fullName: true } }
        }
      });
      
      if (!blacklistEntry) {
        status = {
          isBlacklisted: false,
          canRegister: true,
          status: 'ALLOWED'
        };
      } else {
        status = {
          isBlacklisted: blacklistEntry.isActive,
          canRegister: !blacklistEntry.isActive,
          status: blacklistEntry.isActive ? 'BLACKLISTED' : 'PREVIOUSLY_BLACKLISTED',
          details: {
            reason: blacklistEntry.reason,
            blacklistedAt: blacklistEntry.blacklistedAt,
            blacklistedBy: blacklistEntry.blacklistedAdmin.fullName,
            removedAt: blacklistEntry.removedAt,
            removedBy: blacklistEntry.removedAdmin?.fullName,
            removalReason: blacklistEntry.removedReason
          }
        };
      }
      
      // Cache for 30 minutes
      await CacheService.set(cacheKey, status, 1800);
    }
    
    return successResponse(res, {
      email: email.toLowerCase(),
      ...status
    });
    
  } catch (error) {
    console.error('Check email status error:', error);
    return errorResponse(res, 'Failed to check email status', 500);
  }
};

/**
 * Bulk remove emails from blacklist
 */
const bulkRemoveFromBlacklist = async (req, res) => {
  try {
    const { emailIds, reason = 'Bulk removal by admin' } = req.body;
    const { id: adminId, fullName: adminName } = req.user;
    
    // Validation
    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return errorResponse(res, 'Email IDs array is required', 400);
    }
    
    if (emailIds.length > 100) {
      return errorResponse(res, 'Cannot remove more than 100 emails at once', 400);
    }
    
    // Get emails to remove
    const emailsToRemove = await prisma.blacklistedEmail.findMany({
      where: {
        id: { in: emailIds },
        isActive: true
      },
      select: {
        id: true,
        email: true,
        reason: true
      }
    });
    
    if (emailsToRemove.length === 0) {
      return errorResponse(res, 'No eligible emails found for removal', 400);
    }
    
    const results = {
      successful: [],
      failed: [],
      total: emailsToRemove.length
    };
    
    // Process bulk removal
    await prisma.$transaction(async (tx) => {
      // Update all emails
      const updateResult = await tx.blacklistedEmail.updateMany({
        where: {
          id: { in: emailsToRemove.map(e => e.id) },
          isActive: true
        },
        data: {
          isActive: false,
          removedBy: adminId,
          removedAt: new Date(),
          removedReason: reason.trim()
        }
      });
      
      // Log bulk operation
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'bulk_blacklist_removal',
          details: {
            totalEmails: emailsToRemove.length,
            emailsRemoved: emailsToRemove.map(e => e.email),
            bulkReason: reason.trim(),
            removedCount: updateResult.count
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      // Mark all as successful
      results.successful = emailsToRemove.map(email => ({
        id: email.id,
        email: email.email,
        previousReason: email.reason
      }));
    });
    
    // Clear caches for all removed emails
    await Promise.all([
      ...emailsToRemove.map(email => 
        CacheService.del(`blacklist:check:${email.email}`)
      ),
      CacheService.del('blacklist:stats:summary')
    ]);
    
    return successResponse(res, {
      message: `Successfully removed ${results.successful.length} emails from blacklist`,
      results,
      admin: {
        performedBy: adminName,
        performedAt: new Date(),
        bulkReason: reason.trim()
      }
    });
    
  } catch (error) {
    console.error('Bulk remove from blacklist error:', error);
    return errorResponse(res, 'Bulk blacklist removal failed', 500);
  }
};

/**
 * Export blacklisted emails (CSV format)
 */
const exportBlacklistedEmails = async (req, res) => {
  try {
    const { status = 'active', format = 'json' } = req.query;
    
    let whereClause = {};
    if (status === 'active') {
      whereClause.isActive = true;
    } else if (status === 'removed') {
      whereClause.isActive = false;
    }
    
    const emails = await prisma.blacklistedEmail.findMany({
      where: whereClause,
      include: {
        blacklistedAdmin: { select: { fullName: true, role: true } },
        removedAdmin: { select: { fullName: true, role: true } }
      },
      orderBy: { blacklistedAt: 'desc' }
    });
    
    if (format === 'csv') {
      // Generate CSV content
      const csvHeader = 'Email,Status,Reason,BlacklistedAt,BlacklistedBy,RemovedAt,RemovedBy,RemovalReason\n';
      const csvRows = emails.map(email => {
        return [
          email.email,
          email.isActive ? 'ACTIVE' : 'REMOVED',
          `"${email.reason || ''}"`,
          email.blacklistedAt.toISOString(),
          email.blacklistedAdmin.fullName,
          email.removedAt ? email.removedAt.toISOString() : '',
          email.removedAdmin?.fullName || '',
          `"${email.removedReason || ''}"`
        ].join(',');
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="blacklisted-emails-${status}-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    }
    
    // Default JSON response
    return successResponse(res, {
      emails: emails.map(email => ({
        id: email.id,
        email: email.email,
        reason: email.reason,
        isActive: email.isActive,
        blacklistedAt: email.blacklistedAt,
        blacklistedBy: email.blacklistedAdmin.fullName,
        removedAt: email.removedAt,
        removedBy: email.removedAdmin?.fullName,
        removalReason: email.removedReason
      })),
      exportInfo: {
        totalRecords: emails.length,
        status: status,
        exportedAt: new Date(),
        format: 'json'
      }
    });
    
  } catch (error) {
    console.error('Export blacklisted emails error:', error);
    return errorResponse(res, 'Failed to export blacklisted emails', 500);
  }
};

module.exports = {
  getBlacklistedEmails,
  removeFromBlacklist,
  addToBlacklist,
  bulkRemoveFromBlacklist,
  getBlacklistStats,
  checkEmailStatus,
  exportBlacklistedEmails
};