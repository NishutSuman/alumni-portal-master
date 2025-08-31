// ==========================================
// STEP 3: UPDATED AUTHENTICATION CONTROLLER
// File: apm-server/src/controllers/auth.controller.js  
// ==========================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../../config/database');
const config = require('../../config');
const { successResponse, errorResponse } = require('../../utils/response');
const SerialIdService = require('../../services/serialID.service');
const NotificationService = require('../../services/notification.service');

// Generate JWT tokens (UNCHANGED)
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
  
  return { accessToken, refreshToken };
};

// ==========================================
// UPDATED REGISTRATION WITH ALUMNI VERIFICATION
// ==========================================

const register = async (req, res) => {
  const { email, password, fullName, batch } = req.body;
  
  // Basic validation (same as before)
  if (!email || !password || !fullName || !batch) {
    return errorResponse(res, 'Email, password, full name, and batch are required', 400);
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return errorResponse(res, 'Invalid email format', 400);
  }
  
  // Validate password strength
  if (password.length < 8) {
    return errorResponse(res, 'Password must be at least 8 characters long', 400);
  }
  
  // ==========================================
  // NEW: ENHANCED BATCH VALIDATION
  // ==========================================
  
  const batchValidation = SerialIdService.validateAndParseBatchYear(parseInt(batch));
  if (!batchValidation.isValid) {
    return errorResponse(res, batchValidation.error, 400);
  }
  
  const { admissionYear, passoutYear } = batchValidation;
  
  try {
    // ==========================================
    // NEW: CHECK EMAIL BLACKLIST
    // ==========================================
    
    const blacklistedEmail = await prisma.blacklistedEmail.findFirst({
      where: { 
        email: email.toLowerCase(),
        isActive: true 
      },
      select: {
        id: true,
        reason: true,
        blacklistedAt: true,
        blacklistedAdmin: {
          select: { fullName: true }
        }
      }
    });
    
    if (blacklistedEmail) {
      // Log blacklist attempt
      await prisma.activityLog.create({
        data: {
          userId: null, // No user ID yet
          action: 'blacklisted_registration_attempt',
          details: {
            email: email.toLowerCase(),
            attemptedBatch: batch,
            blacklistReason: blacklistedEmail.reason
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      return errorResponse(res, 
        'This email is not eligible for registration. If you believe this is an error, please contact the administration.', 
        403, 
        { 
          blacklisted: true,
          blacklistedAt: blacklistedEmail.blacklistedAt,
          contactAdmin: true
        }
      );
    }
    
    // Check if user already exists (same as before)
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (existingUser) {
      return errorResponse(res, 'User with this email already exists', 409);
    }
    
    // Hash password and generate email verification token (same as before)
    const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    
    // ==========================================
    // ENHANCED TRANSACTION WITH ALUMNI VERIFICATION
    // ==========================================
    
    const result = await prisma.$transaction(async (prismaTransaction) => {
      // Create or update batch record (enhanced)
      const batchRecord = await prismaTransaction.batch.upsert({
        where: { year: passoutYear }, // Use passout year as main identifier
        update: { 
          totalMembers: { increment: 1 }
        },
        create: {
          year: passoutYear,
          name: `Class of ${passoutYear}`,
          totalMembers: 1,
          
          // NEW: Enhanced batch information
          admissionYear: admissionYear,
          passoutYear: passoutYear,
          batchDisplayName: `${admissionYear}-${passoutYear.toString().slice(-2)}` // 2009-16
        },
      });
      
      // ==========================================
      // CREATE USER WITH ENHANCED VERIFICATION FIELDS
      // ==========================================
      
      const user = await prismaTransaction.user.create({
        data: {
          // Basic information (same as before)
          email: email.toLowerCase(),
          passwordHash,
          fullName,
          emailVerifyToken,
          role: 'USER',
          
          // Enhanced batch information
          batch: passoutYear,           // Keep for backward compatibility  
          admissionYear: admissionYear, // NEW: Admission year
          passoutYear: passoutYear,     // NEW: Passout year
          
          // ==========================================
          // NEW: ALUMNI VERIFICATION FIELDS
          // ==========================================
          isAlumniVerified: false,      // Not verified yet
          pendingVerification: true,    // Awaiting admin approval
          isRejected: false,           // Not rejected
          
          // Serial ID will be generated after verification
          serialId: null,
          serialCounter: null
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          batch: true,
          admissionYear: true,
          passoutYear: true,
          role: true,
          isEmailVerified: true,
          isAlumniVerified: true,
          pendingVerification: true,
          createdAt: true,
        },
      });
      
      return user;
    });
    
    // ==========================================
    // SEND NOTIFICATIONS TO ADMINS
    // ==========================================
    
    await sendNewRegistrationNotifications(result);
    
    // Generate tokens (same as before)
    const { accessToken, refreshToken } = generateTokens(result.id);
    
    // ==========================================
    // ENHANCED ACTIVITY LOG
    // ==========================================
    
    await prisma.activityLog.create({
      data: {
        userId: result.id,
        action: 'user_register',
        details: {
          email: result.email,
          batch: result.batch,
          admissionYear: result.admissionYear,
          passoutYear: result.passoutYear,
          pendingVerification: true,
          batchDisplayName: `${result.admissionYear}-${result.passoutYear.toString().slice(-2)}`
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(
      res,
      {
        user: result,
        tokens: { accessToken, refreshToken },
        verificationStatus: {
          isAlumniVerified: result.isAlumniVerified,
          pendingVerification: result.pendingVerification,
          message: 'Your account has been created successfully. Alumni verification is pending - you will be notified once approved.'
        }
      },
      'Registration completed successfully. Awaiting alumni verification.',
      201
    );
    
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle unique constraint violations (same as before)
    if (error.code === 'P2002') {
      return errorResponse(res, 'User with this email already exists', 409);
    }
    
    return errorResponse(res, 'Registration failed', 500);
  }
};

// ==========================================
// ENHANCED LOGIN WITH VERIFICATION STATUS
// ==========================================

const login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return errorResponse(res, 'Email and password are required', 400);
  }
  
  try {
    // Find user with enhanced verification fields
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        batch: true,
        admissionYear: true,
        passoutYear: true,
        bio: true,
        employmentStatus: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        
        // NEW: Alumni verification fields
        isAlumniVerified: true,
        pendingVerification: true,
        isRejected: true,
        rejectionReason: true,
        
        serialId: true,
        deactivatedAt: true,
      },
    });
    
    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401);
    }
    
    // Check if user is active (same as before)
    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated', 403);
    }
    
    // Verify password (same as before)
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse(res, 'Invalid email or password', 401);
    }
    
    // Generate tokens (same as before)
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Update last login (same as before)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    // ==========================================
    // ENHANCED ACTIVITY LOG
    // ==========================================
    
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'user_login',
        details: {
          email: user.email,
          verificationStatus: {
            isAlumniVerified: user.isAlumniVerified,
            pendingVerification: user.pendingVerification,
            isRejected: user.isRejected
          }
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    // Remove password hash from response
    delete user.passwordHash;
    
    // ==========================================
    // ENHANCED RESPONSE WITH VERIFICATION STATUS
    // ==========================================
    
    return successResponse(res, {
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
      verificationStatus: {
        isAlumniVerified: user.isAlumniVerified,
        pendingVerification: user.pendingVerification,
        isRejected: user.isRejected,
        rejectionReason: user.rejectionReason,
        hasSerialId: !!user.serialId,
        message: user.isAlumniVerified 
          ? 'Welcome back!' 
          : user.isRejected 
            ? 'Your alumni verification was not approved. Contact admin for more information.'
            : 'Your alumni verification is pending approval.'
      }
    }, 'Login successful');
    
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 'Login failed', 500);
  }
};

