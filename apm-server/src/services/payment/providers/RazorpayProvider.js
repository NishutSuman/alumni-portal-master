// src/services/payment/providers/RazorpayProvider.js
// Razorpay-specific payment provider implementation

const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentProvider = require('../PaymentProvider');

class RazorpayProvider extends PaymentProvider {
  constructor(config) {
    super(config);
    
    // Initialize Razorpay instance
    this.razorpay = new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret
    });
    
    this.webhookSecret = config.webhookSecret;
    this.logInfo('Razorpay provider initialized', { keyId: config.keyId });
  }

  // ==============================================
  // ORDER CREATION
  // ==============================================
  async createOrder(orderData) {
    try {
      this.logDebug('Creating Razorpay order', orderData);
      
      // Validate required fields
      this.validateOrderData(orderData);
      
      // Format amount to paise
      const amountInPaise = this.formatAmount(orderData.amount, orderData.currency);
      
      // Prepare Razorpay order options
      const options = {
        amount: amountInPaise,
        currency: orderData.currency || 'INR',
        receipt: orderData.transactionNumber,
        notes: {
          ...this.config.options.notes,
          referenceType: orderData.referenceType,
          referenceId: orderData.referenceId,
          userId: orderData.userId,
          description: orderData.description
        },
        payment_capture: this.config.options.payment_capture
      };

      // Create order with Razorpay
      const razorpayOrder = await this.razorpay.orders.create(options);
      
      this.logInfo('Razorpay order created successfully', {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        receipt: razorpayOrder.receipt
      });

      // Return standardized order response
      return {
        success: true,
        provider: 'RAZORPAY',
        providerOrderId: razorpayOrder.id,
        amount: this.parseAmount(razorpayOrder.amount, razorpayOrder.currency),
        currency: razorpayOrder.currency,
        status: razorpayOrder.status,
        providerOrderData: razorpayOrder,
        expiresAt: new Date(Date.now() + (30 * 60 * 1000)) // 30 minutes from now
      };

    } catch (error) {
      this.logError('Failed to create Razorpay order', error);
      throw new Error(`Razorpay order creation failed: ${error.message}`);
    }
  }

  // ==============================================
  // PAYMENT VERIFICATION
  // ==============================================
  async verifyPayment(paymentData) {
    try {
      this.logDebug('Verifying Razorpay payment', {
        orderId: paymentData.razorpay_order_id,
        paymentId: paymentData.razorpay_payment_id
      });

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      } = paymentData;

      // Validate required fields
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new Error('Missing required payment verification fields');
      }

      // Generate signature for verification
      const generatedSignature = this.generatePaymentSignature(
        razorpay_order_id,
        razorpay_payment_id
      );

      // Verify signature
      const isSignatureValid = generatedSignature === razorpay_signature;
      
      if (!isSignatureValid) {
        this.logError('Payment signature verification failed', {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          expectedSignature: generatedSignature,
          receivedSignature: razorpay_signature
        });
        throw new Error('Payment signature verification failed');
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await this.razorpay.payments.fetch(razorpay_payment_id);
      
      this.logInfo('Payment verified successfully', {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: paymentDetails.amount,
        status: paymentDetails.status
      });

      return {
        success: true,
        verified: true,
        provider: 'RAZORPAY',
        providerOrderId: razorpay_order_id,
        providerPaymentId: razorpay_payment_id,
        amount: this.parseAmount(paymentDetails.amount, paymentDetails.currency),
        currency: paymentDetails.currency,
        status: this.mapRazorpayStatus(paymentDetails.status),
        method: paymentDetails.method,
        providerPaymentData: paymentDetails,
        completedAt: paymentDetails.created_at ? new Date(paymentDetails.created_at * 1000) : new Date()
      };

    } catch (error) {
      this.logError('Payment verification failed', error);
      return {
        success: false,
        verified: false,
        error: error.message
      };
    }
  }

  // ==============================================
  // WEBHOOK SIGNATURE VERIFICATION
  // ==============================================
  async verifyWebhookSignature(payload, signature) {
    try {
      this.logDebug('Verifying webhook signature');

      if (!signature) {
        throw new Error('Webhook signature missing');
      }

      // Generate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      // Compare signatures
      const isValid = expectedSignature === signature;
      
      this.logDebug('Webhook signature verification result', {
        isValid,
        signatureLength: signature.length,
        expectedLength: expectedSignature.length
      });

      return isValid;

    } catch (error) {
      this.logError('Webhook signature verification failed', error);
      return false;
    }
  }

  // ==============================================
  // WEBHOOK PROCESSING
  // ==============================================
  async processWebhook(webhookData) {
    try {
      const { event, payload } = webhookData;
      
      this.logInfo('Processing webhook event', {
        event,
        entityType: payload.entity,
        entityId: payload.payment?.entity?.id || payload.order?.entity?.id
      });

      // Process different webhook events
      switch (event) {
        case 'payment.captured':
          return this.processPaymentCaptured(payload);
        
        case 'payment.failed':
          return this.processPaymentFailed(payload);
        
        case 'order.paid':
          return this.processOrderPaid(payload);
        
        default:
          this.logInfo('Webhook event not handled', { event });
          return {
            success: true,
            action: 'ignored',
            message: `Event ${event} not handled`
          };
      }

    } catch (error) {
      this.logError('Webhook processing failed', error);
      throw error;
    }
  }

  // ==============================================
  // PAYMENT LINK GENERATION
  // ==============================================
  async generatePaymentLink(orderData) {
    try {
      // For Razorpay, we return checkout options for frontend integration
      const checkoutOptions = {
        key: this.config.keyId,
        amount: this.formatAmount(orderData.amount, orderData.currency),
        currency: orderData.currency || 'INR',
        name: 'Alumni Portal',
        description: orderData.description,
        image: process.env.ORGANIZATION_LOGO || '',
        order_id: orderData.providerOrderId,
        handler: function(response) {
          // This will be handled on frontend
          console.log('Payment response:', response);
        },
        prefill: {
          name: orderData.user?.fullName || '',
          email: orderData.user?.email || '',
          contact: orderData.user?.whatsappNumber || ''
        },
        notes: {
          referenceType: orderData.referenceType,
          referenceId: orderData.referenceId
        },
        theme: {
          color: '#3399cc'
        },
        modal: {
          ondismiss: function() {
            console.log('Payment modal dismissed');
          }
        }
      };

      return {
        success: true,
        paymentLink: null, // Razorpay uses modal, not direct link
        checkoutOptions,
        instructions: 'Use checkout options with Razorpay frontend SDK'
      };

    } catch (error) {
      this.logError('Payment link generation failed', error);
      throw error;
    }
  }

  // ==============================================
  // PRIVATE HELPER METHODS
  // ==============================================

  validateOrderData(orderData) {
    const required = ['amount', 'transactionNumber', 'description', 'referenceType', 'referenceId', 'userId'];
    
    for (const field of required) {
      if (!orderData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    this.validateAmount(orderData.amount, orderData.currency);
    this.validateCurrency(orderData.currency || 'INR');
  }

  generatePaymentSignature(orderId, paymentId) {
    return crypto
      .createHmac('sha256', this.config.keySecret)
      .update(orderId + '|' + paymentId)
      .digest('hex');
  }

  mapRazorpayStatus(razorpayStatus) {
    const statusMap = {
      'created': 'PENDING',
      'authorized': 'PROCESSING',
      'captured': 'COMPLETED',
      'refunded': 'REFUNDED',
      'failed': 'FAILED'
    };

    return statusMap[razorpayStatus] || 'PENDING';
  }

  // Webhook event processors
  async processPaymentCaptured(payload) {
    const payment = payload.payment.entity;
    
    return {
      success: true,
      action: 'payment_captured',
      data: {
        providerPaymentId: payment.id,
        providerOrderId: payment.order_id,
        amount: this.parseAmount(payment.amount, payment.currency),
        currency: payment.currency,
        status: 'COMPLETED',
        method: payment.method,
        completedAt: new Date(payment.created_at * 1000),
        providerData: payment
      }
    };
  }

  async processPaymentFailed(payload) {
    const payment = payload.payment.entity;
    
    return {
      success: true,
      action: 'payment_failed',
      data: {
        providerPaymentId: payment.id,
        providerOrderId: payment.order_id,
        amount: this.parseAmount(payment.amount, payment.currency),
        currency: payment.currency,
        status: 'FAILED',
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        failedAt: new Date(payment.created_at * 1000),
        providerData: payment
      }
    };
  }

  async processOrderPaid(payload) {
    const order = payload.order.entity;
    
    return {
      success: true,
      action: 'order_paid',
      data: {
        providerOrderId: order.id,
        amount: this.parseAmount(order.amount, order.currency),
        currency: order.currency,
        status: 'COMPLETED',
        paidAt: new Date(order.created_at * 1000),
        providerData: order
      }
    };
  }
}

module.exports = RazorpayProvider;