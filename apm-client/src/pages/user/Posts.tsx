import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { 
  useGetPostsQuery, 
  useDeletePostMutation,
  useArchivePostMutation 
} from '../../store/api/postApi';
import { PostFilters, POST_CATEGORIES, POST_SORT_OPTIONS } from '../../types/post';
import PostCard from '../../components/user/PostCard';
import CreatePostModal from '../../components/user/CreatePostModal';
import PostFiltersPanel from '../../components/user/PostFiltersPanel';
import LoadingSpinner from '../../components/common/UI/LoadingSpinner';
import { Button } from '../../components/common/UI/Button';
import toast from 'react-hot-toast';
import type { Post } from '../../types/post';

const PostsPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [filters, setFilters] = useState<PostFilters>({
    page: 1,
    limit: 10,
    isPublished: true,
    isArchived: false,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const observer = useRef<IntersectionObserver>();
  const isInitialMount = useRef(true);
  
  // Mutations for post actions
  const [deletePost] = useDeletePostMutation();
  const [archivePost] = useArchivePostMutation();


  // Query for posts with optimized caching for real-time interactions
  const {
    data: postsResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetPostsQuery(filters, {
    pollingInterval: 0, // Disable polling to prevent interference
    refetchOnFocus: false, // Don't refetch when window gets focus
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchOnMountOrArgChange: false, // Don't refetch on mount to preserve cache
    skip: false, // Never skip the query
    // Increase cache time to persist data longer across navigation
    keepUnusedDataFor: 300, // Keep data for 5 minutes
  });

  // Use RTK Query data directly like Polls component - no local state management
  const posts = postsResponse?.posts || [];
  const hasNextPage = postsResponse?.pagination?.hasNext || false;

  // Infinite scroll reference callback
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isFetching) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        setFilters(prev => ({ ...prev, page: prev.page! + 1 }));
      }
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, isFetching, hasNextPage]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<PostFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Handle search
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
  };

  // Auto search when search query changes (with debounce)
  React.useEffect(() => {
    // Skip effect on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only trigger search if we actually have a search query
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        setFilters(prev => ({ 
          ...prev, 
          page: 1,
          search: searchQuery.trim()
        }));
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    } else {
      // If search is cleared, immediately refresh
      setFilters(prev => ({ 
        ...prev, 
        page: 1,
        search: undefined
      }));
    }
  }, [searchQuery]);

  // Handle sort change
  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split(':') as [string, 'asc' | 'desc'];
    handleFilterChange({ sortBy, sortOrder });
  };

  // Handle post edit
  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setShowCreateModal(true);
  };

  // Handle post delete
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    try {
      await deletePost(postId).unwrap();
      toast.success('Post deleted successfully');
      // RTK Query will automatically update cache via invalidatesTags
    } catch (error: any) {
      console.error('Failed to delete post:', error);
      const errorMessage = error?.data?.message || 'Failed to delete post';
      toast.error(errorMessage);
    }
  };

  // Handle post archive
  const handleArchivePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to archive this post?')) {
      return;
    }

    try {
      await archivePost(postId).unwrap();
      toast.success('Post archived successfully');
      // RTK Query will automatically update cache via invalidatesTags
    } catch (error: any) {
      console.error('Failed to archive post:', error);
      const errorMessage = error?.data?.message || 'Failed to archive post';
      toast.error(errorMessage);
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingPost(null);
  };

  // Check if user can create posts
  const canCreatePost = user?.isAlumniVerified && !user?.isBlacklisted;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Posts</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Connect and share with the community</p>
            </div>

            {canCreatePost && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-2"
              >
                <PlusIcon className="h-5 w-5" />
                <span>Create Post</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - Fixed Layout */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-full">
          {/* Mobile Filters Toggle */}
          <div className="lg:hidden mb-4">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
              <span>Filters</span>
            </Button>
          </div>

          <div className="flex gap-6 h-full">
            {/* Filters Sidebar - Fixed */}
            <div className="w-80 flex-shrink-0 hidden lg:block">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sticky top-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
                </div>

                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by title or author..."
                      className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Sort */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sort by
                  </label>
                  <select
                    value={`${filters.sortBy}:${filters.sortOrder}`}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {POST_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={filters.category || ''}
                    onChange={(e) => handleFilterChange({ 
                      category: e.target.value || undefined 
                    })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Categories</option>
                    {POST_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Additional Filters */}
                <PostFiltersPanel
                  filters={filters}
                  onFiltersChange={handleFilterChange}
                  onClearSearch={handleClearSearch}
                  className="block"
                />
              </div>
            </div>

            {/* Posts List - Scrollable */}
            <div className="flex-1 overflow-y-auto h-full">
            {/* Loading state for initial load */}
            {isLoading && posts.length === 0 && (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="text-center py-12">
                <div className="text-red-600 dark:text-red-400 mb-4">
                  Failed to load posts. Please try again.
                </div>
                <Button onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            )}


            {/* Posts */}
            {posts && posts.length > 0 && (
              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {posts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      ref={index === posts.length - 1 ? lastPostElementRef : null}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <PostCard 
                        post={post} 
                        onEdit={handleEditPost}
                        onDelete={handleDeletePost}
                        onArchive={handleArchivePost}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Loading more indicator */}
                {isFetching && (
                  <div className="flex justify-center py-6">
                    <LoadingSpinner />
                  </div>
                )}

                {/* End of posts indicator */}
                {!hasNextPage && posts.length > 0 && (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    You've reached the end of posts
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && (!posts || posts.length === 0) && (
              <div className="text-center py-12">
                <div className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery || filters.category ? 
                    "No posts found matching your criteria" : 
                    "No posts available"}
                </div>
                {canCreatePost && !searchQuery && !filters.category && (
                  <Button onClick={() => setShowCreateModal(true)}>
                    Create the first post
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Mobile Filters Modal */}
      {showFilters && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowFilters(false)}>
          <div className="absolute right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-xl transform transition-transform" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto h-full">
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title or author..."
                    className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Sort */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort by
                </label>
                <select
                  value={`${filters.sortBy}:${filters.sortOrder}`}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {POST_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => handleFilterChange({ 
                    category: e.target.value || undefined 
                  })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {POST_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Filters */}
              <PostFiltersPanel
                filters={filters}
                onFiltersChange={handleFilterChange}
                onClearSearch={handleClearSearch}
                className="block"
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        editPost={editingPost}
      />
    </div>
  );
};

export default PostsPage;