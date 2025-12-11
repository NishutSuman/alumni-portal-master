// src/hooks/usePushNotifications.ts
// Push Notification Hook for Capacitor (Android/iOS)

import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isRegistered: false,
    token: null,
    error: null,
  });

  // Check if push notifications are supported (native platform only)
  const isNativePlatform = Capacitor.isNativePlatform();

  // Register for push notifications
  const registerForPush = useCallback(async () => {
    if (!isNativePlatform) {
      console.log('Push notifications not supported on web');
      return;
    }

    try {
      // Request permission
      const permissionResult = await PushNotifications.requestPermissions();

      if (permissionResult.receive === 'granted') {
        // Register with FCM
        await PushNotifications.register();
        setState(prev => ({ ...prev, isRegistered: true, error: null }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Push notification permission denied',
          isRegistered: false
        }));
        toast.error('Please enable notifications in settings for important updates');
      }
    } catch (error) {
      console.error('Error registering for push:', error);
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
    if (!isNativePlatform) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    setState(prev => ({ ...prev, isSupported: true }));

    // Registration success - get FCM token
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      setState(prev => ({ ...prev, token: token.value, isRegistered: true }));

      // TODO: Send token to backend to store for user
      // This would typically be an API call like:
      // api.post('/notifications/register-device', { token: token.value, platform: 'android' });

      // Store token locally for now
      localStorage.setItem('pushToken', token.value);
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
        console.log('Push notification received:', notification);

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
        console.log('Push notification action performed:', action);
        handleNotificationAction(action.notification);
      }
    );

    // Check existing permissions on mount
    PushNotifications.checkPermissions().then(result => {
      if (result.receive === 'granted') {
        // Already have permission, register
        registerForPush();
      }
    });

    // Cleanup listeners
    return () => {
      registrationListener.then(l => l.remove());
      registrationErrorListener.then(l => l.remove());
      notificationReceivedListener.then(l => l.remove());
      notificationActionListener.then(l => l.remove());
    };
  }, [isNativePlatform, handleNotificationAction, registerForPush]);

  return {
    ...state,
    registerForPush,
    unregister,
  };
};

export default usePushNotifications;
