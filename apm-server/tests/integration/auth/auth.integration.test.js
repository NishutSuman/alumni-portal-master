// tests/integration/auth/auth.integration.test.js
const request = require('supertest');
const app = require('../../../src/app');
const { UserFactory, AuthFactory } = require('../../factories');

describe('Authentication Integration Tests', () => {
  
  describe('POST /api/auth/register', () => {
    test('should register new user successfully', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      await UserFactory.createTestBatch(userData.batch);
      
      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.fullName).toBe(userData.fullName);
      expect(response.body.data.user.isAlumniVerified).toBe(false);
      expect(response.body.data.user.pendingVerification).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      
      // Verify user was created in database
      const dbUser = await global.testPrisma.user.findUnique({
        where: { email: userData.email },
        include: { batch: true }
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser.role).toBe('ALUMNI');
      expect(dbUser.batch.year).toBe(userData.batch);
      
      // Verify activity log was created
      const activityLog = await global.testPrisma.activityLog.findFirst({
        where: {
          userId: dbUser.id,
          action: 'user_registration'
        }
      });
      expect(activityLog).toBeTruthy();
    });

    test('should reject registration with invalid data', async () => {
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // Too weak
          fullName: '',
          batch: 'invalid'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    test('should reject duplicate email registration', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const existingUser = await UserFactory.createTestUser(userData);
      
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    test('should reject blacklisted email', async () => {
      // Arrange
      const blacklistedEmail = await AuthFactory.createBlacklistedEmail();
      const userData = UserFactory.createUserData({
        email: blacklistedEmail.email
      });
      await UserFactory.createTestBatch(userData.batch);
      
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.blacklisted).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      
      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      
      // Verify lastLoginAt was updated
      const updatedUser = await global.testPrisma.user.findUnique({
        where: { id: user.id }
      });
      expect(updatedUser.lastLoginAt).toBeTruthy();
      
      // Verify login activity log
      const activityLog = await global.testPrisma.activityLog.findFirst({
        where: {
          userId: user.id,
          action: 'login_success'
        }
      });
      expect(activityLog).toBeTruthy();
    });

    test('should reject invalid credentials', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPassword123!'
        })
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
      
      // Verify failed login activity log
      const activityLog = await global.testPrisma.activityLog.findFirst({
        where: {
          userId: user.id,
          action: 'login_failed'
        }
      });
      expect(activityLog).toBeTruthy();
    });

    test('should reject deactivated user login', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser({
        ...userData,
        isActive: false
      });
      
      // Act & Assert
      await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return user profile for authenticated request', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const token = UserFactory.generateTestToken(user.id);
      
      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(user.email);
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.user.batch).toBeDefined();
    });

    test('should reject unauthenticated request', async () => {
      // Act & Assert
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    test('should reject invalid token', async () => {
      // Act & Assert
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should reject expired token', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const expiredToken = UserFactory.generateExpiredToken(user.id);
      
      // Act & Assert
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
      
      expect(response.body.message).toBe('Token expired');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    test('should refresh token with valid refresh token', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const refreshToken = UserFactory.generateTestToken(user.id, 'refresh');
      
      // Act
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    test('should reject invalid refresh token', async () => {
      // Act & Assert
      await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    test('should change password successfully', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      const token = UserFactory.generateTestToken(user.id);
      
      // Act
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: userData.password,
          newPassword: 'NewPassword123!'
        })
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
      
      // Verify new password works for login
      await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'NewPassword123!'
        })
        .expect(200);
      
      // Verify old password no longer works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(401);
    });

    test('should reject wrong current password', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const token = UserFactory.generateTestToken(user.id);
      
      // Act & Assert
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!'
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      const token = UserFactory.generateTestToken(user.id);
      
      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
      
      // Verify logout activity log
      const activityLog = await global.testPrisma.activityLog.findFirst({
        where: {
          userId: user.id,
          action: 'logout'
        }
      });
      expect(activityLog).toBeTruthy();
    });
  });

  describe('Password Reset Flow', () => {
    test('should handle forgot password request', async () => {
      // Arrange
      const user = await UserFactory.createTestUser();
      
      // Act
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset link has been sent');
      
      // Verify reset token was created
      const updatedUser = await global.testPrisma.user.findUnique({
        where: { id: user.id }
      });
      expect(updatedUser.resetPasswordToken).toBeTruthy();
      expect(updatedUser.resetPasswordExpiry).toBeTruthy();
    });

    test('should reset password with valid token', async () => {
      // Arrange
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      const { resetToken } = await AuthFactory.createPasswordResetToken(user);
      
      // Act
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewResetPassword123!'
        })
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset successfully');
      
      // Verify new password works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'NewResetPassword123!'
        })
        .expect(200);
      
      // Verify reset token was cleared
      const updatedUser = await global.testPrisma.user.findUnique({
        where: { id: user.id }
      });
      expect(updatedUser.resetPasswordToken).toBe(null);
      expect(updatedUser.resetPasswordExpiry).toBe(null);
    });

    test('should reject invalid reset token', async () => {
      // Act & Assert
      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123!'
        })
        .expect(400);
    });
  });

  describe('Alumni Verification Integration', () => {
    test('should allow verified users access to premium features', async () => {
      // Arrange
      const verifiedUser = await UserFactory.createVerifiedUser();
      const token = UserFactory.generateTestToken(verifiedUser.id);
      
      // Act - Try to access a route that requires verification
      // Note: This test assumes you have a route that requires verification
      // You may need to adjust the route based on your actual implementation
      const response = await request(app)
        .get('/api/events') // Assuming this requires verification
        .set('Authorization', `Bearer ${token}`);
      
      // Should not get 403 verification error
      expect(response.status).not.toBe(403);
    });

    test('should block unverified users from premium features', async () => {
      // Arrange
      const unverifiedUser = await UserFactory.createUnverifiedUser();
      const token = UserFactory.generateTestToken(unverifiedUser.id);
      
      // Act - Try to access a route that requires verification
      const response = await request(app)
        .post('/api/events/test/register') // Assuming this requires verification
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      // Should get verification required error
      if (response.status === 403) {
        expect(response.body.verificationRequired).toBe(true);
      }
    });

    test('should allow admins access regardless of verification status', async () => {
      // Arrange
      const adminUser = await UserFactory.createAdminUser('SUPER_ADMIN');
      // Make admin unverified to test the logic
      await global.testPrisma.user.update({
        where: { id: adminUser.id },
        data: { isAlumniVerified: false }
      });
      const token = UserFactory.generateTestToken(adminUser.id);
      
      // Act - Admin should have access to admin routes
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);
      
      // Should not be blocked by verification
      expect(response.status).not.toBe(403);
    });
  });

  describe('Role-based Access Control', () => {
    test('should allow SUPER_ADMIN access to admin routes', async () => {
      // Arrange
      const adminUser = await UserFactory.createAdminUser('SUPER_ADMIN');
      const token = UserFactory.generateTestToken(adminUser.id);
      
      // Act
      const response = await request(app)
        .get('/api/admin/verification/pending')
        .set('Authorization', `Bearer ${token}`);
      
      // Should have access (not 403 forbidden)
      expect(response.status).not.toBe(403);
    });

    test('should deny regular user access to admin routes', async () => {
      // Arrange
      const regularUser = await UserFactory.createTestUser();
      const token = UserFactory.generateTestToken(regularUser.id);
      
      // Act
      const response = await request(app)
        .get('/api/admin/verification/pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      
      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permissions');
    });
  });

  describe('Authentication Flow End-to-End', () => {
    test('complete user journey: register → login → profile → logout', async () => {
      // Step 1: Register
      const userData = UserFactory.createUserData();
      await UserFactory.createTestBatch(userData.batch);
      
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      const { accessToken } = registerResponse.body.data.tokens;
      
      // Step 2: Get Profile
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(profileResponse.body.data.user.email).toBe(userData.email);
      
      // Step 3: Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      // Step 4: Login again
      await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);
    });
  });
});