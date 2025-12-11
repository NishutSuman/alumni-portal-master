import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import Posts from '../user/Posts';
import Polls from '../user/Polls';
import AdminAnnouncements from './Announcements';

const AdminSocial: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'posts' | 'polls' | 'announcements'>('posts');

  // Handle navigation state to open specific tab
  useEffect(() => {
    if (location.state?.tab === 'announcements') {
      setActiveTab('announcements');
      // Clear the state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const tabs = [
    {
      id: 'posts' as const,
      name: 'Posts',
      icon: ChatBubbleLeftRightIcon,
      description: 'View and interact with community posts',
    },
    {
      id: 'polls' as const,
      name: 'Polls',
      icon: ChartBarIcon,
      description: 'Create and manage community polls',
    },
    {
      id: 'announcements' as const,
      name: 'Announcements',
      icon: MegaphoneIcon,
      description: 'Create and manage important announcements',
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        return <Posts />;
      case 'polls':
        return <Polls />;
      case 'announcements':
        return <AdminAnnouncements />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center space-x-2 py-4 px-1 font-medium text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 0 }}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>

                  {isActive && (
                    <motion.div
                      layoutId="adminActiveTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
        {renderTabContent()}
      </motion.div>
    </div>
  );
};

export default AdminSocial;