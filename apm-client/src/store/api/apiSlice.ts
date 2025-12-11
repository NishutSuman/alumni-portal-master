// src/store/api/apiSlice.ts
// GUILD RTK Query API Configuration

import { createApi, fetchBaseQuery, type FetchArgs, type BaseQueryFn, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'
import { getApiBaseUrl } from '@/config/organizations'

// Dynamic base query that reads API URL from localStorage
// This allows switching between different organization backends
const dynamicBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  // Get the current API base URL (from localStorage or env fallback)
  const baseUrl = getApiBaseUrl()

  // Create a new fetchBaseQuery with the current baseUrl
  const rawBaseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      // Get the token from the auth state
      const token = (getState() as RootState).auth.token

      // If we have a token, set the authorization header
      if (token) {
        headers.set('authorization', `Bearer ${token}`)
      }

      // Multi-tenant support: Add X-Tenant-Code header if organization is selected
      // This allows a shared backend to identify which organization the request is for
      const orgCode = localStorage.getItem('guild-org-code')
      if (orgCode) {
        headers.set('X-Tenant-Code', orgCode)
      }

      // IMPORTANT: Don't set content-type here for any request
      // Let fetchBaseQuery handle it automatically
      // For FormData, browser will set multipart/form-data with boundary
      // For JSON, fetchBaseQuery will set application/json

      return headers
    },
  })

  return rawBaseQuery(args, api, extraOptions)
}

// Base query with token refresh
const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
  let result = await dynamicBaseQuery(args, api, extraOptions)
  
  // If we get a 401 (unauthorized), try to refresh the token
  if (result.error && result.error.status === 401) {
    const refreshToken = (api.getState() as RootState).auth.refreshToken
    
    if (refreshToken) {
      // Try to refresh the token
      const refreshResult = await dynamicBaseQuery(
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
        result = await dynamicBaseQuery(args, api, extraOptions)
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
    'Notification', 'UnreadCount', 'NotificationPreferences', 'PushToken', 'Announcement',
    
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

    // Email configuration (multi-tenant)
    'EmailConfig',
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