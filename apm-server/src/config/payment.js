module.exports = {
  // Provider Selection (Environment-based)
  defaultProvider: process.env.PAYMENT_PROVIDER || 'RAZORPAY',
  
  // Razorpay Configuration
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    
    // Default Options
    options: {
      currency: 'INR',
      payment_capture: 1, // Auto-capture payments
      notes: {
        platform: 'Alumni Portal'
      }
    }
  },
  
  // Payment Settings
  settings: {
    defaultCurrency: 'INR',
    paymentTimeout: 30, // minutes
    
    webhook: {
      maxRetries: 5,
      retryDelayMs: 2000,
      timeoutMs: 30000
    },
    
    invoice: {
      autoGenerate: true,
      autoEmail: true,
      pdfStoragePath: '/public/invoices/',
      templatePath: '/templates/invoice-template.html'
    }
  },
  
  transaction: {
    numberPrefix: 'PT',
    invoicePrefix: 'INV',
    maxAmount: 10000000, // ₹1,00,000 in paise
    minAmount: 100 // ₹1 in paise
  },
  
  urls: {
    success: `${process.env.FRONTEND_URL}/payment/success`,
    failure: `${process.env.FRONTEND_URL}/payment/failure`,
    webhook: `${process.env.BACKEND_URL}/api/payments/webhook`
  }
};