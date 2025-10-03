import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useGetCommentReactionUsersQuery } from '../../../store/api/postApi';
import type { ReactionType } from '../../../types/post';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface CommentReactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  commentId: string;
}

const REACTION_CONFIG: Record<ReactionType, { emoji: string; label: string; color: string }> = {
  LIKE: { emoji: '👍', label: 'Like', color: 'text-blue-600 dark:text-blue-400' },
  LOVE: { emoji: '❤️', label: 'Love', color: 'text-red-600 dark:text-red-400' },
  CELEBRATE: { emoji: '🎉', label: 'Celebrate', color: 'text-yellow-600 dark:text-yellow-400' },
  SUPPORT: { emoji: '🙌', label: 'Support', color: 'text-green-600 dark:text-green-400' },
  FUNNY: { emoji: '😂', label: 'Funny', color: 'text-orange-600 dark:text-orange-400' },
  WOW: { emoji: '😮', label: 'Wow', color: 'text-purple-600 dark:text-purple-400' },
  ANGRY: { emoji: '😠', label: 'Angry', color: 'text-red-700 dark:text-red-300' },
  SAD: { emoji: '😢', label: 'Sad', color: 'text-blue-700 dark:text-blue-300' },
};

const CommentReactionsModal: React.FC<CommentReactionsModalProps> = ({
  isOpen,
  onClose,
  postId,
  commentId,
}) => {
  const [selectedTab, setSelectedTab] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const {
    data: reactionsData,
    isLoading,
    error,
  } = useGetCommentReactionUsersQuery(
    { 
      postId,
      commentId,
      reactionType: selectedTab === 'ALL' ? undefined : selectedTab,
      page,
      limit: 20 
    },
    { skip: !isOpen }
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Get available reaction types with counts
  const availableReactions = reactionsData?.reactionCounts 
    ? Object.entries(reactionsData.reactionCounts)
        .filter(([_, count]) => count > 0)
        .sort(([a, countA], [b, countB]) => {
          if (a === 'ALL') return -1;
          if (b === 'ALL') return 1;
          return countB - countA; // Sort by count descending
        })
    : [];

  const totalReactions = availableReactions.reduce((sum, [_, count]) => sum + count, 0);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                  >
                    Reactions
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-md p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Reaction Tabs */}
                {availableReactions.length > 0 && (
                  <div className="flex space-x-1 mb-4 overflow-x-auto">
                    {/* Add ALL tab with total count */}
                    <button
                      onClick={() => {
                        setSelectedTab('ALL');
                        setPage(1);
                      }}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedTab === 'ALL'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span>All</span>
                      <span className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                        {totalReactions}
                      </span>
                    </button>
                    
                    {availableReactions.map(([reactionType, count]) => (
                      <button
                        key={reactionType}
                        onClick={() => {
                          setSelectedTab(reactionType);
                          setPage(1);
                        }}
                        className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedTab === reactionType
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className="text-base">
                          {REACTION_CONFIG[reactionType as ReactionType]?.emoji}
                        </span>
                        <span className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Reactions List */}
                <div className="h-96 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : error ? (
                    <div className="text-center py-8 text-red-600 dark:text-red-400">
                      Failed to load reactions
                    </div>
                  ) : reactionsData?.reactions?.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No reactions found
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {reactionsData?.reactions?.map((reaction, index) => (
                          <motion.div
                            key={reaction.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            {/* Profile Picture */}
                            <div className="relative">
                              {reaction.user.profileImage ? (
                                <img
                                  src={`/api/users/profile-picture/${reaction.user.id}`}
                                  alt={reaction.user.fullName}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                  {getInitials(reaction.user.fullName)}
                                </div>
                              )}
                              
                              {/* Reaction Emoji Badge */}
                              <div className="absolute -bottom-0.5 -right-0.5 bg-white dark:bg-gray-800 rounded-full p-0.5 border border-gray-200 dark:border-gray-600 w-5 h-5 flex items-center justify-center">
                                <span className="text-xs">
                                  {REACTION_CONFIG[reaction.reactionType]?.emoji}
                                </span>
                              </div>
                            </div>

                            {/* User Info */}
                            <div className="flex-1 min-w-0">
                              <Link
                                to={`/alumni/${reaction.user.id}`}
                                className="block hover:text-blue-600 dark:hover:text-blue-400"
                              >
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {reaction.user.fullName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {reaction.user.workHistory && reaction.user.workHistory.length > 0
                                    ? `${reaction.user.workHistory[0].jobRole} at ${reaction.user.workHistory[0].companyName}`
                                    : (reaction.user.batch && `Batch ${reaction.user.batch}`) || 'Alumni'
                                  }
                                </p>
                              </Link>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {formatDistanceToNow(new Date(reaction.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {reactionsData?.pagination && reactionsData.pagination.pages > 1 && (
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={!reactionsData.pagination.hasPrev}
                      className="px-3 py-1 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Page {reactionsData.pagination.page} of {reactionsData.pagination.pages}
                    </span>
                    
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={!reactionsData.pagination.hasNext}
                      className="px-3 py-1 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CommentReactionsModal;