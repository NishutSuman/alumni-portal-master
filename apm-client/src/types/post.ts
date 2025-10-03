// Base user info for post interactions
export interface PostUser {
  id: string;
  fullName: string;
  profileImage?: string;
  batch?: string;
  employmentStatus?: string;
}

// Reaction types (matches backend enum)
export type ReactionType = 'LIKE' | 'LOVE' | 'CELEBRATE' | 'SUPPORT' | 'FUNNY' | 'WOW' | 'ANGRY' | 'SAD';

// Reaction data structure
export interface PostReaction {
  id: string;
  reactionType: ReactionType;
  user: PostUser;
  createdAt: string;
}

// Reaction counts and user reactions
export interface PostReactions {
  reactions: Record<ReactionType, number>;
  totalReactions: number;
  userReactions: ReactionType[];
  // Legacy compatibility
  likeCount: number;
  isLiked: boolean;
}

// Reaction toggle response
export interface ReactionResponse {
  action: 'added' | 'removed';
  reactionType: ReactionType;
  reactions: Record<ReactionType, number>;
  userReactions: ReactionType[];
  totalReactions: number;
  // Legacy compatibility
  likeCount: number;
  isLiked: boolean;
}

// Post media/attachment types
export interface PostMedia {
  id: string;
  url: string;
  type: 'image' | 'document';
  name: string;
  size: number;
}

// Main post interface (matches backend schema)
export interface Post {
  id: string;
  title: string;
  body: string; // Backend uses 'body', not 'content'
  category: 'MOM' | 'STORY' | 'POST' | 'NOTICE' | 'ANNOUNCEMENT';
  heroImage?: string;
  images: string[]; // Backend uses images array, not media objects
  tags: string[]; // Array of user IDs mentioned
  allowComments: boolean;
  allowLikes: boolean;
  isArchived: boolean;
  isPublished: boolean;
  linkedEventId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  author: PostUser;
  approvedBy?: string;
  approver?: PostUser;
  linkedEvent?: {
    id: string;
    title: string;
    eventDate: string;
  };
  // Computed fields (not in schema but added by API)
  isLikedByUser?: boolean;
  likeCount?: number; // Legacy compatibility
  commentCount?: number;
  viewCount?: number;
  // New reaction system
  reactionCounts?: Record<ReactionType, number>;
  totalReactions?: number;
  userReactions?: ReactionType[];
  recentReactions?: Array<{
    reactionType: ReactionType;
    userId: string;
    user: {
      id: string;
      fullName: string;
      profileImage?: string;
    };
  }>;
  reactionUsers?: PostReaction[];
  _count?: {
    likes?: number; // Legacy - may not exist
    comments: number;
  };
}

// Posts response with pagination
export interface PostsResponse {
  posts: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Create post data (matches backend expectations)
export interface CreatePostData {
  title: string;
  body: string; // Backend expects 'body'
  category: 'MOM' | 'STORY' | 'POST' | 'NOTICE' | 'ANNOUNCEMENT';
  linkedEventId?: string;
  tags?: string[]; // Array of user IDs mentioned
  allowComments?: boolean;
  allowLikes?: boolean;
  heroImage?: File;
  images?: File[];
}

// Update post data
export interface UpdatePostData extends Partial<CreatePostData> {
  id: string;
}

// Comment interface
export interface Comment {
  id: string;
  content: string;
  isEdited: boolean;
  postId: string;
  parentId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  author: PostUser;
  replies?: Comment[];
  _count?: {
    replies: number;
  };
  // Reaction data
  reactions?: Record<ReactionType, number>;
  totalReactions?: number;
  userReaction?: ReactionType | null;
}

// Comments response
export interface CommentsResponse {
  comments: Comment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalAllComments?: number; // Total including replies for display
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Create comment data
export interface CreateCommentData {
  content: string;
  mentions?: string[];
}

// Update comment data
export interface UpdateCommentData {
  content: string;
}

// Like response
export interface LikeResponse {
  action: 'liked' | 'unliked';
  likeCount: number;
  isLiked: boolean;
}

// Like info
export interface PostLike {
  id: string;
  user: PostUser;
  likedAt: string;
}

// Post likes response
export interface PostLikesResponse {
  likes: PostLike[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Post filters for search/filtering (matches backend query params)
export interface PostFilters {
  page?: number;
  limit?: number;
  isPublished?: boolean;
  isArchived?: boolean;
  category?: 'MOM' | 'STORY' | 'POST' | 'NOTICE' | 'ANNOUNCEMENT';
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  author?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
}

// Post form data for creation/editing
export interface PostFormData {
  title: string;
  body: string; // Backend expects 'body'
  category: 'MOM' | 'STORY' | 'POST' | 'NOTICE' | 'ANNOUNCEMENT';
  linkedEventId?: string;
  tags: string[]; // Array of user IDs mentioned
  allowComments: boolean;
  allowLikes: boolean;
  heroImage?: File;
  images?: File[];
  removeImages?: string[];
}

// Post categories (these match backend PostCategory enum exactly)
export const POST_CATEGORIES = [
  { value: 'MOM', label: 'Minutes of Meeting' },
  { value: 'STORY', label: 'Alumni Story' },
  { value: 'POST', label: 'General Post' },
  { value: 'NOTICE', label: 'Official Notice' },
  { value: 'ANNOUNCEMENT', label: 'Event Announcement' },
] as const;

// Sort options (matches backend sortBy options)
export const POST_SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'New to Old' },
  { value: 'createdAt:asc', label: 'Old to New' },
] as const;