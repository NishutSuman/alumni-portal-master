// tests/unit/middleware/auth/auth.middleware.test.js
// FIXED: Updated imports for professional auth folder structure

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
    // FIXED: Import from auth folder (professional structure)
    authMiddleware = require('../../../../src/middleware/auth/auth.middleware');
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
    });
  });
});