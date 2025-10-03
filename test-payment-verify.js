// Test script to directly verify payment completion
const axios = require('axios');

// Replace with your actual values
const TRANSACTION_ID = 'your-transaction-id-here'; // From your payment transaction
const RAZORPAY_ORDER_ID = 'your-razorpay-order-id'; // From your payment transaction
const AUTH_TOKEN = 'your-jwt-token'; // Get from localStorage/network tab

// Simulate payment verification
const verifyPayment = async () => {
  try {
    const response = await axios.post(
      `http://localhost:3000/api/payments/${TRANSACTION_ID}/verify`,
      {
        razorpay_order_id: RAZORPAY_ORDER_ID,
        razorpay_payment_id: `pay_test_${Date.now()}`, // Mock payment ID
        razorpay_signature: 'test_signature_12345' // Mock signature for test
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Payment Verification Response:', response.data);
  } catch (error) {
    console.error('Verification Error:', error.response?.data || error.message);
  }
};

console.log('Testing payment verification...');
console.log('Make sure to update TRANSACTION_ID, RAZORPAY_ORDER_ID, and AUTH_TOKEN above');
// verifyPayment();