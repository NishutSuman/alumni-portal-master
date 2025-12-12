import { apiSlice } from './apiSlice';
import { getApiUrl } from '@/utils/helpers';
import type {
  Post,
  CreatePostData,
  UpdatePostData,
  PostsResponse,
  Comment,
  CreateCommentData,
  UpdateCommentData,
  CommentsResponse,
  LikeResponse,
  PostLikesResponse,
  ReactionType,
  PostReactions,
  ReactionResponse,
} from '../../types/post';

// Post API endpoints
export const postApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get posts with pagination and filters
    getPosts: builder.query<PostsResponse, {
      page?: number;
      limit?: number;
      status?: string;
      category?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      isPublished?: boolean;
      isArchived?: boolean;
      forceRefresh?: boolean; // New parameter to force cache bypass
    }>({
      query: (params) => {
        const { forceRefresh, ...restParams } = params;
        return {
          url: '/posts',
          params: {
            ...restParams,
            // Only add timestamp when explicitly forcing refresh
            ...(forceRefresh && { _t: Date.now() }),
          },
        };
      },
      transformResponse: (response: any) => ({
        posts: response.data,
        pagination: response.pagination,
      }),
      providesTags: (result) => [
        'Post',
        ...(result?.posts?.map(({ id }) => ({ type: 'Post' as const, id })) ?? []),
      ],
      // Balanced caching for performance and real-time updates  
      keepUnusedDataFor: 300, // Keep data for 5 minutes to persist across navigation
    }),

    // Get single post by ID
    getPostById: builder.query<Post, string>({
      query: (postId) => `/posts/${postId}`,
      providesTags: (result, error, postId) => [{ type: 'Post', id: postId }],
    }),

    // Get pending posts (SUPER_ADMIN only)
    getPendingPosts: builder.query<PostsResponse, {
      page?: number;
      limit?: number;
    }>({
      query: (params) => ({
        url: '/posts/admin/pending',
        params,
      }),
      transformResponse: (response: any) => ({
        posts: response.data,
        pagination: response.pagination,
      }),
      providesTags: ['PendingPost'],
    }),

    // Create new post
    createPost: builder.mutation<Post, FormData>({
      queryFn: async (formData, { getState }) => {
        try {
          const state = getState() as any;
          const token = state.auth.token;
          
          console.log('🚀 Custom queryFn for createPost:', {
            isFormData: formData instanceof FormData,
            hasToken: !!token
          });
          
          const response = await fetch(getApiUrl('/api/posts'), {
            method: 'POST',
            headers: {
              ...(token && { 'authorization': `Bearer ${token}` }),
              // Don't set Content-Type - let browser handle it for FormData
            },
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          return { data: data.data || data };
        } catch (error: any) {
          console.error('createPost queryFn error:', error);
          return { error: { status: 'FETCH_ERROR', error: error.message, data: { message: error.message } } };
        }
      },
      invalidatesTags: ['Post', 'PendingPost'],
    }),

    // Update existing post
    updatePost: builder.mutation<Post, { postId: string; formData: FormData }>({
      queryFn: async ({ postId, formData }, { getState }) => {
        try {
          const state = getState() as any;
          const token = state.auth.token;
          
          console.log('🚀 Custom queryFn for updatePost:', {
            postId,
            isFormData: formData instanceof FormData,
            hasToken: !!token
          });
          
          const response = await fetch(getApiUrl(`/api/posts/${postId}`), {
            method: 'PUT',
            headers: {
              ...(token && { 'authorization': `Bearer ${token}` }),
              // Don't set Content-Type - let browser handle it for FormData
            },
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          return { data: data.data || data };
        } catch (error: any) {
          console.error('updatePost queryFn error:', error);
          return { error: { status: 'FETCH_ERROR', error: error.message, data: { message: error.message } } };
        }
      },
      invalidatesTags: (result, error, { postId }) => [
        'Post',
        { type: 'Post', id: postId },
        'PendingPost',
      ],
    }),

    // Archive/Unarchive post
    archivePost: builder.mutation<void, { postId: string; isArchived?: boolean }>({
      query: ({ postId, isArchived }) => ({
        url: `/posts/${postId}/archive`,
        method: 'PATCH',
        body: isArchived !== undefined ? { isArchived } : {},
      }),
      invalidatesTags: (result, error, { postId }) => [
        'Post',
        { type: 'Post', id: postId },
      ],
    }),

    // Approve post (SUPER_ADMIN only)
    approvePost: builder.mutation<Post, { postId: string; approved: boolean; feedback?: string }>({
      query: ({ postId, approved, feedback }) => ({
        url: `/posts/${postId}/approve`,
        method: 'PATCH',
        body: {
          action: approved ? 'approve' : 'reject',
          reason: feedback || (approved ? 'Manual approval' : 'Manual rejection'),
        },
      }),
      invalidatesTags: (result, error, { postId }) => [
        'Post',
        { type: 'Post', id: postId },
        'PendingPost',
      ],
    }),

    // Delete post (SUPER_ADMIN only)
    deletePost: builder.mutation<void, string>({
      query: (postId) => ({
        url: `/posts/${postId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, postId) => [
        'Post',
        { type: 'Post', id: postId },
        'PendingPost',
      ],
    }),

    // Like/Unlike post
    toggleLike: builder.mutation<LikeResponse, string>({
      query: (postId) => ({
        url: `/posts/${postId}/like`,
        method: 'POST',
      }),
      // Optimistic update
      onQueryStarted: async (postId, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          
          // Update the post in cache
          dispatch(
            postApi.util.updateQueryData('getPostById', postId, (draft) => {
              if (draft) {
                draft.likeCount = data.likeCount;
                draft.isLikedByUser = data.isLiked;
              }
            })
          );

          // Update post in posts list cache
          dispatch(
            postApi.util.updateQueryData('getPosts', {}, (draft) => {
              const post = draft.posts?.find(p => p.id === postId);
              if (post) {
                post.likeCount = data.likeCount;
                post.isLikedByUser = data.isLiked;
              }
            })
          );
        } catch {}
      },
    }),

    // Get post likes
    getPostLikes: builder.query<PostLikesResponse, {
      postId: string;
      page?: number;
      limit?: number;
    }>({
      query: ({ postId, ...params }) => ({
        url: `/posts/${postId}/likes`,
        params,
      }),
      providesTags: (result, error, { postId }) => [{ type: 'PostLikes', id: postId }],
    }),

    // Check if user liked post
    checkUserLike: builder.query<{ isLiked: boolean; likedAt: string | null }, string>({
      query: (postId) => `/posts/${postId}/like/status`,
      providesTags: (result, error, postId) => [{ type: 'UserLike', id: postId }],
    }),

    // ==========================================
    // NEW REACTION ENDPOINTS
    // ==========================================

    // Toggle reaction on a post
    toggleReaction: builder.mutation<ReactionResponse, { postId: string; reactionType: ReactionType }>({
      query: ({ postId, reactionType }) => ({
        url: `/posts/${postId}/reactions`,
        method: 'POST',
        body: { reactionType },
      }),
      // Optimistic update for instant UI feedback
      onQueryStarted: async ({ postId }, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          
          // Update the post reactions in cache
          dispatch(
            postApi.util.updateQueryData('getPostReactions', postId, (draft) => {
              if (draft) {
                draft.reactions = data.reactions;
                draft.userReactions = data.userReactions;
                draft.totalReactions = data.totalReactions;
                draft.likeCount = data.likeCount;
                draft.isLiked = data.isLiked;
              }
            })
          );

          // Get all cached getPosts queries and update them
          const state = getState() as any;
          const postsCache = state.api.queries;
          
          // Update all getPosts cache entries
          Object.keys(postsCache).forEach(key => {
            if (key.startsWith('getPosts(')) {
              try {
                const cacheKey = JSON.parse(key.replace('getPosts(', '').replace(')', ''));
                dispatch(
                  postApi.util.updateQueryData('getPosts', cacheKey, (draft) => {
                    const post = draft.posts?.find(p => p.id === postId);
                    if (post) {
                      // Update new reaction structure
                      post.reactionCounts = data.reactions;
                      post.totalReactions = data.totalReactions;
                      post.userReactions = data.userReactions;
                      // Legacy compatibility
                      post.likeCount = data.likeCount;
                      post.isLikedByUser = data.isLiked;
                    }
                  })
                );
              } catch (e) {
                // Skip invalid cache keys
              }
            }
          });

          // Update single post cache
          dispatch(
            postApi.util.updateQueryData('getPostById', postId, (draft) => {
              if (draft) {
                // Update reaction structure
                draft.reactionCounts = data.reactions;
                draft.totalReactions = data.totalReactions;
                draft.userReactions = data.userReactions;
                // Legacy compatibility
                draft.likeCount = data.likeCount;
                draft.isLikedByUser = data.isLiked;
              }
            })
          );
        } catch (error) {
          console.error('Error updating reaction cache:', error);
        }
      },
      // Invalidate tags to trigger cache refresh for real-time updates
      invalidatesTags: (result, error, { postId }) => [
        'Post', // Invalidate all posts to ensure real-time updates
        { type: 'PostReactions', id: postId },
        { type: 'PostReactionUsers', id: postId }, // Invalidate modal data for real-time updates
        { type: 'Post', id: postId },
        'PendingPost', // Also invalidate pending posts if applicable
      ],
    }),

    // Get post reactions with counts
    getPostReactions: builder.query<PostReactions, string>({
      query: (postId) => `/posts/${postId}/reactions`,
      providesTags: (result, error, postId) => [{ type: 'PostReactions', id: postId }],
    }),

    // Get detailed reaction users for modal (LinkedIn-style)
    getPostReactionUsers: builder.query<{
      reactions: Array<{
        id: string;
        reactionType: ReactionType;
        createdAt: string;
        user: {
          id: string;
          fullName: string;
          profileImage?: string;
          batch?: string;
          employmentStatus?: string;
          currentCompany?: string;
          currentPosition?: string;
        };
      }>;
      reactionCounts: Record<string, number>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }, {
      postId: string;
      reactionType?: string;
      page?: number;
      limit?: number;
    }>({
      query: ({ postId, reactionType, page = 1, limit = 20 }) => ({
        url: `/posts/${postId}/reactions/users`,
        params: { reactionType, page, limit },
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, { postId }) => [{ type: 'PostReactionUsers', id: postId }],
    }),

    // Get post comments
    getPostComments: builder.query<CommentsResponse, {
      postId: string;
      page?: number;
      limit?: number;
      sortOrder?: 'desc' | 'asc';
    }>({
      query: ({ postId, ...params }) => ({
        url: `/posts/${postId}/comments`,
        params,
      }),
      transformResponse: (response: any) => ({
        comments: response.data,
        pagination: response.pagination,
      }),
      providesTags: (result, error, { postId }) => [
        { type: 'PostComments', id: postId },
        ...(result?.comments?.map(({ id }) => ({ type: 'Comment' as const, id })) ?? []),
      ],
    }),

    // Create comment
    createComment: builder.mutation<Comment, {
      postId: string;
      content: string;
      mentions?: string[];
    }>({
      query: ({ postId, ...body }) => ({
        url: `/posts/${postId}/comments`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { postId }) => [
        { type: 'PostComments', id: postId },
        { type: 'Post', id: postId },
      ],
    }),

    // Update comment
    updateComment: builder.mutation<Comment, {
      postId: string;
      commentId: string;
      content: string;
    }>({
      query: ({ postId, commentId, ...body }) => ({
        url: `/posts/${postId}/comments/${commentId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { postId, commentId }) => [
        { type: 'PostComments', id: postId },
        { type: 'Comment', id: commentId },
      ],
    }),

    // Delete comment
    deleteComment: builder.mutation<void, {
      postId: string;
      commentId: string;
    }>({
      query: ({ postId, commentId }) => ({
        url: `/posts/${postId}/comments/${commentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { postId, commentId }) => [
        { type: 'PostComments', id: postId },
        { type: 'Comment', id: commentId },
        { type: 'Post', id: postId },
      ],
    }),

    // Create reply
    createReply: builder.mutation<Comment, {
      postId: string;
      commentId: string;
      content: string;
      mentions?: string[];
    }>({
      query: ({ postId, commentId, ...body }) => ({
        url: `/posts/${postId}/comments/${commentId}/replies`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { postId }) => [
        { type: 'PostComments', id: postId },
      ],
    }),

    // Toggle reaction on a comment
    toggleCommentReaction: builder.mutation<ReactionResponse, {
      postId: string;
      commentId: string;
      reactionType?: ReactionType;
    }>({
      query: ({ postId, commentId, ...body }) => ({
        url: `/posts/${postId}/comments/${commentId}/reactions`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { postId, commentId }) => [
        { type: 'PostComments', id: postId },
        { type: 'Comment', id: commentId },
        { type: 'CommentReactions', id: commentId },
      ],
    }),

    // Get comment reactions with counts
    getCommentReactions: builder.query<{
      reactions: Record<ReactionType, number>;
      totalReactions: number;
      userReactions: ReactionType[];
    }, {
      postId: string;
      commentId: string;
    }>({
      query: ({ postId, commentId }) => ({
        url: `/posts/${postId}/comments/${commentId}/reactions`,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, { commentId }) => [
        { type: 'CommentReactions', id: commentId },
      ],
    }),

    // Get detailed comment reaction users for modal (LinkedIn-style)
    getCommentReactionUsers: builder.query<{
      reactions: Array<{
        id: string;
        reactionType: ReactionType;
        createdAt: string;
        user: {
          id: string;
          fullName: string;
          profileImage?: string;
          batch?: number;
          employmentStatus?: string;
          workHistory: Array<{
            companyName: string;
            jobRole: string;
          }>;
        };
      }>;
      reactionCounts: Record<string, number>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }, {
      postId: string;
      commentId: string;
      reactionType?: string;
      page?: number;
      limit?: number;
    }>({
      query: ({ postId, commentId, reactionType, page = 1, limit = 20 }) => ({
        url: `/posts/${postId}/comments/${commentId}/reactions/users`,
        params: { reactionType, page, limit },
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, { commentId }) => [{ type: 'CommentReactionUsers', id: commentId }],
    }),

  }),
});

export const {
  useGetPostsQuery,
  useGetPostByIdQuery,
  useGetPendingPostsQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useArchivePostMutation,
  useApprovePostMutation,
  useDeletePostMutation,
  useToggleLikeMutation,
  useGetPostLikesQuery,
  useCheckUserLikeQuery,
  // New reaction hooks
  useToggleReactionMutation,
  useGetPostReactionsQuery,
  useGetPostReactionUsersQuery, // New hook for LinkedIn-style modal
  // Comment hooks
  useGetPostCommentsQuery,
  useCreateCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
  useCreateReplyMutation,
  // Comment reaction hooks
  useToggleCommentReactionMutation,
  useGetCommentReactionsQuery,
  useGetCommentReactionUsersQuery,
} = postApi;