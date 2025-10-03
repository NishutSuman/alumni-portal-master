import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { EllipsisHorizontalIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { 
  useGetPostCommentsQuery, 
  useCreateCommentMutation, 
  useCreateReplyMutation,
  useToggleCommentReactionMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation
} from '../../../store/api/postApi';
import type { Comment, ReactionType } from '../../../types/post';
import { useAuth } from '../../../hooks/useAuth';
import CommentReactionsModal from './CommentReactionsModal';

interface CommentsSectionProps {
  postId: string;
  allowComments: boolean;
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

const CommentsSection: React.FC<CommentsSectionProps> = ({ postId, allowComments }) => {
  const { user } = useAuth();
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showReactionsModal, setShowReactionsModal] = useState<{ commentId: string; isOpen: boolean } | null>(null);
  const [currentLimit, setCurrentLimit] = useState(2); // Start with 2 comments
  
  const { 
    data: commentsData, 
    isLoading: commentsLoading,
    error: commentsError
  } = useGetPostCommentsQuery({ postId, page: 1, limit: currentLimit, sortOrder });
  
  const [createComment, { isLoading: creatingComment }] = useCreateCommentMutation();
  const [createReply, { isLoading: creatingReply }] = useCreateReplyMutation();
  const [toggleCommentReaction] = useToggleCommentReactionMutation();
  const [updateComment, { isLoading: updatingComment }] = useUpdateCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getAvatarColor = (userId: string): string => {
    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-pink-500 to-red-600',
      'from-yellow-500 to-orange-600',
      'from-indigo-500 to-blue-600',
      'from-purple-500 to-pink-600',
      'from-teal-500 to-green-600',
      'from-orange-500 to-red-600',
    ];
    
    // Use user ID to consistently generate the same color for each user
    const colorIndex = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[colorIndex];
  };

  const handleImageLoad = (userId: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    // Check if it's a real image (not a tiny placeholder)
    if (img.naturalWidth > 50 && img.naturalHeight > 50) {
      setLoadedImages(prev => new Set(prev).add(userId));
    }
  };

  const handleReactionClick = async (commentId: string, reactionType: ReactionType) => {
    if (!user) return;
    
    try {
      await toggleCommentReaction({
        postId,
        commentId,
        reactionType,
      }).unwrap();
      setShowReactionsModal(null);
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };


  const handleDeleteComment = async (commentId: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      await deleteComment({ postId, commentId }).unwrap();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };


  // Simple LinkedIn-style input component
  const CommentInput: React.FC<{
    placeholder: string;
    onSubmit: (content: string) => Promise<void>;
    isLoading: boolean;
    buttonText: string;
    autoFocus?: boolean;
  }> = ({ placeholder, onSubmit, isLoading, buttonText, autoFocus = false }) => {
    const [text, setText] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = useCallback(async () => {
      if (!text.trim()) return;
      
      try {
        await onSubmit(text.trim());
        setText('');
        setIsFocused(false);
        if (textareaRef.current) {
          textareaRef.current.style.height = '36px';
        }
      } catch (error) {
        console.error('Failed to submit:', error);
      }
    }, [text, onSubmit]);

    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      // Auto-resize
      const target = e.target;
      target.style.height = '36px';
      target.style.height = Math.min(target.scrollHeight, 120) + 'px';
    }, []);

    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }, [handleSubmit]);

    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      if (!text.trim()) {
        setIsFocused(false);
      }
    }, [text]);

    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyPress={handleKeyPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full resize-none focus:outline-none text-sm dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border rounded-lg px-3 py-2 transition-colors ${
            isFocused 
              ? 'border-blue-500 bg-white dark:bg-gray-700' 
              : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700'
          }`}
          rows={1}
          style={{ minHeight: '40px', maxHeight: '120px', lineHeight: '18px' }}
        />
        {(isFocused || text.trim()) && (
          <div className="flex justify-between mt-2">
            <button
              onClick={() => {
                setText('');
                setIsFocused(false);
              }}
              className="px-4 py-1 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || isLoading}
              className="px-4 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Posting...' : buttonText}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Unified comment component for both comments and replies
  const CommentItem: React.FC<{ 
    comment: Comment; 
    isReply?: boolean;
    level?: number;
  }> = React.memo(({ comment, isReply = false, level = 0 }) => {
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);
    const [showCommentMenu, setShowCommentMenu] = useState(false);
    const [showAllReplies, setShowAllReplies] = useState(false);
    const isAuthor = comment.author.id === user?.id;
    const userReaction = comment.userReaction;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const replyCount = comment.replies ? comment.replies.length : 0;

    const handleCreateReply = async (content: string) => {
      await createReply({
        postId,
        commentId: comment.id,
        content,
        mentions: [],
      }).unwrap();
      setShowReplyInput(false);
    };

    const handleReactionToggle = (reactionType: ReactionType) => {
      handleReactionClick(comment.id, reactionType);
      setShowReactionPicker(false);
    };

    const handleEditThisComment = () => {
      setEditingComment({ id: comment.id, content: comment.content });
      setShowCommentMenu(false); // Close menu
    };

    const handleUpdateThisComment = async (content: string) => {
      if (!user || !content.trim()) return;
      
      try {
        await updateComment({ postId, commentId: comment.id, content }).unwrap();
        setEditingComment(null);
      } catch (error) {
        console.error('Failed to update comment:', error);
      }
    };

    const handleEditContentChange = useCallback((value: string) => {
      setEditingComment(prev => prev ? { ...prev, content: value } : null);
    }, []);

    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setShowCommentMenu(false);
        }
      };

      if (showCommentMenu) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [showCommentMenu]);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${isReply ? 'ml-10 mt-2' : 'mb-3'}`}
      >
        <div className="flex space-x-3">
          {/* Profile Picture */}
          <div className="flex-shrink-0 mt-1">
            {loadedImages.has(comment.author.id) ? (
              <img
                src={`/api/users/profile-picture/${comment.author.id}`}
                alt={comment.author.fullName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <>
                <img
                  src={`/api/users/profile-picture/${comment.author.id}`}
                  alt={comment.author.fullName}
                  className="h-8 w-8 rounded-full object-cover opacity-0 absolute"
                  onLoad={(e) => handleImageLoad(comment.author.id, e)}
                />
                <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${getAvatarColor(comment.author.id)} flex items-center justify-center text-white font-semibold text-xs`}>
                  {getInitials(comment.author.fullName)}
                </div>
              </>
            )}
          </div>

          {/* Comment Content */}
          <div className="flex-1 min-w-0">
            {/* Comment Content */}
            <div className="py-1">
              <div className="flex items-start justify-between mb-1">
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                      {comment.author.fullName}
                    </span>
                    {isAuthor && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        Author
                      </span>
                    )}
                  </div>
                  {comment.author.batch && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Batch {comment.author.batch}
                    </span>
                  )}
                </div>
                
                {/* 3-dot menu for comment author */}
                {user && user.id === comment.createdBy && (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setShowCommentMenu(!showCommentMenu)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                    >
                      <EllipsisHorizontalIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    
                    <AnimatePresence>
                      {showCommentMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: -10 }}
                          className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-20"
                        >
                          <div className="py-1">
                            <button
                              onClick={handleEditThisComment}
                              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <PencilIcon className="h-4 w-4 mr-2" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                handleDeleteComment(comment.id);
                                setShowCommentMenu(false);
                              }}
                              className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <TrashIcon className="h-4 w-4 mr-2" />
                              Delete
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              {editingComment?.id === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingComment.content}
                    onChange={(e) => handleEditContentChange(e.target.value)}
                    className="w-full text-sm bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleUpdateThisComment(editingComment.content)}
                      disabled={updatingComment}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updatingComment ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingComment(null)}
                      className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-normal">
                    {comment.content}
                  </p>
                  {comment.isEdited && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">edited</span>
                  )}
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 mt-1 ml-3">
              {/* Like Button (for showing reaction picker) */}
              <div className="relative">
                <button
                  onClick={() => setShowReactionPicker(!showReactionPicker)}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    userReaction
                      ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>Like</span>
                  {userReaction && (
                    <span className="text-sm">{REACTION_CONFIG[userReaction].emoji}</span>
                  )}
                </button>

                {/* Reaction Picker */}
                <AnimatePresence>
                  {showReactionPicker && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full shadow-lg px-2 py-1 flex space-x-1 z-10"
                    >
                      {Object.entries(REACTION_CONFIG).map(([reactionType, config]) => (
                        <button
                          key={reactionType}
                          onClick={() => handleReactionToggle(reactionType as ReactionType)}
                          className="hover:scale-125 transition-transform p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                          title={config.label}
                        >
                          <span className="text-xl">{config.emoji}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Reaction Count Button (opens modal) */}
              {comment.totalReactions > 0 && (
                <button
                  onClick={() => setShowReactionsModal({ commentId: comment.id, isOpen: true })}
                  className="flex items-center space-x-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium"
                >
                  <span className="text-sm">
                    {comment.reactions && Object.entries(comment.reactions)
                      .filter(([, count]) => count > 0)
                      .slice(0, 3)
                      .map(([reactionType]) => REACTION_CONFIG[reactionType as ReactionType]?.emoji)
                      .join('')
                    }
                  </span>
                  <span>({comment.totalReactions})</span>
                </button>
              )}
              
              {/* Reply Button */}
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium"
              >
                Reply{replyCount > 0 && ` · ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
              </button>
              
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
            </div>

            {/* Reply Input */}
            {showReplyInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 ml-4"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <img
                      src={`/api/users/profile-picture/${user?.id}`}
                      alt={user?.fullName || ''}
                      className="h-6 w-6 rounded-full object-cover"
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        // Check if image is very small (likely a placeholder/default image)
                        if (target.naturalWidth <= 50 || target.naturalHeight <= 50) {
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `<div class="h-6 w-6 rounded-full bg-gradient-to-br ${getAvatarColor(user?.id || '')} flex items-center justify-center text-white font-semibold text-xs">${getInitials(user?.fullName || '')}</div>`;
                          }
                        }
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div class="h-6 w-6 rounded-full bg-gradient-to-br ${getAvatarColor(user?.id || '')} flex items-center justify-center text-white font-semibold text-xs">${getInitials(user?.fullName || '')}</div>`;
                        }
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <CommentInput
                      placeholder="Write a reply..."
                      onSubmit={handleCreateReply}
                      isLoading={creatingReply}
                      buttonText="Reply"
                      autoFocus={true}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Nested Replies */}
            {hasReplies && !isReply && (
              <div className="mt-3 ml-6">
                {/* Show All Replies or Collapsed View */}
                {replyCount > 1 && !showAllReplies ? (
                  <div>
                    {/* See Previous Replies Button */}
                    <button
                      onClick={() => setShowAllReplies(true)}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium mb-3 flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      See previous {replyCount - 1} {replyCount - 1 === 1 ? 'reply' : 'replies'}
                    </button>
                    
                    {/* Latest reply */}
                    <CommentItem 
                      key={comment.replies[comment.replies.length - 1].id}
                      comment={comment.replies[comment.replies.length - 1]} 
                      isReply={true}
                      level={level + 1}
                    />
                  </div>
                ) : (
                  <div>
                    {/* Show all replies */}
                    {comment.replies.map((reply, index) => (
                      <div key={reply.id} className="mb-3">
                        {replyCount > 1 && showAllReplies && index === 0 && (
                          <button
                            onClick={() => setShowAllReplies(false)}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium mb-3 flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            Hide previous replies
                          </button>
                        )}
                        
                        <CommentItem 
                          comment={reply} 
                          isReply={true}
                          level={level + 1}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Show replies for nested comments (when isReply = true) */}
            {hasReplies && isReply && (
              <div className="mt-3 ml-6">
                {comment.replies.map((reply) => (
                  <CommentItem 
                    key={reply.id} 
                    comment={reply} 
                    isReply={true}
                    level={level + 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  });

  const handleCreateComment = async (content: string) => {
    await createComment({
      postId,
      content,
      mentions: [],
    }).unwrap();
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    setCurrentLimit(2); // Reset to initial limit when sorting changes
  };

  const loadMoreComments = () => {
    setCurrentLimit(prev => prev + 5); // Load 5 more comments
  };

  // Check if there are more comments to load
  const hasMoreComments = commentsData?.pagination && commentsData.pagination.hasNext;

  if (!allowComments) {
    return null;
  }

  return (
    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      {/* Comments Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {commentsData?.pagination.totalAllComments || commentsData?.pagination.total || 0} comments
        </span>
        <button
          onClick={toggleSortOrder}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors font-medium"
        >
{sortOrder === 'desc' ? 'Oldest first' : 'Newest first'}
        </button>
      </div>

      {/* Create Comment */}
      {user && (
        <div className="flex items-start space-x-3 mb-4">
          <div className="flex-shrink-0 mt-1">
            {loadedImages.has(user.id) ? (
              <img
                src={`/api/users/profile-picture/${user.id}`}
                alt={user.fullName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <>
                <img
                  src={`/api/users/profile-picture/${user.id}`}
                  alt={user.fullName}
                  className="h-8 w-8 rounded-full object-cover opacity-0 absolute"
                  onLoad={(e) => handleImageLoad(user.id, e)}
                />
                <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${getAvatarColor(user.id)} flex items-center justify-center text-white font-semibold text-xs`}>
                  {getInitials(user.fullName)}
                </div>
              </>
            )}
          </div>
          <div className="flex-1">
            <CommentInput
              placeholder="Add a comment..."
              onSubmit={handleCreateComment}
              isLoading={creatingComment}
              buttonText="Comment"
            />
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {commentsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : commentsError ? (
          <div className="text-center py-8 text-red-600 dark:text-red-400">
            Failed to load comments
          </div>
        ) : commentsData?.comments?.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <AnimatePresence>
            {commentsData?.comments?.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Load More Comments */}
      {hasMoreComments && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button 
            onClick={loadMoreComments}
            disabled={commentsLoading}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium text-sm transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>{commentsLoading ? 'Loading...' : 'Load more comments'}</span>
          </button>
        </div>
      )}

      {/* Reactions Modal */}
      {showReactionsModal && (
        <CommentReactionsModal
          isOpen={showReactionsModal.isOpen}
          onClose={() => setShowReactionsModal(null)}
          commentId={showReactionsModal.commentId}
          postId={postId}
        />
      )}
    </div>
  );
};

export default CommentsSection;