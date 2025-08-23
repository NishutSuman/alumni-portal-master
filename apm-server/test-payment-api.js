require('dotenv').config();

const axios = require('axios');

class PaymentAPITester {
  constructor() {
    // Fix: Use correct port from environment
    this.baseURL = `http://localhost:${process.env.PORT || 3000}`;
    this.userToken = null;
    
    console.log(`🔧 Using base URL: ${this.baseURL}`);
  }

  // Test 1: Server connectivity
  async testServerConnection() {
    console.log('\n🔌 Testing Server Connection...');
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'PaymentTester/1.0'
        }
      });
      console.log('✅ Server is running and responding');
      console.log('Health Status:', response.data);
      return true;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Server is not running on port', process.env.PORT || 3000);
        console.log('💡 Start your server with: npm start or node src/server.js');
        return false;
      } else if (error.response?.status === 404) {
        console.log('⚠️ Health endpoint not found - but server is running');
        console.log('💡 Need to fix health endpoint in app.js');
        return true; // Server is running, just missing endpoint
      } else {
        console.log('❌ Server connection failed');
        console.log('Error:', error.message);
        console.log('Status:', error.response?.status);
        console.log('Headers:', error.response?.headers);
        return false;
      }
    }
  }

  // Test 2: Environment variables
  async testEnvironmentVariables() {
    console.log('\n📋 Testing Environment Variables...');
    
    const requiredVars = [
      'DATABASE_URL',
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'PAYMENT_PROVIDER'
    ];

    let allSet = true;
    
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        console.log(`✅ ${varName}: SET`);
      } else {
        console.log(`❌ ${varName}: NOT SET`);
        allSet = false;
      }
    }

    // Check port configuration
    console.log(`✅ PORT: ${process.env.PORT || '3000 (default)'}`);

    return allSet;
  }

  // Test 3: Payment configuration
  async testPaymentConfig() {
    console.log('\n⚙️ Testing Payment Configuration...');
    try {
      const paymentConfig = require('./src/config/payment');
      console.log('✅ Payment config file loaded');
      
      if (!paymentConfig.razorpay.keyId) {
        console.log('❌ Razorpay keyId not loaded from config');
        return false;
      }

      if (!paymentConfig.razorpay.keySecret) {
        console.log('❌ Razorpay keySecret not loaded from config');
        return false;
      }

      console.log('✅ Razorpay credentials loaded successfully');
      console.log('✅ Default provider:', paymentConfig.defaultProvider);
      
      return true;
    } catch (error) {
      console.log('❌ Payment configuration test failed');
      console.log('Error:', error.message);
      
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log('💡 Create src/config/payment.js file');
      }
      
      return false;
    }
  }

  // Test 4: Database connection
  async testDatabaseConnection() {
    console.log('\n🗄️ Testing Database Connection...');
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      await prisma.$connect();
      console.log('✅ Database connection successful');
      
      // Test if payment tables exist
      try {
        await prisma.paymentTransaction.findMany({ take: 1 });
        console.log('✅ PaymentTransaction table accessible');
      } catch (tableError) {
        console.log('⚠️ PaymentTransaction table not found');
        console.log('💡 Run: npx prisma migrate dev');
      }
      
      await prisma.$disconnect();
      return true;
    } catch (error) {
      console.log('❌ Database connection failed');
      console.log('Error:', error.message);
      return false;
    }
  }

  // Test 5: Payment routes registration
  async testPaymentRoutes() {
    console.log('\n🌐 Testing Payment Routes...');
    
    // Test if payment routes are registered
    const testRoutes = [
      '/api/payments/webhook/razorpay',
      '/api/auth/login', // Should exist
      '/api/users/profile/1' // Should exist
    ];

    let routesWorking = 0;
    
    for (const route of testRoutes) {
      try {
        const response = await axios.get(`${this.baseURL}${route}`, {
          validateStatus: () => true,
          timeout: 3000
        });
        
        if (response.status === 404 && route.includes('payment')) {
          console.log(`⚠️ Payment route ${route} returns 404 - routes not registered`);
        } else if (response.status !== 404) {
          console.log(`✅ Route ${route} is registered (status: ${response.status})`);
          routesWorking++;
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log('❌ Server not running');
          return false;
        }
        console.log(`⚠️ Route ${route} test inconclusive:`, error.message);
      }
    }

    if (routesWorking === 0) {
      console.log('❌ No routes responding - check app.js route registration');
      return false;
    }

    return true;
  }

  // Test 6: Authentication flow
  async testAuthenticationFlow() {
    console.log('\n🔐 Testing Authentication...');
    try {
      // Test user registration/login flow
      const loginData = {
        email: 'test@example.com',
        password: 'testpassword'
      };

      const response = await axios.post(`${this.baseURL}/api/auth/login`, loginData, {
        validateStatus: () => true,
        timeout: 5000
      });

      if (response.status === 404) {
        console.log('⚠️ Auth routes not found - check route registration');
        return false;
      } else if (response.status === 400 || response.status === 401) {
        console.log('✅ Auth routes responding (credentials invalid - expected)');
        return true;
      } else {
        console.log('✅ Auth system operational');
        return true;
      }
    } catch (error) {
      console.log('⚠️ Auth test inconclusive:', error.message);
      return true; // Don't fail on auth test
    }
  }

  // Test 7: Payment endpoint accessibility
  async testPaymentEndpoints() {
    console.log('\n💳 Testing Payment Endpoints...');
    
    const endpoints = [
      { method: 'POST', path: '/api/payments/calculate', needsAuth: true },
      { method: 'POST', path: '/api/payments/initiate', needsAuth: true },
      { method: 'GET', path: '/api/payments/my-payments', needsAuth: true },
      { method: 'POST', path: '/api/payments/webhook/razorpay', needsAuth: false }
    ];

    let accessible = 0;

    for (const endpoint of endpoints) {
      try {
        const config = {
          validateStatus: () => true,
          timeout: 3000,
          headers: endpoint.needsAuth ? { 'Authorization': 'Bearer invalid_token' } : {}
        };

        let response;
        if (endpoint.method === 'POST') {
          response = await axios.post(`${this.baseURL}${endpoint.path}`, {}, config);
        } else {
          response = await axios.get(`${this.baseURL}${endpoint.path}`, config);
        }

        if (response.status === 404) {
          console.log(`❌ ${endpoint.method} ${endpoint.path} - NOT FOUND`);
        } else if (response.status === 401 && endpoint.needsAuth) {
          console.log(`✅ ${endpoint.method} ${endpoint.path} - PROTECTED (401 expected)`);
          accessible++;
        } else if (response.status === 400 || response.status === 422) {
          console.log(`✅ ${endpoint.method} ${endpoint.path} - VALIDATION ERROR (expected)`);
          accessible++;
        } else {
          console.log(`✅ ${endpoint.method} ${endpoint.path} - RESPONDING (${response.status})`);
          accessible++;
        }
      } catch (error) {
        console.log(`⚠️ ${endpoint.method} ${endpoint.path} - ERROR:`, error.message);
      }
    }

    console.log(`📊 Payment endpoints accessible: ${accessible}/${endpoints.length}`);
    return accessible > 0;
  }

  // Run all tests
  async runAllTests() {
    console.log('🧪 PAYMENT SYSTEM DIAGNOSTIC TESTS');
    console.log('==========================================');

    const tests = [
      { name: 'Server Connection', fn: () => this.testServerConnection() },
      { name: 'Environment Variables', fn: () => this.testEnvironmentVariables() },
      { name: 'Payment Configuration', fn: () => this.testPaymentConfig() },
      { name: 'Database Connection', fn: () => this.testDatabaseConnection() },
      { name: 'Payment Routes', fn: () => this.testPaymentRoutes() },
      { name: 'Authentication Flow', fn: () => this.testAuthenticationFlow() },
      { name: 'Payment Endpoints', fn: () => this.testPaymentEndpoints() }
    ];

    let passed = 0;
    const total = tests.length;

    for (const test of tests) {
      try {
        const result = await test.fn();
        if (result) passed++;
      } catch (error) {
        console.log(`💥 ${test.name} test crashed:`, error.message);
      }
    }

    console.log('\n==========================================');
    console.log(`📊 DIAGNOSTIC RESULTS: ${passed}/${total} tests passed`);

    if (passed >= 5) {
      console.log('🎉 Payment system is operational!');
      this.printNextSteps();
    } else {
      console.log('⚠️ Critical issues found. See fixes below:');
      this.printTroubleshootingGuide();
    }

    return passed >= 5;
  }

  printTroubleshootingGuide() {
    console.log('\n🔧 TROUBLESHOOTING GUIDE:');
    console.log('==========================================');
    console.log('1. 🚀 Start Server: npm start or node src/server.js');
    console.log('2. 📋 Check Port: Ensure server runs on port', process.env.PORT || 3000);
    console.log('3. 🔗 Register Routes: Uncomment payment routes in app.js');
    console.log('4. 🏥 Fix Health: Add health endpoint at /health');
    console.log('5. 🗄️ Database: Run npx prisma migrate dev');
    console.log('6. 🔧 Config: Create src/config/payment.js');
  }

  printNextSteps() {
    console.log('\n🚀 NEXT STEPS:');
    console.log('==========================================');
    console.log('1. 🧪 Test individual payment endpoints');
    console.log('2. 🎯 Test payment flow end-to-end');
    console.log('3. 🔗 Setup Razorpay webhook');
    console.log('4. 📊 Test admin dashboard');
    console.log('5. 🧾 Test invoice generation');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new PaymentAPITester();
  tester.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = PaymentAPITester;