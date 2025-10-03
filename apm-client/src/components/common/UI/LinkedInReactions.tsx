import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatBubbleLeftIcon, ShareIcon } from '@heroicons/react/24/outline';
import type { ReactionType } from '../../../types/post';
import ReactionsModal from './ReactionsModal';

interface LinkedInReactionsProps {
  postId: string;
  reactions: Record<ReactionType, number>;
  userReactions: ReactionType[];
  totalReactions: number;
  recentReactions?: Array<{
    reactionType: ReactionType;
    userId: string;
    user: {
      id: string;
      fullName: string;
      profileImage?: string;
    };
  }>;
  onReact: (reactionType: ReactionType) => void;
  onCommentClick?: () => void;
  onShareClick?: () => void;
  commentCount?: number;
  disabled?: boolean;
  className?: string;
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

const LinkedInReactions: React.FC<LinkedInReactionsProps> = ({
  postId,
  reactions,
  userReactions,
  totalReactions,
  recentReactions = [],
  onReact,
  onCommentClick,
  onShareClick,
  commentCount = 0,
  disabled = false,
  className = '',
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [showReactionsModal, setShowReactionsModal] = useState(false);

  // Get user's current reaction (only one allowed)
  const userReaction = userReactions?.[0];
  const hasReacted = !!userReaction;

  // Get top reactions for display (max 3)
  const topReactions = Object.entries(reactions || {})
    .filter(([_, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([type]) => type as ReactionType);

  const handleReactionClick = (reactionType: ReactionType) => {
    onReact(reactionType);
    setShowPicker(false);
  };

  const handleMainButtonClick = () => {
    if (hasReacted) {
      // Remove current reaction
      onReact(userReaction);
    } else {
      // Add LIKE reaction
      onReact('LIKE');
    }
  };

  // Show picker on hover with delay
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isHovering && !disabled) {
      timeout = setTimeout(() => {
        setShowPicker(true);
      }, 500);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isHovering, disabled]);

  // Generate LinkedIn-style reaction text
  const getReactionText = () => {
    if (totalReactions === 0 || !totalReactions) return null;
    
    const uniqueUsers = Array.from(
      new Map(recentReactions.map(r => [r.userId, r])).values()
    );
    
    if (uniqueUsers.length === 0) {
      return `${totalReactions}`;
    }
    
    if (uniqueUsers.length === 1) {
      if (totalReactions === 1) {
        return uniqueUsers[0].user.fullName;
      } else {
        return `${uniqueUsers[0].user.fullName} and ${totalReactions - 1} others`;
      }
    } else if (uniqueUsers.length === 2) {
      if (totalReactions === 2) {
        return `${uniqueUsers[0].user.fullName} and ${uniqueUsers[1].user.fullName}`;
      } else {
        return `${uniqueUsers[0].user.fullName}, ${uniqueUsers[1].user.fullName} and ${totalReactions - 2} others`;
      }
    } else {
      return `${uniqueUsers[0].user.fullName}, ${uniqueUsers[1].user.fullName} and ${totalReactions - 2} others`;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top section: Reaction summary (LinkedIn style) */}
      {totalReactions > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <button 
            onClick={() => setShowReactionsModal(true)}
            className="flex items-center space-x-2 hover:text-gray-700 dark:hover:text-gray-300 hover:underline cursor-pointer"
          >
            {/* Reaction emojis stack */}
            <div className="flex -space-x-1">
              {topReactions.map((reactionType, index) => (
                <div
                  key={reactionType}
                  className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs border-2 border-white dark:border-gray-800"
                  style={{ zIndex: topReactions.length - index }}
                >
                  {REACTION_CONFIG[reactionType].emoji}
                </div>
              ))}
            </div>
            
            {/* LinkedIn-style reaction text */}
            <span className="ml-1">
              {getReactionText()}
            </span>
          </button>

          {/* Comments count */}
          {commentCount > 0 && (
            <button 
              onClick={onCommentClick}
              className="hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
            >
              {commentCount === 1 ? '1 comment' : `${commentCount} comments`}
            </button>
          )}
        </div>
      )}

      {/* Bottom section: Action buttons (LinkedIn style) */}
      <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
        <div className="flex items-center space-x-1">
          {/* Like/Reaction button */}
          <div className="relative">
            <button
              onClick={handleMainButtonClick}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              disabled={disabled}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                hasReacted
                  ? `${REACTION_CONFIG[userReaction]?.color} bg-blue-50 dark:bg-blue-900/20 font-medium`
                  : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-lg">
                {hasReacted ? REACTION_CONFIG[userReaction]?.emoji : '👍'}
              </span>
              <span className="text-sm font-medium">
                {hasReacted ? REACTION_CONFIG[userReaction]?.label : 'Like'}
              </span>
            </button>

            {/* Reaction picker popup */}
            <AnimatePresence>
              {showPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  className="absolute bottom-full left-0 mb-2 z-50"
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => {
                    setIsHovering(false);
                    setShowPicker(false);
                  }}
                >
                  <div className="bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-200 dark:border-gray-700 p-2 flex space-x-1">
                    {Object.entries(REACTION_CONFIG).map(([reactionType, config]) => {
                      const isActive = userReaction === reactionType;
                      const count = reactions?.[reactionType as ReactionType] || 0;
                      
                      return (
                        <motion.button
                          key={reactionType}
                          whileHover={{ scale: 1.3, y: -4 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleReactionClick(reactionType as ReactionType)}
                          className={`relative p-2 rounded-full transition-all duration-200 ${
                            isActive
                              ? 'bg-blue-100 dark:bg-blue-900 scale-110 shadow-lg'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                          }`}
                          title={`${config.label}${count > 0 ? ` (${count})` : ''}`}
                        >
                          <span className="text-xl">{config.emoji}</span>
                          
                          {/* Count badge */}
                          {count > 0 && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1"
                            >
                              {count}
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Comment button */}
          <button 
            onClick={onCommentClick}
            className="flex items-center space-x-2 px-4 py-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChatBubbleLeftIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Comment</span>
          </button>

          {/* Share button */}
          <button 
            onClick={onShareClick}
            className="flex items-center space-x-2 px-4 py-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ShareIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>
      </div>

      {/* Backdrop to close picker */}
      {showPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPicker(false)}
        />
      )}

      {/* Reactions Modal */}
      <ReactionsModal
        isOpen={showReactionsModal}
        onClose={() => setShowReactionsModal(false)}
        postId={postId}
      />
    </div>
  );
};

export default LinkedInReactions;