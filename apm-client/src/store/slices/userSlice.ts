// src/store/slices/userSlice.ts
// GUILD User Profile Management

import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface UserProfile {
  // Personal Information
  fullName: string
  dateOfBirth?: string
  profilePictureUrl?: string
  bio?: string
  currentLocation?: string
  
  // Contact Information
  email: string
  whatsappNumber?: string
  personalEmail?: string
  
  // Academic Information
  batch: number
  admissionYear?: number
  passoutYear?: number
  
  // Professional Information
  employmentStatus?: 'STUDENT' | 'EMPLOYED' | 'UNEMPLOYED' | 'ENTREPRENEUR' | 'FREELANCER'
  currentCompany?: string
  jobTitle?: string
  
  // Privacy Settings
  isProfilePublic: boolean
  showEmail: boolean
  showPhone: boolean
  showLocation: boolean
  
  // Preferences
  emailNotifications: boolean
  pushNotifications: boolean
  smsNotifications: boolean
  
  // Statistics
  eventsAttended: number
  postsCount: number
  connectionsCount: number
  
  // Last activity
  lastActive?: string
}

export interface UserState {
  profile: UserProfile | null
  isLoading: boolean
  error: string | null
  
  // Profile completion
  profileCompletion: number
  missingFields: string[]
  
  // Activity
  recentActivity: any[]
  
  // Connections
  connections: any[]
  connectionRequests: any[]
  
  // Preferences
  preferences: {
    language: string
    timezone: string
    dateFormat: string
    currency: string
  }
}

const initialState: UserState = {
  profile: null,
  isLoading: false,
  error: null,
  profileCompletion: 0,
  missingFields: [],
  recentActivity: [],
  connections: [],
  connectionRequests: [],
  preferences: {
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'DD/MM/YYYY',
    currency: 'INR',
  },
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<UserProfile>) => {
      state.profile = action.payload
      state.profileCompletion = calculateProfileCompletion(action.payload)
      state.missingFields = getMissingFields(action.payload)
    },
    
    updateProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload }
        state.profileCompletion = calculateProfileCompletion(state.profile)
        state.missingFields = getMissingFields(state.profile)
      }
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    
    updatePreferences: (state, action: PayloadAction<Partial<UserState['preferences']>>) => {
      state.preferences = { ...state.preferences, ...action.payload }
    },
    
    addRecentActivity: (state, action: PayloadAction<any>) => {
      state.recentActivity.unshift(action.payload)
      // Keep only last 50 activities
      if (state.recentActivity.length > 50) {
        state.recentActivity = state.recentActivity.slice(0, 50)
      }
    },
    
    clearProfile: (state) => {
      state.profile = null
      state.profileCompletion = 0
      state.missingFields = []
      state.recentActivity = []
      state.connections = []
      state.connectionRequests = []
    },
  },
})

// Helper functions
function calculateProfileCompletion(profile: UserProfile): number {
  const fields = [
    'fullName', 'dateOfBirth', 'profilePictureUrl', 'bio', 'currentLocation',
    'whatsappNumber', 'personalEmail', 'admissionYear', 'passoutYear',
    'employmentStatus', 'currentCompany', 'jobTitle'
  ]
  
  const completedFields = fields.filter(field => profile[field as keyof UserProfile])
  return Math.round((completedFields.length / fields.length) * 100)
}

function getMissingFields(profile: UserProfile): string[] {
  const requiredFields = [
    { key: 'dateOfBirth', label: 'Date of Birth' },
    { key: 'whatsappNumber', label: 'WhatsApp Number' },
    { key: 'admissionYear', label: 'Admission Year' },
    { key: 'passoutYear', label: 'Passout Year' },
    { key: 'employmentStatus', label: 'Employment Status' },
  ]
  
  return requiredFields
    .filter(field => !profile[field.key as keyof UserProfile])
    .map(field => field.label)
}

export const {
  setProfile,
  updateProfile,
  setLoading,
  setError,
  updatePreferences,
  addRecentActivity,
  clearProfile,
} = userSlice.actions

// Selectors
export const selectUserProfile = (state: { user: UserState }) => state.user.profile
export const selectProfileCompletion = (state: { user: UserState }) => state.user.profileCompletion
export const selectMissingFields = (state: { user: UserState }) => state.user.missingFields
export const selectUserPreferences = (state: { user: UserState }) => state.user.preferences

export default userSlice.reducer

// ============================================

