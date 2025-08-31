// tests/unit/middleware/auth/verification.middleware.test.js
const { UserFactory, AuthFactory } = require('../../../factories');

// Mock response object
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mock request object
const mockReq = (body = {}, user = null, ip = '127.0.0.1') => ({
  body,
  user,
  ip,
  get: jest.fn().mockReturnValue('test-user-agent')
});

// Mock next function
const mockNext = jest.fn();

describe('Alumni Verification Middleware Unit Tests', () => {
  let verificationMiddleware;
  
  beforeAll(() => {
    // Import your existing verification middleware
    verificationMiddleware = require('../../../../src/middleware/alumniVerification.middleware');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireAlumniVerification', () => {
    test('should allow verified alumni user access', async () => {
      // Arrange
      const verifiedUser = await UserFactory.createVerifiedUser();
      const req = mockReq({}, verifiedUser);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.requireAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should allow SUPER_ADMIN access without verification', async () => {
      // Arrange
      const adminUser = await UserFactory.createAdminUser('SUPER_ADMIN');
      // Make admin unverified to test middleware logic
      await global.testPrisma.user.update({
        where: { id: adminUser.id },
        data: { isAlumniVerified: false }
      });
      
      const req = mockReq({}, { 
        ...adminUser, 
        isAlumniVerified: false,
        role: 'SUPER_ADMIN' 
      });
      const res = mockRes();
      
      // Act
      await verificationMiddleware.requireAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should allow BATCH_ADMIN access without verification', async () => {
      // Arrange
      const batchAdmin = await UserFactory.createAdminUser('BATCH_ADMIN');
      // Make admin unverified to test middleware logic
      await global.testPrisma.user.update({
        where: { id: batchAdmin.id },
        data: { isAlumniVerified: false }
      });
      
      const req = mockReq({}, { 
        ...batchAdmin, 
        isAlumniVerified: false,
        role: 'BATCH_ADMIN' 
      });
      const res = mockRes();
      
      // Act
      await verificationMiddleware.requireAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should block unverified alumni user', async () => {
      // Arrange
      const unverifiedUser = await UserFactory.createUnverifiedUser();
      const req = mockReq({}, unverifiedUser);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.requireAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Alumni verification required'),
          verificationRequired: true,
          status: 'pending'
        })
      );
    });

    test('should handle rejected user verification', async () => {
      // Arrange
      const rejectedUser = await UserFactory.createTestUser({
        isAlumniVerified: false,
        pendingVerification: false,
        isRejected: true
      });
      const req = mockReq({}, rejectedUser);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.requireAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          status: 'rejected'
        })
      );
    });

    test('should require authentication', async () => {
      // Arrange
      const req = mockReq({}, null); // No user
      const res = mockRes();
      
      // Act
      await verificationMiddleware.requireAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Authentication required'
        })
      );
    });
  });

  describe('optionalAlumniVerification', () => {
    test('should add verification context for verified user', async () => {
      // Arrange
      const verifiedUser = await UserFactory.createVerifiedUser();
      const req = mockReq({}, verifiedUser);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.optionalAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.alumniVerification).toEqual({
        isVerified: true,
        isPending: false,
        isRejected: false,
        isAdmin: false,
        hasFullAccess: true
      });
    });

    test('should add verification context for unverified user', async () => {
      // Arrange
      const unverifiedUser = await UserFactory.createUnverifiedUser();
      const req = mockReq({}, unverifiedUser);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.optionalAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.alumniVerification).toEqual({
        isVerified: false,
        isPending: true,
        isRejected: false,
        isAdmin: false,
        hasFullAccess: false
      });
    });

    test('should add verification context for admin user', async () => {
      // Arrange
      const adminUser = await UserFactory.createAdminUser('SUPER_ADMIN');
      const req = mockReq({}, adminUser);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.optionalAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.alumniVerification.isAdmin).toBe(true);
      expect(req.alumniVerification.hasFullAccess).toBe(true);
    });

    test('should continue without user context when no user', async () => {
      // Arrange
      const req = mockReq({}, null);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.optionalAlumniVerification(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.alumniVerification).toBe(null);
    });
  });

  describe('checkEmailBlacklist', () => {
    test('should allow registration with non-blacklisted email', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const req = mockReq(userData);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.checkEmailBlacklist(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should block registration with blacklisted email', async () => {
      // Arrange
      const blacklistedEmail = await AuthFactory.createBlacklistedEmail();
      const userData = UserFactory.createUserData({
        email: blacklistedEmail.email
      });
      const req = mockReq(userData);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.checkEmailBlacklist(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('not eligible for registration'),
          blacklisted: true
        })
      );
      
      // Verify activity log was created
      const activityLog = await global.testPrisma.activityLog.findFirst({
        where: {
          action: 'blacklisted_registration_attempt',
          details: {
            path: ['email'],
            equals: blacklistedEmail.email
          }
        }
      });
      expect(activityLog).toBeTruthy();
    });

    test('should continue when email not provided', async () => {
      // Arrange
      const req = mockReq({}); // No email in body
      const res = mockRes();
      
      // Act
      await verificationMiddleware.checkEmailBlacklist(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateBatchAdminVerificationPermission', () => {
    test('should allow SUPER_ADMIN to verify any user', async () => {
      // Arrange
      const adminUser = await UserFactory.createAdminUser('SUPER_ADMIN');
      const targetUser = await UserFactory.createUnverifiedUser();
      const req = {
        ...mockReq({}, adminUser),
        params: { userId: targetUser.id }
      };
      const res = mockRes();
      
      // Act  
      await verificationMiddleware.validateBatchAdminVerificationPermission(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should block BATCH_ADMIN from verifying users outside their batch', async () => {
      // Arrange
      const batchAdmin = await UserFactory.createTestUser({ 
        role: 'BATCH_ADMIN',
        batch: 2020 
      });
      const targetUser = await UserFactory.createTestUser({ 
        batch: 2021 // Different batch
      });
      const req = {
        ...mockReq({}, batchAdmin),
        params: { userId: targetUser.id }
      };
      const res = mockRes();
      
      // Act
      await verificationMiddleware.validateBatchAdminVerificationPermission(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('should require userId parameter', async () => {
      // Arrange
      const adminUser = await UserFactory.createAdminUser();
      const req = {
        ...mockReq({}, adminUser),
        params: {} // No userId
      };
      const res = mockRes();
      
      // Act
      await verificationMiddleware.validateBatchAdminVerificationPermission(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should reject regular user attempts', async () => {
      // Arrange
      const regularUser = await UserFactory.createTestUser();
      const targetUser = await UserFactory.createUnverifiedUser();
      const req = {
        ...mockReq({}, regularUser),
        params: { userId: targetUser.id }
      };
      const res = mockRes();
      
      // Act
      await verificationMiddleware.validateBatchAdminVerificationPermission(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Insufficient permissions for user verification'
        })
      );
    });
  });

  describe('verificationRateLimit', () => {
    test('should allow requests under rate limit', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const req = mockReq({}, user);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.verificationRateLimit(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should continue for unauthenticated requests', async () => {
      // Arrange
      const req = mockReq({}, null); // No user
      const res = mockRes();
      
      // Act
      await verificationMiddleware.verificationRateLimit(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });
  });
});