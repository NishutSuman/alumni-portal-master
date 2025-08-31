// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { prisma } = require('../../config/database');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }
    
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        deactivatedAt: true,
      },
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }
    
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

// Check if user has required role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Convert single role to array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }
    
    next();
  };
};

// Check if user is batch admin for specific batch
const requireBatchAdmin = async (req, res, next) => {
  try {
    const batchId = req.params.batchId || req.body.batchId;
    
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID required',
      });
    }
    
    // Super admins can access any batch
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }
    
    // Check if user is batch admin for this specific batch
    const batch = await prisma.batch.findFirst({
      where: {
        id: batchId,
        admins: {
          some: {
            id: req.user.id,
          },
        },
      },
    });
    
    if (!batch) {
      return res.status(403).json({
        success: false,
        message: 'You are not an admin for this batch',
      });
    }
    
    next();
  } catch (error) {
    console.error('Batch admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed',
    });
  }
};

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
        },
      });
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireBatchAdmin,
  optionalAuth,
};