// ==========================================
// STEP 4B: ALUMNI VERIFICATION CONTROLLER
// File: apm-server/src/controllers/admin/alumniVerification.controller.js
// ==========================================

const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { CacheService } = require('../../config/redis');
const SerialIdService = require('../../services/serialID.service');
const { sendVerificationNotifications } = require('../auth/auth.controller');

/**
 * Get pending verification users
 * Batch admins see only their batches, super admins see all
 */
const getPendingVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, batch: filterBatch, search = '' } = req.query;
    const { role, id: adminId } = req.user;
    const offset = (page - 1) * limit;
    
    // Build where clause based on admin role
    let whereClause = {
      pendingVerification: true,
      isAlumniVerified: false,
      isActive: true,
      isRejected: false // Don't show rejected users in pending list
    };
    
    // Add search filter
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Batch admin: only see their managed batches
    if (role === 'BATCH_ADMIN') {
      const managedBatches = await prisma.batchAdminAssignment.findMany({
        where: {
          userId: adminId,
          isActive: true
        },
        select: { batchYear: true }
      });
      
      const batchYears = managedBatches.map(b => b.batchYear);
      
      if (batchYears.length === 0) {
        return successResponse(res, {
          users: [],
          pagination: { currentPage: 1, totalPages: 0, totalUsers: 0, limit: parseInt(limit) },
          adminContext: { role, managedBatches: [], canViewAllBatches: false }
        });
      }
      
      whereClause.batch = { in: batchYears };
    } 
    // Super admin: can filter by specific batch if requested
    else if (filterBatch && role === 'SUPER_ADMIN') {
      whereClause.batch = parseInt(filterBatch);
    }
    
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          fullName: true,
          batch: true,
          admissionYear: true,
          passoutYear: true,
          createdAt: true,
          pendingVerification: true,
          isEmailVerified: true,
          lastLoginAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.user.count({ where: whereClause })
    ]);
    
    // Add batch display names
    const enhancedUsers = users.map(user => ({
      ...user,
      batchDisplayName: user.admissionYear && user.passoutYear 
        ? `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`
        : `Class of ${user.batch}`
    }));
    
    return successResponse(res, {
      users: enhancedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalUsers: totalCount,
        limit: parseInt(limit)
      },
      adminContext: {
        role,
        canViewAllBatches: role === 'SUPER_ADMIN',
        managedBatches: role === 'BATCH_ADMIN' ? req.managedBatches || [] : null
      }
    });
    
  } catch (error) {
    console.error('Get pending verifications error:', error);
    return errorResponse(res, 'Failed to fetch pending verifications', 500);
  }
};

/**
 * Get verification details for specific user
 */
const getVerificationDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        batch: true,
        admissionYear: true,
        passoutYear: true,
        createdAt: true,
        lastLoginAt: true,
        
        // Verification status
        isAlumniVerified: true,
        pendingVerification: true,
        isRejected: true,
        rejectionReason: true,
        verificationNotes: true,
        alumniVerifiedAt: true,
        rejectedAt: true,
        
        // Verification history
        verifiedAdmin: {
          select: { fullName: true, role: true }
        },
        rejectedAdmin: {
          select: { fullName: true, role: true }
        },
        
        serialId: true,
        isEmailVerified: true,
        
        // Profile information for verification
        bio: true,
        employmentStatus: true,
        linkedinUrl: true,
        
        // Activity summary for admin review
        _count: {
          select: {
            activityLogs: true
          }
        }
      }
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    // Add batch display name
    user.batchDisplayName = user.admissionYear && user.passoutYear 
      ? `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`
      : `Class of ${user.batch}`;
    
    // Get recent activity for verification context
    const recentActivity = await prisma.activityLog.findMany({
      where: { userId: user.id },
      select: {
        action: true,
        createdAt: true,
        ipAddress: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    return successResponse(res, { 
      user: {
        ...user,
        recentActivity,
        totalActivity: user._count.activityLogs
      }
    });
    
  } catch (error) {
    console.error('Get verification details error:', error);
    return errorResponse(res, 'Failed to fetch user details', 500);
  }
};

/**
 * Verify alumni user - APPROVE
 */
const verifyAlumniUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes = '' } = req.body;
    const { id: adminId, role, fullName: adminName } = req.user;
    
    const user = req.targetUser || await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        batch: true,
        admissionYear: true,
        passoutYear: true,
        pendingVerification: true,
        isAlumniVerified: true,
        isRejected: true
      }
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    // Validation checks
    if (user.isAlumniVerified) {
      return errorResponse(res, 'User is already verified as alumni', 400);
    }
    
    if (!user.pendingVerification) {
      return errorResponse(res, 'User is not in pending verification status', 400);
    }
    
    // ==========================================
    // GENERATE SERIAL ID FOR VERIFIED USER
    // ==========================================
    
    const { serialId, counter } = await SerialIdService.generateUniqueSerialId(
      user.fullName,
      user.admissionYear,
      user.passoutYear
    );
    
    // ==========================================
    // UPDATE USER WITH VERIFICATION
    // ==========================================
    
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update user verification status
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          isAlumniVerified: true,
          pendingVerification: false,
          isRejected: false,
          alumniVerifiedBy: adminId,
          alumniVerifiedAt: new Date(),
          verificationNotes: notes.trim(),
          
          // Generate and assign serial ID
          serialId: serialId,
          serialCounter: counter,
          
          // Clear any previous rejection data
          rejectionReason: null,
          rejectedBy: null,
          rejectedAt: null
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          batch: true,
          serialId: true,
          alumniVerifiedAt: true,
          isAlumniVerified: true
        }
      });
      
      // Log verification activity
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'alumni_verified',
          details: {
            verifiedUserId: userId,
            verifiedUserEmail: user.email,
            verifiedUserName: user.fullName,
            verifiedUserBatch: user.batch,
            serialId: serialId,
            verificationNotes: notes.trim(),
            adminRole: role
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      // Log activity for the verified user
      await tx.activityLog.create({
        data: {
          userId: userId,
          action: 'alumni_status_verified',
          details: {
            verifiedBy: adminName,
            serialId: serialId,
            verifiedAt: new Date()
          }
        }
      });
      
      return updated;
    });
    
    // ==========================================
    // SEND APPROVAL NOTIFICATIONS
    // ==========================================
    
    await sendVerificationNotifications(user, adminName, 'approved', null, serialId);
    
    // Clear relevant caches
    await Promise.all([
      CacheService.del(`user:${userId}:verification:status`),
      CacheService.del(`batch:${user.batch}:pending:count`),
      CacheService.del(`admin:${adminId}:verification:stats`)
    ]);
    
    return successResponse(res, {
      message: `${user.fullName} has been successfully verified as alumni`,
      user: {
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        batch: updatedUser.batch,
        batchDisplayName: `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`,
        serialId: updatedUser.serialId,
        verifiedAt: updatedUser.alumniVerifiedAt,
        isAlumniVerified: updatedUser.isAlumniVerified
      },
      admin: {
        verifiedBy: adminName,
        role: role
      }
    });
    
  } catch (error) {
    console.error('Verify alumni user error:', error);
    
    if (error.message.includes('Failed to generate serial ID')) {
      return errorResponse(res, 'Verification failed: Could not generate serial ID. Please ensure organization details are configured.', 500);
    }
    
    return errorResponse(res, 'Failed to verify user as alumni', 500);
  }
};

/**
 * Reject alumni user
 */
const rejectAlumniUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const { id: adminId, role, fullName: adminName } = req.user;
    
    const user = req.targetUser || await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        batch: true,
        admissionYear: true,
        passoutYear: true,
        pendingVerification: true,
        isRejected: true,
        isAlumniVerified: true
      }
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    // Validation checks
    if (user.isRejected) {
      return errorResponse(res, 'User is already rejected', 400);
    }
    
    if (user.isAlumniVerified) {
      return errorResponse(res, 'Cannot reject a verified alumni user', 400);
    }
    
    // ==========================================
    // REJECT USER AND ADD TO BLACKLIST
    // ==========================================
    
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update user rejection status
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          isRejected: true,
          pendingVerification: false,
          isAlumniVerified: false,
          rejectedBy: adminId,
          rejectedAt: new Date(),
          rejectionReason: reason
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          batch: true,
          rejectedAt: true,
          isRejected: true
        }
      });
      
      // Add email to blacklist
      await tx.blacklistedEmail.create({
        data: {
          email: user.email,
          reason: `Alumni verification rejected by ${adminName}: ${reason}`,
          blacklistedBy: adminId
        }
      });
      
      // Log rejection activity for admin
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'alumni_rejected',
          details: {
            rejectedUserId: userId,
            rejectedUserEmail: user.email,
            rejectedUserName: user.fullName,
            rejectedUserBatch: user.batch,
            rejectionReason: reason,
            adminRole: role
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      // Log activity for the rejected user
      await tx.activityLog.create({
        data: {
          userId: userId,
          action: 'alumni_status_rejected',
          details: {
            rejectedBy: adminName,
            rejectionReason: reason,
            rejectedAt: new Date()
          }
        }
      });
      
      return updated;
    });
    
    // ==========================================
    // SEND REJECTION NOTIFICATIONS
    // ==========================================
    
    await sendVerificationNotifications(user, adminName, 'rejected', reason);
    
    // Clear relevant caches
    await Promise.all([
      CacheService.del(`user:${userId}:verification:status`),
      CacheService.del(`batch:${user.batch}:pending:count`),
      CacheService.del(`admin:${adminId}:verification:stats`)
    ]);
    
    return successResponse(res, {
      message: `${user.fullName} has been rejected and email has been blacklisted`,
      user: {
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        batch: updatedUser.batch,
        batchDisplayName: `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`,
        isRejected: updatedUser.isRejected,
        rejectedAt: updatedUser.rejectedAt,
        rejectionReason: reason
      },
      admin: {
        rejectedBy: adminName,
        role: role
      },
      blacklist: {
        emailBlacklisted: true,
        canBeReversed: true // Only by super admin
      }
    });
    
  } catch (error) {
    console.error('Reject alumni user error:', error);
    return errorResponse(res, 'Failed to reject user', 500);
  }
};

/**
 * Get verification statistics and analytics
 */
const getVerificationStats = async (req, res) => {
  try {
    const { role, id: adminId } = req.user;
    const { timeframe = '30' } = req.query; // Days
    
    // Cache key based on admin and timeframe
    const cacheKey = `verification:stats:${adminId}:${role}:${timeframe}d`;
    let stats = await CacheService.get(cacheKey);
    
    if (!stats) {
      let batchFilter = {};
      
      // Batch admin: only their managed batches
      if (role === 'BATCH_ADMIN') {
        const managedBatches = await prisma.batchAdminAssignment.findMany({
          where: {
            userId: adminId,
            isActive: true
          },
          select: { batchYear: true }
        });
        
        const batchYears = managedBatches.map(b => b.batchYear);
        batchFilter = { batch: { in: batchYears } };
      }
      
      const timeframeDays = parseInt(timeframe);
      const timeframeDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
      
      const [
        pendingCount,
        verifiedCount,
        rejectedCount,
        totalRegistrations,
        recentVerifications,
        recentRejections,
        batchWiseStats
      ] = await Promise.all([
        // Pending verifications
        prisma.user.count({
          where: {
            ...batchFilter,
            pendingVerification: true,
            isAlumniVerified: false,
            isActive: true,
            isRejected: false
          }
        }),
        
        // Total verified users
        prisma.user.count({
          where: {
            ...batchFilter,
            isAlumniVerified: true,
            isActive: true
          }
        }),
        
        // Total rejected users
        prisma.user.count({
          where: {
            ...batchFilter,
            isRejected: true,
            isActive: true
          }
        }),
        
        // Total registrations
        prisma.user.count({
          where: {
            ...batchFilter,
            role: 'USER',
            isActive: true
          }
        }),
        
        // Recent verifications (within timeframe)
        prisma.user.findMany({
          where: {
            ...batchFilter,
            alumniVerifiedAt: { gte: timeframeDate },
            isAlumniVerified: true
          },
          select: {
            id: true,
            fullName: true,
            batch: true,
            alumniVerifiedAt: true,
            serialId: true,
            verifiedAdmin: { select: { fullName: true } }
          },
          orderBy: { alumniVerifiedAt: 'desc' },
          take: 10
        }),
        
        // Recent rejections (within timeframe)
        prisma.user.findMany({
          where: {
            ...batchFilter,
            rejectedAt: { gte: timeframeDate },
            isRejected: true
          },
          select: {
            id: true,
            fullName: true,
            batch: true,
            rejectedAt: true,
            rejectionReason: true,
            rejectedAdmin: { select: { fullName: true } }
          },
          orderBy: { rejectedAt: 'desc' },
          take: 10
        }),
        
        // Batch-wise statistics
        prisma.user.groupBy({
          by: ['batch'],
          where: {
            ...batchFilter,
            isActive: true,
            role: 'USER'
          },
          _count: {
            id: true
          },
          _sum: {
            isAlumniVerified: true
          }
        })
      ]);
      
      // Calculate verification rate
      const verificationRate = totalRegistrations > 0 
        ? ((verifiedCount / totalRegistrations) * 100).toFixed(1) 
        : 0;
      
      // Process batch-wise stats
      const batchStats = await Promise.all(
        batchWiseStats.map(async (batch) => {
          const [pending, verified, rejected] = await Promise.all([
            prisma.user.count({
              where: { 
                batch: batch.batch, 
                pendingVerification: true, 
                isActive: true 
              }
            }),
            prisma.user.count({
              where: { 
                batch: batch.batch, 
                isAlumniVerified: true, 
                isActive: true 
              }
            }),
            prisma.user.count({
              where: { 
                batch: batch.batch, 
                isRejected: true, 
                isActive: true 
              }
            })
          ]);
          
          return {
            batch: batch.batch,
            batchDisplayName: `Class of ${batch.batch}`,
            total: batch._count.id,
            verified,
            pending,
            rejected,
            verificationRate: batch._count.id > 0 ? ((verified / batch._count.id) * 100).toFixed(1) : 0
          };
        })
      );
      
      stats = {
        summary: {
          pending: pendingCount,
          verified: verifiedCount,
          rejected: rejectedCount,
          total: totalRegistrations,
          verificationRate: parseFloat(verificationRate)
        },
        recentActivity: {
          verifications: recentVerifications,
          rejections: recentRejections
        },
        batchWiseStats: batchStats.sort((a, b) => b.batch - a.batch), // Latest batches first
        adminContext: {
          role,
          canViewAllBatches: role === 'SUPER_ADMIN',
          timeframe: timeframeDays
        }
      };
      
      // Cache for 5 minutes
      await CacheService.set(cacheKey, stats, 300);
    }
    
    return successResponse(res, stats);
    
  } catch (error) {
    console.error('Get verification stats error:', error);
    return errorResponse(res, 'Failed to fetch verification statistics', 500);
  }
};

