import React from 'react';
import { motion } from 'framer-motion';
import { MegaphoneIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useGetUserAnnouncementsQuery } from '../../store/api/announcementApi';

const UserAnnouncements: React.FC = () => {
  const { data: announcementsData, isLoading } = useGetUserAnnouncementsQuery({
    page: 1,
    limit: 20,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const announcements = announcementsData?.announcements || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <MegaphoneIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Announcements
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Important updates from your organization
            </p>
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-3">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse"
              >
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              </div>
            ))
          ) : announcements.length === 0 ? (
            // Empty state
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <MegaphoneIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Announcements
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                You're all caught up! Check back later for updates.
              </p>
            </div>
          ) : (
            // Announcements
            announcements.map((announcement, index) => (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-shadow"
              >
                {/* Message */}
                <p className="text-gray-900 dark:text-white text-base mb-3">
                  {announcement.message}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <span>{formatDate(announcement.createdAt)}</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    by {announcement.createdBy.fullName}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Pagination info */}
        {announcementsData && announcementsData.pagination?.total > 0 && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-4">
            Showing {announcements.length} of {announcementsData.pagination.total} announcements
          </div>
        )}
      </div>
    </div>
  );
};

export default UserAnnouncements;
