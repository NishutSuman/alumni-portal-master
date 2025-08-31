// tests/unit/controllers/auth/auth.controller.test.js
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
    // Import your existing controller
    authController = require('../../../../src/controllers/auth.controller');
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
          message: 'User registered successfully',
          data: expect.objectContaining({
            user: expect.objectContaining({
              email: userData.email,
              fullName: userData.fullName
            }),
            tokens: expect.objectContaining({
              accessToken: expect.any(String),
              refreshToken: expect.any(String)
            })
          })
        })
      );
      
      // Verify user created in database
      const dbUser = await global.testPrisma.user.findUnique({
        where: { email: userData.email }
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser.role).toBe('ALUMNI');
    });

    test('should reject registration with missing required fields', async () => {
      // Arrange
      const incompleteData = { email: 'test@example.com' }; // Missing other fields
      const req = mockReq(incompleteData);
      const res = mockRes();
      
      // Act
      await authController.register(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('required')
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
          message: expect.stringContaining('already exists')
        })
      );
    });

    test('should reject registration with invalid batch', async () => {
      // Arrange
      const userData = AuthFactory.createRegistrationData({
        batch: 9999 // Non-existent batch
      });
      const req = mockReq(userData);
      const res = mockRes();
      
      // Act
      await authController.register(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Invalid batch year')
        })
      );
    });
  });

  describe('login', () => {
    test('should login with valid credentials', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      const loginData = AuthFactory.createLoginCredentials(user, userData.password);
      const req = mockReq(loginData);
      const res = mockRes();
      
      // Act
      await authController.login(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Login successful',
          data: expect.objectContaining({
            user: expect.objectContaining({
              email: user.email,
              id: user.id
            }),
            tokens: expect.objectContaining({
              accessToken: expect.any(String),
              refreshToken: expect.any(String)
            })
          })
        })
      );
      
      // Ensure password is not returned
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.user.password).toBeUndefined();
    });

    test('should reject login with wrong password', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const loginData = AuthFactory.createLoginCredentials(user, 'WrongPassword123!');
      const req = mockReq(loginData);
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

    test('should reject login with non-existent email', async () => {
      // Arrange
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SomePassword123!'
      };
      const req = mockReq(loginData);
      const res = mockRes();
      
      // Act
      await authController.login(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Invalid credentials')
        })
      );
    });

    test('should reject login for deactivated user', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser({
        ...userData,
        isActive: false
      });
      const loginData = AuthFactory.createLoginCredentials(user, userData.password);
      const req = mockReq(loginData);
      const res = mockRes();
      
      // Act
      await authController.login(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('getCurrentUser', () => {
    test('should return current user profile', async () => {
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
          message: expect.stringContaining('retrieved successfully'),
          data: expect.objectContaining({
            user: expect.objectContaining({
              email: user.email,
              fullName: user.fullName,
              role: user.role
            })
          })
        })
      );
    });

    test('should handle user not found', async () => {
      // Arrange
      const fakeUser = { id: 'non-existent-id' };
      const req = mockReq({}, fakeUser);
      const res = mockRes();
      
      // Act
      await authController.getCurrentUser(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'User not found'
        })
      );
    });
  });

  describe('changePassword', () => {
    test('should change password with valid current password', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      const changeData = {
        currentPassword: userData.password,
        newPassword: 'NewPassword123!'
      };
      const req = mockReq(changeData, user);
      const res = mockRes();
      
      // Act
      await authController.changePassword(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password changed successfully'
        })
      );
      
      // Verify activity log was created
      const activityLog = await global.testPrisma.activityLog.findFirst({
        where: {
          userId: user.id,
          action: 'password_changed'
        }
      });
      expect(activityLog).toBeTruthy();
    });

    test('should reject password change with wrong current password', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const changeData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!'
      };
      const req = mockReq(changeData, user);
      const res = mockRes();
      
      // Act
      await authController.changePassword(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Current password is incorrect'
        })
      );
    });
  });

  describe('refreshToken', () => {
    test('should refresh token with valid refresh token', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const refreshToken = UserFactory.generateTestToken(user.id, 'refresh');
      const req = mockReq({ refreshToken });
      const res = mockRes();
      
      // Act
      await authController.refreshToken(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Token refreshed successfully',
          data: expect.objectContaining({
            tokens: expect.objectContaining({
              accessToken: expect.any(String),
              refreshToken: expect.any(String)
            })
          })
        })
      );
    });

    test('should reject invalid refresh token', async () => {
      // Arrange
      const req = mockReq({ refreshToken: 'invalid-token' });
      const res = mockRes();
      
      // Act
      await authController.refreshToken(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Invalid')
        })
      );
    });
  });

  describe('logout', () => {
    test('should logout user successfully', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const req = mockReq({}, user);
      const res = mockRes();
      
      // Act
      await authController.logout(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logged out successfully'
        })
      );
      
      // Verify logout activity log was created
      const activityLog = await global.testPrisma.activityLog.findFirst({
        where: {
          userId: user.id,
          action: 'logout'
        }
      });
      expect(activityLog).toBeTruthy();
    });
  });

  describe('forgotPassword', () => {
    test('should handle forgot password request for existing user', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const req = mockReq({ email: user.email });
      const res = mockRes();
      
      // Act
      await authController.forgotPassword(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('reset link has been sent')
        })
      );
      
      // Verify reset token was created
      const updatedUser = await global.testPrisma.user.findUnique({
        where: { id: user.id },
        select: {
          resetPasswordToken: true,
          resetPasswordExpiry: true
        }
      });
      expect(updatedUser.resetPasswordToken).toBeTruthy();
      expect(updatedUser.resetPasswordExpiry).toBeTruthy();
    });

    test('should handle forgot password for non-existent email gracefully', async () => {
      // Arrange
      const req = mockReq({ email: 'nonexistent@example.com' });
      const res = mockRes();
      
      // Act
      await authController.forgotPassword(req, res);
      
      // Assert - Should return success for security (don't reveal if email exists)
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('reset link has been sent')
        })
      );
    });
  });

  describe('resetPassword', () => {
    test('should reset password with valid token', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const { resetToken } = await AuthFactory.createPasswordResetToken(user);
      const req = mockReq({
        token: resetToken,
        newPassword: 'NewSecurePassword123!'
      });
      const res = mockRes();
      
      // Act
      await authController.resetPassword(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password reset successfully'
        })
      );
      
      // Verify reset token was cleared
      const updatedUser = await global.testPrisma.user.findUnique({
        where: { id: user.id },
        select: {
          resetPasswordToken: true,
          resetPasswordExpiry: true
        }
      });
      expect(updatedUser.resetPasswordToken).toBe(null);
      expect(updatedUser.resetPasswordExpiry).toBe(null);
    });

    test('should reject reset with invalid token', async () => {
      // Arrange
      const req = mockReq({
        token: 'invalid-token',
        newPassword: 'NewPassword123!'
      });
      const res = mockRes();
      
      // Act
      await authController.resetPassword(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Invalid or expired')
        })
      );
    });
  });
});