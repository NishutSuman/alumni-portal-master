import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MegaphoneIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import {
  useCreateAnnouncementMutation,
  useGetAdminAnnouncementsQuery,
  useToggleAnnouncementStatusMutation,
  useDeleteAnnouncementMutation,
} from '../../store/api/announcementApi';

const MAX_WORDS = 100;

const AdminAnnouncements: React.FC = () => {
  const [message, setMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [createAnnouncement, { isLoading: isCreating }] = useCreateAnnouncementMutation();
  const [toggleStatus, { isLoading: isToggling }] = useToggleAnnouncementStatusMutation();
  const [deleteAnnouncement, { isLoading: isDeleting }] = useDeleteAnnouncementMutation();

  const { data: announcementsData, isLoading: isLoadingAnnouncements } = useGetAdminAnnouncementsQuery({
    page: 1,
    limit: 50,
    ...(filter !== 'all' && { status: filter }),
  });

  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
  const isOverLimit = wordCount > MAX_WORDS;
  const canSend = message.trim().length > 0 && !isOverLimit && !isCreating;

  const handleSend = async () => {
    if (!canSend) return;

    try {
      await createAnnouncement({
        message: message.trim(),
      }).unwrap();

      setMessage('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to create announcement:', error);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleStatus(id).unwrap();
    } catch (error) {
      console.error('Failed to toggle announcement:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteAnnouncement(id).unwrap();
    } catch (error) {
      console.error('Failed to delete announcement:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const announcements = announcementsData?.announcements || [];
  const activeCount = announcements.filter((a) => a.isActive).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <MegaphoneIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Announcements
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Send and manage organization announcements
              </p>
            </div>
          </div>
          {activeCount > 0 && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-full">
              {activeCount} active
            </span>
          )}
        </div>

        {/* Success Message */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
            >
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-green-800 dark:text-green-300">
                Announcement created and sent to all members!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            New Announcement
          </h2>
          <div className="space-y-4">
            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your announcement here..."
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  isOverLimit
                    ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/10'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                } text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
              />
            </div>

            {/* Word Count & Send Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-sm ${
                    isOverLimit
                      ? 'text-red-600 dark:text-red-400 font-medium'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {wordCount}/{MAX_WORDS} words
                </span>
                {isOverLimit && (
                  <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
                )}
              </div>

              <motion.button
                onClick={handleSend}
                disabled={!canSend}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                  canSend
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
                whileHover={canSend ? { scale: 1.02 } : {}}
                whileTap={canSend ? { scale: 0.98 } : {}}
              >
                {isCreating ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <PaperAirplaneIcon className="h-4 w-4" />
                    <span>Send to All</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Announcements List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              All Announcements
            </h2>

            {/* Filter */}
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['all', 'active', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    filter === f
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoadingAnnouncements ? (
              <div className="p-6 text-center">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-8 text-center">
                <MegaphoneIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  {filter === 'all' ? 'No announcements yet' : `No ${filter} announcements`}
                </p>
              </div>
            ) : (
              announcements.map((announcement) => (
                <motion.div
                  key={announcement.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`p-4 sm:px-6 transition-colors ${
                    !announcement.isActive ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Status Badge */}
                      <div className="flex items-center space-x-2 mb-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            announcement.isActive
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {announcement.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Message */}
                      <p
                        className={`text-sm mb-2 ${
                          announcement.isActive
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {announcement.message}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center space-x-1">
                          <ClockIcon className="h-3.5 w-3.5" />
                          <span>{formatDate(announcement.createdAt)}</span>
                        </span>
                        <span>by {announcement.createdBy.fullName}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <motion.button
                        onClick={() => handleToggle(announcement.id)}
                        disabled={isToggling}
                        className={`p-2 rounded-lg transition-colors ${
                          announcement.isActive
                            ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={announcement.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {announcement.isActive ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </motion.button>

                      <motion.button
                        onClick={() => handleDelete(announcement.id)}
                        disabled={isDeleting}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Delete"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p><strong>Active announcements</strong> are visible on the dashboard for all members.</p>
            <p><strong>Inactive announcements</strong> are hidden but can be reactivated anytime.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnnouncements;
