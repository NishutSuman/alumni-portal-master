// =============================================
// FILE: debug-env.js
// Create this file in your PROJECT ROOT (same level as package.json)
// =============================================

console.log('🔍 Environment Variables Debug:');
console.log('==============================');

// Check if .env file loading works
require('dotenv').config();

console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('PAYMENT_PROVIDER:', process.env.PAYMENT_PROVIDER || 'not set');

// Check Razorpay credentials (don't log actual values for security)
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? `SET (${process.env.RAZORPAY_KEY_ID.substring(0, 10)}...)` : 'NOT SET ❌');
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'SET ✅' : 'NOT SET ❌');
console.log('RAZORPAY_WEBHOOK_SECRET:', process.env.RAZORPAY_WEBHOOK_SECRET ? 'SET ✅' : 'NOT SET ❌');

console.log('\n📋 Payment Config Test:');
console.log('=======================');

try {
  const paymentConfig = require('./config/payment');
  console.log('✅ Payment config file loaded');
  console.log('Default provider:', paymentConfig.defaultProvider);
  console.log('Razorpay keyId loaded:', paymentConfig.razorpay.keyId ? 'YES ✅' : 'NO ❌');
  console.log('Razorpay keySecret loaded:', paymentConfig.razorpay.keySecret ? 'YES ✅' : 'NO ❌');
  console.log('Razorpay webhookSecret loaded:', paymentConfig.razorpay.webhookSecret ? 'YES ✅' : 'NO ❌');
  
  // Show partial key for verification
  if (paymentConfig.razorpay.keyId) {
    console.log('Key ID preview:', paymentConfig.razorpay.keyId.substring(0, 15) + '...');
  }
  
} catch (error) {
  console.log('❌ Error loading payment config:', error.message);
}

console.log('\n🔧 Troubleshooting Tips:');
console.log('=======================');

if (!process.env.RAZORPAY_KEY_ID) {
  console.log('❌ RAZORPAY_KEY_ID missing');
  console.log('💡 Add to .env: RAZORPAY_KEY_ID=rzp_test_your_key');
}

if (!process.env.RAZORPAY_KEY_SECRET) {
  console.log('❌ RAZORPAY_KEY_SECRET missing');
  console.log('💡 Add to .env: RAZORPAY_KEY_SECRET=your_secret');
}

if (!process.env.PAYMENT_PROVIDER) {
  console.log('❌ PAYMENT_PROVIDER missing');
  console.log('💡 Add to .env: PAYMENT_PROVIDER=RAZORPAY');
}

console.log('\n📝 Expected .env format:');
console.log('========================');
console.log('PAYMENT_PROVIDER=RAZORPAY');
console.log('RAZORPAY_KEY_ID=rzp_test_your_actual_key');
console.log('RAZORPAY_KEY_SECRET=your_actual_secret');
console.log('RAZORPAY_WEBHOOK_SECRET=any_random_string');
console.log('FRONTEND_URL=http://localhost:3000');
console.log('BACKEND_URL=http://localhost:5000');

// =============================================
// QUICK .env FILE CHECKER
// =============================================

const fs = require('fs');
const path = require('path');

console.log('\n📁 .env File Check:');
console.log('===================');

const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists at:', envPath);
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    console.log('📄 .env file contents (first few lines):');
    lines.slice(0, 10).forEach((line, index) => {
      // Hide sensitive values
      if (line.includes('SECRET') || line.includes('KEY')) {
        const [key] = line.split('=');
        console.log(`   ${index + 1}. ${key}=***hidden***`);
      } else {
        console.log(`   ${index + 1}. ${line}`);
      }
    });
    
    if (lines.length > 10) {
      console.log(`   ... and ${lines.length - 10} more lines`);
    }
    
  } catch (error) {
    console.log('❌ Error reading .env file:', error.message);
  }
  
} else {
  console.log('❌ .env file not found at:', envPath);
  console.log('💡 Create .env file in your project root directory');
}

console.log('\n✅ Environment debug complete!');
console.log('Now run: node test-payment-api.js');