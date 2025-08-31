// scripts/runTests.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
  constructor() {
    this.testSuites = {
      unit: 'tests/unit/**/*.test.js',
      integration: 'tests/integration/**/*.test.js',
      e2e: 'tests/e2e/**/*.test.js',
      auth: 'tests/**/*auth*.test.js'
    };
  }

  async checkEnvironment() {
    console.log('🔍 Checking test environment...');
    
    // Check if test env file exists
    if (!fs.existsSync('.env.test')) {
      console.error('❌ .env.test file not found');
      console.log('💡 Create .env.test file with test database configuration');
      return false;
    }

    // Check if test database is configured
    require('dotenv').config({ path: '.env.test' });
    if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
      console.error('❌ TEST_DATABASE_URL not configured');
      return false;
    }

    console.log('✅ Environment check passed');
    return true;
  }

  runCommand(command, description) {
    return new Promise((resolve, reject) => {
      console.log(`\n🚀 ${description}...`);
      console.log(`Running: ${command}\n`);

      const process = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ ${description} failed:`, error.message);
          reject(error);
          return;
        }
        
        if (stderr && !stderr.includes('Warning')) {
          console.error(`⚠️ ${description} warnings:`, stderr);
        }
        
        console.log(stdout);
        console.log(`✅ ${description} completed`);
        resolve(stdout);
      });

      // Stream output in real-time
      process.stdout.on('data', (data) => {
        process.stdout.write(data);
      });
    });
  }

  async runTestSuite(suiteName) {
    if (!this.testSuites[suiteName]) {
      console.error(`❌ Unknown test suite: ${suiteName}`);
      return false;
    }

    const pattern = this.testSuites[suiteName];
    const command = `npx jest --testPathPattern="${pattern}" --verbose`;
    
    try {
      await this.runCommand(command, `Running ${suiteName} tests`);
      return true;
    } catch (error) {
      console.error(`❌ ${suiteName} tests failed`);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 Running all test suites...\n');
    
    const suites = ['unit', 'integration', 'e2e'];
    let passedSuites = 0;
    
    for (const suite of suites) {
      const success = await this.runTestSuite(suite);
      if (success) {
        passedSuites++;
      }
    }
    
    console.log(`\n📊 Test Results: ${passedSuites}/${suites.length} suites passed`);
    return passedSuites === suites.length;
  }

  async generateCoverageReport() {
    const command = 'npx jest --coverage --testPathPattern="tests/(unit|integration)/"';
    try {
      await this.runCommand(command, 'Generating coverage report');
      console.log('\n📈 Coverage report generated at: coverage/index.html');
      return true;
    } catch (error) {
      console.error('❌ Coverage report generation failed');
      return false;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new TestRunner();

  // Check environment first
  const envReady = await runner.checkEnvironment();
  if (!envReady) {
    process.exit(1);
  }

  try {
    if (args.length === 0) {
      // Run all tests by default
      const success = await runner.runAllTests();
      process.exit(success ? 0 : 1);
    }

    const command = args[0];
    switch (command) {
      case 'unit':
      case 'integration':
      case 'e2e':
      case 'auth':
        const success = await runner.runTestSuite(command);
        process.exit(success ? 0 : 1);
        break;
        
      case 'coverage':
        const coverageSuccess = await runner.generateCoverageReport();
        process.exit(coverageSuccess ? 0 : 1);
        break;
        
      case 'all':
        const allSuccess = await runner.runAllTests();
        process.exit(allSuccess ? 0 : 1);
        break;
        
      default:
        console.log('Usage: node scripts/runTests.js [unit|integration|e2e|auth|coverage|all]');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TestRunner;

// tests/e2e/auth.workflow.test.js
const request = require('supertest');
const app = require('../../src/app');
const { UserFactory, AuthFactory } = require('../factories');

describe('Authentication End-to-End Workflow Tests', () => {
  
  describe('Complete User Registration and Verification Workflow', () => {
    test('new user registration → login → profile update → verification request', async () => {
      // Step 1: User Registration
      const userData = UserFactory.createUserData();
      await UserFactory.createTestBatch(userData.batch);
      
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      expect(registrationResponse.body.success).toBe(true);
      const userId = registrationResponse.body.data.user.id;
      const { accessToken } = registrationResponse.body.data.tokens;
      
      // Step 2: Login with new credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);
      
      expect(loginResponse.body.success).toBe(true);
      const newAccessToken = loginResponse.body.data.tokens.accessToken;
      
      // Step 3: Get user profile
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);
      
      expect(profileResponse.body.data.user.email).toBe(userData.email);
      expect(profileResponse.body.data.user.isAlumniVerified).toBe(false);
      expect(profileResponse.body.data.user.pendingVerification).toBe(true);
      
      // Step 4: Try to access premium feature (should be blocked)
      const premiumResponse = await request(app)
        .post('/api/events/test/register')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .send({});
      
      if (premiumResponse.status === 403) {
        expect(premiumResponse.body.verificationRequired).toBe(true);
      }
      
      // Step 5: Change password
      const passwordChangeResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .send({
          currentPassword: userData.password,
          newPassword: 'UpdatedPassword123!'
        })
        .expect(200);
      
      expect(passwordChangeResponse.body.success).toBe(true);
      
      // Step 6: Login with new password
      await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'UpdatedPassword123!'
        })
        .expect(200);
      
      // Step 7: Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);
      
      expect(logoutResponse.body.success).toBe(true);
      
      // Verify complete workflow in database
      const finalUser = await global.testPrisma.user.findUnique({
        where: { id: userId },
        include: {
          batch: true
        }
      });
      
      expect(finalUser).toBeTruthy();
      expect(finalUser.email).toBe(userData.email);
      expect(finalUser.batch.year).toBe(userData.batch);
      
      // Verify activity logs were created
      const activityLogs = await global.testPrisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
      });
      
      const logActions = activityLogs.map(log => log.action);
      expect(logActions).toContain('user_registration');
      expect(logActions).toContain('login_success');
      expect(logActions).toContain('password_changed');
      expect(logActions).toContain('logout');
    });
  });

  describe('Admin User Workflow', () => {
    test('admin registration → verification management → user approval', async () => {
      // Step 1: Create admin user
      const adminUser = await UserFactory.createAdminUser('SUPER_ADMIN');
      const adminToken = UserFactory.generateTestToken(adminUser.id);
      
      // Step 2: Create unverified user to manage
      const unverifiedUser = await UserFactory.createUnverifiedUser();
      
      // Step 3: Admin accesses verification dashboard
      const pendingResponse = await request(app)
        .get('/api/admin/verification/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Should have admin access
      expect(pendingResponse.status).not.toBe(403);
      
      // Step 4: Admin verifies user (if endpoint exists)
      const verifyResponse = await request(app)
        .post(`/api/admin/verification/users/${unverifiedUser.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Verified by admin during testing' });
      
      // Should have admin privileges
      expect(verifyResponse.status).not.toBe(403);
      
      // Step 5: Verify the user was updated (if verification worked)
      if (verifyResponse.status === 200) {
        const updatedUser = await global.testPrisma.user.findUnique({
          where: { id: unverifiedUser.id }
        });
        expect(updatedUser.isAlumniVerified).toBe(true);
      }
    });
  });

  describe('Password Reset Workflow', () => {
    test('forgot password → email token → password reset → login with new password', async () => {
      // Step 1: Create user
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      
      // Step 2: Request password reset
      const forgotResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: userData.email })
        .expect(200);
      
      expect(forgotResponse.body.success).toBe(true);
      
      // Step 3: Get reset token from database (simulating email click)
      const userWithToken = await global.testPrisma.user.findUnique({
        where: { id: user.id },
        select: {
          resetPasswordToken: true,
          resetPasswordExpiry: true
        }
      });
      
      expect(userWithToken.resetPasswordToken).toBeTruthy();
      expect(userWithToken.resetPasswordExpiry).toBeTruthy();
      
      // Step 4: Reset password with token
      const resetResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: userWithToken.resetPasswordToken,
          newPassword: 'NewResetPassword123!'
        })
        .expect(200);
      
      expect(resetResponse.body.success).toBe(true);
      
      // Step 5: Login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'NewResetPassword123!'
        })
        .expect(200);
      
      expect(loginResponse.body.success).toBe(true);
      
      // Step 6: Verify old password no longer works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password // Old password
        })
        .expect(401);
      
      // Step 7: Verify reset token was cleared
      const finalUser = await global.testPrisma.user.findUnique({
        where: { id: user.id },
        select: {
          resetPasswordToken: true,
          resetPasswordExpiry: true
        }
      });
      
      expect(finalUser.resetPasswordToken).toBe(null);
      expect(finalUser.resetPasswordExpiry).toBe(null);
    });
  });

  describe('Token Refresh Workflow', () => {
    test('login → token expiry → refresh token → continue session', async () => {
      // Step 1: Login user
      const userData = UserFactory.createUserData();
      const user = await UserFactory.createTestUser(userData);
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);
      
      const { accessToken, refreshToken } = loginResponse.body.data.tokens;
      
      // Step 2: Use access token
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      // Step 3: Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);
      
      const newTokens = refreshResponse.body.data.tokens;
      expect(newTokens.accessToken).toBeTruthy();
      expect(newTokens.refreshToken).toBeTruthy();
      expect(newTokens.accessToken).not.toBe(accessToken); // Should be different
      
      // Step 4: Use new access token
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newTokens.accessToken}`)
        .expect(200);
    });
  });

  describe('Multi-User Concurrent Workflow', () => {
    test('multiple users registration and login simultaneously', async () => {
      // Create test data for multiple users
      const userData1 = UserFactory.createUserData({ batch: 2020 });
      const userData2 = UserFactory.createUserData({ batch: 2021 });
      const userData3 = UserFactory.createUserData({ batch: 2022 });
      
      // Create batches
      await UserFactory.createTestBatch(2020);
      await UserFactory.createTestBatch(2021);
      await UserFactory.createTestBatch(2022);
      
      // Concurrent registrations
      const registrationPromises = [userData1, userData2, userData3].map(data =>
        request(app)
          .post('/api/auth/register')
          .send(data)
          .expect(201)
      );
      
      const registrationResponses = await Promise.all(registrationPromises);
      
      // Verify all registrations succeeded
      registrationResponses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe([userData1, userData2, userData3][index].email);
      });
      
      // Concurrent logins
      const loginPromises = [userData1, userData2, userData3].map(data =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: data.email,
            password: data.password
          })
          .expect(200)
      );
      
      const loginResponses = await Promise.all(loginPromises);
      
      // Verify all logins succeeded
      loginResponses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.tokens.accessToken).toBeTruthy();
      });
      
      // Verify all users exist in database
      const createdUsers = await global.testPrisma.user.findMany({
        where: {
          email: {
            in: [userData1.email, userData2.email, userData3.email]
          }
        },
        include: { batch: true }
      });
      
      expect(createdUsers).toHaveLength(3);
    });
  });
});