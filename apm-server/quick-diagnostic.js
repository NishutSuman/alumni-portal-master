// quick-diagnostic.js
// Quick diagnostic script to identify missing components

require('dotenv').config();
const fs = require('fs');
const path = require('path');

class PaymentDiagnostic {
  constructor() {
    this.issues = [];
    this.fixes = [];
  }

  checkFile(filePath, description) {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ ${description}: EXISTS`);
      return true;
    } else {
      console.log(`❌ ${description}: MISSING`);
      this.issues.push(`Missing: ${filePath}`);
      return false;
    }
  }

  checkEnvVariable(varName) {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: SET`);
      return true;
    } else {
      console.log(`❌ ${varName}: NOT SET`);
      this.issues.push(`Environment variable not set: ${varName}`);
      return false;
    }
  }

  async checkPort() {
    const port = process.env.PORT || 3000;
    console.log(`🔧 Port configured: ${port}`);
    
    // Check if something is running on the port
    const net = require('net');
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.close();
        console.log(`✅ Port ${port}: AVAILABLE`);
        resolve(true);
      });
      server.on('error', () => {
        console.log(`⚠️ Port ${port}: IN USE (server might be running)`);
        resolve(false);
      });
    });
  }

  checkPaymentFiles() {
    console.log('\n📁 PAYMENT SYSTEM FILES CHECK:');
    console.log('=====================================');

    const requiredFiles = [
      { path: 'src/routes/payments.route.js', desc: 'Payment Routes' },
      { path: 'src/controllers/payment.controller.js', desc: 'Payment Controller' },
      { path: 'src/controllers/invoice.controller.js', desc: 'Invoice Controller' },
      { path: 'src/middleware/payment.validation.middleware.js', desc: 'Payment Validation' },
      { path: 'src/middleware/payment.cache.middleware.js', desc: 'Payment Cache' },
      { path: 'src/services/payment/InvoiceService.js', desc: 'Invoice Service' },
      { path: 'src/config/payment.js', desc: 'Payment Config' },
      { path: 'src/app.js', desc: 'Main App File' },
      { path: 'src/server.js', desc: 'Server File' }
    ];

    let filesPresent = 0;
    for (const file of requiredFiles) {
      if (this.checkFile(file.path, file.desc)) {
        filesPresent++;
      } else {
        this.fixes.push(`Create ${file.path}`);
      }
    }

    return filesPresent === requiredFiles.length;
  }

  checkEnvironmentVariables() {
    console.log('\n🔧 ENVIRONMENT VARIABLES CHECK:');
    console.log('=====================================');

    const requiredVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'PAYMENT_PROVIDER'
    ];

    let varsSet = 0;
    for (const varName of requiredVars) {
      if (this.checkEnvVariable(varName)) {
        varsSet++;
      } else {
        this.fixes.push(`Set ${varName} in .env file`);
      }
    }

    return varsSet === requiredVars.length;
  }

  checkAppJsConfiguration() {
    console.log('\n⚙️ APP.JS CONFIGURATION CHECK:');
    console.log('=====================================');

    try {
      const appPath = path.join(process.cwd(), 'src/app.js');
      if (!fs.existsSync(appPath)) {
        console.log('❌ src/app.js not found');
        this.fixes.push('Create src/app.js file');
        return false;
      }

      const appContent = fs.readFileSync(appPath, 'utf8');
      
      // Check if payment routes are uncommented
      if (appContent.includes("app.use('/api/payments'") && !appContent.includes("// app.use('/api/payments'")) {
        console.log('✅ Payment routes: REGISTERED');
      } else {
        console.log('❌ Payment routes: NOT REGISTERED');
        this.fixes.push('Uncomment payment routes in app.js');
      }

      // Check if health endpoint exists
      if (appContent.includes("app.get('/health'")) {
        console.log('✅ Health endpoint: EXISTS');
      } else {
        console.log('❌ Health endpoint: MISSING');
        this.fixes.push('Add health endpoint to app.js');
      }

      // Check CORS configuration
      if (appContent.includes('cors({')) {
        console.log('✅ CORS: CONFIGURED');
      } else {
        console.log('❌ CORS: NOT CONFIGURED');
        this.fixes.push('Configure CORS in app.js');
      }

      return true;
    } catch (error) {
      console.log('❌ Error reading app.js:', error.message);
      return false;
    }
  }

  async checkDatabase() {
    console.log('\n🗄️ DATABASE CHECK:');
    console.log('=====================================');

    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      await prisma.$connect();
      console.log('✅ Database connection: SUCCESSFUL');
      
      // Check if payment tables exist
      try {
        await prisma.paymentTransaction.findMany({ take: 1 });
        console.log('✅ PaymentTransaction table: EXISTS');
      } catch (error) {
        console.log('❌ PaymentTransaction table: MISSING');
        this.fixes.push('Run: npx prisma migrate dev');
      }
      
      await prisma.$disconnect();
      return true;
    } catch (error) {
      console.log('❌ Database connection: FAILED');
      console.log('Error:', error.message);
      this.fixes.push('Fix database connection in .env');
      return false;
    }
  }

  async runFullDiagnostic() {
    console.log('🔍 PAYMENT SYSTEM FULL DIAGNOSTIC');
    console.log('=====================================');

    const checks = [
      { name: 'Payment Files', fn: () => this.checkPaymentFiles() },
      { name: 'Environment Variables', fn: () => this.checkEnvironmentVariables() },
      { name: 'App.js Configuration', fn: () => this.checkAppJsConfiguration() },
      { name: 'Database Connection', fn: () => this.checkDatabase() },
      { name: 'Port Availability', fn: () => this.checkPort() }
    ];

    let passed = 0;
    for (const check of checks) {
      try {
        const result = await check.fn();
        if (result) passed++;
      } catch (error) {
        console.log(`💥 ${check.name} check failed:`, error.message);
      }
    }

    console.log('\n=====================================');
    console.log(`📊 DIAGNOSTIC RESULTS: ${passed}/${checks.length} checks passed`);

    if (this.issues.length > 0) {
      console.log('\n❌ ISSUES FOUND:');
      this.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }

    if (this.fixes.length > 0) {
      console.log('\n🔧 REQUIRED FIXES:');
      this.fixes.forEach((fix, index) => {
        console.log(`   ${index + 1}. ${fix}`);
      });
    }

    if (passed >= 4) {
      console.log('\n🎉 System ready for testing!');
      console.log('Run: node test-payment-api.js');
    } else {
      console.log('\n⚠️ Fix the issues above before testing');
    }

    return passed >= 4;
  }
}

// Run diagnostic if called directly
if (require.main === module) {
  const diagnostic = new PaymentDiagnostic();
  diagnostic.runFullDiagnostic().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = PaymentDiagnostic;