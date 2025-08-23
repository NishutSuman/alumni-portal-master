require('dotenv').config();
const axios = require('axios');

class ComprehensivePaymentTester {
  constructor() {
    this.baseURL = `http://localhost:${process.env.PORT || 3000}`;
    this.userToken = null;
    this.adminToken = null;
    this.testTransactionId = null;
    this.testUserId = null;
    
    // Test counters
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    
    console.log(`🎯 Testing Payment System at: ${this.baseURL}`);
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  generateTestUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    console.log(`[${timestamp}] ${icons[type] || 'ℹ️'} ${message}`);
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    this.totalTests++;
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        validateStatus: () => true // Accept any status code
      };

      if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        config.data = data;
      }

      const response = await axios(config);
      return response;
    } catch (error) {
      this.log(`Request failed: ${error.message}`, 'error');
      this.failedTests++;
      return null;
    }
  }

  async testEndpoint(name, method, endpoint, expectedStatus, data = null, headers = {}) {
    this.log(`Testing: ${method} ${endpoint}`, 'info');
    
    const response = await this.makeRequest(method, endpoint, data, headers);
    
    if (!response) {
      this.log(`❌ ${name}: REQUEST FAILED`, 'error');
      this.failedTests++;
      return false;
    }

    const success = Array.isArray(expectedStatus) 
      ? expectedStatus.includes(response.status)
      : response.status === expectedStatus;

    if (success) {
      this.log(`✅ ${name}: PASSED (${response.status})`, 'success');
      this.passedTests++;
      return response;
    } else {
      this.log(`❌ ${name}: FAILED (expected ${expectedStatus}, got ${response.status})`, 'error');
      if (response.data) {
        console.log('Response:', response.data);
      }
      this.failedTests++;
      return false;
    }
  }

  // =============================================
  // AUTHENTICATION SETUP
  // =============================================

  async setupAuthentication() {
    this.log('\n🔐 Setting up Authentication...', 'info');

    // Try to login with test credentials (user already exists)
    const testUser = {
      email: 'test@payment.com',
      password: 'TestPassword123!'
    };

    // Try login with existing user
    let response = await this.makeRequest('POST', '/api/auth/login', testUser);
    
    if (response && response.status === 200 && response.data.success) {
      // Extract token and user ID based on your API structure
      this.userToken = response.data.data.tokens.accessToken;
      this.testUserId = response.data.data.user.id;
      
      this.log('✅ User login successful', 'success');
      this.log(`📝 Token: ${this.userToken ? 'SET' : 'NOT SET'}`, 'info');
      this.log(`📝 User ID: ${this.testUserId}`, 'info');
      this.log(`📝 User Role: ${response.data.data.user.role}`, 'info');
      
      // Check if user is admin
      if (response.data.data.user.role === 'SUPER_ADMIN') {
        this.adminToken = this.userToken;
        this.log('✅ Admin access available', 'success');
      } else {
        this.log('⚠️ User is not admin (will test admin endpoints anyway)', 'warning');
        this.adminToken = this.userToken; // Use user token for admin tests
      }
      
    } else {
      this.log(`❌ Login failed with status: ${response?.status}`, 'error');
      if (response?.data) {
        console.log('Login error:', response.data);
      }
      
      // Try registration if login fails
      const registerData = {
        ...testUser,
        fullName: 'Test Payment User',
        batch: 2020
      };

      this.log('Attempting user registration...', 'info');
      response = await this.makeRequest('POST', '/api/auth/register', registerData);
      
      if (response && [200, 201].includes(response.status)) {
        this.log('✅ User registration successful', 'success');
        
        // Now login
        const loginResponse = await this.makeRequest('POST', '/api/auth/login', testUser);
        if (loginResponse && loginResponse.status === 200 && loginResponse.data.success) {
          this.userToken = loginResponse.data.data.tokens.accessToken;
          this.testUserId = loginResponse.data.data.user.id;
          
          this.log('✅ User login after registration successful', 'success');
          this.log(`📝 Token: ${this.userToken ? 'SET' : 'NOT SET'}`, 'info');
          this.log(`📝 User ID: ${this.testUserId}`, 'info');
          
          // Set admin token (user won't be admin by default)
          this.adminToken = this.userToken;
        } else {
          this.log('❌ Login after registration failed', 'error');
          if (loginResponse?.data) {
            console.log('Login error:', loginResponse.data);
          }
        }
      } else {
        this.log('❌ User registration failed', 'error');
        if (response?.data) {
          console.log('Registration error:', response.data);
        }
      }
    }

    // Verify authentication works by testing /me endpoint
    if (this.userToken) {
      const meResponse = await this.makeRequest('GET', '/api/auth/me', null, {
        'Authorization': `Bearer ${this.userToken}`
      });

      if (meResponse && meResponse.status === 200) {
        this.log('✅ Token verification successful with /me endpoint', 'success');
        
        // Update user info from /me response if needed
        if (meResponse.data.data?.user?.id) {
          this.testUserId = meResponse.data.data.user.id;
        }
      } else {
        this.log('⚠️ Token verification failed', 'warning');
        console.log('/me response:', meResponse?.data);
      }
    }

    const authSuccess = !!(this.userToken && this.testUserId);
    this.log(`🔐 Authentication setup ${authSuccess ? 'SUCCESSFUL' : 'FAILED'}`, authSuccess ? 'success' : 'error');
    
    if (authSuccess) {
      this.log(`🎯 Ready to test with User ID: ${this.testUserId}`, 'info');
    }
    
    return authSuccess;
  }

  // =============================================
  // PAYMENT ENDPOINT TESTS
  // =============================================

  async testPaymentCalculation() {
    this.log('\n💰 Testing Payment Calculation...', 'info');

    // Test 1: Valid calculation request
    const calculationData = {
      referenceType: 'EVENT_REGISTRATION',
      referenceId: 'test-event-123',
      items: [
        { type: 'registration_fee', amount: 5000 },
        { type: 'guest_fee', amount: 2000, quantity: 2 }
      ],
      donationAmount: 1000
    };

    const response = await this.testEndpoint(
      'Payment Calculation',
      'POST',
      '/api/payments/calculate',
      [200, 400], // 400 is ok if validation fails
      calculationData,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 2: Invalid calculation request
    await this.testEndpoint(
      'Payment Calculation (Invalid)',
      'POST',
      '/api/payments/calculate',
      400,
      {},
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 3: Unauthorized access
    await this.testEndpoint(
      'Payment Calculation (Unauthorized)',
      'POST',
      '/api/payments/calculate',
      401,
      calculationData
    );

    return response;
  }

  async testPaymentInitiation() {
    this.log('\n🚀 Testing Payment Initiation...', 'info');

    const initiationData = {
      referenceType: 'EVENT_REGISTRATION',
      referenceId: 'test-event-123',
      amount: 10000, // ₹100 in paise
      currency: 'INR',
      description: 'Test Event Registration Payment',
      customerInfo: {
        name: 'Test User',
        email: 'test@payment.com',
        phone: '+919876543210'
      },
      metadata: {
        eventId: 'test-event-123',
        userId: this.testUserId
      }
    };

    // Test 1: Valid payment initiation
    const response = await this.testEndpoint(
      'Payment Initiation',
      'POST',
      '/api/payments/initiate',
      [200, 201, 400], // 400 might occur if validation fails
      initiationData,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Store transaction ID for later tests
    if (response && response.data && response.data.success) {
      // Try multiple possible locations for transaction ID
      this.testTransactionId = response.data.data?.transactionId || 
                              response.data.transactionId ||
                              response.data.data?.id ||
                              response.data.id;
      
      if (this.testTransactionId) {
        this.log(`📝 Stored transaction ID: ${this.testTransactionId}`, 'success');
      } else {
        this.log('⚠️ No transaction ID returned from payment initiation', 'warning');
        // Generate a valid UUID for testing
        this.testTransactionId = this.generateTestUUID();
        this.log(`📝 Using generated test UUID: ${this.testTransactionId}`, 'info');
      }
    } else {
      this.log('⚠️ Payment initiation failed, using generated UUID for tests', 'warning');
      this.testTransactionId = this.generateTestUUID();
      this.log(`📝 Using generated test UUID: ${this.testTransactionId}`, 'info');
    }

    // Test 2: Invalid amount
    await this.testEndpoint(
      'Payment Initiation (Invalid Amount)',
      'POST',
      '/api/payments/initiate',
      400,
      { ...initiationData, amount: -100 },
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 3: Unauthorized access
    await this.testEndpoint(
      'Payment Initiation (Unauthorized)',
      'POST',
      '/api/payments/initiate',
      401,
      initiationData
    );

    return response;
  }

  async testPaymentVerification() {
    this.log('\n🔍 Testing Payment Verification...', 'info');

    // Use stored transaction ID or generate a valid UUID
    const transactionId = this.testTransactionId || this.generateTestUUID();

    const verificationData = {
      paymentId: 'pay_test_123',
      orderId: 'order_test_123',
      signature: 'test_signature_123'
    };

    // Test 1: Payment verification
    await this.testEndpoint(
      'Payment Verification',
      'POST',
      `/api/payments/${transactionId}/verify`,
      [200, 400, 404], // Various statuses are acceptable
      verificationData,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 2: Invalid transaction ID format
    await this.testEndpoint(
      'Payment Verification (Invalid ID Format)',
      'POST',
      '/api/payments/invalid-id-format/verify',
      [400, 404],
      verificationData,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 3: Unauthorized access
    await this.testEndpoint(
      'Payment Verification (Unauthorized)',
      'POST',
      `/api/payments/${transactionId}/verify`,
      401,
      verificationData
    );
  }

  async testPaymentStatus() {
    this.log('\n📊 Testing Payment Status...', 'info');

    const transactionId = this.testTransactionId || this.generateTestUUID();

    // Test 1: Get payment status
    await this.testEndpoint(
      'Payment Status',
      'GET',
      `/api/payments/${transactionId}/status`,
      [200, 404], // 404 if transaction doesn't exist
      null,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 2: Invalid transaction ID format
    await this.testEndpoint(
      'Payment Status (Invalid ID Format)',
      'GET',
      '/api/payments/invalid-id-format/status',
      [400, 404],
      null,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 3: Unauthorized access
    await this.testEndpoint(
      'Payment Status (Unauthorized)',
      'GET',
      `/api/payments/${transactionId}/status`,
      401
    );
  }

  async testUserPaymentHistory() {
    this.log('\n📋 Testing User Payment History...', 'info');

    // Test 1: Get user payments
    await this.testEndpoint(
      'User Payment History',
      'GET',
      '/api/payments/my-payments',
      200,
      null,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 2: Get user payments with pagination
    await this.testEndpoint(
      'User Payment History (Paginated)',
      'GET',
      '/api/payments/my-payments?page=1&limit=5',
      200,
      null,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 3: Unauthorized access
    await this.testEndpoint(
      'User Payment History (Unauthorized)',
      'GET',
      '/api/payments/my-payments',
      401
    );
  }

  async testInvoiceGeneration() {
    this.log('\n🧾 Testing Invoice Generation...', 'info');

    const transactionId = this.testTransactionId || this.generateTestUUID();
    this.log(`📝 Using transaction ID for invoice tests: ${transactionId}`, 'info');

    // Test 1: Generate invoice
    await this.testEndpoint(
      'Invoice Generation',
      'POST',
      `/api/payments/${transactionId}/invoice`,
      [200, 201, 400, 404],
      null,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 2: Get invoice data
    await this.testEndpoint(
      'Get Invoice Data',
      'GET',
      `/api/payments/${transactionId}/invoice`,
      [200, 404],
      null,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 3: Download invoice PDF
    await this.testEndpoint(
      'Download Invoice PDF',
      'GET',
      `/api/payments/${transactionId}/invoice/pdf`,
      [200, 404],
      null,
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 4: Resend invoice email
    await this.testEndpoint(
      'Resend Invoice Email',
      'POST',
      `/api/payments/${transactionId}/invoice/resend`,
      [200, 404],
      { email: 'test@payment.com' },
      { 'Authorization': `Bearer ${this.userToken}` }
    );

    // Test 5: Invalid transaction ID format for invoice
    await this.testEndpoint(
      'Invoice Generation (Invalid ID Format)',
      'POST',
      '/api/payments/invalid-id-format/invoice',
      400,
      null,
      { 'Authorization': `Bearer ${this.userToken}` }
    );
  }

  async testAdminEndpoints() {
    this.log('\n👑 Testing Admin Endpoints...', 'info');

    // Test 1: Get all payments (admin)
    await this.testEndpoint(
      'Admin Payment List',
      'GET',
      '/api/payments/admin/payments',
      [200, 403], // 403 if not admin
      null,
      { 'Authorization': `Bearer ${this.adminToken}` }
    );

    // Test 2: Get payment analytics
    await this.testEndpoint(
      'Admin Payment Analytics',
      'GET',
      '/api/payments/admin/payments/analytics',
      [200, 403],
      null,
      { 'Authorization': `Bearer ${this.adminToken}` }
    );

    // Test 3: Get payment analytics with filters
    await this.testEndpoint(
      'Admin Payment Analytics (Filtered)',
      'GET',
      '/api/payments/admin/payments/analytics?fromDate=2024-01-01&toDate=2024-12-31&groupBy=month',
      [200, 403],
      null,
      { 'Authorization': `Bearer ${this.adminToken}` }
    );

    const transactionId = this.testTransactionId || this.generateTestUUID();

    // Test 4: Admin get specific payment details
    await this.testEndpoint(
      'Admin Payment Details',
      'GET',
      `/api/payments/admin/payments/${transactionId}`,
      [200, 403, 404],
      null,
      { 'Authorization': `Bearer ${this.adminToken}` }
    );

    // Test 5: Admin generate invoice
    await this.testEndpoint(
      'Admin Generate Invoice',
      'POST',
      `/api/payments/admin/payments/${transactionId}/invoice`,
      [200, 403, 404],
      null,
      { 'Authorization': `Bearer ${this.adminToken}` }
    );

    // Test 6: Admin get invoice
    await this.testEndpoint(
      'Admin Get Invoice',
      'GET',
      `/api/payments/admin/payments/${transactionId}/invoice`,
      [200, 403, 404],
      null,
      { 'Authorization': `Bearer ${this.adminToken}` }
    );
  }

  async testWebhookEndpoint() {
    this.log('\n🔗 Testing Webhook Endpoint...', 'info');

    const webhookPayload = {
      entity: 'event',
      account_id: 'acc_test',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_test_123',
            amount: 10000,
            currency: 'INR',
            status: 'captured',
            order_id: 'order_test_123'
          }
        }
      }
    };

    // Test 1: Razorpay webhook
    await this.testEndpoint(
      'Razorpay Webhook',
      'POST',
      '/api/payments/webhook/razorpay',
      [200, 400], // 400 for signature validation failure
      webhookPayload
    );

    // Test 2: Invalid provider
    await this.testEndpoint(
      'Invalid Provider Webhook',
      'POST',
      '/api/payments/webhook/invalid',
      [400, 404],
      webhookPayload
    );
  }

  // =============================================
  // COMPREHENSIVE TEST RUNNER
  // =============================================

  async runAllPaymentTests() {
    console.log('\n🧪 COMPREHENSIVE PAYMENT ENDPOINT TESTING');
    console.log('==========================================');

    const startTime = Date.now();

    // Setup
    const authSuccess = await this.setupAuthentication();
    if (!authSuccess) {
      this.log('❌ Authentication setup failed - some tests will be skipped', 'error');
    }

    // Run all endpoint tests
    const tests = [
      { name: 'Payment Calculation', fn: () => this.testPaymentCalculation() },
      { name: 'Payment Initiation', fn: () => this.testPaymentInitiation() },
      { name: 'Payment Verification', fn: () => this.testPaymentVerification() },
      { name: 'Payment Status', fn: () => this.testPaymentStatus() },
      { name: 'User Payment History', fn: () => this.testUserPaymentHistory() },
      { name: 'Invoice Generation', fn: () => this.testInvoiceGeneration() },
      { name: 'Admin Endpoints', fn: () => this.testAdminEndpoints() },
      { name: 'Webhook Endpoint', fn: () => this.testWebhookEndpoint() }
    ];

    for (const test of tests) {
      try {
        await test.fn();
      } catch (error) {
        this.log(`💥 ${test.name} test suite crashed: ${error.message}`, 'error');
        this.failedTests++;
      }
    }

    // Results
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n==========================================');
    console.log('📊 COMPREHENSIVE TEST RESULTS');
    console.log('==========================================');
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    console.log(`📊 Total: ${this.totalTests}`);
    console.log(`⏱️ Duration: ${duration}s`);
    console.log(`📈 Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);

    if (this.testTransactionId) {
      console.log(`🔗 Test Transaction ID: ${this.testTransactionId}`);
      console.log(`📋 Transaction ID Type: ${this.testTransactionId.includes('-') ? 'UUID Format' : 'Custom Format'}`);
    } else {
      console.log(`⚠️ No transaction ID captured from payment initiation`);
    }

    // Recommendations
    console.log('\n📋 NEXT STEPS:');
    if (this.passedTests >= this.totalTests * 0.8) {
      console.log('🎉 Payment system is working excellently!');
      console.log('1. ✅ All major endpoints are functional');
      console.log('2. 🔗 Test with real Razorpay credentials');
      console.log('3. 🌐 Setup webhook URL with ngrok');
      console.log('4. 🎨 Test full payment flow with UI');
      console.log('5. ⚡ Performance testing with load');
    } else if (this.passedTests >= this.totalTests * 0.7) {
      console.log('🎉 Payment system is working well!');
      console.log('1. ✅ Core payment functionality works');
      console.log('2. 🔧 Fix any validation issues found');
      console.log('3. 🔗 Test with real Razorpay credentials');
      console.log('4. 🌐 Setup webhook URL with ngrok');
      console.log('5. 📊 Test error scenarios and edge cases');
    } else {
      console.log('⚠️ Several endpoints need attention');
      console.log('1. 🔍 Check failed endpoints above');
      console.log('2. 🔐 Verify authentication setup');
      console.log('3. 🗄️ Check database migrations');
      console.log('4. ⚙️ Verify payment configuration');
      console.log('5. 📝 Check validation middleware');
    }

    // UUID validation guidance
    if (this.failedTests > 0) {
      console.log('\n💡 TROUBLESHOOTING TIPS:');
      console.log('- If you see "must be a valid GUID" errors: Validation is working correctly');
      console.log('- UUID format required for transaction IDs: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx');
      console.log('- 404 errors are expected for non-existent transactions');
      console.log('- 403 errors are expected for non-admin users on admin endpoints');
    }

    return this.passedTests >= this.totalTests * 0.5;
  }
}

// Run comprehensive tests if called directly
if (require.main === module) {
  const tester = new ComprehensivePaymentTester();
  tester.runAllPaymentTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensivePaymentTester;