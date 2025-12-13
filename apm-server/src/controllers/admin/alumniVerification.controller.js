// ==========================================
// ALUMNI VERIFICATION CONTROLLER - SIMPLIFIED
// ==========================================

const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const NotificationService = require('../../services/notification.service');
const emailManager = require('../../services/email/EmailManager');
const tenantEmailManager = require('../../services/email/TenantEmailManager');
const SerialIdService = require('../../services/serialID.service');
const { getOrganizationName, getTenantCode } = require('../../utils/tenant.util');

/**
 * Get pending verification users
 */
const getPendingVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, batch: filterBatch, search = '' } = req.query;
    const offset = (page - 1) * limit;

    // MULTI-TENANT: Get tenant ID from request
    const tenantId = req.tenant?.id || req.user?.organizationId;

    // Build where clause with tenant isolation
    let whereClause = {
      pendingVerification: true,
      isAlumniVerified: false,
      isActive: true,
      isRejected: false,
      role: { not: 'DEVELOPER' } // Never show developers in org user lists
    };

    // CRITICAL: Filter by organization for multi-tenant isolation
    if (tenantId) {
      whereClause.organizationId = tenantId;
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Add batch filter
    if (filterBatch) {
      whereClause.batch = parseInt(filterBatch);
    }

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          fullName: true,
          email: true,
          batch: true,
          createdAt: true,
          lastLoginAt: true,
          isEmailVerified: true
        },
        skip: parseInt(offset),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    // Add profile completeness calculation
    const usersWithCompleteness = users.map(user => ({
      ...user,
      registeredAt: user.createdAt,
      profileCompleteness: user.fullName && user.email ? 85 : 60 // Simple calculation
    }));

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    };

    return successResponse(res, {
      users: usersWithCompleteness,
      pagination
    });

  } catch (error) {
    console.error('getPendingVerifications error:', error);
    return errorResponse(res, 'Failed to retrieve pending verifications', 500);
  }
};

/**
 * Get verification statistics
 */
const getVerificationStats = async (req, res) => {
  try {
    // MULTI-TENANT: Get tenant ID from request
    const tenantId = req.tenant?.id || req.user?.organizationId;

    // Build tenant filter - exclude DEVELOPER users
    const tenantFilter = tenantId
      ? { organizationId: tenantId, role: { not: 'DEVELOPER' } }
      : { role: { not: 'DEVELOPER' } };

    const [pendingCount, verifiedCount, rejectedCount] = await Promise.all([
      prisma.user.count({
        where: {
          ...tenantFilter,
          pendingVerification: true,
          isAlumniVerified: false,
          isActive: true,
          isRejected: false
        }
      }),
      prisma.user.count({
        where: {
          ...tenantFilter,
          isAlumniVerified: true,
          isActive: true
        }
      }),
      prisma.user.count({
        where: {
          ...tenantFilter,
          isRejected: true,
          isActive: true
        }
      })
    ]);

    const stats = {
      pending: {
        total: pendingCount,
        byBatch: []
      },
      processed: {
        approved: verifiedCount,
        rejected: rejectedCount,
        total: verifiedCount + rejectedCount
      },
      recentActivity: []
    };

    return successResponse(res, stats, 'Verification stats retrieved successfully');
  } catch (error) {
    console.error('getVerificationStats error:', error);
    return errorResponse(res, 'Failed to retrieve verification stats', 500);
  }
};

/**
 * Get user verification details  
 */
const getVerificationDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        batch: true,
        createdAt: true,
        lastLoginAt: true,
        isAlumniVerified: true,
        pendingVerification: true,
        isRejected: true,
        bio: true,
        employmentStatus: true
      }
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    return successResponse(res, { 
      user: {
        ...user,
        profileImage: null,
        currentLocation: null,
        whatsappNumber: null
      }, 
      verificationHistory: [] 
    });
  } catch (error) {
    console.error('getVerificationDetails error:', error);
    return errorResponse(res, 'Failed to get verification details', 500);
  }
};

/**
 * Verify alumni user
 */  
const verifyAlumniUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes = '' } = req.body;
    const { id: adminId } = req.user;
    
    // Get user details first to generate serial ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        batch: true,
        serialId: true
      }
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    // Generate serial ID if not already assigned
    let serialId = user.serialId;
    let userSerialCounter = null;
    if (!serialId) {
      try {
        // Parse batch years from user's batch (passout year)
        const { admissionYear, passoutYear } = SerialIdService.parseBatchYears(user.batch);
        
        // Generate unique serial ID using static method
        const { serialId: generatedSerialId, counter } = await SerialIdService.generateUniqueSerialId(
          user.fullName,
          admissionYear,
          passoutYear
        );
        
        serialId = generatedSerialId;
        userSerialCounter = counter;
        console.log(`✅ Generated Serial ID: ${serialId} (Counter: ${counter}) for user: ${user.fullName} (Batch: ${user.batch})`);
      } catch (serialError) {
        console.error('Failed to generate serial ID:', serialError);
        // Don't fail verification if serial ID generation fails
        // Admin can manually assign it later
      }
    }
    
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isAlumniVerified: true,
        pendingVerification: false,
        alumniVerifiedBy: adminId,
        alumniVerifiedAt: new Date(),
        verificationNotes: notes,
        ...(serialId && { serialId }), // Only update if serial ID was generated
        ...(userSerialCounter && { serialCounter: userSerialCounter }) // Store the counter number used
      }
    });

    // Send email notification and push notification
    try {
      // Create push notification
      await prisma.notification.create({
        data: {
          type: 'VERIFICATION_APPROVED',
          title: 'Account Activated - Welcome!',
          message: `Congratulations! Your alumni status has been verified and your account is now active. Welcome to the Alumni Portal!`,
          payload: { 
            adminId, 
            verifiedAt: new Date().toISOString(),
            notes: notes || 'Welcome to the community',
            accountActivated: true
          },
          userId: userId
        }
      });

      // Send email notification using tenant email manager
      const tenantCode = getTenantCode(req);
      const organizationName = getOrganizationName(req);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #10b981; margin: 0;">🎉 Welcome to ${organizationName}!</h2>
          </div>

          <p>Dear ${updated.fullName},</p>

          <p>Congratulations! Your alumni status has been verified and your account is now active at <strong>${organizationName}</strong>.</p>

          <div style="background-color: #f0fdf4; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 5px;">
            <strong>Your account is now activated!</strong>
            <p style="margin: 10px 0 0 0;">You can now access all portal features and connect with your fellow alumni.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${frontendUrl}/auth/login"
               style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
               Login to Portal
            </a>
          </div>

          <p>Welcome to the community!</p>

          <div style="margin: 30px 0; padding: 15px; background-color: #f3f4f6; border-radius: 5px;">
            <h4 style="margin-top: 0;">Need Help?</h4>
            <p style="margin-bottom: 0;">Contact our support team at: <strong>${process.env.SUPPORT_EMAIL || 'support@alumni.portal'}</strong></p>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ${organizationName}. All rights reserved.</p>
            <p style="margin: 10px 0 0 0;">
              <a href="https://digikite.in" target="_blank" style="color: #9ca3af; text-decoration: none; font-size: 11px;">Powered by Guild by Digikite</a>
            </p>
          </div>
        </div>
      `;

      try {
        await tenantEmailManager.sendEmail(tenantCode, {
          to: updated.email,
          subject: `Alumni Account Activated - Welcome to ${organizationName}!`,
          html: emailHtml
        });
        console.log(`✅ Account activation email sent to ${updated.email}`);
      } catch (emailError) {
        console.error('Failed to send activation email:', emailError);
        // Don't fail verification if email fails
      }
    } catch (notificationError) {
      console.error('Failed to send verification notifications:', notificationError);
      // Don't fail the verification if notification fails
    }
    
    return successResponse(res, null, 'User verified successfully');
  } catch (error) {
    console.error('verifyAlumniUser error:', error);
    return errorResponse(res, 'Failed to verify user', 500);
  }
};

/**
 * Reject alumni user
 */
const rejectAlumniUser = async (req, res) => {
  try {
    const { userId } = req.params; 
    const { reason } = req.body;
    const { id: adminId, role } = req.user;
    
    // Only SUPER_ADMIN can reject users
    if (role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Only Super Admins can reject users', 403);
    }
    
    // Get user details first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        batch: true
      }
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    // Update user and add to blacklist in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update user status
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          isRejected: true,
          pendingVerification: false,
          rejectedBy: adminId,
          rejectedAt: new Date(),
          rejectionReason: reason
        }
      });
      
      // Add email to blacklist table
      await tx.blacklistedEmail.create({
        data: {
          email: user.email.toLowerCase(),
          reason: `User verification rejected: ${reason}`,
          blacklistedBy: adminId,
          isActive: true
        }
      });
      
      return updatedUser;
    });

    // Send ONLY email notification to user about rejection (no push notification)
    try {
      const tenantCode = getTenantCode(req);
      const organizationName = getOrganizationName(req);

      const rejectionEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #dc3545; margin: 0;">Registration Review Update</h2>
            <p style="color: #6b7280; margin-top: 10px;">${organizationName}</p>
          </div>

          <p>Dear ${user.fullName},</p>

          <p>Thank you for your interest in joining <strong>${organizationName}</strong>. After reviewing your registration application, we are unable to proceed with your registration at this time.</p>

          <div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0; border-radius: 5px;">
            <strong>Reason:</strong> ${reason || 'Unable to verify your alumni status with our records'}
          </div>

          <p>If you believe this decision was made in error, please contact our support team with any additional documentation that may help verify your alumni status.</p>

          <div style="margin: 30px 0; padding: 15px; background-color: #f3f4f6; border-radius: 5px;">
            <h4 style="margin-top: 0;">Need Help?</h4>
            <p style="margin-bottom: 0;">Contact our support team at: <strong>${process.env.SUPPORT_EMAIL || 'support@alumni.portal'}</strong></p>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ${organizationName}. All rights reserved.</p>
            <p style="margin: 10px 0 0 0;">
              <a href="https://digikite.in" target="_blank" style="color: #9ca3af; text-decoration: none; font-size: 11px;">Powered by Guild by Digikite</a>
            </p>
          </div>
        </div>
      `;

      await tenantEmailManager.sendEmail(tenantCode, {
        to: user.email,
        subject: `Registration Application Update - ${organizationName}`,
        html: rejectionEmailHtml
      });

      console.log(`✅ Rejection email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      // Don't fail the rejection if email fails
    }
    
    return successResponse(res, null, 'User rejected successfully');
  } catch (error) {
    console.error('rejectAlumniUser error:', error);
    return errorResponse(res, 'Failed to reject user', 500);
  }
};

/**
 * Unblock user (remove from blacklist and reset verification status)
 */
const unblockAlumniUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = 'User unblocked by admin' } = req.body;
    const { id: adminId, role } = req.user;
    
    // Only SUPER_ADMIN can unblock users
    if (role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Only Super Admins can unblock users', 403);
    }
    
    // Get user details first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        batch: true,
        isEmailVerified: true,
        isRejected: true
      }
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    if (!user.isRejected) {
      return errorResponse(res, 'User is not rejected/blacklisted', 400);
    }
    
    // Unblock user and remove from blacklist in transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete from blacklisted_emails table completely
      await tx.blacklistedEmail.deleteMany({
        where: { 
          email: user.email.toLowerCase(),
          isActive: true
        }
      });
      
      // 2. Reset user verification status (preserve email verification)
      await tx.user.update({
        where: { id: userId },
        data: {
          isRejected: false,
          // Keep isEmailVerified as it was (preserve email verification status)
          pendingVerification: true,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null
        }
      });
      
      // 3. Log admin activity
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'user_unblocked',
          details: {
            unblockedUserId: userId,
            unblockedUserEmail: user.email,
            unblockedUserName: user.fullName,
            unblockedUserBatch: user.batch,
            reason: reason.trim(),
            emailVerificationPreserved: user.isEmailVerified
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
    });
    
    return successResponse(res, {
      message: `User ${user.fullName} has been successfully unblocked and can now proceed with verification`,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        batch: user.batch,
        isEmailVerified: user.isEmailVerified,
        pendingVerification: true,
        isRejected: false,
        canProceedWithVerification: true
      },
      action: {
        performedBy: adminId,
        performedAt: new Date(),
        reason: reason.trim()
      }
    });
    
  } catch (error) {
    console.error('unblockAlumniUser error:', error);
    return errorResponse(res, 'Failed to unblock user', 500);
  }
};

/**
 * Bulk verify users
 */
const bulkVerifyUsers = async (req, res) => {
  try {
    const { userIds, notes = '' } = req.body;
    const { id: adminId, role } = req.user;
    
    // Only super admins can bulk verify
    if (role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Only Super Admins can perform bulk verification', 403);
    }
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return errorResponse(res, 'User IDs array is required', 400);
    }
    
    // For bulk verification, process each user individually to generate serial IDs
    let successCount = 0;
    const failedUsers = [];
    
    for (const userId of userIds) {
      try {
        // Get user details including batch information
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            fullName: true,
            batch: true,
            serialId: true,
            pendingVerification: true,
            isAlumniVerified: true
          }
        });
        
        if (!user || user.isAlumniVerified || !user.pendingVerification) {
          continue; // Skip if already verified or not pending
        }
        
        // Generate serial ID if not already assigned
        let serialId = user.serialId;
        let userSerialCounter = null;
        if (!serialId) {
          try {
            // Parse batch years from user's batch (passout year)
            const { admissionYear, passoutYear } = SerialIdService.parseBatchYears(user.batch);
            
            // Generate unique serial ID using static method
            const { serialId: generatedSerialId, counter } = await SerialIdService.generateUniqueSerialId(
              user.fullName,
              admissionYear,
              passoutYear
            );
            
            serialId = generatedSerialId;
            userSerialCounter = counter;
            console.log(`✅ Generated Serial ID: ${serialId} (Counter: ${counter}) for user: ${user.fullName} (Batch: ${user.batch})`);
          } catch (serialError) {
            console.error(`Failed to generate serial ID for ${user.fullName}:`, serialError);
          }
        }
        
        // Update user with verification and serial ID
        await prisma.user.update({
          where: { id: userId },
          data: {
            isAlumniVerified: true,
            pendingVerification: false,
            alumniVerifiedBy: adminId,
            alumniVerifiedAt: new Date(),
            verificationNotes: notes,
            ...(serialId && { serialId }),
            ...(userSerialCounter && { serialCounter: userSerialCounter })
          }
        });
        
        successCount++;
      } catch (error) {
        console.error(`Failed to verify user ${userId}:`, error);
        failedUsers.push(userId);
      }
    }
    
    const results = { count: successCount };

    // Send bulk notifications to all verified users
    if (results.count > 0) {
      try {
        const notificationPromises = userIds.map(userId => 
          prisma.notification.create({
            data: {
              type: 'VERIFICATION_APPROVED',
              title: 'Alumni Verification Approved',
              message: `Congratulations! Your alumni status has been verified. Welcome to the Alumni Portal!`,
              payload: { 
                adminId, 
                verifiedAt: new Date().toISOString(),
                notes: notes || 'No additional notes provided',
                bulkVerification: true
              },
              userId: userId
            }
          })
        );
        await Promise.all(notificationPromises);
      } catch (notificationError) {
        console.error('Failed to send bulk verification notifications:', notificationError);
        // Don't fail the bulk verification if notifications fail
      }
    }
    
    return successResponse(res, { 
      success: true,
      verifiedCount: results.count,
      message: `${results.count} users verified successfully`
    });
  } catch (error) {
    console.error('bulkVerifyUsers error:', error);
    return errorResponse(res, 'Failed to bulk verify users', 500);
  }
};

module.exports = {
  getPendingVerifications,
  getVerificationStats,
  getVerificationDetails,
  verifyAlumniUser,
  rejectAlumniUser,
  unblockAlumniUser,
  bulkVerifyUsers
};