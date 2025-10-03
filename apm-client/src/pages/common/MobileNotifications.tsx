// src/pages/common/MobileNotifications.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeftIcon, 
  BellIcon, 
  CheckIcon, 
  TrashIcon, 
  XMarkIcon,
  ExclamationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  useClearAllNotificationsMutation,
  Notification
} from '@/store/api/notificationApi';
import LoadingSpinner from '@/components/common/UI/LoadingSpinner';

const MobileNotifications: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  // Get both all notifications and unread count for proper tab counts
  const { data: allNotificationsData, isLoading: isLoadingAll, error: errorAll } = useGetNotificationsQuery({
    page: 1,
    limit: 50,
    unreadOnly: false
  });
  
  const { data: unreadNotificationsData, isLoading: isLoadingUnread, error: errorUnread } = useGetNotificationsQuery({
    page: 1,
    limit: 50,
    unreadOnly: true
  });
  
  const { data: unreadCountData } = useGetUnreadCountQuery();

  // Use appropriate data based on filter
  const notificationsData = filter === 'all' ? allNotificationsData : unreadNotificationsData;
  const isLoading = filter === 'all' ? isLoadingAll : isLoadingUnread;
  const error = filter === 'all' ? errorAll : errorUnread;
  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();
  const [clearAllNotifications, { isLoading: isClearingAll }] = useClearAllNotificationsMutation();

  const notifications = notificationsData?.notifications || [];
  const allNotifications = allNotificationsData?.notifications || [];
  const unreadNotifications = unreadNotificationsData?.notifications || [];
  const unreadCount = unreadCountData?.count || 0;
  
  // Get accurate counts for tabs
  const allCount = allNotifications.length;
  const unreadCountForTab = unreadNotifications.length;

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId).unwrap();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead().unwrap();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId).unwrap();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
      return;
    }
    
    try {
      const result = await clearAllNotifications().unwrap();
      console.log(`Successfully cleared ${result.deletedCount} notifications`);
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
      const errorMessage = error?.data?.message || 'Failed to clear notifications';
      alert(`Error: ${errorMessage}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'NEW_REGISTRATION':
      case 'VERIFICATION_APPROVED':
      case 'ROLE_UPDATED':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'ACCOUNT_SUSPENDED':
      case 'VERIFICATION_REJECTED':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <BellIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY':
        return 'text-red-600 dark:text-red-400';
      case 'HIGH':
        return 'text-orange-600 dark:text-orange-400';
      case 'NORMAL':
        return 'text-blue-600 dark:text-blue-400';
      case 'LOW':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors -ml-2"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h1>
            </div>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex mt-4 space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              All ({allCount})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                filter === 'unread'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Unread ({unreadCountForTab})
            </button>
          </div>
          
          {/* Action Buttons */}
          {notifications.length > 0 && (
            <div className="flex justify-between mt-4 space-x-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-lg transition-colors"
                >
                  Mark All Read
                </button>
              )}
              <button
                onClick={handleClearAll}
                disabled={isClearingAll}
                className="flex-1 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 border border-red-600 dark:border-red-400 rounded-lg transition-colors disabled:opacity-50"
              >
                {isClearingAll ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-4 py-4">
        {error ? (
          <div className="text-center py-8">
            <ExclamationCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Failed to load notifications</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <BellIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No notifications
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${
                  !notification.isRead ? 'ring-2 ring-blue-500 ring-opacity-20' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center mt-2 space-x-4">
                          <time className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(notification.createdAt).toLocaleString()}
                          </time>
                          <span className={`text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-md transition-colors"
                            title="Mark as read"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotification(notification.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileNotifications;