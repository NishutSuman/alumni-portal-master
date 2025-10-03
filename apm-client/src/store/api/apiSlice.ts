// src/store/api/apiSlice.ts
// GUILD RTK Query API Configuration

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'

// Base query configuration
const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  prepareHeaders: (headers, { getState, endpoint, body }) => {
    // Get the token from the auth state
    const token = (getState() as RootState).auth.token
    
    // If we have a token, set the authorization header
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    
    // Check if body is FormData
    const isFormData = body instanceof FormData
    
    // For FormData requests, don't set any content-type header - let browser handle it
    if (isFormData) {
      // Explicitly remove content-type header for FormData to prevent conflicts
      if (headers.has('content-type')) {
        headers.delete('content-type');
      }
      // Don't set any content-type for FormData
      return headers;
    }
    
    // For non-FormData requests, set JSON content-type if not already set
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    
    return headers
  },
})

// Base query with token refresh  
const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
  let result = await baseQuery(args, api, extraOptions)
  
  // If we get a 401 (unauthorized), try to refresh the token
  if (result.error && result.error.status === 401) {
    const refreshToken = (api.getState() as RootState).auth.refreshToken
    
    if (refreshToken) {
      // Try to refresh the token
      const refreshResult = await baseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions
      )
      
      if (refreshResult.data) {
        // Store the new tokens
        const { accessToken, refreshToken: newRefreshToken } = refreshResult.data as any
        api.dispatch({
          type: 'auth/refreshTokenSuccess',
          payload: {
            token: accessToken,
            refreshToken: newRefreshToken,
          },
        })
        
        // Retry the original query with the new token
        result = await baseQuery(args, api, extraOptions)
      } else {
        // Refresh failed, logout the user
        api.dispatch({ type: 'auth/sessionExpired' })
      }
    } else {
      // No refresh token, logout the user
      api.dispatch({ type: 'auth/sessionExpired' })
    }
  }
  
  return result
}

// Define the main API slice
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  
  // Define tag types for caching and invalidation
  tagTypes: [
    // Authentication
    'Auth', 'User', 'Profile',
    
    // Admin
    'Admin', 'Dashboard', 'Users', 'Verification', 'Organization', 'Cache', 'Health',
    
    // Alumni Directory
    'Alumni', 'AlumniStats',
    
    // Core entities
    'Event', 'EventRegistration', 'EventCategory',
    'Post', 'Comment', 'Like', 'PostReactions', 'PostReactionUsers', 'PostComments', 'PostLikes', 'PendingPost', 'CommentReactions', 'UserLike', 'CommentReactionUsers',
    'Album', 'Photo',
    'Notification', 'UnreadCount', 'NotificationPreferences', 'PushToken',
    
    // LifeLink system
    'LifeLink', 'BloodRequisition', 'Donation',
    
    // Treasury system
    'Treasury', 'Expense', 'Collection', 'AccountBalance',
    
    // Membership system
    'Membership', 'BatchSettings', 'Payment',
    
    // Support system
    'Ticket', 'TicketMessage', 'TicketCategory',
    
    // Polls and voting
    'Poll', 'Vote', 'UserVotes', 'PollStats',
    
    // Organization management
    'Organization', 'Batch', 'Sponsor',
    
    // Groups and committee system
    'Group', 'GroupMember', 'GroupStats',
    
    // Analytics and reporting
    'Analytics', 'Report', 'Statistics',
  ],
  
  // Base endpoints (empty, will be injected by other files)
  endpoints: () => ({}),
})

// Organization endpoints (public)
export const organizationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPublicOrganization: builder.query<{
      id: string;
      name: string;
      shortName: string;
      foundationYear: number;
      officialEmail: string;
      officialContactNumber?: string;
      officeAddress?: string;
      logoUrl?: string;
      bylawDocumentUrl?: string;
      registrationCertUrl?: string;
      websiteUrl?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      twitterUrl?: string;
      linkedinUrl?: string;
      youtubeUrl?: string;
      foundingMembers?: any[];
      description?: string;
      mission?: string;
      vision?: string;
      createdAt: string;
      updatedAt: string;
    }, void>({
      query: () => '/organization',
      transformResponse: (response: any) => response.data.organization,
      providesTags: ['Organization'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetPublicOrganizationQuery } = organizationApi;

// Export hooks that are auto-generated based on the endpoints
// These will be extended by injecting endpoints from other files

// Export the enhanced API slice
export default apiSlice