/**
 * Bulk approve users (Super Admin only)
 */
const bulkVerifyUsers = async (req, res) => {
  try {
    const { userIds, notes = '' } = req.body;
    const { id: adminId, role, fullName: adminName } = req.user;
    
    // Only super admins can bulk verify
    if (role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Only Super Admins can perform bulk verification', 403);
    }
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return errorResponse(res, 'User IDs array is required', 400);
    }
    
    if (userIds.length > 50) {
      return errorResponse(res, 'Cannot verify more than 50 users at once', 400);
    }
    
    // Get users to verify
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        pendingVerification: true,
        isAlumniVerified: false,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        batch: true,
        admissionYear: true,
        passoutYear: true
      }
    });
    
    if (users.length === 0) {
      return errorResponse(res, 'No eligible users found for verification', 400);
    }
    
    const results = {
      successful: [],
      failed: [],
      total: users.length
    };
    
    // Process each user
    for (const user of users) {
      try {
        // Generate serial ID
        const { serialId, counter } = await SerialIdService.generateUniqueSerialId(
          user.fullName,
          user.admissionYear,
          user.passoutYear
        );
        
        // Update user
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isAlumniVerified: true,
            pendingVerification: false,
            alumniVerifiedBy: adminId,
            alumniVerifiedAt: new Date(),
            verificationNotes: notes.trim(),
            serialId: serialId,
            serialCounter: counter
          }
        });
        
        // Send notification
        await sendVerificationNotifications(user, adminName, 'approved', null, serialId);
        
        results.successful.push({
          id: user.id,
          name: user.fullName,
          email: user.email,
          serialId: serialId
        });
        
      } catch (userError) {
        console.error(`Failed to verify user ${user.id}:`, userError);
        results.failed.push({
          id: user.id,
          name: user.fullName,
          error: userError.message
        });
      }
    }
    
    // Log bulk operation
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'bulk_alumni_verification',
        details: {
          totalUsers: results.total,
          successful: results.successful.length,
          failed: results.failed.length,
          notes: notes.trim()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(res, {
      message: `Bulk verification completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      results
    });
    
  } catch (error) {
    console.error('Bulk verify users error:', error);
    return errorResponse(res, 'Bulk verification failed', 500);
  }
};

module.exports = {
  getPendingVerifications,
  getVerificationDetails,
  verifyAlumniUser,
  rejectAlumniUser,
  getVerificationStats,
  bulkVerifyUsers
};