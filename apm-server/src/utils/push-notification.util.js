// src/utils/push-notification.util.js
// Firebase Cloud Messaging Utility - Web & Mobile Push Notifications

const admin = require('firebase-admin');
const path = require('path');

/**
 * Initialize Firebase Admin SDK
 * Place your Firebase service account JSON file in the config folder
 */
class PushNotificationService {
  constructor() {
    this.initialized = false;
    try {
      this.initializeFirebase();
    } catch (error) {
      console.warn('❌ Firebase initialization failed in constructor:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Initialize Firebase Admin SDK
   */
  initializeFirebase() {
    try {
      // Skip initialization if already done or in test environment
      if (this.initialized || process.env.NODE_ENV === 'test') {
        return;
      }

      const fs = require('fs');
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        || path.join(__dirname, '../config/firebase-service-account.json');

      // Check if Firebase credentials are available
      const hasEnvCredentials = process.env.FIREBASE_PROJECT_ID &&
                                process.env.FIREBASE_CLIENT_EMAIL &&
                                process.env.FIREBASE_PRIVATE_KEY;
      const hasServiceAccountFile = fs.existsSync(serviceAccountPath);

      if (!hasEnvCredentials && !hasServiceAccountFile) {
        // No Firebase credentials - run in mock mode
        console.log('📱 Mock Firebase push notifications enabled (no credentials found)');
        console.log('💡 To enable real push notifications, set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
        this.initialized = true;
        this.mockMode = true;
        return;
      }

      // Check if Firebase is already initialized
      if (!admin.apps.length) {
        // Initialize with service account file if it exists
        if (hasServiceAccountFile) {
          admin.initializeApp({
            credential: admin.credential.cert(require(serviceAccountPath)),
            projectId: process.env.FIREBASE_PROJECT_ID
          });
          console.log('✅ Firebase initialized with service account file');
        } else if (hasEnvCredentials) {
          // Initialize with environment variables (for production)
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            }),
            projectId: process.env.FIREBASE_PROJECT_ID
          });
          console.log('✅ Firebase initialized with environment variables');
        }
      }

      this.messaging = admin.messaging();
      this.initialized = true;
      this.mockMode = false;
      console.log('✅ Firebase Admin SDK initialized successfully - Push notifications ENABLED');

    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      console.log('📱 Falling back to mock mode for push notifications');
      this.initialized = true;
      this.mockMode = true;
    }
  }

