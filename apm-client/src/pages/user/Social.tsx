import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import Posts from './Posts';
import Polls from './Polls';

const Social: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'posts' | 'polls' | 'announcements'>('posts');

  const tabs = [
    {
      id: 'posts' as const,
      name: 'Posts',
      icon: ChatBubbleLeftRightIcon,
      description: 'Share and discover posts from the community',
    },
    {
      id: 'polls' as const,
      name: 'Polls',
      icon: ChartBarIcon,
      description: 'Create and participate in community polls',
    },
    {
      id: 'announcements' as const,
      name: 'Announcements',
      icon: MegaphoneIcon,
      description: 'Important updates and announcements',
      comingSoon: true,
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        return <Posts />;
      case 'polls':
        return <Polls />;
      case 'announcements':
        return (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <MegaphoneIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Announcements Coming Soon</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Stay updated with important announcements and news from your organization.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Tab Navigation - Fixed */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="-mb-px flex space-x-8 overflow-x-auto">
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
                  {tab.comingSoon && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300">
                      Soon
                    </span>
                  )}

                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                    />
                  )}
                </motion.button>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content - Scrollable */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {renderTabContent()}
        </motion.div>
      </div>
    </div>
  );
};

export default Social;