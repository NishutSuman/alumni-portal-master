// src/store/api/notificationApi.ts
import { apiSlice } from './apiSlice';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  priority: 'EMERGENCY' | 'HIGH' | 'NORMAL' | 'LOW';
  createdAt: string;
  readAt?: string;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  lifelinksEnabled: boolean;
  eventsEnabled: boolean;
  pollsEnabled: boolean;
  paymentsEnabled: boolean;
  systemEnabled: boolean;
  postsEnabled: boolean;
}

// Inject notification endpoints into the main API slice
export const notificationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get user notifications
    getNotifications: builder.query<{
      notifications: Notification[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }, {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: string;
    }>({
      query: (params = {}) => ({
        url: '/notifications',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Notification'],
    }),

    // Get unread count
    getUnreadCount: builder.query<{
      count: number;
    }, void>({
      query: () => '/notifications/unread-count',
      transformResponse: (response: any) => response.data,
      providesTags: ['Notification', 'UnreadCount'],
    }),

    // Mark notification as read
    markAsRead: builder.mutation<{
      success: boolean;
      message: string;
    }, string>({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/read`,
        method: 'PUT',
      }),
      invalidatesTags: ['Notification', 'UnreadCount'],
    }),

    // Mark all notifications as read
    markAllAsRead: builder.mutation<{
      success: boolean;
      message: string;
    }, void>({
      query: () => ({
        url: '/notifications/mark-all-read',
        method: 'PUT',
      }),
      invalidatesTags: ['Notification', 'UnreadCount'],
    }),

    // Delete notification
    deleteNotification: builder.mutation<{
      success: boolean;
      message: string;
    }, string>({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Notification', 'UnreadCount'],
    }),

    // Clear all notifications
    clearAllNotifications: builder.mutation<{
      success: boolean;
      message: string;
      deletedCount: number;
    }, void>({
      query: () => ({
        url: '/notifications/clear-all',
        method: 'DELETE',
      }),
      invalidatesTags: ['Notification', 'UnreadCount'],
    }),

    // Get notification preferences
    getNotificationPreferences: builder.query<NotificationPreferences, void>({
      query: () => '/notifications/preferences',
      transformResponse: (response: any) => response.data,
      providesTags: ['NotificationPreferences'],
    }),

    // Update notification preferences
    updateNotificationPreferences: builder.mutation<{
      success: boolean;
      preferences: NotificationPreferences;
    }, Partial<NotificationPreferences>>({
      query: (preferences) => ({
        url: '/notifications/preferences',
        method: 'PUT',
        body: preferences,
      }),
      invalidatesTags: ['NotificationPreferences'],
    }),

    // Register push notification token
    registerPushToken: builder.mutation<{
      success: boolean;
      message: string;
    }, {
      token: string;
      deviceType: string;
      deviceId: string;
    }>({
      query: (data) => ({
        url: '/notifications/register-token',
        method: 'POST',
        body: data,
      }),
    }),

    // Get user push tokens
    getPushTokens: builder.query<{
      tokens: Array<{
        id: string;
        token: string;
        deviceType: string;
        deviceId: string;
        isActive: boolean;
        createdAt: string;
        lastUsed: string;
      }>;
    }, void>({
      query: () => '/notifications/my-tokens',
      transformResponse: (response: any) => response.data,
      providesTags: ['PushToken'],
    }),
  }),
  overrideExisting: false,
});

// Export hooks for use in components
export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  useClearAllNotificationsMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useRegisterPushTokenMutation,
  useGetPushTokensQuery,
} = notificationApi;

export default notificationApi;