  /**
   * Send notification to single token
   * @param {Object} options - Notification options
   * @returns {Promise<Object>} Send result
   */
  async sendToToken(options) {
    try {
      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      const { token, title, body, data = {}, priority = 'normal' } = options;

      // Mock mode for development
      if (this.mockMode) {
        console.log('📱 MOCK PUSH NOTIFICATION:', {
          token: token?.substring(0, 20) + '...',
          title,
          body,
          data,
          priority
        });
        
        return {
          success: true,
          messageId: 'mock-' + Date.now(),
          token,
          mockMode: true
        };
      }

      const message = {
        token,
        notification: {
          title,
          body
        },
        data: this.sanitizeData(data),
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: this.getChannelId(data.type),
            priority: priority === 'high' ? 'high' : 'default',
            defaultSound: true,
            defaultVibrateTimings: true
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body
              },
              sound: 'default',
              badge: 1
            }
          },
          headers: {
            'apns-priority': priority === 'high' ? '10' : '5'
          }
        },
        webpush: {
          notification: {
            title,
            body,
            icon: '/icons/icon-192x192.png', // Your app icon
            badge: '/icons/badge-72x72.png', // Small badge icon
            tag: data.type || 'default',
            requireInteraction: priority === 'high',
            actions: this.getNotificationActions(data.type)
          },
          fcmOptions: {
            link: this.getNotificationLink(data)
          }
        }
      };

      const response = await this.messaging.send(message);
      console.log('✅ Push notification sent successfully:', response);

      return {
        success: true,
        messageId: response,
        token
      };

    } catch (error) {
      console.error('❌ Send to token error:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'messaging/registration-token-not-registered') {
        return {
          success: false,
          error: 'TOKEN_INVALID',
          message: 'Token no longer valid'
        };
      }

      return {
        success: false,
        error: error.code || 'UNKNOWN_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Send notification to multiple tokens
   * @param {Object} options - Notification options with tokens array
   * @returns {Promise<Object>} Send result with success/failure counts
   */
  async sendToTokens(options) {
    try {
      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      const { tokens, title, body, data = {}, priority = 'normal' } = options;

      if (!tokens || tokens.length === 0) {
        throw new Error('No tokens provided');
      }

      const message = {
        notification: {
          title,
          body
        },
        data: this.sanitizeData(data),
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: this.getChannelId(data.type),
            priority: priority === 'high' ? 'high' : 'default',
            defaultSound: true,
            defaultVibrateTimings: true
          }
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: 'default',
              badge: 1
            }
          },
          headers: {
            'apns-priority': priority === 'high' ? '10' : '5'
          }
        },
        webpush: {
          notification: {
            title,
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            tag: data.type || 'default',
            requireInteraction: priority === 'high',
            actions: this.getNotificationActions(data.type)
          },
          fcmOptions: {
            link: this.getNotificationLink(data)
          }
        },
        tokens: tokens.slice(0, 500) // FCM limit is 500 tokens per request
      };

      const response = await this.messaging.sendMulticast(message);
      
      console.log(`✅ Multicast sent - Success: ${response.successCount}, Failure: ${response.failureCount}`);

      // Process failures to identify invalid tokens
      const invalidTokens = [];
      if (response.failureCount > 0) {
        response.responses.forEach((resp, index) => {
          if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[index]);
          }
        });
      }

      return {
        success: response.failureCount === 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
        responses: response.responses
      };

    } catch (error) {
      console.error('❌ Send to tokens error:', error);
      return {
        success: false,
        error: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        successCount: 0,
        failureCount: tokens?.length || 0
      };
    }
  }

  /**
   * Send to topic (for broadcast notifications)
   * @param {Object} options - Topic notification options
   * @returns {Promise<Object>} Send result
   */
  async sendToTopic(options) {
    try {
      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      const { topic, title, body, data = {}, priority = 'normal' } = options;

      const message = {
        topic,
        notification: { title, body },
        data: this.sanitizeData(data),
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: this.getChannelId(data.type),
            priority: priority === 'high' ? 'high' : 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: 'default'
            }
          }
        },
        webpush: {
          notification: {
            title,
            body,
            icon: '/icons/icon-192x192.png',
            tag: data.type || 'default'
          }
        }
      };

      const response = await this.messaging.send(message);
      console.log('✅ Topic notification sent:', response);

      return {
        success: true,
        messageId: response,
        topic
      };

    } catch (error) {
      console.error('❌ Send to topic error:', error);
      return {
        success: false,
        error: error.code || 'UNKNOWN_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Subscribe tokens to topic
   * @param {Array} tokens - Device tokens
   * @param {string} topic - Topic name
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeToTopic(tokens, topic) {
    try {
      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      const response = await this.messaging.subscribeToTopic(tokens, topic);
      console.log(`✅ Subscribed ${response.successCount} tokens to topic: ${topic}`);

      return {
        success: response.failureCount === 0,
        successCount: response.successCount,
        failureCount: response.failureCount
      };

    } catch (error) {
      console.error('❌ Subscribe to topic error:', error);
      return {
        success: false,
        error: error.code || 'UNKNOWN_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Sanitize data for FCM (all values must be strings)
   * @param {Object} data - Raw data object
   * @returns {Object} Sanitized data
   */
  sanitizeData(data) {
    const sanitized = {};
    
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== null && value !== undefined) {
        sanitized[key] = String(value);
      }
    });

    return sanitized;
  }

  /**
   * Get notification channel ID based on type
   * @param {string} type - Notification type
   * @returns {string} Channel ID
   */
  getChannelId(type) {
    if (type?.includes('LIFELINK_EMERGENCY')) return 'lifelink_emergency';
    if (type?.includes('LIFELINK')) return 'lifelink_general';
    if (type?.includes('EVENT')) return 'events';
    if (type?.includes('POLL')) return 'polls';
    if (type?.includes('PAYMENT')) return 'payments';
    return 'general';
  }

  /**
   * Get notification actions based on type
   * @param {string} type - Notification type
   * @returns {Array} Notification actions
   */
  getNotificationActions(type) {
    if (type?.includes('LIFELINK_EMERGENCY')) {
      return [
        {
          action: 'respond_willing',
          title: '✅ I Can Help',
          icon: '/icons/check.png'
        },
        {
          action: 'respond_unable',
          title: '❌ Not Available',
          icon: '/icons/close.png'
        }
      ];
    }

    if (type?.includes('EVENT')) {
      return [
        {
          action: 'view_event',
          title: 'View Event',
          icon: '/icons/eye.png'
        }
      ];
    }

    if (type?.includes('POLL')) {
      return [
        {
          action: 'vote_now',
          title: 'Vote Now',
          icon: '/icons/vote.png'
        }
      ];
    }

    return [];
  }

  /**
   * Get notification click link based on data
   * @param {Object} data - Notification data
   * @returns {string} Click URL
   */
  getNotificationLink(data) {
    const baseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
    
    if (data.type?.includes('LIFELINK')) {
      if (data.requisitionId) {
        return `${baseUrl}/lifelink/requisition/${data.requisitionId}`;
      }
      return `${baseUrl}/lifelink/notifications`;
    }

    if (data.type?.includes('EVENT') && data.eventId) {
      return `${baseUrl}/events/${data.eventId}`;
    }

    if (data.type?.includes('POLL') && data.pollId) {
      return `${baseUrl}/polls/${data.pollId}`;
    }

    return `${baseUrl}/notifications`;
  }

  /**
   * Validate token format
   * @param {string} token - FCM token
   * @returns {boolean} Is valid
   */
  isValidToken(token) {
    return token && typeof token === 'string' && token.length > 50;
  }

  /**
   * Create notification channels for Android (to be called from frontend)
   * @returns {Object} Channel definitions
   */
  static getAndroidChannels() {
    return {
      lifelink_emergency: {
        id: 'lifelink_emergency',
        name: 'LifeLink Emergency',
        description: 'Emergency blood donation requests',
        importance: 'HIGH',
        sound: 'emergency',
        vibrate: [0, 250, 250, 250],
        lights: true,
        lightColor: '#FF0000'
      },
      lifelink_general: {
        id: 'lifelink_general',
        name: 'LifeLink Updates',
        description: 'General LifeLink notifications',
        importance: 'DEFAULT',
        sound: 'default'
      },
      events: {
        id: 'events',
        name: 'Event Updates',
        description: 'Event registration and updates',
        importance: 'DEFAULT',
        sound: 'default'
      },
      polls: {
        id: 'polls',
        name: 'Polls & Surveys',
        description: 'New polls and voting reminders',
        importance: 'LOW',
        sound: 'default'
      },
      payments: {
        id: 'payments',
        name: 'Payment Notifications',
        description: 'Payment confirmations and reminders',
        importance: 'DEFAULT',
        sound: 'default'
      },
      general: {
        id: 'general',
        name: 'General Notifications',
        description: 'App announcements and updates',
        importance: 'LOW',
        sound: 'default'
      }
    };
  }
}

// Create singleton instance
let pushNotificationService;
try {
  pushNotificationService = new PushNotificationService();
} catch (error) {
  console.warn('❌ Push notification service disabled due to configuration error:', error.message);
  pushNotificationService = {
    initialized: false,
    sendToToken: () => Promise.resolve({ success: false, error: 'Service not configured' }),
    sendToTokens: () => Promise.resolve({ success: false, error: 'Service not configured' })
  };
}

module.exports = pushNotificationService;

// ============================================
// SETUP INSTRUCTIONS
// ============================================

/*
FIREBASE SETUP:

1. Create Firebase Project:
   - Go to https://console.firebase.google.com/
   - Create new project
   - Enable Cloud Messaging

2. Get Service Account:
   - Project Settings > Service Accounts
   - Generate new private key
   - Save as firebase-service-account.json in src/config/

3. Environment Variables:
   Add to your .env file:
   
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-service-account-email
   FIREBASE_PRIVATE_KEY=your-private-key
   FRONTEND_URL=https://yourapp.com

4. Web Push Setup:
   - Project Settings > Cloud Messaging
   - Generate Web Push Certificate
   - Add VAPID keys to frontend

5. Mobile Setup:
   - Download google-services.json (Android)
   - Download GoogleService-Info.plist (iOS)
   - Configure Capacitor push notifications

USAGE:
const PushNotificationService = require('./utils/push-notification.util');

// Send to single token
await PushNotificationService.sendToToken({
  token: 'device-token',
  title: 'Emergency Blood Needed',
  body: 'O+ blood needed at City Hospital',
  data: { type: 'LIFELINK_EMERGENCY', requisitionId: '123' },
  priority: 'high'
});

// Send to multiple tokens
await PushNotificationService.sendToTokens({
  tokens: ['token1', 'token2'],
  title: 'New Poll Available',
  body: 'Cast your vote on the latest poll'
});
*/