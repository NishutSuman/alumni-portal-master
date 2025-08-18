// src/controllers/auth.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const config = require('../config');
const { successResponse, errorResponse } = require('../utils/response');

// Generate JWT tokens
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

// Register new user - FIXED VERSION
const register = async (req, res) => {
  const { email, password, fullName, batch } = req.body;
  
  // Basic validation
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
  
  // Validate batch year
  const currentYear = new Date().getFullYear();
  if (batch < 1950 || batch > currentYear + 10) {
    return errorResponse(res, 'Invalid batch year', 400);
  }
  
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (existingUser) {
      return errorResponse(res, 'User with this email already exists', 409);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
    
    // Generate email verification token
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    
    // Start transaction to create batch first, then user
    const result = await prisma.$transaction(async (prisma) => {
      // FIRST: Create or ensure batch exists
      const batchRecord = await prisma.batch.upsert({
        where: { year: parseInt(batch) },
        update: {
          totalMembers: {
            increment: 1
          }
        },
        create: {
          year: parseInt(batch),
          name: `Class of ${batch}`,
          totalMembers: 1,
        },
      });
      
      // SECOND: Create user (now batch exists)
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          fullName,
          batch: parseInt(batch),
          emailVerifyToken,
          role: 'USER',
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          batch: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
        },
      });
      
      return user;
    });
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(result.id);
    
    // Log user registration
    await prisma.activityLog.create({
      data: {
        userId: result.id,
        action: 'user_register',
        details: {
          email: result.email,
          batch: result.batch,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    // TODO: Send verification email (implement email service)
    console.log(`Email verification token for ${email}: ${emailVerifyToken}`);
    
    return successResponse(
      res,
      {
        user: result,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
      'User registered successfully. Please verify your email.',
      201
    );
    
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return errorResponse(res, 'User with this email already exists', 409);
    }
    
    return errorResponse(res, 'Registration failed', 500);
  }
};

    


// Login user
const login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return errorResponse(res, 'Email and password are required', 400);
  }
  
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        batch: true,
        bio: true,
        employmentStatus: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        deactivatedAt: true,
      },
    });
    
    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401);
    }
    
    // Check if user is active
    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated', 403);
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse(res, 'Invalid email or password', 401);
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    // Log login
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'user_login',
        details: {
          email: user.email,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    // Remove password hash from response
    delete user.passwordHash;
    
    return successResponse(res, {
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    }, 'Login successful');
    
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 'Login failed', 500);
  }
};

// Refresh access token
const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;
  
  if (!token) {
    return errorResponse(res, 'Refresh token is required', 400);
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret);
    
    if (decoded.type !== 'refresh') {
      return errorResponse(res, 'Invalid token type', 401);
    }
    
    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
    
    if (!user || !user.isActive) {
      return errorResponse(res, 'Invalid refresh token', 401);
    }
    
    // Generate new tokens
    const tokens = generateTokens(user.id);
    
    return successResponse(res, { tokens }, 'Token refreshed successfully');
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Invalid refresh token', 401);
    }
    
    console.error('Refresh token error:', error);
    return errorResponse(res, 'Token refresh failed', 500);
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        batch: true,
        dateOfBirth: true,
        whatsappNumber: true,
        alternateNumber: true,
        bio: true,
        employmentStatus: true,
        profileImage: true,
        linkedinUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        twitterUrl: true,
        youtubeUrl: true,
        portfolioUrl: true,
        isProfilePublic: true,
        showEmail: true,
        showPhone: true,
        role: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        educationHistory: {
          orderBy: { fromYear: 'desc' },
          select: {
            id: true,
            course: true,
            stream: true,
            institution: true,
            fromYear: true,
            toYear: true,
            isOngoing: true,
            description: true,
          },
        },
        workHistory: {
          orderBy: { fromYear: 'desc' },
          select: {
            id: true,
            companyName: true,
            jobRole: true,
            companyType: true,
            workAddress: true,
            fromYear: true,
            toYear: true,
            isCurrentJob: true,
            description: true,
          },
        },
        addresses: {
          select: {
            id: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
            addressType: true,
          },
        },
      },
    });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    return successResponse(res, { user }, 'User data retrieved successfully');
    
  } catch (error) {
    console.error('Get current user error:', error);
    return errorResponse(res, 'Failed to retrieve user data', 500);
  }
};

// Logout (optional - mainly for client-side token cleanup)
const logout = async (req, res) => {
  try {
    // Log logout activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'user_logout',
        details: {
          email: req.user.email,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Logout successful');
    
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse(res, 'Logout failed', 500);
  }
};

// Change password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return errorResponse(res, 'Current password and new password are required', 400);
  }
  
  if (newPassword.length < 8) {
    return errorResponse(res, 'New password must be at least 8 characters long', 400);
  }
  
  try {
    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true },
    });
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return errorResponse(res, 'Current password is incorrect', 400);
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
    
    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });
    
    // Log password change
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'password_change',
        details: {},
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

// Forgot password (placeholder - implement email service)
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return errorResponse(res, 'Email is required', 400);
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    // Always return success for security (don't reveal if email exists)
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });
      
      // TODO: Send password reset email
      console.log(`Password reset token for ${email}: ${resetToken}`);
    }
    
    return successResponse(
      res,
      null,
      'If an account with that email exists, a password reset link has been sent.'
    );
    
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse(res, 'Failed to process password reset request', 500);
  }
};

// Reset password
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
          gt: new Date(),
        },
      },
    });
    
    if (!user) {
      return errorResponse(res, 'Invalid or expired reset token', 400);
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
    
    // Update password and clear reset tokens
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    
    // Log password reset
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'password_reset',
        details: {},
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Password reset successfully');
    
  } catch (error) {
    console.error('Reset password error:', error);
    return errorResponse(res, 'Failed to reset password', 500);
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  const { token } = req.params;
  
  try {
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });
    
    if (!user) {
      return errorResponse(res, 'Invalid verification token', 400);
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
      },
    });
    
    // Log email verification
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'email_verified',
        details: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Email verified successfully');
    
  } catch (error) {
    console.error('Email verification error:', error);
    return errorResponse(res, 'Email verification failed', 500);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getCurrentUser,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
};