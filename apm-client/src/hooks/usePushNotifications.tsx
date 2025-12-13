// src/hooks/usePushNotifications.ts
// Push Notification Hook for Capacitor (Android/iOS)

import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { useRegisterPushTokenMutation } from '@/store/api/notificationApi';
import { apiSlice } from '@/store/api/apiSlice';

interface PushNotificationState {
  isSupported: boolean;
  isRegistered: boolean;
  token: string | null;
  error: string | null;
}

interface UsePushNotificationsReturn extends PushNotificationState {
  registerForPush: () => Promise<void>;
  unregister: () => Promise<void>;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [registerPushToken] = useRegisterPushTokenMutation();
  const tokenRegisteredRef = useRef(false);
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isRegistered: false,
    token: null,
    error: null,
  });

  // Helper to refresh notification cache when push is received
  const refreshNotificationCache = useCallback(() => {
    console.log('🔔 Refreshing notification cache after push received');
    // Invalidate both notification list and unread count
    dispatch(apiSlice.util.invalidateTags(['Notification', 'UnreadCount']));
  }, [dispatch]);

  // Check if push notifications are supported (native platform only)
  const isNativePlatform = Capacitor.isNativePlatform();

  // Register for push notifications
  const registerForPush = useCallback(async () => {
    if (!isNativePlatform) {
      console.log('🔔 Push notifications not supported on web');
      return;
    }

    try {
      console.log('🔔 Requesting push notification permissions...');
      // Request permission
      const permissionResult = await PushNotifications.requestPermissions();
      console.log('🔔 Permission result:', permissionResult);

      if (permissionResult.receive === 'granted') {
        console.log('🔔 Permission granted, registering with FCM...');
        // Register with FCM
        await PushNotifications.register();
        console.log('🔔 FCM registration called successfully');
        setState(prev => ({ ...prev, isRegistered: true, error: null }));
      } else {
        console.log('🔔 Permission denied:', permissionResult.receive);
        setState(prev => ({
          ...prev,
          error: 'Push notification permission denied',
          isRegistered: false
        }));
        toast.error('Please enable notifications in settings for important updates');
      }
    } catch (error) {
      console.error('🔔 Error registering for push:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to register',
        isRegistered: false
      }));
    }
  }, [isNativePlatform]);

  // Unregister from push notifications
  const unregister = useCallback(async () => {
    if (!isNativePlatform) return;

    try {
      await PushNotifications.unregister();
      setState(prev => ({ ...prev, isRegistered: false, token: null }));
    } catch (error) {
      console.error('Error unregistering push:', error);
    }
  }, [isNativePlatform]);

  // Handle notification click/action
  const handleNotificationAction = useCallback((notification: PushNotificationSchema) => {
    const data = notification.data;

    // Navigate based on notification type
    if (data?.type) {
      switch (data.type) {
        case 'LIFELINK_EMERGENCY':
          if (data.requisitionId) {
            navigate(`/lifelink/requisition/${data.requisitionId}`);
          } else {
            navigate('/lifelink');
          }
          break;
        case 'EVENT_REGISTRATION':
        case 'EVENT_REMINDER':
        case 'EVENT_UPDATE':
          if (data.eventId) {
            navigate(`/events/${data.eventId}`);
          } else {
            navigate('/events');
          }
          break;
        case 'POLL_CREATED':
        case 'POLL_REMINDER':
          if (data.pollId) {
            navigate(`/polls/${data.pollId}`);
          } else {
            navigate('/polls');
          }
          break;
        case 'POST_APPROVED':
        case 'POST_COMMENTED':
        case 'POST_LIKED':
          if (data.postId) {
            navigate(`/posts/${data.postId}`);
          } else {
            navigate('/posts');
          }
          break;
        case 'ALUMNI_VERIFIED':
        case 'ALUMNI_REJECTED':
          navigate('/profile');
          break;
        default:
          navigate('/notifications');
      }
    } else {
      navigate('/notifications');
    }
  }, [navigate]);

  // Setup listeners
  useEffect(() => {
    console.log('🔔 Push notifications hook initialized, isNativePlatform:', isNativePlatform);

    if (!isNativePlatform) {
      console.log('🔔 Not a native platform, skipping push setup');
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    console.log('🔔 Setting up push notifications for native platform');
    setState(prev => ({ ...prev, isSupported: true }));

    // Registration success - get FCM token
    const registrationListener = PushNotifications.addListener('registration', async (token: Token) => {
      console.log('📱 Push notification token received:', token.value.substring(0, 20) + '...');
      setState(prev => ({ ...prev, token: token.value, isRegistered: true }));

      // Store token locally
      localStorage.setItem('pushToken', token.value);

      // Send token to backend (only once per session)
      if (!tokenRegisteredRef.current) {
        tokenRegisteredRef.current = true;
        try {
          const deviceInfo = await Device.getInfo();
          const deviceId = await Device.getId();

          await registerPushToken({
            token: token.value,
            deviceType: deviceInfo.platform || 'android',
            deviceId: deviceId.identifier || 'unknown',
          });
          console.log('✅ Push token registered with backend');
        } catch (error) {
          console.error('❌ Failed to register push token with backend:', error);
          tokenRegisteredRef.current = false; // Allow retry
        }
      }
    });

    // Registration error
    const registrationErrorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
      setState(prev => ({
        ...prev,
        error: error.error || 'Registration failed',
        isRegistered: false
      }));
    });

    // Notification received while app is in foreground
    const notificationReceivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('🔔 Push notification received:', notification);

        // Refresh notification cache to update badge counts
        refreshNotificationCache();

        // Show in-app toast for foreground notifications
        const title = notification.title || 'New Notification';
        const body = notification.body || '';

        // Check if it's an emergency notification
        const isEmergency = notification.data?.type === 'LIFELINK_EMERGENCY';

        if (isEmergency) {
          // Show prominent emergency notification
          toast.custom((t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-red-600 text-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <span className="text-2xl">🆘</span>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-bold">{title}</p>
                    <p className="mt-1 text-sm">{body}</p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-red-700">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    handleNotificationAction(notification);
                  }}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-white hover:bg-red-700 focus:outline-none"
                >
                  View
                </button>
              </div>
            </div>
          ), { duration: 10000 });
        } else {
          // Regular notification toast
          toast(
            <div onClick={() => handleNotificationAction(notification)} className="cursor-pointer">
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-gray-600">{body}</p>
            </div>,
            { duration: 5000 }
          );
        }
      }
    );

    // Notification clicked/tapped
    const notificationActionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('🔔 Push notification action performed:', action);
        // Refresh notification cache when coming back from a notification tap
        refreshNotificationCache();
        handleNotificationAction(action.notification);
      }
    );

    // Check existing permissions on mount and auto-register
    PushNotifications.checkPermissions().then(async result => {
      console.log('🔔 Current permission status:', result.receive);
      if (result.receive === 'granted') {
        // Already have permission, register
        console.log('🔔 Permission already granted, registering...');
        registerForPush();
      } else if (result.receive === 'prompt' || result.receive === 'prompt-with-rationale') {
        // Need to request permission
        console.log('🔔 Requesting push notification permission...');
        registerForPush();
      } else {
        console.log('🔔 Push notifications denied or unavailable');
      }
    }).catch(error => {
      console.error('🔔 Error checking push permissions:', error);
    });

    // Cleanup listeners
    return () => {
      registrationListener.then(l => l.remove());
      registrationErrorListener.then(l => l.remove());
      notificationReceivedListener.then(l => l.remove());
      notificationActionListener.then(l => l.remove());
    };
  }, [isNativePlatform, handleNotificationAction, registerForPush, refreshNotificationCache]);

  return {
    ...state,
    registerForPush,
    unregister,
  };
};

export default usePushNotifications;
