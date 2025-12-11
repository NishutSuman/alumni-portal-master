// src/components/user/AlumniStorySection.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  BookOpenIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useGetPostsQuery } from '../../store/api/postApi';
import PostCard from './PostCard';

const AlumniStorySection: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch latest Alumni Story post (category = STORY)
  const { data: storyData, isLoading } = useGetPostsQuery({
    page: 1,
    limit: 1,
    category: 'STORY',
    isPublished: true,
    isArchived: false,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const alumniStory = storyData?.posts?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
            <BookOpenIcon className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alumni Story of the Month</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Accordion Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                </div>
              ) : alumniStory ? (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <PostCard
                    post={alumniStory}
                    showActions={false}
                  />
                </motion.div>
              ) : (
                <div className="text-center py-8">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 dark:bg-amber-900/20">
                    <SparklesIcon className="h-8 w-8 text-amber-500" />
                  </div>
                  <h4 className="text-gray-900 dark:text-white font-medium mb-2">No Alumni Story Yet</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                    Stay tuned! We'll feature inspiring stories from our alumni community here.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AlumniStorySection;
