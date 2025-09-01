// tests/performance/auth.performance.test.js
/**
 * FIXED: Updated imports and factory usage
 * Performance tests for authentication system
 */

const request = require('supertest');
const app = require('../../src/app');
const { UserFactory, AuthFactory } = require('../factories'); // FIXED: Now imports correctly
const { PerformanceTestHelpers } = require('../utils/testHelpers');

describe('Authentication Performance Tests', () => {
  let testUser;
  let userCredentials;

  beforeAll(async () => {
    // Create test user for performance testing
    const userWithCreds = await AuthFactory.createUserWithCredentials();
    testUser = userWithCreds.user;
    userCredentials = userWithCreds.credentials;
  });

  describe('Response Time Tests', () => {
    test('login should respond within acceptable time', async () => {
      const benchmarks = PerformanceTestHelpers.getPerformanceBenchmarks();
      const maxTime = benchmarks.authentication.login; // 500ms
      
      const { responseTime, response } = await PerformanceTestHelpers.measureResponseTime(
        () => request(app)
          .post('/api/auth/login')
          .send(userCredentials)
      );
      
      // Assert performance
      PerformanceTestHelpers.assertResponseTime(responseTime, maxTime, 'login');
      
      // Assert functionality
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      console.log(`✅ Login performance: ${responseTime}ms (max: ${maxTime}ms)`);
    });

    test('registration should respond within acceptable time', async () => {
      const benchmarks = PerformanceTestHelpers.getPerformanceBenchmarks();
      const maxTime = benchmarks.authentication.register; // 1000ms
      
      const registrationData = AuthFactory.createValidRegistrationData();
      await UserFactory.createTestBatch(registrationData.batch);
      
      const { responseTime, response } = await PerformanceTestHelpers.measureResponseTime(
        () => request(app)
          .post('/api/auth/register')
          .send(registrationData)
      );
      
      // Assert performance  
      PerformanceTestHelpers.assertResponseTime(responseTime, maxTime, 'registration');
      
      // Assert functionality
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      
      console.log(`✅ Registration performance: ${responseTime}ms (max: ${maxTime}ms)`);
    });

    test('profile retrieval should be fast', async () => {
      const benchmarks = PerformanceTestHelpers.getPerformanceBenchmarks();
      const maxTime = benchmarks.userOperations.getProfile; // 200ms
      
      const tokens = AuthFactory.generateTestTokens(testUser.id);
      
      const { responseTime, response } = await PerformanceTestHelpers.measureResponseTime(
        () => request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
      );
      
      // Assert performance
      PerformanceTestHelpers.assertResponseTime(responseTime, maxTime, 'profile retrieval');
      
      // Assert functionality
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      console.log(`✅ Profile retrieval performance: ${responseTime}ms (max: ${maxTime}ms)`);
    });
  });

  describe('Concurrent Request Tests', () => {
    test('should handle concurrent logins', async () => {
      const concurrency = 10;
      
      const { avgResponseTime, maxResponseTime, results } = 
        await PerformanceTestHelpers.runConcurrentRequests(
          () => request(app)
            .post('/api/auth/login')
            .send(userCredentials),
          concurrency
        );
      
      // Performance assertions
      expect(avgResponseTime).toBeLessThan(1000); // Average under 1s
      expect(maxResponseTime).toBeLessThan(2000); // Max under 2s
      
      // Functionality assertions
      const successfulRequests = results.filter(r => r.response.status === 200);
      expect(successfulRequests.length).toBe(concurrency);
      
      console.log(`✅ Concurrent logins: avg ${avgResponseTime}ms, max ${maxResponseTime}ms`);
    });

    test('should handle concurrent registrations', async () => {
      const concurrency = 5; // Lower for registrations
      
      const { avgResponseTime, maxResponseTime, results } = 
        await PerformanceTestHelpers.runConcurrentRequests(
          async () => {
            const registrationData = AuthFactory.createValidRegistrationData();
            await UserFactory.createTestBatch(registrationData.batch);
            
            return request(app)
              .post('/api/auth/register')
              .send(registrationData);
          },
          concurrency
        );
      
      // Performance assertions
      expect(avgResponseTime).toBeLessThan(2000); // Average under 2s
      expect(maxResponseTime).toBeLessThan(3000); // Max under 3s
      
      // Functionality assertions - registrations should succeed
      const successfulRequests = results.filter(r => r.response.status === 201);
      expect(successfulRequests.length).toBe(concurrency);
      
      console.log(`✅ Concurrent registrations: avg ${avgResponseTime}ms, max ${maxResponseTime}ms`);
    });
  });

  describe('Load Tests', () => {
    test('should maintain performance under moderate load', async () => {
      const loadTestConfig = {
        totalRequests: 50,
        concurrencyLevels: [1, 5, 10, 15]
      };
      
      const tokens = AuthFactory.generateTestTokens(testUser.id);
      const results = [];
      
      for (const concurrency of loadTestConfig.concurrencyLevels) {
        const requestsPerLevel = Math.floor(loadTestConfig.totalRequests / concurrency);
        
        const { avgResponseTime, maxResponseTime } = 
          await PerformanceTestHelpers.runConcurrentRequests(
            () => request(app)
              .get('/api/auth/me')
              .set('Authorization', `Bearer ${tokens.accessToken}`),
            requestsPerLevel
          );
        
        results.push({
          concurrency,
          avgResponseTime,
          maxResponseTime
        });
        
        // Performance should not degrade significantly
        expect(avgResponseTime).toBeLessThan(500);
        expect(maxResponseTime).toBeLessThan(1000);
      }
      
      console.log('✅ Load test results:', results);
    });
  });

  describe('Memory Usage Tests', () => {
    test('should not cause memory leaks during user operations', async () => {
      const tokens = AuthFactory.generateTestTokens(testUser.id);
      
      const memoryResults = await PerformanceTestHelpers.checkMemoryUsage(
        async () => {
          // Simulate user operations that might cause memory leaks
          await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${tokens.accessToken}`);
          
          await request(app)
            .post('/api/auth/login')
            .send(userCredentials);
        },
        50 // 50 iterations
      );
      
      // Memory increase should be reasonable (less than 10MB)
      const heapIncrease = memoryResults.memoryIncrease.heapUsed;
      const maxAcceptableIncrease = 10 * 1024 * 1024; // 10MB
      
      expect(heapIncrease).toBeLessThan(maxAcceptableIncrease);
      
      console.log(`✅ Memory usage test: ${(heapIncrease / 1024 / 1024).toFixed(2)}MB increase`);
    });
  });

  describe('Token Performance Tests', () => {
    test('token generation should be fast', async () => {
      const iterations = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        AuthFactory.generateTestTokens(`user-${i}`);
      }
      
      const totalTime = Date.now() - startTime;
      const avgTimePerToken = totalTime / iterations;
      
      // Token generation should be very fast (< 10ms per token)
      expect(avgTimePerToken).toBeLessThan(10);
      
      console.log(`✅ Token generation: ${avgTimePerToken.toFixed(2)}ms average`);
    });

    test('token verification should be fast', async () => {
      const jwt = require('jsonwebtoken');
      const tokens = [];
      
      // Generate test tokens
      for (let i = 0; i < 100; i++) {
        const token = AuthFactory.generateTestTokens(`user-${i}`);
        tokens.push(token.accessToken);
      }
      
      // Measure verification time
      const startTime = Date.now();
      
      for (const token of tokens) {
        try {
          jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
          // Some tokens might be invalid, that's okay for performance testing
        }
      }
      
      const totalTime = Date.now() - startTime;
      const avgTimePerVerification = totalTime / tokens.length;
      
      // Token verification should be very fast (< 5ms per token)
      expect(avgTimePerVerification).toBeLessThan(5);
      
      console.log(`✅ Token verification: ${avgTimePerVerification.toFixed(2)}ms average`);
    });
  });

  describe('Database Performance Tests', () => {
    test('user lookup by ID should be fast', async () => {
      const iterations = 50;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await global.testPrisma.user.findUnique({
          where: { id: testUser.id },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true
          }
        });
      }
      
      const totalTime = Date.now() - startTime;
      const avgTimePerLookup = totalTime / iterations;
      
      // Database lookups should be fast (< 50ms average)
      expect(avgTimePerLookup).toBeLessThan(50);
      
      console.log(`✅ DB user lookup: ${avgTimePerLookup.toFixed(2)}ms average`);
    });

    test('user lookup by email should be optimized', async () => {
      const iterations = 50;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await global.testPrisma.user.findUnique({
          where: { email: testUser.email },
          select: {
            id: true,
            email: true,
            role: true
          }
        });
      }
      
      const totalTime = Date.now() - startTime;
      const avgTimePerLookup = totalTime / iterations;
      
      // Email lookups should be fast (< 50ms average) - indicates proper indexing
      expect(avgTimePerLookup).toBeLessThan(50);
      
      console.log(`✅ DB email lookup: ${avgTimePerLookup.toFixed(2)}ms average`);
    });
  });
});