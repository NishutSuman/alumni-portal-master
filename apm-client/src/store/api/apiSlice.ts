// src/store/api/apiSlice.ts
// GUILD RTK Query API Configuration

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'

// Base query configuration
const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  prepareHeaders: (headers, { getState }) => {
    // Get the token from the auth state
    const token = (getState() as RootState).auth.token
    
    // If we have a token, set the authorization header
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    
    // Set content type if not already set
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
    
    // Core entities
    'Event', 'EventRegistration', 'EventCategory',
    'Post', 'Comment', 'Like',
    'Album', 'Photo',
    'Notification',
    
    // LifeLink system
    'LifeLink', 'BloodRequisition', 'Donation',
    
    // Treasury system
    'Treasury', 'Expense', 'Collection', 'AccountBalance',
    
    // Membership system
    'Membership', 'BatchSettings', 'Payment',
    
    // Support system
    'Ticket', 'TicketMessage', 'TicketCategory',
    
    // Polls and voting
    'Poll', 'Vote',
    
    // Organization management
    'Organization', 'Batch', 'Sponsor',
    
    // Analytics and reporting
    'Analytics', 'Report', 'Statistics',
  ],
  
  // Base endpoints (empty, will be injected by other files)
  endpoints: () => ({}),
})

// Export hooks that are auto-generated based on the endpoints
// These will be extended by injecting endpoints from other files

// Export the enhanced API slice
export default apiSlice