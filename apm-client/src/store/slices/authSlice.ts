// src/store/slices/authSlice.ts
// GUILD Authentication State Management

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { apiSlice } from '../api/apiSlice'

// Types for authentication
export interface User {
  id: string
  email: string
  fullName: string
  role: 'USER' | 'TEACHER' | 'BATCH_ADMIN' | 'SUPER_ADMIN' | 'DEVELOPER'
  batch: number
  admissionYear?: number
  passoutYear?: number
  isAlumniVerified: boolean
  pendingVerification: boolean
  isRejected?: boolean
  rejectionReason?: string
  profileImage?: string
  whatsappNumber?: string
  personalEmail?: string
  currentLocation?: string
  bio?: string
  employmentStatus?: 'STUDENT' | 'EMPLOYED' | 'UNEMPLOYED' | 'ENTREPRENEUR' | 'FREELANCER'
  serialId?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  verificationContext?: {
    isBlacklisted?: boolean
    blacklistInfo?: {
      reason?: string
      blacklistedAt?: string
    }
  }
}

export interface AuthState {
  // Authentication status
  isAuthenticated: boolean
  isLoading: boolean
  
  // User data
  user: User | null
  
  // Tokens
  token: string | null
  refreshToken: string | null
  
  // Error handling
  error: string | null
  
  // Login attempt tracking
  loginAttempts: number
  lastLoginAttempt?: string
  
  // Session management
  sessionExpiry?: string
  rememberMe: boolean
  
  // Verification status
  emailVerificationSent: boolean
  passwordResetSent: boolean
  
  // UI states
  showWelcome: boolean
  isFirstLogin: boolean
}

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  token: null,
  refreshToken: null,
  error: null,
  loginAttempts: 0,
  rememberMe: false,
  emailVerificationSent: false,
  passwordResetSent: false,
  showWelcome: false,
  isFirstLogin: false,
}

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Login actions
    loginStart: (state) => {
      state.isLoading = true
      state.error = null
    },
    
    loginSuccess: (state, action: PayloadAction<{
      user: User
      token: string
      refreshToken: string
      rememberMe?: boolean
    }>) => {
      const { user, token, refreshToken, rememberMe = false } = action.payload
      
      state.isAuthenticated = true
      state.isLoading = false
      state.user = user
      state.token = token
      state.refreshToken = refreshToken
      state.rememberMe = rememberMe
      state.error = null
      state.loginAttempts = 0
      state.showWelcome = true
      
      // Check if it's first login
      if (!user.lastLoginAt) {
        state.isFirstLogin = true
      }
      
      // Set session expiry (2 hours from now)
      const expiry = new Date()
      expiry.setHours(expiry.getHours() + 2)
      state.sessionExpiry = expiry.toISOString()
    },
    
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false
      state.error = action.payload
      state.loginAttempts += 1
      state.lastLoginAttempt = new Date().toISOString()
      state.isAuthenticated = false
      state.user = null
      state.token = null
      state.refreshToken = null
    },
    
    // Registration actions
    registerStart: (state) => {
      state.isLoading = true
      state.error = null
    },
    
    registerSuccess: (state, action: PayloadAction<{ message: string }>) => {
      state.isLoading = false
      state.error = null
      state.emailVerificationSent = true
    },
    
    registerFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false
      state.error = action.payload
    },
    
    // Token refresh
    refreshTokenSuccess: (state, action: PayloadAction<{
      token: string
      refreshToken: string
    }>) => {
      state.token = action.payload.token
      state.refreshToken = action.payload.refreshToken
      
      // Update session expiry
      const expiry = new Date()
      expiry.setHours(expiry.getHours() + 2)
      state.sessionExpiry = expiry.toISOString()
    },
    
    // Logout
    logout: (state) => {
      state.isAuthenticated = false
      state.user = null
      state.token = null
      state.refreshToken = null
      state.error = null
      state.isLoading = false
      state.showWelcome = false
      state.isFirstLogin = false
      state.sessionExpiry = undefined
      state.emailVerificationSent = false
      state.passwordResetSent = false
    },
    
    // Profile updates
    updateProfile: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },
    
    // Verification updates
    updateVerificationStatus: (state, action: PayloadAction<{
      isAlumniVerified: boolean
      pendingVerification: boolean
    }>) => {
      if (state.user) {
        state.user.isAlumniVerified = action.payload.isAlumniVerified
        state.user.pendingVerification = action.payload.pendingVerification
      }
    },
    
    // Password reset
    passwordResetStart: (state) => {
      state.isLoading = true
      state.error = null
    },
    
    passwordResetSuccess: (state) => {
      state.isLoading = false
      state.passwordResetSent = true
      state.error = null
    },
    
    passwordResetFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false
      state.error = action.payload
    },
    
    // Email verification
    emailVerificationSuccess: (state) => {
      state.emailVerificationSent = false
      if (state.user) {
        // Note: isEmailVerified field should be added to User interface if needed
        // For now, we'll assume email verification updates the main verification status
        state.user.isAlumniVerified = true
      }
    },
    
    // Clear error
    clearError: (state) => {
      state.error = null
    },
    
    // Clear success states
    clearSuccessStates: (state) => {
      state.emailVerificationSent = false
      state.passwordResetSent = false
      state.showWelcome = false
    },
    
    // Session management
    sessionExpired: (state) => {
      state.isAuthenticated = false
      state.token = null
      state.error = 'Session expired. Please login again.'
    },
    
    extendSession: (state) => {
      const expiry = new Date()
      expiry.setHours(expiry.getHours() + 2)
      state.sessionExpiry = expiry.toISOString()
    },
    
    // UI state management
    dismissWelcome: (state) => {
      state.showWelcome = false
      state.isFirstLogin = false
    },
    
    // Role updates (admin actions)
    updateUserRole: (state, action: PayloadAction<User['role']>) => {
      if (state.user) {
        state.user.role = action.payload
      }
    },
  },
})

// Export actions
export const {
  loginStart,
  loginSuccess,
  loginFailure,
  registerStart,
  registerSuccess,
  registerFailure,
  refreshTokenSuccess,
  logout,
  updateProfile,
  updateVerificationStatus,
  passwordResetStart,
  passwordResetSuccess,
  passwordResetFailure,
  emailVerificationSuccess,
  clearError,
  clearSuccessStates,
  sessionExpired,
  extendSession,
  dismissWelcome,
  updateUserRole,
} = authSlice.actions

// Selectors for easy state access
export const selectAuth = (state: { auth: AuthState }) => state.auth
export const selectUser = (state: { auth: AuthState }) => state.auth.user
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated
export const selectIsLoading = (state: { auth: AuthState }) => state.auth.isLoading
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error
export const selectUserRole = (state: { auth: AuthState }) => state.auth.user?.role
export const selectIsVerified = (state: { auth: AuthState }) => state.auth.user?.isAlumniVerified
export const selectIsPendingVerification = (state: { auth: AuthState }) => state.auth.user?.pendingVerification

// Role-based selectors
export const selectIsAdmin = (state: { auth: AuthState }) => 
  state.auth.user?.role === 'SUPER_ADMIN'
export const selectIsBatchAdmin = (state: { auth: AuthState }) => 
  state.auth.user?.role === 'BATCH_ADMIN'
export const selectIsRegularUser = (state: { auth: AuthState }) => 
  state.auth.user?.role === 'USER'

// Export reducer
export default authSlice.reducer