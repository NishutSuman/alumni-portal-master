import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  HeartIcon,
  ChatBubbleLeftIcon,
  ShareIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ArchiveBoxIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolidIcon,
} from '@heroicons/react/24/solid';
import { Post } from '../../types/post';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import {
  useToggleLikeMutation,
  useToggleReactionMutation
} from '../../store/api/postApi';
import type { ReactionType } from '../../types/post';
import { formatDistanceToNow } from 'date-fns';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Button } from '../common/UI/Button';
import LinkedInReactions from '../common/UI/LinkedInReactions';
import CommentsSection from '../common/UI/CommentsSection';
import PostImageDisplay from './PostImageDisplay';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/utils/helpers';

interface PostCardProps {
  post: Post;
  showActions?: boolean;
  onEdit?: (post: Post) => void;
  onDelete?: (postId: string) => void;
  onArchive?: (postId: string) => void;
  onApprove?: (postId: string, approved: boolean) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  showActions = true,
  onEdit,
  onDelete,
  onArchive,
  onApprove,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [showComments, setShowComments] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [toggleLike, { isLoading: likingPost }] = useToggleLikeMutation();
  const [toggleReaction, { isLoading: reactingToPost }] = useToggleReactionMutation();
  
  // Use reaction data from post object (already includes real-time data)
  const defaultReactions: Record<ReactionType, number> = {
    LIKE: 0,
    LOVE: 0,
    CELEBRATE: 0,
    SUPPORT: 0,
    FUNNY: 0,
    WOW: 0,
    ANGRY: 0,
    SAD: 0,
  };
  
  const reactionsData = {
    reactions: { ...defaultReactions, ...post.reactionCounts },
    userReactions: post.userReactions || [],
    totalReactions: post.totalReactions || 0,
  };
  const loadingReactions = false; // Data is already available in post object


  // Determine if user can perform actions
  const canEdit = user?.id === post.createdBy || user?.role === 'SUPER_ADMIN';
  const canDelete = user?.id === post.createdBy || user?.role === 'SUPER_ADMIN'; // Allow authors to delete their own posts
  const canApprove = user?.role === 'SUPER_ADMIN' && !post.isPublished;
  const canArchive = canEdit;

  // Handle new reaction system
  const handleReaction = async (reactionType: ReactionType) => {
    if (!user) {
      toast.error('Please login to react to posts');
      return;
    }

    try {
      await toggleReaction({ postId: post.id, reactionType }).unwrap();
    } catch (error: any) {
      console.error('Failed to toggle reaction:', error);
      const errorMessage = error?.data?.message || 'Failed to update reaction';
      toast.error(errorMessage);
    }
  };

  // Legacy handler for backward compatibility  
  const handleReactionToggle = async (reactionId: string) => {
    // Map old reaction IDs to new types
    const reactionMap: Record<string, ReactionType> = {
      'like': 'LIKE',
      'love': 'LOVE', 
      'celebrate': 'CELEBRATE',
      'support': 'SUPPORT',
      'funny': 'FUNNY',
      'wow': 'WOW',
      'angry': 'ANGRY',
      'sad': 'SAD'
    };
    
    const reactionType = reactionMap[reactionId] || 'LIKE';
    await handleReaction(reactionType);
  };

  // Generate user initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Helper function to get plain text from HTML
  const getPlainText = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  // Helper function to clean HTML content and remove unwanted link styling
  const cleanHtmlContent = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Only remove anchor tags that are not mentions (keep mention functionality)
    const anchors = tempDiv.querySelectorAll('a');
    anchors.forEach(anchor => {
      // Check if this is a mention (has data-user-id or mention class)
      const isMention = anchor.hasAttribute('data-user-id') || 
                       anchor.classList.contains('mention') ||
                       anchor.textContent?.startsWith('@');

      if (isMention) {
        // Convert mention links to styled spans to preserve mention appearance
        const mentionSpan = document.createElement('span');
        mentionSpan.className = 'mention bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-1 rounded font-medium';
        mentionSpan.textContent = anchor.textContent || '';
        if (anchor.hasAttribute('data-user-id')) {
          mentionSpan.setAttribute('data-user-id', anchor.getAttribute('data-user-id') || '');
        }
        anchor.parentNode?.replaceChild(mentionSpan, anchor);
      } else {
        // Remove non-mention links but keep their text content
        const textNode = document.createTextNode(anchor.textContent || '');
        anchor.parentNode?.replaceChild(textNode, anchor);
      }
    });

