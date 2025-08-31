// tests/utils/testHelpers.js
const request = require('supertest');
const app = require('../../src/app');

/**
 * Test helper utilities for authentication tests
 */
class AuthTestHelpers {
  /**
   * Create test user, return tokens
   * @param {Object} userData - User registration data
   * @returns {Object} - User and tokens
   */
  static async createAndLoginUser(userData = null) {
    const { UserFactory } = require('../factories');
    
    if (!userData) {
      userData = UserFactory.createUserData();
    }
    
    // Ensure batch exists
    await UserFactory.createTestBatch(userData.batch);
    
    // Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);
    
    return {
      user: registerResponse.body.data.user,
      tokens: registerResponse.body.data.tokens,
      originalPassword: userData.password
    };
  }

  /**
   * Login existing user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} - Login response data
   */
  static async loginUser(email, password) {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    
    return response.body.data;
  }

  /**
   * Make authenticated request
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {string} token - Access token
   * @param {Object} data - Request data
   * @returns {Object} - Response
   */
  static async authenticatedRequest(method, url, token, data = {}) {
    const req = request(app)[method.toLowerCase()](url)
      .set('Authorization', `Bearer ${token}`);
    
    if (method.toUpperCase() !== 'GET' && Object.keys(data).length > 0) {
      req.send(data);
    }
    
    return req;
  }

  /**
   * Verify JWT token structure
   * @param {string} token - JWT token
   * @returns {Object} - Decoded token
   */
  static verifyTokenStructure(token) {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    
    expect(decoded).toHaveProperty('userId');
    expect(decoded).toHaveProperty('type');
    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
    
    return decoded;
  }

  /**
   * Wait for specified time (useful for rate limiting tests)
   * @param {number} ms - Milliseconds to wait
   */
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create multiple test users for bulk testing
   * @param {number} count - Number of users to create
   * @param {Object} baseData - Base user data
   * @returns {Array} - Array of created users
   */
  static async createMultipleUsers(count = 5, baseData = {}) {
    const { UserFactory } = require('../factories');
    const users = [];
    
    for (let i = 0; i < count; i++) {
      const userData = UserFactory.createUserData({
        ...baseData,
        email: `testuser${i}@example.com`
      });
      
      const user = await UserFactory.createTestUser(userData);
      users.push({
        ...user,
        originalPassword: userData.password
      });
    }
    
    return users;
  }

  /**
   * Clean up test data for specific user
   * @param {string} userId - User ID to clean up
   */
  static async cleanupUser(userId) {
    await global.testPrisma.activityLog.deleteMany({
      where: { userId }
    });
    
    await global.testPrisma.user.delete({
      where: { id: userId }
    });
  }
}

/**
 * Database test utilities
 */
class DatabaseTestHelpers {
  /**
   * Count records in table
   * @param {string} tableName - Table name
   * @param {Object} where - Where clause
   * @returns {number} - Record count
   */
  static async countRecords(tableName, where = {}) {
    return await global.testPrisma[tableName].count({ where });
  }

  /**
   * Check if record exists
   * @param {string} tableName - Table name
   * @param {Object} where - Where clause
   * @returns {boolean} - Record exists
   */
  static async recordExists(tableName, where) {
    const record = await global.testPrisma[tableName].findFirst({ where });
    return !!record;
  }

  /**
   * Get latest activity log for user
   * @param {string} userId - User ID
   * @param {string} action - Action type (optional)
   * @returns {Object} - Activity log record
   */
  static async getLatestActivityLog(userId, action = null) {
    const where = { userId };
    if (action) {
      where.action = action;
    }
    
    return await global.testPrisma.activityLog.findFirst({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Verify activity log was created
   * @param {string} userId - User ID
   * @param {string} action - Expected action
   * @returns {boolean} - Activity log exists
   */
  static async verifyActivityLogged(userId, action) {
    const log = await this.getLatestActivityLog(userId, action);
    return !!log;
  }

  /**
   * Clean all test data
   */
  static async cleanAllTestData() {
    const tables = ['activityLog', 'blacklistedEmail', 'user', 'batch'];
    
    for (const table of tables) {
      try {
        await global.testPrisma[table].deleteMany({});
      } catch (error) {
        console.warn(`Failed to clean ${table}:`, error.message);
      }
    }
  }
}

/**
 * Validation test helpers
 */
class ValidationTestHelpers {
  /**
   * Test validation errors
   * @param {Object} response - Test response
   * @param {Array} expectedFields - Expected error fields
   */
  static expectValidationErrors(response, expectedFields = []) {
    expect(response.body.success).toBe(false);
    expect(response.body.errors).toBeDefined();
    
    if (expectedFields.length > 0) {
      const errorFields = response.body.errors.map(err => err.field);
      expectedFields.forEach(field => {
        expect(errorFields).toContain(field);
      });
    }
  }

  /**
   * Generate invalid test data scenarios
   * @param {Object} validData - Valid base data
   * @returns {Array} - Array of invalid data scenarios
   */
  static generateInvalidDataScenarios(validData) {
    return [
      // Missing required fields
      { ...validData, email: undefined, scenario: 'missing email' },
      { ...validData, password: undefined, scenario: 'missing password' },
      { ...validData, fullName: undefined, scenario: 'missing fullName' },
      { ...validData, batch: undefined, scenario: 'missing batch' },
      
      // Invalid formats
      { ...validData, email: 'invalid-email', scenario: 'invalid email format' },
      { ...validData, password: '123', scenario: 'weak password' },
      { ...validData, fullName: '', scenario: 'empty fullName' },
      { ...validData, batch: 'invalid', scenario: 'invalid batch type' },
      
      // Edge cases
      { ...validData, email: 'a'.repeat(100) + '@example.com', scenario: 'very long email' },
      { ...validData, fullName: 'a'.repeat(200), scenario: 'very long name' },
      { ...validData, batch: 1900, scenario: 'very old batch' },
      { ...validData, batch: 2050, scenario: 'future batch' }
    ];
  }
}

/**
 * Mock helpers for testing
 */
class MockHelpers {
  /**
   * Mock external service calls
   */
  static mockExternalServices() {
    // Mock email service
    jest.mock('../../src/services/notification.service', () => ({
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
      sendVerificationEmail: jest.fn().mockResolvedValue(true)
    }));
    
    // Mock Redis if not available
    if (!global.testRedis) {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        flushdb: jest.fn().mockResolvedValue('OK')
      };
      global.testRedis = mockRedis;
    }
  }

  /**
   * Restore all mocks
   */
  static restoreMocks() {
    jest.restoreAllMocks();
  }
}

/**
 * Performance test helpers
 */
class PerformanceTestHelpers {
  /**
   * Measure endpoint response time
   * @param {Function} requestFunction - Function that makes request
   * @returns {Object} - Response and timing info
   */
  static async measureResponseTime(requestFunction) {
    const startTime = Date.now();
    const response = await requestFunction();
    const endTime = Date.now();
    
    return {
      response,
      responseTime: endTime - startTime,
      isUnderThreshold: (endTime - startTime) < 1000 // 1 second threshold
    };
  }

  /**
   * Run concurrent requests
   * @param {Function} requestFunction - Function that makes request
   * @param {number} concurrency - Number of concurrent requests
   * @returns {Array} - Array of responses
   */
  static async runConcurrentRequests(requestFunction, concurrency = 10) {
    const promises = Array(concurrency).fill().map(() => requestFunction());
    return await Promise.all(promises);
  }
}

module.exports = {
  AuthTestHelpers,
  DatabaseTestHelpers,
  ValidationTestHelpers,
  MockHelpers,
  PerformanceTestHelpers
};