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
const emailManager = require('../../services/email/EmailManager');

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
  
  // Basic validation - only batch passout year required
  if (!email || !password || !fullName || !batch) {
    return errorResponse(res, 'Email, password, full name, and batch passout year are required', 400);
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
  // VALIDATE BATCH PASSOUT YEAR
  // ==========================================
  
  // Validate batch passout year
  const batchNum = parseInt(batch);
  
  if (isNaN(batchNum) || batchNum < 1950 || batchNum > new Date().getFullYear() + 10) {
    return errorResponse(res, 'Invalid batch passout year', 400);
  }
  
  // Use batch as passout year, admission year will be null for now
  const finalPassoutYear = batchNum;
  const finalAdmissionYear = null; // Can be filled later in profile
  
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
        where: { year: finalPassoutYear }, // Use passout year as main identifier
        update: { 
          totalMembers: { increment: 1 }
        },
        create: {
          year: finalPassoutYear,
          name: `Class of ${finalPassoutYear}`,
          totalMembers: 1,
          
          // NEW: Enhanced batch information
          admissionYear: finalAdmissionYear,
          passoutYear: finalPassoutYear,
          batchDisplayName: finalAdmissionYear ? `${finalAdmissionYear}-${finalPassoutYear.toString().slice(-2)}` : `Class of ${finalPassoutYear}`
        },
      });
      
      // ==========================================
      // SERIAL ID GENERATION MOVED TO VERIFICATION APPROVAL
      // Serial ID is generated only when admin approves the user
      // ==========================================
      const serialId = null; // Will be generated during alumni verification approval
      const counter = null;
      
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
          batch: finalPassoutYear,           // Keep for backward compatibility  
          admissionYear: finalAdmissionYear, // User's actual admission year
          passoutYear: finalPassoutYear,     // User's actual passout year
          
          // ==========================================
          // NEW: ALUMNI VERIFICATION FIELDS
          // ==========================================
          isAlumniVerified: false,      // Not verified yet
          pendingVerification: true,    // Awaiting admin approval
          isRejected: false,           // Not rejected
          
          // Serial ID generated immediately during registration
          serialId: serialId,
          serialCounter: counter
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
          serialId: true,
          serialCounter: true,
          createdAt: true,
        },
      });
      
      return user;
    });
    
    // ==========================================
    // SEND NOTIFICATIONS TO ADMINS
    // ==========================================
    
    await sendNewRegistrationNotifications(result);
    
    // ==========================================
    // SEND VERIFICATION EMAIL
    // ==========================================
    
    try {
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/verify-email?token=${emailVerifyToken}&email=${encodeURIComponent(result.email)}`;
      
      if (emailManager.isInitialized) {
        const emailService = emailManager.getService();
        await emailService.sendVerificationEmail({
          to: result.email,
          name: result.fullName,
          verificationLink: verificationLink
        });
        console.log('✅ Registration verification email sent to:', result.email);
      } else {
        console.log('📧 Email system not initialized. Verification token:', emailVerifyToken);
        console.log('🔗 Verification link would be:', verificationLink);
      }
    } catch (emailError) {
      console.error('Registration email sending error:', emailError);
      // Don't fail registration if email fails
    }
    
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
        emailVerifyToken: true, // Added for auto-sending verification emails
        
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
    
    // ==========================================
    // CHECK EMAIL BLACKLIST STATUS
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
      // Log blacklist login attempt
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'blacklisted_login_attempt',
          details: {
            email: email.toLowerCase(),
            blacklistReason: blacklistedEmail.reason,
            blacklistedBy: blacklistedEmail.blacklistedAdmin.fullName,
            blacklistedAt: blacklistedEmail.blacklistedAt
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      return errorResponse(res, 'This account is not eligible for access. Please contact support if you believe this is an error.', 403, {
        accountBlacklisted: true,
        contactSupport: true,
        helpMessage: 'Your email address has been restricted from accessing this platform. If you believe this is a mistake, please contact the administration with proper documentation.'
      });
    }
    
    // ==========================================
    // CHECK EMAIL VERIFICATION STATUS
    // ==========================================
    
    if (!user.isEmailVerified) {
      // Auto-send verification email when unverified user tries to login
      try {
        // Generate new verification token if user doesn't have one
        let verificationToken = user.emailVerifyToken;
        if (!verificationToken) {
          verificationToken = crypto.randomBytes(32).toString('hex');
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerifyToken: verificationToken }
          });
        }
        
        // Create verification link
        const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;
        
        // Send verification email with correct parameters
        const emailService = emailManager.getService();
        await emailService.sendVerificationEmail({
          to: user.email,
          name: user.fullName,
          verificationLink: verificationLink
        });
        
        console.log(`✅ Auto-sent verification email to ${user.email} during login attempt`);
        
        // Log the auto-send activity
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: 'verification_email_auto_sent',
            details: {
              email: user.email,
              triggeredBy: 'login_attempt',
              reason: 'unverified_user_login',
              verificationToken: verificationToken
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          },
        });
        
      } catch (emailError) {
        console.error('Failed to auto-send verification email:', emailError);
        // Don't fail the response if email fails
      }
      
      return errorResponse(res, 'Please verify your email address before signing in. We have sent you a new verification link - check your inbox.', 403, {
        emailVerificationRequired: true,
        email: user.email,
        fullName: user.fullName,
        verificationEmailSent: true
      });
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
    // ENHANCED RESPONSE WITH VERIFICATION STATUS (Allow login for all users)
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
        message: `${user.fullName} from ${user.batch} batch has registered and needs verification`,
        type: 'NEW_REGISTRATION',
        priority: 'HIGH',
        data: {
          newUserId: user.id,
          userName: user.fullName,
          userEmail: user.email,
          userBatch: user.batch,
          batchDisplayName: `${user.batch}`,
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
          message: `${user.fullName} from your batch (${user.batch}) has registered and needs verification`,
          type: 'NEW_REGISTRATION',
          priority: 'MEDIUM',
          data: {
            newUserId: user.id,
            userName: user.fullName,
            userEmail: user.email,
            userBatch: user.batch,
            batchDisplayName: `${user.batch}`,
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
          payload: recipient.data,
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
          batchDisplayName: `${user.batch}`,
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
              batchDisplayName: `${user.batch}`,
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
          batchDisplayName: `${user.batch}`,
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
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return errorResponse(res, 'Refresh token is required', 400);
  }
  
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    
    if (decoded.type !== 'refresh') {
      return errorResponse(res, 'Invalid token type', 401);
    }
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isActive: true }
    });
    
    if (!user || !user.isActive) {
      return errorResponse(res, 'User not found or inactive', 401);
    }
    
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
    
    return successResponse(res, {
      accessToken,
      refreshToken: newRefreshToken,
    }, 'Token refreshed successfully');
    
  } catch (error) {
    console.error('Refresh token error:', error);
    return errorResponse(res, 'Invalid or expired refresh token', 401);
  }
};

const logout = async (req, res) => {
  try {
    // Log the logout activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'user_logout',
        details: {
          loggedOutAt: new Date().toISOString()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse(res, 'Logout failed', 500);
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return errorResponse(res, 'Current password and new password are required', 400);
  }
  
  if (newPassword.length < 8) {
    return errorResponse(res, 'New password must be at least 8 characters long', 400);
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true, email: true }
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return errorResponse(res, 'Current password is incorrect', 401);
    }
    
    const newPasswordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      },
    });
    
    // Log the password change
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'password_changed',
        details: {
          changedAt: new Date().toISOString()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Password changed successfully');
    
  } catch (error) {
    console.error('Change password error:', error);
    return errorResponse(res, 'Failed to change password', 500);
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return errorResponse(res, 'Email is required', 400);
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, fullName: true, isActive: true }
    });
    
    if (!user || !user.isActive) {
      // Don't reveal if email exists or not for security
      return successResponse(res, null, 'If an account with that email exists, a password reset link has been sent.');
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Save reset token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetTokenExpiry
      }
    });
    
    // Log the password reset request
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'password_reset_requested',
        details: {
          email: user.email,
          requestedAt: new Date().toISOString()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    // Send password reset email
    try {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
      
      if (emailManager.isInitialized) {
        const emailService = emailManager.getService();
        await emailService.sendPasswordResetEmail({
          to: user.email,
          name: user.fullName,
          resetLink: resetLink,
          expiryHours: 1
        });
        console.log('✅ Password reset email sent to:', user.email);
      } else {
        console.log('📧 Email system not initialized. Reset token:', resetToken);
        console.log('🔗 Reset link would be:', resetLink);
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the request if email fails
    }
    
    return successResponse(res, null, 'Password reset instructions have been sent to your email.');
    
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse(res, 'Failed to process password reset request', 500);
  }
};

// Validate reset token endpoint
const validateResetToken = async (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return errorResponse(res, 'Reset token is required', 400);
  }
  
  try {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        },
        isActive: true
      },
      select: { id: true, email: true }
    });
    
    if (!user) {
      return errorResponse(res, 'Invalid or expired reset token', 400);
    }
    
    return successResponse(res, {
      valid: true,
      email: user.email
    }, 'Reset token is valid');
    
  } catch (error) {
    console.error('Validate reset token error:', error);
    return errorResponse(res, 'Failed to validate reset token', 500);
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return errorResponse(res, 'Token and new password are required', 400);
  }
  
  if (newPassword.length < 8) {
    return errorResponse(res, 'Password must be at least 8 characters long', 400);
  }
  
  try {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        },
        isActive: true
      },
      select: { id: true, email: true, fullName: true }
    });
    
    if (!user) {
      return errorResponse(res, 'Invalid or expired reset token', 400);
    }
    
    const newPasswordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
    
    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date()
      }
    });
    
    // Log the password reset
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'password_reset_completed',
        details: {
          resetAt: new Date().toISOString()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Password reset successful. You can now login with your new password.');
    
  } catch (error) {
    console.error('Reset password error:', error);
    return errorResponse(res, 'Failed to reset password', 500);
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.params;
  
  if (!token) {
    return errorResponse(res, 'Verification token is required', 400);
  }
  
  try {
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isEmailVerified: true,
        isAlumniVerified: true,
        pendingVerification: true
      }
    });
    
    if (!user) {
      return errorResponse(res, 'Invalid or expired verification token', 400);
    }
    
    if (user.isEmailVerified) {
      return successResponse(res, { user }, 'Email already verified');
    }
    
    // Update user email verification status
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isEmailVerified: true,
        isAlumniVerified: true,
        pendingVerification: true,
        batch: true,
        role: true
      }
    });
    
    // Log the email verification
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'email_verified',
        details: {
          email: user.email,
          verifiedAt: new Date().toISOString()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { user: updatedUser }, 'Email verified successfully');
    
  } catch (error) {
    console.error('Email verification error:', error);
    return errorResponse(res, 'Email verification failed', 500);
  }
};

const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return errorResponse(res, 'Email is required', 400);
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        isEmailVerified: true,
        emailVerifyToken: true
      }
    });
    
    if (!user || !user.isActive) {
      // Don't reveal if email exists for security
      return successResponse(res, null, 'If an account with that email exists, a verification email has been sent.');
    }
    
    if (user.isEmailVerified) {
      return successResponse(res, null, 'Email is already verified.');
    }
    
    // Generate new verification token if needed
    let verificationToken = user.emailVerifyToken;
    if (!verificationToken) {
      verificationToken = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifyToken: verificationToken }
      });
    }
    
    // Send verification email
    try {
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;
      
      if (emailManager.isInitialized) {
        const emailService = emailManager.getService();
        await emailService.sendVerificationEmail({
          to: user.email,
          name: user.fullName,
          verificationLink: verificationLink
        });
        console.log('✅ Verification email sent to:', user.email);
      } else {
        console.log('📧 Email system not initialized. Verification token:', verificationToken);
        console.log('🔗 Verification link would be:', verificationLink);
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the request if email fails
    }
    
    // Log the resend request
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'verification_email_resent',
        details: {
          email: user.email,
          requestedAt: new Date().toISOString()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Verification email sent! Please check your inbox.');
    
  } catch (error) {
    console.error('Resend verification error:', error);
    return errorResponse(res, 'Failed to resend verification email', 500);
  }
};

const testEmail = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return errorResponse(res, 'Email is required for testing', 400);
  }
  
  try {
    console.log('🧪 Testing email system...');
    
    // Check if email manager is initialized
    if (!emailManager.isInitialized) {
      console.log('❌ Email manager not initialized');
      return errorResponse(res, 'Email system not initialized', 500, {
        initialized: false,
        suggestions: [
          'Check Gmail credentials in .env file',
          'Ensure GMAIL_USER and GMAIL_APP_PASSWORD are set',
          'Verify app password is correct (no spaces)',
          'Check server logs for initialization errors'
        ]
      });
    }
    
    console.log('✅ Email manager is initialized');
    
    // Test connection
    const emailService = emailManager.getService();
    const testResult = await emailService.testEmailConfig();
    
    if (!testResult.success) {
      console.log('❌ Email connection test failed:', testResult.error);
      return errorResponse(res, 'Email connection test failed', 500, {
        connectionTest: testResult,
        suggestions: [
          'Check Gmail app password',
          'Enable 2-factor authentication on Gmail',
          'Generate a new app password if needed'
        ]
      });
    }
    
    console.log('✅ Email connection test passed');
    
    // Send test verification email
    const testResult2 = await emailService.sendVerificationEmail({
      to: email,
      name: 'Test User',
      verificationLink: 'https://example.com/test-verification-link'
    });
    
    if (testResult2.success) {
      console.log('✅ Test email sent successfully');
      return successResponse(res, {
        emailSent: true,
        testResult: testResult2,
        connectionTest: testResult
      }, 'Test email sent successfully! Check your inbox.');
    } else {
      console.log('❌ Test email failed:', testResult2.error);
      return errorResponse(res, 'Failed to send test email', 500, {
        emailResult: testResult2,
        connectionTest: testResult
      });
    }
    
  } catch (error) {
    console.error('❌ Email test error:', error);
    return errorResponse(res, 'Email test failed', 500, {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  register,                    // ✅ UPDATED
  login,                       // ✅ UPDATED  
  getCurrentUser,              // ✅ UPDATED
  refreshToken,                // ✅ IMPLEMENTED
  logout,                      // ✅ IMPLEMENTED
  changePassword,              // ✅ IMPLEMENTED
  forgotPassword,              // ✅ IMPLEMENTED
  validateResetToken,          // ✅ NEW
  resetPassword,               // ✅ IMPLEMENTED
  verifyEmail,                 // ✅ IMPLEMENTED
  resendVerificationEmail,     // ✅ NEW
  testEmail,                   // ✅ TEST FUNCTION
  
  // NEW EXPORTS
  sendVerificationNotifications // ✅ NEW (will be used by verification controller)
};