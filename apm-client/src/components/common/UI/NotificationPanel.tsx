import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon, XMarkIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { BellIcon as BellSolidIcon } from '@heroicons/react/24/solid';
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  useClearAllNotificationsMutation,
  Notification
} from '@/store/api/notificationApi';
import LoadingSpinner from './LoadingSpinner';

const NotificationPanel: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  const { data: notificationsData, isLoading, error } = useGetNotificationsQuery({
    page: 1,
    limit: 20,
    unreadOnly: filter === 'unread'
  });
  
  const { data: unreadCountData } = useGetUnreadCountQuery();
  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();
  const [clearAllNotifications, { isLoading: isClearingAll }] = useClearAllNotificationsMutation();

  const notifications = notificationsData?.notifications || [];
  const unreadCount = unreadCountData?.count || 0;

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const result = await markAsRead(notificationId).unwrap();
      console.log('Mark as read success:', result);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Show user-friendly error
      const errorMessage = error?.data?.message || 'Failed to mark notification as read';
      console.log('Detailed error:', JSON.stringify(error, null, 2));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead().unwrap();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
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
      console.log('Detailed error:', JSON.stringify(error, null, 2));
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      const result = await deleteNotification(notificationId).unwrap();
      console.log('Delete notification success:', result);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      // Show user-friendly error
      const errorMessage = error?.data?.message || 'Failed to delete notification';
      console.log('Detailed error:', JSON.stringify(error, null, 2));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ALUMNI_VERIFIED':
        return '✅';
      case 'ALUMNI_REJECTED':
        return '❌';
      case 'ROLE_UPDATED':
        return '👑';
      default:
        return '📢';
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

  // Check if on mobile (screen width < 768px)
  const isMobile = window.innerWidth < 768;

  const handleNotificationClick = () => {
    if (isMobile) {
      // On mobile, navigate to dedicated notifications page
      navigate('/notifications');
    } else {
      // On desktop, toggle dropdown
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={handleNotificationClick}
        className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellSolidIcon className="h-6 w-6 text-orange-500" />
        ) : (
          <BellIcon className="h-6 w-6" />
        )}
        
        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[1.25rem] h-5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel - Only show on desktop */}
      <AnimatePresence>
        {isOpen && !isMobile && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 sm:hidden"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 lg:w-[28rem] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[32rem] sm:max-h-[40rem] flex flex-col"
              style={{
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Notifications
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Filter and Actions */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        filter === 'all'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilter('unread')}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        filter === 'unread'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        disabled={isClearingAll}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        {isClearingAll ? 'Clearing...' : 'Clear all'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 flex justify-center">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : error ? (
                  <div className="p-4 text-center text-red-600 dark:text-red-400">
                    Failed to load notifications
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          {/* Icon */}
                          <div className="flex-shrink-0">
                            <span className="text-2xl">
                              {getNotificationIcon(notification.type)}
                            </span>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className={`text-sm font-medium ${
                                  !notification.isRead 
                                    ? 'text-gray-900 dark:text-white' 
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  {notification.title}
                                </h4>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                  {notification.message}
                                </p>
                                <p className={`mt-1 text-xs ${notification.priority ? getPriorityColor(notification.priority) : 'text-gray-500 dark:text-gray-400'}`}>
                                  {new Date(notification.createdAt).toLocaleString()}
                                </p>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex items-center space-x-1 ml-2">
                                {!notification.isRead && (
                                  <button
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    title="Mark as read"
                                  >
                                    <CheckIcon className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(notification.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                  title="Delete notification"
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
              
              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <button className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                      View all notifications
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationPanel;