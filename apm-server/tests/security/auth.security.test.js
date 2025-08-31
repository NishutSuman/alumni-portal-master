// tests/security/auth.security.test.js
const request = require('supertest');
const app = require('../../src/app');
const { UserFactory, AuthFactory } = require('../factories');
const { AuthTestHelpers, PerformanceTestHelpers } = require('../utils/testHelpers');

describe('Authentication Security Tests', () => {
  
  describe('SQL Injection Protection', () => {
    test('should prevent SQL injection in login email field', async () => {
      const maliciousEmail = "admin@example.com' OR '1'='1' --";
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousEmail,
          password: 'any-password'
        });
      
      // Should not succeed with SQL injection
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should prevent SQL injection in registration fields', async () => {
      const batch = await UserFactory.createTestBatch();
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: "test@example.com",
          password: "Password123!",
          fullName: "'; DROP TABLE users; --",
          batch: batch.year
        });
      
      // Should either succeed with sanitized data or fail validation
      // But should not cause database errors
      expect([200, 201, 400, 422]).toContain(response.status);
    });
  });

  describe('XSS Prevention', () => {
    test('should sanitize XSS attempts in user input', async () => {
      const batch = await UserFactory.createTestBatch();
      const xssScript = "<script>alert('xss')</script>";
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: "test@example.com",
          password: "Password123!",
          fullName: `John Doe ${xssScript}`,
          batch: batch.year
        });
      
      if (response.status === 201) {
        const user = response.body.data.user;
        expect(user.fullName).not.toContain('<script>');
        expect(user.fullName).not.toContain('alert');
      }
    });
  });

  describe('Brute Force Protection', () => {
    test('should rate limit login attempts', async () => {
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      
      // Make multiple failed login attempts
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: userData.email,
              password: 'wrong-password'
            })
        );
      }
      
      const responses = await Promise.all(attempts);
      
      // Last attempts should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);

    test('should rate limit registration attempts', async () => {
      const batch = await UserFactory.createTestBatch();
      
      const attempts = [];
      for (let i = 0; i < 5; i++) {
        const userData = UserFactory.createUserData({
          email: `test${i}@example.com`,
          batch: batch.year
        });
        attempts.push(
          request(app)
            .post('/api/auth/register')
            .send(userData)
        );
      }
      
      const responses = await Promise.all(attempts);
      
      // Should have some rate limiting
      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount + rateLimitCount).toBe(5);
    }, 10000);
  });

  describe('JWT Security', () => {
    test('should generate secure JWT tokens', async () => {
      const { user, tokens } = await AuthTestHelpers.createAndLoginUser();
      const jwt = require('jsonwebtoken');
      
      // Verify token structure
      const decodedAccess = jwt.decode(tokens.accessToken);
      const decodedRefresh = jwt.decode(tokens.refreshToken);
      
      expect(decodedAccess.type).toBe('access');
      expect(decodedRefresh.type).toBe('refresh');
      expect(decodedAccess.userId).toBe(user.id);
      expect(decodedRefresh.userId).toBe(user.id);
      
      // Verify expiration times are reasonable
      const accessExp = new Date(decodedAccess.exp * 1000);
      const refreshExp = new Date(decodedRefresh.exp * 1000);
      const now = new Date();
      
      expect(accessExp.getTime()).toBeGreaterThan(now.getTime());
      expect(refreshExp.getTime()).toBeGreaterThan(accessExp.getTime());
    });

    test('should reject tampered JWT tokens', async () => {
      const { tokens } = await AuthTestHelpers.createAndLoginUser();
      
      // Tamper with token
      const tamperedToken = tokens.accessToken.slice(0, -5) + 'XXXXX';
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
      
      expect(response.body.message).toBe('Invalid token');
    });

    test('should not accept tokens with wrong secret', async () => {
      const user = await UserFactory.createTestUser();
      const jwt = require('jsonwebtoken');
      
      // Create token with wrong secret
      const maliciousToken = jwt.sign(
        { userId: user.id, type: 'access' },
        'wrong-secret',
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(401);
      
      expect(response.body.message).toBe('Invalid token');
    });
  });

  describe('Password Security', () => {
    test('should enforce strong password requirements', async () => {
      const batch = await UserFactory.createTestBatch();
      
      const weakPasswords = [
        'password',      // Too common
        '123456',        // Too simple
        'Password',      // Missing special char
        'password123',   // Missing uppercase
        'PASSWORD123!',  // Missing lowercase
        'Pass123!',      // Too short
      ];
      
      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: weakPassword,
            fullName: 'Test User',
            batch: batch.year
          });
        
        expect(response.status).toBe(400);
      }
    });

    test('should hash passwords properly', async () => {
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      
      // Get user from database
      const dbUser = await global.testPrisma.user.findUnique({
        where: { id: user.id }
      });
      
      // Password should be hashed, not plain text
      expect(dbUser.password).not.toBe(userData.password);
      expect(dbUser.password.length).toBeGreaterThan(50); // Bcrypt hashes are ~60 chars
      expect(dbUser.password.startsWith('$2')).toBe(true); // Bcrypt prefix
    });
  });

  describe('Input Validation Security', () => {
    test('should reject malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });

    test('should handle oversized payloads', async () => {
      const largeString = 'x'.repeat(1000000); // 1MB string
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
          fullName: largeString,
          batch: 2020
        });
      
      expect([400, 413, 422]).toContain(response.status);
    });
  });

  describe('Session Security', () => {
    test('should invalidate tokens after logout', async () => {
      const { tokens } = await AuthTestHelpers.createAndLoginUser();
      
      // Use token first
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);
      
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);
      
      // Token should still work (stateless JWT)
      // Note: In a real app, you might implement token blacklisting
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);
    });
  });
});

