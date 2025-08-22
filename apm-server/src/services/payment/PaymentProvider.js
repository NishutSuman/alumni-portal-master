class PaymentProvider {
  constructor(config) {
    this.config = config;
    this.provider = this.constructor.name.replace('Provider', '').toUpperCase();
  }

  // Abstract methods that must be implemented by concrete providers
  async createOrder(orderData) {
    throw new Error('createOrder method must be implemented by payment provider');
  }

  async verifyPayment(paymentData) {
    throw new Error('verifyPayment method must be implemented by payment provider');
  }

  async verifyWebhookSignature(payload, signature) {
    throw new Error('verifyWebhookSignature method must be implemented by payment provider');
  }

  async processWebhook(webhookData) {
    throw new Error('processWebhook method must be implemented by payment provider');
  }

  async generatePaymentLink(orderData) {
    throw new Error('generatePaymentLink method must be implemented by payment provider');
  }

  // Common utility methods
  formatAmount(amount, currency = 'INR') {
    if (currency === 'INR') {
      return Math.round(amount * 100); // Convert to paise
    }
    return amount;
  }

  parseAmount(amount, currency = 'INR') {
    if (currency === 'INR') {
      return amount / 100; // Convert from paise
    }
    return amount;
  }

  generateTransactionNumber() {
    const prefix = 'PT';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}-${date}-${random}`;
  }

  generateInvoiceNumber() {
    const prefix = 'INV';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}-${date}-${random}`;
  }

  // Validation methods
  validateAmount(amount, currency = 'INR') {
    const paymentConfig = require('../../config/payment');
    const formattedAmount = this.formatAmount(amount, currency);
    
    if (formattedAmount < paymentConfig.transaction.minAmount) {
      throw new Error(`Amount too low. Minimum: ₹${paymentConfig.transaction.minAmount / 100}`);
    }
    
    if (formattedAmount > paymentConfig.transaction.maxAmount) {
      throw new Error(`Amount too high. Maximum: ₹${paymentConfig.transaction.maxAmount / 100}`);
    }
    
    return true;
  }

  validateCurrency(currency) {
    const supportedCurrencies = ['INR'];
    if (!supportedCurrencies.includes(currency)) {
      throw new Error(`Currency ${currency} not supported`);
    }
    return true;
  }

  // Logging methods
  log(level, message, data = {}) {
    console.log(`[${this.provider}] [${level.toUpperCase()}] ${message}`, data);
  }

  logInfo(message, data) {
    this.log('info', message, data);
  }

  logError(message, error) {
    this.log('error', message, { error: error.message, stack: error.stack });
  }

  logDebug(message, data) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, data);
    }
  }
}

module.exports = PaymentProvider;