describe('Authentication Performance Tests', () => {
  
  describe('Response Time Tests', () => {
    test('login should respond within acceptable time', async () => {
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      
      const { response, responseTime } = await PerformanceTestHelpers.measureResponseTime(async () => {
        return await request(app)
          .post('/api/auth/login')
          .send({
            email: userData.email,
            password: userData.password
          });
      });
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should be under 1 second
      console.log(`Login response time: ${responseTime}ms`);
    });

    test('registration should respond within acceptable time', async () => {
      const userData = UserFactory.createUserData();
      await UserFactory.createTestBatch(userData.batch);
      
      const { response, responseTime } = await PerformanceTestHelpers.measureResponseTime(async () => {
        return await request(app)
          .post('/api/auth/register')
          .send(userData);
      });
      
      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(2000); // Should be under 2 seconds (includes hashing)
      console.log(`Registration response time: ${responseTime}ms`);
    });

    test('profile retrieval should be fast', async () => {
      const { tokens } = await AuthTestHelpers.createAndLoginUser();
      
      const { response, responseTime } = await PerformanceTestHelpers.measureResponseTime(async () => {
        return await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${tokens.accessToken}`);
      });
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500); // Should be under 500ms
      console.log(`Profile retrieval response time: ${responseTime}ms`);
    });
  });

  describe('Concurrent Request Tests', () => {
    test('should handle concurrent logins', async () => {
      // Create test users
      const users = await Promise.all([
        UserFactory.createTestUser(),
        UserFactory.createTestUser(),
        UserFactory.createTestUser(),
        UserFactory.createTestUser(),
        UserFactory.createTestUser()
      ]);
      
      // Concurrent login requests
      const loginPromises = users.map(user => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: 'TestPassword123!' // Default password from factory
          })
      );
      
      const responses = await Promise.all(loginPromises);
      
      // All logins should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    }, 10000);

    test('should handle concurrent registrations', async () => {
      const batch = await UserFactory.createTestBatch();
      
      const registrationPromises = Array(5).fill().map((_, index) => {
        const userData = UserFactory.createUserData({
          email: `concurrent${index}@example.com`,
          batch: batch.year
        });
        
        return request(app)
          .post('/api/auth/register')
          .send(userData);
      });
      
      const responses = await Promise.all(registrationPromises);
      
      // All registrations should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    }, 10000);
  });

  describe('Load Tests', () => {
    test('should maintain performance under moderate load', async () => {
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      
      const concurrentRequests = 20;
      const startTime = Date.now();
      
      const responses = await PerformanceTestHelpers.runConcurrentRequests(
        async () => {
          return await request(app)
            .post('/api/auth/login')
            .send({
              email: userData.email,
              password: userData.password
            });
        },
        concurrentRequests
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrentRequests;
      
      // All requests should succeed
      responses.forEach(response => {
        expect([200, 401, 429]).toContain(response.status); // Allow rate limiting
      });
      
      expect(avgResponseTime).toBeLessThan(2000); // Average under 2 seconds
      console.log(`Load test - ${concurrentRequests} concurrent requests: ${totalTime}ms total, ${avgResponseTime}ms average`);
    }, 15000);
  });

  describe('Memory Usage Tests', () => {
    test('should not cause memory leaks during user operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 10; i++) {
        const { user, tokens } = await AuthTestHelpers.createAndLoginUser();
        
        // Make several requests
        await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${tokens.accessToken}`);
        
        await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${tokens.accessToken}`);
        
        // Clean up
        await global.testPrisma.user.delete({ where: { id: user.id } });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      console.log(`Memory increase after operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }, 30000);
  });
});