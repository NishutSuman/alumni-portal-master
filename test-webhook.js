// Test script to simulate Razorpay webhook for payment completion
const axios = require('axios');
const crypto = require('crypto');

// Replace with your actual transaction details from the database
const TRANSACTION_ID = 'your-transaction-id-here'; // Get this from your payment transaction
const RAZORPAY_ORDER_ID = 'your-razorpay-order-id'; // Get this from your payment transaction
const WEBHOOK_SECRET = 'your-webhook-secret'; // From your .env file

// Simulate successful payment webhook
const webhookPayload = {
  entity: 'event',
  account_id: 'acc_test_account',
  event: 'payment.captured',
  contains: ['payment'],
  payload: {
    payment: {
      entity: {
        id: `pay_test_${Date.now()}`,
        entity: 'payment',
        amount: 50000, // Amount in paisa (₹500)
        currency: 'INR',
        status: 'captured',
        order_id: RAZORPAY_ORDER_ID,
        method: 'card',
        captured: true,
        created_at: Math.floor(Date.now() / 1000)
      }
    }
  },
  created_at: Math.floor(Date.now() / 1000)
};

// Generate signature
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(webhookPayload))
  .digest('hex');

// Send webhook
async function simulateWebhook() {
  try {
    const response = await axios.post('http://localhost:3000/api/payments/webhook/razorpay', webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': signature
      }
    });
    
    console.log('Webhook Response:', response.data);
  } catch (error) {
    console.error('Webhook Error:', error.response?.data || error.message);
  }
}

console.log('Simulating payment webhook...');
console.log('Make sure to update TRANSACTION_ID and RAZORPAY_ORDER_ID above');
// simulateWebhook();