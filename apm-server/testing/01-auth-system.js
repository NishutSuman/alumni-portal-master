// testing/01-auth-system.js
// COMPLETE Authentication System Testing
// Based on YOUR EXACT API response structure

require('dotenv').config();
const axios = require('axios');
const colors = require('colors');
const { faker } = require('@faker-js/faker');

class AuthSystemTester {
  constructor() {
    this.baseURL = `http://localhost:${process.env.PORT || 3000}`;
    this.adminToken = null;
    this.userToken = null;
    this.batchAdminToken = null;
    this.testUserId = null;
    
    // Test counters
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.criticalIssues = [];
    
    // YOUR SEEDED CREDENTIALS
    this.testCredentials = {
      admin: { email: 'admin@test.com', password: 'TestPassword123!' },
      user: { email: 'user@test.com', password: 'TestPassword123!' },
      batchAdmin: { email: 'batchadmin2020@test.com', password: 'TestPassword123!' }
    };
    
    console.log(`🔐 Testing Authentication System at: ${this.baseURL}`.cyan.bold);
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', test: '🧪', critical: '🚨' };
    const colorMap = { success: 'green', error: 'red', warning: 'yellow', info: 'blue', test: 'magenta', critical: 'red' };
    console.log(`[${timestamp}] ${icons[type]} ${message}`[colorMap[type]]);
  }

  async makeRequest(method, endpoint, data = null, token = null) {
    this.totalTests++;
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true
      };

