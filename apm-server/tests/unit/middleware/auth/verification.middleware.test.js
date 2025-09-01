// tests/unit/middleware/auth/verification.middleware.test.js
// FIXED: Updated imports for professional auth folder structure

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
    // FIXED: Import from auth folder (professional structure)
    verificationMiddleware = require('../../../../src/middleware/auth/alumniVerification.middleware');
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

    test('should reject unverified user', async () => {
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

  describe('checkEmailBlacklist', () => {
    test('should allow registration with non-blacklisted email', async () => {
      // Arrange
      const registrationData = AuthFactory.createValidRegistrationData();
      const req = mockReq(registrationData);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.checkEmailBlacklist(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject registration with blacklisted email', async () => {
      // Arrange
      const blacklistedEmail = 'blacklisted@test.com';
      await AuthFactory.createBlacklistedEmail(blacklistedEmail, 'Test blacklist');
      
      const registrationData = AuthFactory.createValidRegistrationData({
        email: blacklistedEmail
      });
      const req = mockReq(registrationData);
      const res = mockRes();
      
      // Act
      await verificationMiddleware.checkEmailBlacklist(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'This email address is not allowed to register'
        })
      );
    });
  });
});