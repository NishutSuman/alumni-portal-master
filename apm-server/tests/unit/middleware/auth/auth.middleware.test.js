// tests/unit/middleware/auth/auth.middleware.test.js
const { UserFactory } = require('../../../factories');

// Mock response object
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mock request object
const mockReq = (headers = {}, user = null) => ({
  headers,
  user,
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('test-user-agent')
});

// Mock next function
const mockNext = jest.fn();

describe('Authentication Middleware Unit Tests', () => {
  let authMiddleware;
  
  beforeAll(() => {
    // Import your existing middleware
    authMiddleware = require('../../../../src/middleware/auth.middleware');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    test('should authenticate user with valid JWT token', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const token = UserFactory.generateTestToken(user.id);
      const req = mockReq({
        authorization: `Bearer ${token}`
      });
      const res = mockRes();
      
      // Act
      await authMiddleware.authenticateToken(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe(user.email);
      expect(req.user.id).toBe(user.id);
    });

    test('should reject request without authorization header', async () => {
      // Arrange
      const req = mockReq({});
      const res = mockRes();
      
      // Act
      await authMiddleware.authenticateToken(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Access token required'
        })
      );
    });

    test('should reject request with invalid token', async () => {
      // Arrange
      const req = mockReq({
        authorization: 'Bearer invalid-token'
      });
      const res = mockRes();
      
      // Act
      await authMiddleware.authenticateToken(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid token'
        })
      );
    });

    test('should reject expired JWT token', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const expiredToken = UserFactory.generateExpiredToken(user.id);
      const req = mockReq({
        authorization: `Bearer ${expiredToken}`
      });
      const res = mockRes();
      
      // Act
      await authMiddleware.authenticateToken(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Token expired'
        })
      );
    });

    test('should reject token for non-existent user', async () => {
      // Arrange
      const fakeUserId = 'non-existent-user-id';
      const token = UserFactory.generateTestToken(fakeUserId);
      const req = mockReq({
        authorization: `Bearer ${token}`
      });
      const res = mockRes();
      
      // Act
      await authMiddleware.authenticateToken(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'User not found'
        })
      );
    });

    test('should reject token for deactivated user', async () => {
      // Arrange
      const user = await UserFactory.createTestUser({ isActive: false });
      const token = UserFactory.generateTestToken(user.id);
      const req = mockReq({
        authorization: `Bearer ${token}`
      });
      const res = mockRes();
      
      // Act
      await authMiddleware.authenticateToken(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Account is deactivated'
        })
      );
    });
  });

  describe('requireRole', () => {
    test('should allow user with required role', async () => {
      // Arrange
      const adminUser = await UserFactory.createAdminUser('SUPER_ADMIN');
      const req = mockReq({}, adminUser);
      const res = mockRes();
      const middleware = authMiddleware.requireRole('SUPER_ADMIN');
      
      // Act
      middleware(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should allow user with one of multiple required roles', async () => {
      // Arrange
      const adminUser = await UserFactory.createAdminUser('BATCH_ADMIN');
      const req = mockReq({}, adminUser);
      const res = mockRes();
      const middleware = authMiddleware.requireRole(['SUPER_ADMIN', 'BATCH_ADMIN']);
      
      // Act
      middleware(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject user without required role', async () => {
      // Arrange
      const regularUser = await UserFactory.createTestUser({ role: 'ALUMNI' });
      const req = mockReq({}, regularUser);
      const res = mockRes();
      const middleware = authMiddleware.requireRole('SUPER_ADMIN');
      
      // Act
      middleware(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Insufficient permissions'
        })
      );
    });

    test('should reject unauthenticated request', async () => {
      // Arrange
      const req = mockReq({}); // No user
      const res = mockRes();
      const middleware = authMiddleware.requireRole('SUPER_ADMIN');
      
      // Act
      middleware(req, res, mockNext);
      
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

  describe('optionalAuth', () => {
    test('should add user to request with valid token', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const token = UserFactory.generateTestToken(user.id);
      const req = mockReq({
        authorization: `Bearer ${token}`
      });
      const res = mockRes();
      
      // Act
      await authMiddleware.optionalAuth(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe(user.email);
    });

    test('should continue without user for invalid token', async () => {
      // Arrange
      const req = mockReq({
        authorization: 'Bearer invalid-token'
      });
      const res = mockRes();
      
      // Act
      await authMiddleware.optionalAuth(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    test('should continue without user when no token provided', async () => {
      // Arrange
      const req = mockReq({});
      const res = mockRes();
      
      // Act
      await authMiddleware.optionalAuth(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });

  describe('requireBatchAdmin', () => {
    test('should allow SUPER_ADMIN access to any batch', async () => {
      // Arrange
      const adminUser = await UserFactory.createAdminUser('SUPER_ADMIN');
      const batch = await UserFactory.createTestBatch(2020);
      const req = {
        ...mockReq({}, adminUser),
        params: { batchId: batch.id }
      };
      const res = mockRes();
      
      // Act
      await authMiddleware.requireBatchAdmin(req, res, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test('should require batchId parameter', async () => {
      // Arrange
      const batchAdmin = await UserFactory.createAdminUser('BATCH_ADMIN');
      const req = {
        ...mockReq({}, batchAdmin),
        params: {} // No batchId
      };
      const res = mockRes();
      
      // Act
      await authMiddleware.requireBatchAdmin(req, res, mockNext);
      
      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Batch ID required'
        })
      );
    });
  });
});