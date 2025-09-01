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
      const userData = UserFactory.createUserData(baseData);
      await UserFactory.createTestBatch(userData.batch);
      const user = await UserFactory.createTestUser(userData);
      users.push(user);
    }
    
    return users;
  }

  /**
   * Clean up test users after test
   * @param {Array} userIds - Array of user IDs to clean up
   */
  static async cleanupUsers(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return;
    
    try {
      await global.testPrisma.user.deleteMany({
        where: {
          id: {
            in: userIds
          }
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup test users:', error.message);
    }
  }
}

/**
 * Test helper utilities for performance testing
 */
class PerformanceTestHelpers {
  /**
   * Measure endpoint response time
   * @param {Function} requestFunction - Function that makes the request
   * @returns {Object} - Response and timing data
   */
  static async measureResponseTime(requestFunction) {
    const startTime = Date.now();
    const response = await requestFunction();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      response,
      responseTime,
      startTime,
      endTime
    };
  }

  /**
   * Run concurrent requests for load testing
   * @param {Function} requestFunction - Function that makes the request
   * @param {number} concurrency - Number of concurrent requests
   * @returns {Array} - Array of response times
   */
  static async runConcurrentRequests(requestFunction, concurrency = 10) {
    const promises = Array(concurrency).fill(null).map(() => 
      this.measureResponseTime(requestFunction)
    );
    
    const results = await Promise.all(promises);
    
    const responseTimes = results.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    return {
      results,
      responseTimes,
      avgResponseTime,
      maxResponseTime,
      minResponseTime,
      concurrency
    };
  }

  /**
   * Check for memory leaks during user operations
   * @param {Function} operationFunction - Function to test for memory leaks
   * @param {number} iterations - Number of iterations to run
   * @returns {Object} - Memory usage data
   */
  static async checkMemoryUsage(operationFunction, iterations = 100) {
    const initialMemory = process.memoryUsage();
    
    for (let i = 0; i < iterations; i++) {
      await operationFunction();
      
      // Force garbage collection every 10 iterations if available
      if (i % 10 === 0 && global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage();
    
    return {
      initialMemory,
      finalMemory,
      memoryIncrease: {
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        external: finalMemory.external - initialMemory.external,
        rss: finalMemory.rss - initialMemory.rss
      },
      iterations
    };
  }

  /**
   * Assert response time is within acceptable limits
   * @param {number} responseTime - Response time in milliseconds
   * @param {number} maxTime - Maximum acceptable time in milliseconds
   * @param {string} endpoint - Endpoint name for error message
   */
  static assertResponseTime(responseTime, maxTime, endpoint = 'endpoint') {
    if (responseTime > maxTime) {
      throw new Error(
        `${endpoint} response time ${responseTime}ms exceeds maximum ${maxTime}ms`
      );
    }
  }

  /**
   * Get performance benchmarks for different endpoint types
   * @returns {Object} - Performance benchmarks
   */
  static getPerformanceBenchmarks() {
    return {
      authentication: {
        login: 500, // 500ms max for login
        register: 1000, // 1s max for registration
        tokenRefresh: 200, // 200ms max for token refresh
        logout: 100 // 100ms max for logout
      },
      userOperations: {
        getProfile: 200, // 200ms max for profile retrieval
        updateProfile: 300, // 300ms max for profile update
        deleteUser: 500 // 500ms max for user deletion
      },
      dataOperations: {
        listUsers: 500, // 500ms max for user listing
        searchUsers: 800, // 800ms max for user search
        bulkOperations: 2000 // 2s max for bulk operations
      }
    };
  }
}

/**
 * Test helper utilities for database operations
 */
class DatabaseTestHelpers {
  /**
   * Clean specific tables for test isolation
   * @param {Array} tableNames - Array of table names to clean
   */
  static async cleanTables(tableNames) {
    for (const tableName of tableNames) {
      try {
        await global.testPrisma[tableName].deleteMany({});
      } catch (error) {
        console.warn(`Failed to clean ${tableName}:`, error.message);
      }
    }
  }

  /**
   * Create test data for specific table
   * @param {string} tableName - Name of the table
   * @param {Object} data - Data to create
   * @returns {Object} - Created record
   */
  static async createTestData(tableName, data) {
    return await global.testPrisma[tableName].create({
      data
    });
  }

  /**
   * Count records in table
   * @param {string} tableName - Name of the table
   * @param {Object} where - Where conditions
   * @returns {number} - Record count
   */
  static async countRecords(tableName, where = {}) {
    return await global.testPrisma[tableName].count({ where });
  }

  /**
   * Check if record exists
   * @param {string} tableName - Name of the table
   * @param {Object} where - Where conditions
   * @returns {boolean} - Whether record exists
   */
  static async recordExists(tableName, where) {
    const count = await this.countRecords(tableName, where);
    return count > 0;
  }
}

/**
 * Test helper utilities for API response validation
 */
class ApiTestHelpers {
  /**
   * Validate standard API response structure
   * @param {Object} response - Response object
   * @param {number} expectedStatus - Expected status code
   * @param {boolean} shouldSucceed - Whether request should succeed
   */
  static validateApiResponse(response, expectedStatus, shouldSucceed = true) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success');
    expect(response.body.success).toBe(shouldSucceed);
    expect(response.body).toHaveProperty('message');
    
    if (shouldSucceed && expectedStatus === 200) {
      expect(response.body).toHaveProperty('data');
    }
  }

  /**
   * Validate pagination response
   * @param {Object} response - Response object with pagination
   */
  static validatePaginationResponse(response) {
    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data).toHaveProperty('pagination');
    expect(response.body.data.pagination).toHaveProperty('page');
    expect(response.body.data.pagination).toHaveProperty('limit');
    expect(response.body.data.pagination).toHaveProperty('total');
    expect(response.body.data.pagination).toHaveProperty('totalPages');
  }

  /**
   * Validate error response structure
   * @param {Object} response - Error response object
   * @param {number} expectedStatus - Expected error status
   */
  static validateErrorResponse(response, expectedStatus) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body.success).toBe(false);
    expect(response.body).toHaveProperty('message');
    
    if (response.body.errors) {
      expect(Array.isArray(response.body.errors)).toBe(true);
    }
  }
}