    // Only remove problematic attributes while keeping essential formatting
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(element => {
      // Remove only navigation-related attributes
      element.removeAttribute('href');
      element.removeAttribute('data-discover');
      
      // Remove only problematic inline styles but keep essential formatting classes
      const style = element.getAttribute('style');
      if (style) {
        // Remove specific problematic style properties while keeping others
        const problematicStyles = [
          'color: rgb(96, 165, 250)',
          '--tw-text-opacity: 1'
        ];
        
        let cleanedStyle = style;
        problematicStyles.forEach(problemStyle => {
          cleanedStyle = cleanedStyle.replace(new RegExp(problemStyle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
        });
        
        // Clean up extra semicolons and spaces
        cleanedStyle = cleanedStyle.replace(/;+/g, ';').replace(/;\s*$/, '').trim();
        
        if (cleanedStyle) {
          element.setAttribute('style', cleanedStyle);
        } else {
          element.removeAttribute('style');
        }
      }
    });

    return tempDiv.innerHTML;
  };

  // Helper function to truncate HTML content properly
  const getTruncatedHtml = (html: string, maxLength: number): string => {
    const cleanedHtml = cleanHtmlContent(html);
    const plainText = getPlainText(cleanedHtml);
    
    if (plainText.length <= maxLength) {
      return cleanedHtml;
    }

    // Simple approach: truncate based on plain text length
    const words = plainText.split(' ');
    let truncatedText = '';
    for (const word of words) {
      if ((truncatedText + ' ' + word).length > maxLength) {
        break;
      }
      truncatedText += (truncatedText ? ' ' : '') + word;
    }
    
    // For truncated content, just return the plain text to avoid broken HTML
    return truncatedText;
  };

  // Handle share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: getPlainText(cleanHtmlContent(post.body)).substring(0, 100) + '...',
          url: `${window.location.origin}/posts/${post.id}`,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
        toast.success('Link copied to clipboard!');
      } catch (error) {
        toast.error('Failed to copy link');
      }
    }
  };

  // Get status badge (based on backend boolean fields)
  const getStatusBadge = () => {
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
          <ClockIcon className="h-3 w-3 mr-1" />
          Pending Review
        </span>
      );
    }
    
    return null;
  };

  return (
    <motion.article
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200"
      whileHover={{ y: -2 }}
      layout
    >
      {/* Post Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {!imageError ? (
              <img
                src={getApiUrl(`/api/users/profile-picture/${post.author.id}`)}
                alt={post.author.fullName}
                className="h-10 w-10 rounded-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                {getInitials(post.author.fullName)}
              </div>
            )}
            <div>
              <Link
                to={`/alumni/${post.author.id}`}
                className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
              >
                {post.author.fullName}
              </Link>
              {post.author.batch && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Batch {post.author.batch}</p>
              )}
              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <time>
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </time>
                {post.category && (
                  <>
                    <span>•</span>
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full">
                      {post.category}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {getStatusBadge()}
            
            {showActions && (canEdit || canDelete || canApprove) && (
              <Menu as="div" className="relative">
                <Menu.Button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <EllipsisVerticalIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </Menu.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-600 focus:outline-none z-10">
                    <div className="py-1">
                      {canApprove && (
                        <>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => onApprove?.(post.id, true)}
                                className={`${
                                  active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                } group flex items-center px-4 py-2 text-sm text-green-700 dark:text-green-400 w-full text-left`}
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-3" />
                                Approve Post
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => onApprove?.(post.id, false)}
                                className={`${
                                  active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                } group flex items-center px-4 py-2 text-sm text-red-700 dark:text-red-400 w-full text-left`}
                              >
                                <XCircleIcon className="h-4 w-4 mr-3" />
                                Reject Post
                              </button>
                            )}
                          </Menu.Item>
                        </>
                      )}
                      
                      {canEdit && (
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => onEdit?.(post)}
                              className={`${
                                active ? 'bg-gray-100 dark:bg-gray-700' : ''
                              } group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 w-full text-left`}
                            >
                              <PencilIcon className="h-4 w-4 mr-3" />
                              Edit Post
                            </button>
                          )}
                        </Menu.Item>
                      )}

                      {canArchive && (
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => onArchive?.(post.id)}
                              className={`${
                                active ? 'bg-gray-100 dark:bg-gray-700' : ''
                              } group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 w-full text-left`}
                            >
                              <ArchiveBoxIcon className="h-4 w-4 mr-3" />
                              Archive Post
                            </button>
                          )}
                        </Menu.Item>
                      )}

                      {canDelete && (
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => onDelete?.(post.id)}
                              className={`${
                                active ? 'bg-gray-100 dark:bg-gray-700' : ''
                              } group flex items-center px-4 py-2 text-sm text-red-700 dark:text-red-400 w-full text-left`}
                            >
                              <TrashIcon className="h-4 w-4 mr-3" />
                              Delete Post
                            </button>
                          )}
                        </Menu.Item>
                      )}
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>
            )}
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="p-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {post.title}
          </h2>
          
          <div className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
            <div 
              className="prose dark:prose-invert max-w-none prose-sm"
              dangerouslySetInnerHTML={{
                __html: isExpanded ? cleanHtmlContent(post.body) : getTruncatedHtml(post.body, 200)
              }}
            />
            {getPlainText(post.body).length > 200 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium mt-1 inline-block"
              >
                {isExpanded ? 'Read less' : 'Read more'}
              </button>
            )}
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

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* LinkedIn-style Post Actions */}
      <div className="px-4 py-3">
        <LinkedInReactions
          postId={post.id}
          reactions={reactionsData.reactions}
          userReactions={reactionsData.userReactions}
          totalReactions={reactionsData.totalReactions}
          recentReactions={post.recentReactions}
          onReact={handleReaction}
          onCommentClick={() => setShowComments(!showComments)}
          onShareClick={handleShare}
          commentCount={post._count?.comments || 0}
          disabled={reactingToPost || !user}
        />
      </div>

      {/* Comments Section */}
      {showComments && (
        <CommentsSection
          postId={post.id}
          allowComments={post.allowComments}
        />
      )}
    </motion.article>
  );
};

export default PostCard;