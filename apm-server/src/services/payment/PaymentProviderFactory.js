const paymentConfig = require('../../config/payment');

class PaymentProviderFactory {
  static create(providerName = null) {
    const provider = providerName || paymentConfig.defaultProvider;
    
    switch (provider.toUpperCase()) {
      case 'RAZORPAY':
        const RazorpayProvider = require('./providers/RazorpayProvider');
        return new RazorpayProvider(paymentConfig.razorpay);
      
      case 'PAYTM':
        throw new Error('Paytm provider not yet implemented');
      
      case 'PHONEPE':
        throw new Error('PhonePe provider not yet implemented');
      
      default:
        throw new Error(`Payment provider ${provider} not supported`);
    }
  }

  static getSupportedProviders() {
    return ['RAZORPAY'];
  }

  static isProviderSupported(provider) {
    return this.getSupportedProviders().includes(provider.toUpperCase());
  }
}

module.exports = PaymentProviderFactory;