/**
 * Test helper utilities for cache testing
 */
class CacheTestHelpers {
  /**
   * Clear all test cache
   */
  static async clearTestCache() {
    if (global.testRedis) {
      try {
        await global.testRedis.flushdb();
      } catch (error) {
        console.warn('Failed to clear test cache:', error.message);
      }
    }
  }

  /**
   * Check if cache key exists
   * @param {string} key - Cache key
   * @returns {boolean} - Whether key exists
   */
  static async cacheKeyExists(key) {
    if (!global.testRedis) return false;
    
    try {
      const exists = await global.testRedis.exists(key);
      return exists === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache value
   * @param {string} key - Cache key
   * @returns {Object|null} - Cached value or null
   */
  static async getCacheValue(key) {
    if (!global.testRedis) return null;
    
    try {
      const value = await global.testRedis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set cache value for testing
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   */
  static async setCacheValue(key, value, ttl = 300) {
    if (!global.testRedis) return;
    
    try {
      await global.testRedis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to set cache value:', error.message);
    }
  }
}

/**
 * Test helper utilities for file upload testing
 */
class FileTestHelpers {
  /**
   * Create test file buffer
   * @param {string} type - File type ('image', 'pdf', 'text')
   * @param {number} size - File size in bytes
   * @returns {Buffer} - Test file buffer
   */
  static createTestFile(type = 'image', size = 1024) {
    switch (type) {
      case 'image':
        // Create minimal valid JPEG buffer
        const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
        const jpegFooter = Buffer.from([0xFF, 0xD9]);
        const padding = Buffer.alloc(Math.max(0, size - jpegHeader.length - jpegFooter.length));
        return Buffer.concat([jpegHeader, padding, jpegFooter]);
      
      case 'pdf':
        // Create minimal valid PDF buffer
        const pdfContent = '%PDF-1.4\n%%EOF';
        return Buffer.from(pdfContent.padEnd(size, ' '));
      
      case 'text':
        return Buffer.from('Test file content'.padEnd(size, ' '));
      
      default:
        return Buffer.alloc(size);
    }
  }

  /**
   * Create test image for upload testing
   * @param {string} filename - File name
   * @param {number} size - File size
   * @returns {Object} - File object for testing
   */
  static createTestImage(filename = 'test.jpg', size = 2048) {
    return {
      buffer: this.createTestFile('image', size),
      originalname: filename,
      mimetype: 'image/jpeg',
      size
    };
  }
}

/**
 * Test utilities for error handling
 */
class ErrorTestHelpers {
  /**
   * Test that endpoint handles various error scenarios
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} validData - Valid request data
   * @param {string} token - Auth token (if needed)
   */
  static async testErrorScenarios(endpoint, method, validData, token = null) {
    const baseRequest = () => {
      const req = request(app)[method.toLowerCase()](endpoint);
      if (token) {
        req.set('Authorization', `Bearer ${token}`);
      }
      return req;
    };

    const scenarios = [
      {
        name: 'Empty request body',
        data: {},
        expectedStatus: 400
      },
      {
        name: 'Invalid JSON',
        data: null,
        expectedStatus: 400
      },
      {
        name: 'Missing required fields',
        data: Object.keys(validData).length > 1 
          ? { [Object.keys(validData)[0]]: validData[Object.keys(validData)[0]] }
          : {},
        expectedStatus: 400
      }
    ];

    const results = [];
    
    for (const scenario of scenarios) {
      try {
        const response = await baseRequest().send(scenario.data);
        results.push({
          scenario: scenario.name,
          status: response.status,
          success: response.status === scenario.expectedStatus,
          body: response.body
        });
      } catch (error) {
        results.push({
          scenario: scenario.name,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  /**
   * Test rate limiting functionality
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @param {number} maxRequests - Maximum requests before rate limit
   * @param {number} windowMs - Rate limit window in milliseconds
   */
  static async testRateLimit(endpoint, method, data, maxRequests = 5, windowMs = 60000) {
    const responses = [];
    
    // Make requests up to the limit
    for (let i = 0; i < maxRequests + 2; i++) {
      try {
        const response = await request(app)[method.toLowerCase()](endpoint)
          .send(data);
        
        responses.push({
          attempt: i + 1,
          status: response.status,
          rateLimited: response.status === 429
        });
      } catch (error) {
        responses.push({
          attempt: i + 1,
          error: error.message
        });
      }
    }
    
    return responses;
  }
}

/**
 * Test utilities for security testing
 */
class SecurityTestHelpers {
  /**
   * Generate common security test payloads
   * @returns {Object} - Security test payloads
   */
  static getSecurityPayloads() {
    return {
      sqlInjection: [
        "admin@test.com' OR '1'='1' --",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "admin@test.com'; SELECT * FROM users WHERE '1'='1"
      ],
      xssPayloads: [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert('xss')>",
        "javascript:alert('xss')",
        "<svg onload=alert('xss')>",
        "';alert('xss');//"
      ],
      commandInjection: [
        "; cat /etc/passwd",
        "| whoami",
        "&& rm -rf /",
        "`rm -rf /`"
      ]
    };
  }

  /**
   * Test endpoint against security payloads
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {string} field - Field to test
   * @param {Array} payloads - Security payloads to test
   * @param {string} token - Auth token (if needed)
   */
  static async testSecurityPayloads(endpoint, method, field, payloads, token = null) {
    const results = [];
    
    for (const payload of payloads) {
      try {
        const data = { [field]: payload };
        const req = request(app)[method.toLowerCase()](endpoint);
        
        if (token) {
          req.set('Authorization', `Bearer ${token}`);
        }
        
        const response = await req.send(data);
        
        results.push({
          payload,
          status: response.status,
          success: response.body.success,
          secured: response.status !== 200 || !response.body.success
        });
      } catch (error) {
        results.push({
          payload,
          error: error.message,
          secured: true
        });
      }
    }
    
    return results;
  }
}

module.exports = {
  AuthTestHelpers,
  PerformanceTestHelpers,
  DatabaseTestHelpers,
  ApiTestHelpers,
  CacheTestHelpers,
  FileTestHelpers,
  ErrorTestHelpers,
  SecurityTestHelpers
};