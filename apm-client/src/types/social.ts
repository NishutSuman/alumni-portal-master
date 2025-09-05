// src/types/social.ts - FIXED with proper User import
import type { User } from './auth'

export interface Post {
  id: string
  content: string
  mediaUrls?: string[]
  authorId: string
  author?: User  // FIXED: Now properly imported
  likes: number
  commentsCount: number
  shares: number
  isPublic: boolean
  tags: string[]
  location?: string
  mentionedUsers?: string[]
  status: PostStatus
  createdAt: string
  updatedAt: string
  userHasLiked?: boolean
  userHasShared?: boolean
}

export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'REPORTED'

export interface Comment {
  id: string
  postId: string
  content: string
  authorId: string
  author?: User  // FIXED: Now properly imported
  parentId?: string
  replies?: Comment[]
  likes: number
  userHasLiked?: boolean
  createdAt: string
  updatedAt: string
}

export interface Like {
  id: string
  userId: string
  user?: User  // FIXED: Now properly imported
  targetId: string
  targetType: 'POST' | 'COMMENT'
  createdAt: string
}