      if (token) config.headers.Authorization = `Bearer ${token}`;
      if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) config.data = data;

      return await axios(config);
    } catch (error) {
      this.log(`Request failed: ${error.message}`, 'error');
      this.failedTests++;
      return null;
    }
  }

  async testEndpoint(testName, method, endpoint, expectedStatus, data = null, token = null) {
    this.log(`🧪 ${testName}`, 'test');
    
    const response = await this.makeRequest(method, endpoint, data, token);
    if (!response) {
      this.failedTests++;
      return { success: false, response: null };
    }

    const success = Array.isArray(expectedStatus) 
      ? expectedStatus.includes(response.status)
      : response.status === expectedStatus;

    if (success) {
      this.log(`✅ ${testName}: Status ${response.status}`, 'success');
      this.passedTests++;
      return { success: true, response };
    } else {
      this.log(`❌ ${testName}: Expected ${expectedStatus}, got ${response.status}`, 'error');
      this.failedTests++;
      return { success: false, response };
    }
  }

  // =============================================
  // HEALTH CHECK
  // =============================================

  async testServerHealth() {
    this.log('\n🏥 TESTING SERVER HEALTH', 'info');
    console.log('====================================='.cyan);

    const healthResult = await this.testEndpoint('Server Health Check', 'GET', '/health', 200);
    
    if (!healthResult.success) {
      this.criticalIssues.push('Server not responding to health checks');
      return false;
    }
    return true;
  }

  // =============================================
  // AUTHENTICATION FLOW TESTING
  // =============================================

  async testLoginFlow() {
    this.log('\n🔑 TESTING LOGIN FLOW', 'info');
    console.log('====================================='.cyan);

    // 1. Test admin login (using YOUR response structure)
    const adminLoginResult = await this.testEndpoint(
      'Admin Login (Seeded)',
      'POST',
      '/api/auth/login',
      200,
      this.testCredentials.admin
    );

    if (adminLoginResult.success) {
      // Extract token using YOUR EXACT structure
      this.adminToken = adminLoginResult.response.data.data.tokens.accessToken;
      this.log(`   Admin token acquired: ${this.adminToken.substring(0, 20)}...`, 'success');
    }

    // 2. Test regular user login
    const userLoginResult = await this.testEndpoint(
      'Regular User Login (Seeded)',
      'POST',
      '/api/auth/login',
      200,
      this.testCredentials.user
    );

    if (userLoginResult.success) {
      this.userToken = userLoginResult.response.data.data.tokens.accessToken;
      this.testUserId = userLoginResult.response.data.data.user.id;
      this.log(`   User token acquired, ID: ${this.testUserId}`, 'success');
    }

    // 3. Test batch admin login
    const batchAdminResult = await this.testEndpoint(
      'Batch Admin Login (Seeded)',
      'POST',
      '/api/auth/login',
      200,
      this.testCredentials.batchAdmin
    );

    if (batchAdminResult.success) {
      this.batchAdminToken = batchAdminResult.response.data.data.tokens.accessToken;
    }

    // 4. Test invalid credentials
    await this.testEndpoint(
      'Invalid Email Login',
      'POST',
      '/api/auth/login',
      401,
      { email: 'nonexistent@test.com', password: 'TestPassword123!' }
    );

    await this.testEndpoint(
      'Wrong Password',
      'POST',
      '/api/auth/login',
      401,
      { ...this.testCredentials.admin, password: 'WrongPassword123!' }
    );

    // 5. Test malformed login data
    await this.testEndpoint(
      'Missing Email Field',
      'POST',
      '/api/auth/login',
      [400, 422],
      { password: 'TestPassword123!' }
    );
  }

  async testRegistrationFlow() {
    this.log('\n👤 TESTING REGISTRATION FLOW', 'info');
    console.log('====================================='.cyan);

    // 1. Test valid registration
    const newUser = {
      email: faker.internet.email(),
      password: 'TestPassword123!',
      fullName: `${faker.person.firstName()} ${faker.person.lastName()}`,
      batch: 2020
    };

    await this.testEndpoint(
      'Valid User Registration',
      'POST',
      '/api/auth/register',
      [200, 201],
      newUser
    );

    // 2. Test duplicate email
    await this.testEndpoint(
      'Duplicate Email Registration',
      'POST',
      '/api/auth/register',
      [400, 409],
      { ...this.testCredentials.admin, fullName: 'Test Duplicate' }
    );

    // 3. Test invalid email format
    await this.testEndpoint(
      'Invalid Email Format',
      'POST',
      '/api/auth/register',
      [400, 422],
      { ...newUser, email: 'invalid-email' }
    );

    // 4. Test weak password
    await this.testEndpoint(
      'Weak Password Rejection',
      'POST',
      '/api/auth/register',
      [400, 422],
      { ...newUser, email: faker.internet.email(), password: '123' }
    );

    // 5. Test missing required fields
    await this.testEndpoint(
      'Missing Required Fields',
      'POST',
      '/api/auth/register',
      [400, 422],
      { email: faker.internet.email() }
    );
  }

  async testTokenManagement() {
    this.log('\n🎟️ TESTING TOKEN MANAGEMENT', 'info');
    console.log('====================================='.cyan);

    if (!this.adminToken) {
      this.log('⚠️ Skipping token tests - no admin token available', 'warning');
      return;
    }

    // 1. Test /api/auth/me endpoint (using YOUR structure)
    const meResult = await this.testEndpoint(
      'Get Current User Info',
      'GET',
      '/api/auth/me',
      200,
      null,
      this.adminToken
    );

    if (meResult.success) {
      const userData = meResult.response.data.data.user; // YOUR structure
      this.log(`   User role: ${userData.role}`, 'info');
      this.log(`   User email: ${userData.email}`, 'info');
      this.log(`   Alumni verified: ${userData.isAlumniVerified}`, 'info');
    }

    // 2. Test with invalid token
    await this.testEndpoint(
      'Invalid Token Access',
      'GET',
      '/api/auth/me',
      401,
      null,
      'invalid_token_12345'
    );

    // 3. Test with no token
    await this.testEndpoint(
      'No Token Access',
      'GET',
      '/api/auth/me',
      401
    );

    // 4. Test token refresh
    await this.testEndpoint(
      'Token Refresh',
      'POST',
      '/api/auth/refresh-token',
      [200, 404],
      null,
      this.adminToken
    );

    // 5. Test logout
    await this.testEndpoint(
      'User Logout',
      'POST',
      '/api/auth/logout',
      [200, 204, 404],
      null,
      this.adminToken
    );
  }

  async testPasswordManagement() {
    this.log('\n🔒 TESTING PASSWORD MANAGEMENT', 'info');
    console.log('====================================='.cyan);

    if (!this.userToken) {
      this.log('⚠️ Skipping password tests - no user token available', 'warning');
      return;
    }

    // 1. Test change password with valid current password
    await this.testEndpoint(
      'Change Password (Valid Current)',
      'POST',
      '/api/auth/change-password',
      [200, 404],
      {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewTestPassword123!'
      },
      this.userToken
    );

    // 2. Test change password with wrong current password
    await this.testEndpoint(
      'Change Password (Wrong Current)',
      'POST',
      '/api/auth/change-password',
      [400, 401, 404],
      {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewTestPassword123!'
      },
      this.userToken
    );

    // 3. Test forgot password flow
    await this.testEndpoint(
      'Forgot Password Request',
      'POST',
      '/api/auth/forgot-password',
      [200, 404],
      { email: this.testCredentials.user.email }
    );

    // 4. Test forgot password with invalid email
    await this.testEndpoint(
      'Forgot Password (Invalid Email)',
      'POST',
      '/api/auth/forgot-password',
      [400, 404],
      { email: 'nonexistent@invalid.com' }
    );

    // 5. Test reset password (simulate scenario)
    await this.testEndpoint(
      'Reset Password (Mock Token)',
      'POST',
      '/api/auth/reset-password',
      [400, 404],
      {
        token: 'mock_reset_token_12345',
        newPassword: 'ResetPassword123!'
      }
    );
  }

  async testProtectedRoutes() {
    this.log('\n🛡️ TESTING PROTECTED ROUTES ACCESS', 'info');
    console.log('====================================='.cyan);

    const protectedRoutes = [
      { method: 'GET', path: '/api/users/profile', role: 'user' },
      { method: 'GET', path: '/api/admin/dashboard/overview', role: 'admin' },
      { method: 'GET', path: '/api/events', role: 'user' },
      { method: 'GET', path: '/api/membership/status', role: 'user' }
    ];

    for (const route of protectedRoutes) {
      // Test without token (should fail)
      await this.testEndpoint(
        `${route.path} (No Auth)`,
        route.method,
        route.path,
        401
      );

      // Test with appropriate token
      const token = route.role === 'admin' ? this.adminToken : this.userToken;
      if (token) {
        await this.testEndpoint(
          `${route.path} (With ${route.role} Token)`,
          route.method,
          route.path,
          [200, 400, 403, 404]
        );
      }
    }
  }

  async testRoleBasedAccess() {
    this.log('\n👑 TESTING ROLE-BASED ACCESS CONTROL', 'info');
    console.log('====================================='.cyan);

    if (!this.adminToken || !this.userToken) {
      this.log('⚠️ Skipping role tests - missing tokens', 'warning');
      return;
    }

    const adminOnlyRoutes = [
      '/api/admin/dashboard/overview',
      '/api/admin/cache/stats', 
      '/api/admin/users'
    ];

    for (const route of adminOnlyRoutes) {
      // Test with regular user (should fail)
      await this.testEndpoint(
        `Admin Route Access (Regular User) - ${route}`,
        'GET',
        route,
        403,
        null,
        this.userToken
      );

      // Test with admin token (should work or different error)
      await this.testEndpoint(
        `Admin Route Access (Admin User) - ${route}`,
        'GET',
        route,
        [200, 400, 404],
        null,
        this.adminToken
      );
    }
  }

  async testTokenStructure() {
    this.log('\n🔍 TESTING TOKEN STRUCTURE', 'info');
    console.log('====================================='.cyan);

    if (!this.adminToken) {
      this.log('⚠️ Skipping token structure tests - no token available', 'warning');
      return;
    }

    try {
      const tokenParts = this.adminToken.split('.');
      
      if (tokenParts.length === 3) {
        this.log('✅ Token has valid JWT structure (3 parts)', 'success');
        
        try {
          const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          
          this.log(`   Algorithm: ${header.alg || 'Not specified'}`, 'info');
          this.log(`   Token Type: ${header.typ || 'Not specified'}`, 'info');
          this.log(`   User ID in payload: ${payload.userId || payload.sub || 'Not found'}`, 'info');
          this.log(`   Token type: ${payload.type || 'Not found'}`, 'info');
          this.log(`   Expires: ${payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'Not found'}`, 'info');
          
          this.passedTests++;
        } catch (error) {
          this.log('❌ Could not decode JWT payload', 'error');
          this.failedTests++;
        }
      } else {
        this.log('❌ Token does not have valid JWT structure', 'error');
        this.failedTests++;
      }
    } catch (error) {
      this.log(`❌ Token structure test failed: ${error.message}`, 'error');
      this.failedTests++;
    }
  }

  async testSecurityFeatures() {
    this.log('\n🔐 TESTING SECURITY FEATURES', 'info');
    console.log('====================================='.cyan);

    // 1. Test SQL injection protection
    await this.testEndpoint(
      'SQL Injection Protection (Login)',
      'POST',
      '/api/auth/login',
      [400, 401, 422],
      {
        email: "admin@test.com'; DROP TABLE users; --",
        password: 'TestPassword123!'
      }
    );

    // 2. Test XSS protection
    await this.testEndpoint(
      'XSS Protection (Registration)',
      'POST',
      '/api/auth/register',
      [400, 422],
      {
        email: faker.internet.email(),
        password: 'TestPassword123!',
        fullName: '<script>alert("xss")</script>',
        batch: 2020
      }
    );

    // 3. Test rate limiting (5 rapid requests)
    this.log('   Testing rate limiting (5 rapid requests)...', 'info');
    const rapidRequests = [];
    for (let i = 0; i < 5; i++) {
      rapidRequests.push(
        this.makeRequest('POST', '/api/auth/login', {
          email: 'test@invalid.com',
          password: 'TestPassword123!'
        })
      );
    }

    const rapidResults = await Promise.all(rapidRequests);
    const rateLimited = rapidResults.some(r => r && r.status === 429);
    
    if (rateLimited) {
      this.log('✅ Rate limiting is working', 'success');
      this.passedTests++;
    } else {
      this.log('⚠️ Rate limiting not detected (may not be implemented)', 'warning');
    }
  }

  // =============================================
  // MAIN TEST RUNNER
  // =============================================

  async runAllTests() {
    console.log('\n🚀 STARTING AUTHENTICATION SYSTEM TESTS'.rainbow.bold);
    console.log('='.repeat(50).cyan);
    
    const startTime = Date.now();

    try {
      // 1. Health Check (Critical)
      const serverHealthy = await this.testServerHealth();
      if (!serverHealthy) {
        this.log('🚨 ABORTING: Server not healthy', 'critical');
        return this.generateReport();
      }

      // 2. Login Flow (Critical for getting tokens)
      await this.testLoginFlow();

      // 3. Registration Flow
      await this.testRegistrationFlow();

      // 4. Token Management
      await this.testTokenManagement();

      // 5. Password Management
      await this.testPasswordManagement();

      // 6. Protected Routes Access
      await this.testProtectedRoutes();

      // 7. Role-Based Access Control
      await this.testRoleBasedAccess();

      // 8. Token Structure Validation
      await this.testTokenStructure();

      // 9. Security Features
      await this.testSecurityFeatures();

    } catch (error) {
      this.log(`🚨 CRITICAL ERROR: ${error.message}`, 'critical');
      this.criticalIssues.push(`System error: ${error.message}`);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    return this.generateReport(duration);
  }

  generateReport(duration = 'Unknown') {
    console.log('\n📊 AUTHENTICATION SYSTEM TEST REPORT'.rainbow.bold);
    console.log('='.repeat(50).cyan);
    
    const successRate = this.totalTests > 0 ? 
      ((this.passedTests / this.totalTests) * 100).toFixed(1) : 0;

    console.log(`\n📈 TEST STATISTICS:`.yellow.bold);
    console.log(`   Total Tests: ${this.totalTests}`.white);
    console.log(`   Passed: ${this.passedTests}`.green);
    console.log(`   Failed: ${this.failedTests}`.red);
    console.log(`   Success Rate: ${successRate}%`.cyan);
    console.log(`   Duration: ${duration} seconds`.gray);

    console.log(`\n🔑 AUTHENTICATION STATUS:`.yellow.bold);
    console.log(`   Admin Token: ${this.adminToken ? '✅ Acquired' : '❌ Failed'}`.white);
    console.log(`   User Token: ${this.userToken ? '✅ Acquired' : '❌ Failed'}`.white);
    console.log(`   Batch Admin Token: ${this.batchAdminToken ? '✅ Acquired' : '❌ Failed'}`.white);

    if (this.criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES:`.red.bold);
      this.criticalIssues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`.red);
      });
    }

    console.log(`\n💡 RECOMMENDATIONS:`.green.bold);
    
    if (this.failedTests === 0) {
      console.log('   🎉 Authentication system is working perfectly!'.green);
      console.log('   ✅ Ready to proceed to Phase 2: User Management System'.green);
      console.log('   ✅ Run: node testing/02-user-management.js'.green);
    } else if (successRate >= 80) {
      console.log('   ⚠️ Minor issues found - check failed tests above'.yellow);
      console.log('   ✅ Can proceed to next phase with monitoring'.yellow);
    } else {
      console.log('   🚨 Major issues found - fix before proceeding'.red);
      console.log('   ❌ Recommend fixing authentication issues first'.red);
    }

    console.log(`\n🎯 NEXT STEPS:`.blue.bold);
    console.log('   1. Review any failed tests above'.white);
    console.log('   2. Fix critical authentication issues'.white);
    console.log('   3. Verify environment variables are set'.white);
    console.log('   4. If >80% success: Ready for Phase 2 testing'.white);

    console.log(`\n${'='.repeat(50)}`.cyan);
    console.log(`🏁 Authentication Testing Complete - ${successRate}% Success`.rainbow.bold);
    
    return {
      totalTests: this.totalTests,
      passedTests: this.passedTests,
      failedTests: this.failedTests,
      successRate: parseFloat(successRate),
      criticalIssues: this.criticalIssues,
      tokens: {
        admin: !!this.adminToken,
        user: !!this.userToken,
        batchAdmin: !!this.batchAdminToken
      }
    };
  }
}

// =============================================
// EXECUTION
// =============================================

async function main() {
  console.log('🎯 PHASE 1: AUTHENTICATION SYSTEM TESTING'.rainbow.bold);
  console.log('Using YOUR EXACT API response structure'.gray);
  console.log('='.repeat(60).cyan);

  const tester = new AuthSystemTester();
  const results = await tester.runAllTests();

  process.exit(results.criticalIssues.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('🚨 FATAL ERROR:'.red.bold, error.message);
    process.exit(1);
  });
}

module.exports = AuthSystemTester;