// ==========================================
// ENHANCED GET CURRENT USER
// ==========================================

const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        batch: true,
        admissionYear: true,      // NEW
        passoutYear: true,        // NEW
        bio: true,
        profileImage: true,
        employmentStatus: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        
        // NEW: Alumni verification status
        isAlumniVerified: true,
        pendingVerification: true,
        isRejected: true,
        rejectionReason: true,
        alumniVerifiedAt: true,
        rejectedAt: true,
        
        serialId: true,           // NEW
        
        lastLoginAt: true,
        createdAt: true,
        
        // Social links (existing)
        linkedinUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        twitterUrl: true,
        youtubeUrl: true,
        portfolioUrl: true,
        
        // Privacy settings (existing)
        isProfilePublic: true,
        showEmail: true,
        showPhone: true,
      },
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    // ==========================================
    // NEW: ADD BATCH DISPLAY NAME
    // ==========================================
    
    if (user.admissionYear && user.passoutYear) {
      user.batchDisplayName = `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`;
    }
    
    return successResponse(res, { user });
    
  } catch (error) {
    console.error('Get current user error:', error);
    return errorResponse(res, 'Failed to fetch user data', 500);
  }
};

// ==========================================
// NEW: NOTIFICATION HELPER FUNCTIONS
// ==========================================

/**
 * Send push notifications to admins on new registration
 * @param {Object} user - Newly registered user
 */
const sendNewRegistrationNotifications = async (user) => {
  try {
    console.log(`🔔 Sending registration notifications for ${user.fullName} (Batch: ${user.batch})`);
    
    // Get all super admins
    const superAdmins = await prisma.user.findMany({
      where: { 
        role: 'SUPER_ADMIN',
        isActive: true 
      },
      select: { id: true, fullName: true }
    });
    
    // Get batch admins for this user's batch
    const batchAdmins = await prisma.batchAdminAssignment.findMany({
      where: {
        batchYear: user.batch, // Using passout year
        isActive: true
      },
      include: {
        user: {
          select: { id: true, fullName: true }
        }
      }
    });
    
    // Prepare notification recipients
    const recipients = [];
    
    // Add super admins
    superAdmins.forEach(admin => {
      recipients.push({
        userId: admin.id,
        title: 'New Alumni Registration 🎓',
        message: `${user.fullName} from ${user.admissionYear}-${user.passoutYear.toString().slice(-2)} batch has registered and needs verification`,
        type: 'NEW_REGISTRATION',
        priority: 'HIGH',
        data: {
          newUserId: user.id,
          userName: user.fullName,
          userEmail: user.email,
          userBatch: user.batch,
          batchDisplayName: `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`,
          adminType: 'SUPER_ADMIN'
        }
      });
    });
    
    // Add batch admins (avoid duplicates if super admin is also batch admin)
    batchAdmins.forEach(batchAdmin => {
      // Check if this user is already in super admin list
      const isDuplicate = superAdmins.some(admin => admin.id === batchAdmin.user.id);
      
      if (!isDuplicate) {
        recipients.push({
          userId: batchAdmin.user.id,
          title: 'New Batch Registration 🏫',
          message: `${user.fullName} from your batch (${user.admissionYear}-${user.passoutYear.toString().slice(-2)}) has registered and needs verification`,
          type: 'NEW_REGISTRATION',
          priority: 'MEDIUM',
          data: {
            newUserId: user.id,
            userName: user.fullName,
            userEmail: user.email,
            userBatch: user.batch,
            batchDisplayName: `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`,
            adminType: 'BATCH_ADMIN'
          }
        });
      }
    });
    
    // Send notifications if we have recipients
    if (recipients.length > 0) {
      console.log(`📤 Sending ${recipients.length} notifications for new registration`);
      
      // Create notifications in database
      await prisma.notification.createMany({
        data: recipients.map(recipient => ({
          userId: recipient.userId,
          type: recipient.type,
          title: recipient.title,
          message: recipient.message,
          data: recipient.data,
          priority: recipient.priority,
          relatedUserId: user.id,
          batchContext: user.batch
        }))
      });
      
      // Send push notifications using existing notification service
      for (const recipient of recipients) {
        try {
          await NotificationService.sendPushNotification({
            userId: recipient.userId,
            title: recipient.title,
            message: recipient.message,
            data: recipient.data,
            priority: recipient.priority
          });
        } catch (pushError) {
          console.error('Push notification error:', pushError);
          // Continue with other notifications even if one fails
        }
      }
      
      console.log(`✅ Registration notifications sent successfully`);
    } else {
      console.log(`⚠️ No admins found to notify for batch ${user.batch}`);
    }
    
  } catch (error) {
    console.error('Error sending registration notifications:', error);
    // Don't throw error - registration should still succeed even if notifications fail
  }
};

/**
 * Send verification status notifications  
 * @param {Object} user - User being verified/rejected
 * @param {string} adminName - Name of admin performing action
 * @param {string} action - 'approved' or 'rejected'
 * @param {string} reason - Reason for action (required for rejection)
 * @param {string} serialId - Generated serial ID (for approvals)
 */
