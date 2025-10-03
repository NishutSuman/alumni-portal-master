import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
  ArchiveBoxIcon,
  ArchiveBoxXMarkIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import {
  useGetPostsQuery,
  useGetPendingPostsQuery,
  useApprovePostMutation,
  useDeletePostMutation,
  useArchivePostMutation,
} from '../../store/api/postApi';
import { Post, PostFilters } from '../../types/post';
import PostCard from '../../components/user/PostCard';
import CreatePostModal from '../../components/user/CreatePostModal';
import PostDetailModal from '../../components/admin/PostDetailModal';
import LoadingSpinner from '../../components/common/UI/LoadingSpinner';
import { Button } from '../../components/common/UI/Button';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const PostsManagement: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [activeTab, setActiveTab] = useState<'pending' | 'published' | 'archived'>('pending');
  const [filters, setFilters] = useState<PostFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // API hooks
  const [approvePost] = useApprovePostMutation();
  const [deletePost] = useDeletePostMutation();
  const [archivePost] = useArchivePostMutation();

  // Queries based on active tab with polling
  const postsQuery = useGetPostsQuery({
    ...filters,
    isPublished: activeTab === 'published' ? true : undefined,
    isArchived: activeTab === 'archived' ? true : 
                activeTab === 'published' ? false : undefined,
    search: searchQuery || undefined,
  }, {
    pollingInterval: 30000, // Poll every 30 seconds
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const pendingPostsQuery = useGetPendingPostsQuery({
    page: filters.page,
    limit: filters.limit,
  }, {
    pollingInterval: 15000, // Poll pending posts more frequently (15 seconds)
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // Select appropriate query based on tab
  const currentQuery = activeTab === 'pending' ? pendingPostsQuery : postsQuery;
  const posts = currentQuery.data?.posts || [];

  // Handle post approval
  const handleApprove = async (postId: string, approved: boolean) => {
    try {
      await approvePost({ postId, approved }).unwrap();
      toast.success(approved ? 'Post approved successfully' : 'Post rejected successfully');
    } catch (error: any) {
      console.error('Failed to update post approval:', error);
      toast.error(error?.data?.message || 'Failed to update post approval');
    }
  };

  // Handle post deletion
  const handleDelete = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    try {
      await deletePost(postId).unwrap();
      toast.success('Post deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete post:', error);
      toast.error(error?.data?.message || 'Failed to delete post');
    }
  };

  // Handle post archiving/unarchiving
  const handleArchive = async (postId: string, isArchived: boolean = true) => {
    try {
      await archivePost({ postId, isArchived }).unwrap();
      toast.success(`Post ${isArchived ? 'archived' : 'unarchived'} successfully`);
    } catch (error: any) {
      console.error(`Failed to ${isArchived ? 'archive' : 'unarchive'} post:`, error);
      toast.error(error?.data?.message || `Failed to ${isArchived ? 'archive' : 'unarchive'} post`);
    }
  };

  // Get status badge (based on backend boolean fields)
  const getStatusBadge = (post: Post) => {
    if (post.isArchived) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <ArchiveBoxIcon className="h-3 w-3 mr-1" />
          Archived
        </span>
      );
    }
    
    if (!post.isPublished) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <ClockIcon className="h-3 w-3 mr-1" />
          Pending Review
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircleIcon className="h-3 w-3 mr-1" />
        Published
      </span>
    );
  };

  // Get published and archived counts from query data
  const publishedQuery = useGetPostsQuery({
    page: 1,
    limit: 1,
    isPublished: true,
    isArchived: false,
  });

  const archivedQuery = useGetPostsQuery({
    page: 1,
    limit: 1,
    isArchived: true,
  });

  const tabs = [
    { key: 'pending' as const, label: 'Pending Approval', count: pendingPostsQuery.data?.pagination?.total || 0 },
    { key: 'published' as const, label: 'Published', count: publishedQuery.data?.pagination?.total || 0 },
    { key: 'archived' as const, label: 'Archived', count: archivedQuery.data?.pagination?.total || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Posts Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage and moderate community posts</p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Create Post</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none rounded-full ${
                activeTab === tab.key ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>

        <select
          value={`${filters.sortBy}:${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split(':') as [string, 'asc' | 'desc'];
            setFilters(prev => ({ ...prev, sortBy, sortOrder }));
          }}
          className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="createdAt:desc">Newest First</option>
          <option value="createdAt:asc">Oldest First</option>
          <option value="title:asc">Title A-Z</option>
          <option value="title:desc">Title Z-A</option>
          <option value="totalReactions:desc">Most Reacted</option>
          <option value="viewCount:desc">Most Viewed</option>
        </select>
      </div>

      {/* Posts Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {currentQuery.isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : currentQuery.error ? (
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400 mb-4">Failed to load posts</div>
            <Button onClick={() => currentQuery.refetch()}>Retry</Button>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              {activeTab === 'pending' ? 'No posts pending approval' : 
               activeTab === 'archived' ? 'No archived posts available' :
               'No posts found'}
            </div>
            {activeTab === 'published' && (
              <Button onClick={() => setShowCreateModal(true)}>
                Create your first post
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Table View for Admin */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Post
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Author
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Stats
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {posts.map((post) => (
                    <motion.tr
                      key={post.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {post.heroImage && (
                            <img
                              src={`/api/posts/${post.id}/hero-image`}
                              alt={post.title}
                              className="h-10 w-10 rounded object-cover mr-3"
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white max-w-xs truncate">
                              {post.title}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                              {post.category?.toLowerCase()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full mr-2 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                            {post.author.profileImage ? (
                              <img
                                src={`/api/users/profile-picture/${post.author.id}`}
                                alt={post.author.fullName}
                                className="h-full w-full object-cover rounded-full"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.parentElement!.innerHTML = post.author.fullName
                                    .split(' ')
                                    .map(word => word.charAt(0))
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase();
                                }}
                              />
                            ) : (
                              post.author.fullName
                                .split(' ')
                                .map(word => word.charAt(0))
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {post.author.fullName}
                            </div>
                            {post.author.batch && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                Batch {post.author.batch}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(post)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center space-x-1">
                            <span>👍</span>
                            <span>{post.totalReactions || post.likeCount || 0}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <span>💬</span>
                            <span>{post._count?.comments || 0}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPost(post)}
                            className="flex items-center space-x-1 px-3 py-2"
                          >
                            <EyeIcon className="h-4 w-4" />
                            <span className="hidden sm:inline whitespace-nowrap">View</span>
                          </Button>
                          
                          {!post.isPublished && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleApprove(post.id, true)}
                                className="flex items-center space-x-1 px-3 py-2"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                                <span className="hidden md:inline whitespace-nowrap">Approve</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleApprove(post.id, false)}
                                className="flex items-center space-x-1 px-3 py-2"
                              >
                                <XCircleIcon className="h-4 w-4" />
                                <span className="hidden md:inline whitespace-nowrap">Reject</span>
                              </Button>
                            </>
                          )}
                          
                          {!post.isArchived && post.isPublished && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleArchive(post.id, true)}
                              className="flex items-center space-x-1 px-3 py-2"
                            >
                              <ArchiveBoxIcon className="h-4 w-4" />
                              <span className="hidden lg:inline whitespace-nowrap">Archive</span>
                            </Button>
                          )}
                          
                          {post.isArchived && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleArchive(post.id, false)}
                              className="flex items-center space-x-1 px-3 py-2"
                            >
                              <ArchiveBoxXMarkIcon className="h-4 w-4" />
                              <span className="hidden lg:inline whitespace-nowrap">Unarchive</span>
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(post.id)}
                            className="flex items-center space-x-1 px-3 py-2"
                          >
                            <TrashIcon className="h-4 w-4" />
                            <span className="hidden lg:inline whitespace-nowrap">Delete</span>
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {currentQuery.data?.pagination && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {((currentQuery.data.pagination.page - 1) * currentQuery.data.pagination.limit) + 1} to{' '}
                    {Math.min(
                      currentQuery.data.pagination.page * currentQuery.data.pagination.limit,
                      currentQuery.data.pagination.total
                    )}{' '}
                    of {currentQuery.data.pagination.total} results
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!currentQuery.data.pagination.hasPrev}
                      onClick={() => setFilters(prev => ({ ...prev, page: prev.page! - 1 }))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Page {currentQuery.data.pagination.page} of {currentQuery.data.pagination.pages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!currentQuery.data.pagination.hasNext}
                      onClick={() => setFilters(prev => ({ ...prev, page: prev.page! + 1 }))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Post Detail Modal */}
      <PostDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onApprove={handleApprove}
        onArchive={(postId) => handleArchive(postId, !selectedPost?.isArchived)}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default PostsManagement;