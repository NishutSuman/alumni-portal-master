import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArchiveBoxIcon,
  TrashIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { Post } from '../../types/post';
import { Button } from '../common/UI/Button';
import PostImageDisplay from '../user/PostImageDisplay';

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (postId: string, approved: boolean) => void;
  onArchive?: (postId: string) => void;
  onDelete?: (postId: string) => void;
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  isOpen,
  onClose,
  onApprove,
  onArchive,
  onDelete,
}) => {

  const getStatusBadge = (post: Post) => {
    if (post.isArchived) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300">
          <ArchiveBoxIcon className="h-3 w-3 mr-1" />
          Archived
        </span>
      );
    }
    
    if (!post.isPublished) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300">
          <CalendarIcon className="h-3 w-3 mr-1" />
          Pending Review
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300">
        <CheckCircleIcon className="h-3 w-3 mr-1" />
        Published
      </span>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && post && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Post Details
                  </h2>
                  {getStatusBadge(post)}
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-6">
                  {/* Post Header */}
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {post.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <UserIcon className="h-4 w-4 mr-1" />
                        {post.author.fullName}
                        {post.author.batch && ` (Batch ${post.author.batch})`}
                      </div>
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      </div>
                      <div className="flex items-center">
                        <TagIcon className="h-4 w-4 mr-1" />
                        {post.category}
                      </div>
                    </div>
                  </div>

                  {/* Post Images */}
                  {(post.heroImage || (post.images && post.images.length > 0)) && (
                    <PostImageDisplay
                      postId={post.id}
                      heroImage={post.heroImage}
                      images={post.images || []}
                      title={post.title}
                    />
                  )}

                  {/* Post Body */}
                  <div className="prose prose-gray dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {post.body}
                    </div>
                  </div>

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                        Tagged Users
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300"
                          >
                            @{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center space-x-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center text-gray-500 dark:text-gray-400">
                      <span className="mr-2">👍</span>
                      <span>{post.totalReactions || post.likeCount || 0} reactions</span>
                    </div>
                    <div className="flex items-center text-gray-500 dark:text-gray-400">
                      <span className="mr-2">💬</span>
                      <span>{post._count?.comments || 0} comments</span>
                    </div>
                    {post.allowComments && (
                      <span className="text-green-600 dark:text-green-400 text-sm">
                        Comments enabled
                      </span>
                    )}
                    {post.allowLikes && (
                      <span className="text-green-600 dark:text-green-400 text-sm">
                        Reactions enabled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={onClose}
                >
                  Close
                </Button>

                {!post.isPublished && onApprove && (
                  <>
                    <Button
                      variant="danger"
                      onClick={() => onApprove(post.id, false)}
                      className="flex items-center space-x-2"
                    >
                      <XCircleIcon className="h-4 w-4" />
                      <span>Reject</span>
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => onApprove(post.id, true)}
                      className="flex items-center space-x-2"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      <span>Approve</span>
                    </Button>
                  </>
                )}

                {!post.isArchived && post.isPublished && onArchive && (
                  <Button
                    variant="outline"
                    onClick={() => onArchive(post.id)}
                    className="flex items-center space-x-2"
                  >
                    <ArchiveBoxIcon className="h-4 w-4" />
                    <span>Archive</span>
                  </Button>
                )}

                {onDelete && (
                  <Button
                    variant="danger"
                    onClick={() => onDelete(post.id)}
                    className="flex items-center space-x-2"
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span>Delete</span>
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}

    </AnimatePresence>
  );
};

export default PostDetailModal;