const sendVerificationNotifications = async (user, adminName, action, reason = null, serialId = null) => {
  try {
    console.log(`🔔 Sending ${action} notification for ${user.fullName}`);
    
    const notifications = [];
    
    if (action === 'approved') {
      // ==========================================
      // APPROVAL NOTIFICATIONS
      // ==========================================
      
      // Notification to verified user
      notifications.push({
        userId: user.id,
        type: 'VERIFICATION_APPROVED',
        title: 'Alumni Verification Approved! 🎉',
        message: `Congratulations ${user.fullName}! Your alumni status has been verified by ${adminName}. You now have full access to the alumni portal.`,
        priority: 'HIGH',
        data: {
          verifiedBy: adminName,
          verifiedAt: new Date().toISOString(),
          serialId: serialId,
          batchDisplayName: `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`,
          accessGranted: true
        }
      });
      
      // Notification to batch admins (if verified by super admin)
      const batchAdmins = await prisma.batchAdminAssignment.findMany({
        where: {
          batchYear: user.batch,
          isActive: true
        },
        include: {
          user: { 
            select: { 
              id: true, 
              fullName: true,
              role: true 
            } 
          }
        }
      });
      
      batchAdmins.forEach(batchAdmin => {
        // Don't notify if the batch admin is the one who verified
        if (batchAdmin.user.fullName !== adminName) {
          notifications.push({
            userId: batchAdmin.user.id,
            type: 'BATCH_USER_VERIFIED',
            title: 'Batch Member Verified ✅',
            message: `${user.fullName} from your batch has been verified as alumni by ${adminName}`,
            priority: 'MEDIUM',
            data: {
              verifiedUserId: user.id,
              verifiedUserName: user.fullName,
              verifiedUserEmail: user.email,
              userBatch: user.batch,
              batchDisplayName: `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`,
              verifiedBy: adminName,
              serialId: serialId
            }
          });
        }
      });
      
    } else if (action === 'rejected') {
      // ==========================================
      // REJECTION NOTIFICATION
      // ==========================================
      
      notifications.push({
        userId: user.id,
        type: 'VERIFICATION_REJECTED',
        title: 'Alumni Verification Update',
        message: `Your alumni verification has been reviewed. Unfortunately, we could not verify your alumni status. Reason: ${reason}`,
        priority: 'HIGH',
        data: {
          rejectedBy: adminName,
          rejectionReason: reason,
          rejectedAt: new Date().toISOString(),
          batchClaimed: user.batch,
          batchDisplayName: `${user.admissionYear}-${user.passoutYear.toString().slice(-2)}`,
          contactAdmin: true
        }
      });
    }
    
    // Create notifications in database
    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications.map(notification => ({
          ...notification,
          relatedUserId: user.id,
          batchContext: user.batch
        }))
      });
      
      // Send push notifications
      for (const notification of notifications) {
        try {
          await NotificationService.sendPushNotification({
            userId: notification.userId,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            priority: notification.priority
          });
        } catch (pushError) {
          console.error('Push notification error:', pushError);
        }
      }
      
      console.log(`✅ ${action} notifications sent successfully`);
    }
    
  } catch (error) {
    console.error(`Error sending ${action} notifications:`, error);
    // Don't throw - verification should still succeed even if notifications fail
  }
};

// ==========================================
// EXISTING FUNCTIONS (UNCHANGED)
// ==========================================

// refresh token, logout, change password, forgot password, reset password, verify email functions
// remain exactly the same as in your current implementation

const refreshToken = async (req, res) => {
  // ... existing implementation unchanged ...
};

const logout = async (req, res) => {
  // ... existing implementation unchanged ...
};

const changePassword = async (req, res) => {
  // ... existing implementation unchanged ...
};

const forgotPassword = async (req, res) => {
  // ... existing implementation unchanged ...
};

const resetPassword = async (req, res) => {
  // ... existing implementation unchanged ...
};

const verifyEmail = async (req, res) => {
  // ... existing implementation unchanged ...
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  register,                    // ✅ UPDATED
  login,                       // ✅ UPDATED  
  getCurrentUser,              // ✅ UPDATED
  refreshToken,                // ⚪ UNCHANGED
  logout,                      // ⚪ UNCHANGED
  changePassword,              // ⚪ UNCHANGED
  forgotPassword,              // ⚪ UNCHANGED
  resetPassword,               // ⚪ UNCHANGED
  verifyEmail,                 // ⚪ UNCHANGED
  
  // NEW EXPORTS
  sendVerificationNotifications // ✅ NEW (will be used by verification controller)
};