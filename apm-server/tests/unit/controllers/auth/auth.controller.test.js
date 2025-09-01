// tests/unit/controllers/auth/auth.controller.test.js
// FIXED: Updated imports for professional auth folder structure

const { UserFactory, AuthFactory } = require('../../../factories');

// Mock the response object
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mock the request object
const mockReq = (body = {}, user = null, params = {}, ip = '127.0.0.1') => ({
  body,
  user,
  params,
  ip,
  get: jest.fn().mockReturnValue('test-user-agent')
});

describe('Authentication Controller Unit Tests', () => {
  let authController;
  
  beforeAll(() => {
    // FIXED: Import from auth folder (professional structure) 
    authController = require('../../../../src/controllers/auth/auth.controller');
  });

  describe('register', () => {
    test('should register new user with valid data', async () => {
      // Arrange
      const userData = AuthFactory.createRegistrationData();
      const batch = await UserFactory.createTestBatch(userData.batch);
      const req = mockReq(userData);
      const res = mockRes();
      
      // Act
      await authController.register(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'User registered successfully'
        })
      );
    });

    test('should reject registration with duplicate email', async () => {
      // Arrange
      const existingUser = await UserFactory.createTestUser();
      const userData = AuthFactory.createRegistrationData({
        email: existingUser.email
      });
      const req = mockReq(userData);
      const res = mockRes();
      
      // Act
      await authController.register(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'User already exists with this email'
        })
      );
    });
  });

  describe('login', () => {
    test('should login user with valid credentials', async () => {
      // Arrange
      const userWithCreds = await AuthFactory.createUserWithCredentials();
      const req = mockReq(userWithCreds.credentials);
      const res = mockRes();
      
      // Act
      await authController.login(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Login successful'
        })
      );
    });

    test('should reject login with invalid credentials', async () => {
      // Arrange
      const invalidLogin = AuthFactory.createInvalidLoginData('wrong_password');
      const req = mockReq(invalidLogin);
      const res = mockRes();
      
      // Act
      await authController.login(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid credentials'
        })
      );
    });
  });

  describe('getCurrentUser', () => {
    test('should return current user data', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const req = mockReq({}, user);
      const res = mockRes();
      
      // Act
      await authController.getCurrentUser(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: user.id,
              email: user.email
            })
          })
        })
      );
    });
  });
});