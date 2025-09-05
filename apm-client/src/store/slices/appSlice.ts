// src/store/slices/appSlice.ts
// GUILD Application State Management

import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface AppState {
  // App metadata
  version: string
  environment: 'development' | 'staging' | 'production'
  buildDate: string
  
  // Loading states
  isAppLoading: boolean
  isInitializing: boolean
  
  // Network status
  isOnline: boolean
  networkType?: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'
  
  // UI states
  sidebarOpen: boolean
  mobileMenuOpen: boolean
  
  // Notifications
  notifications: {
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
    timestamp: string
    read: boolean
    persistent: boolean
  }[]
  
  // Modal states
  modals: {
    [key: string]: {
      isOpen: boolean
      data?: any
    }
  }
  
  // Cache status
  lastCacheUpdate?: string
  
  // Feature flags
  features: {
    [key: string]: boolean
  }
  
  // Error tracking
  globalError: string | null
  
  // Performance monitoring
  performanceMetrics: {
    loadTime?: number
    renderTime?: number
    apiResponseTime?: number
  }
}

const initialState: AppState = {
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  environment: (import.meta.env.VITE_ENVIRONMENT || 'development') as AppState['environment'],
  buildDate: new Date().toISOString(),
  isAppLoading: false,
  isInitializing: true,
  isOnline: navigator.onLine,
  sidebarOpen: false,
  mobileMenuOpen: false,
  notifications: [],
  modals: {},
  features: {
    lifelink: true,
    treasury: true,
    socialFeed: true,
    polls: true,
    merchandise: true,
    analytics: true,
  },
  globalError: null,
  performanceMetrics: {},
}

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setAppLoading: (state, action: PayloadAction<boolean>) => {
      state.isAppLoading = action.payload
    },
    
    setInitializing: (state, action: PayloadAction<boolean>) => {
      state.isInitializing = action.payload
    },
    
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload
    },
    
    setNetworkType: (state, action: PayloadAction<AppState['networkType']>) => {
      state.networkType = action.payload
    },
    
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    
    setSidebar: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    
    toggleMobileMenu: (state) => {
      state.mobileMenuOpen = !state.mobileMenuOpen
    },
    
    setMobileMenu: (state, action: PayloadAction<boolean>) => {
      state.mobileMenuOpen = action.payload
    },
    
    addNotification: (state, action: PayloadAction<Omit<AppState['notifications'][0], 'id' | 'timestamp' | 'read'>>) => {
      const notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        read: false,
      }
      state.notifications.unshift(notification)
      
      // Keep only last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50)
      }
    },
    
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload)
      if (notification) {
        notification.read = true
      }
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload)
    },
    
    clearAllNotifications: (state) => {
      state.notifications = []
    },
    
    openModal: (state, action: PayloadAction<{ key: string; data?: any }>) => {
      state.modals[action.payload.key] = {
        isOpen: true,
        data: action.payload.data,
      }
    },
    
    closeModal: (state, action: PayloadAction<string>) => {
      if (state.modals[action.payload]) {
        state.modals[action.payload].isOpen = false
      }
    },
    
    updateFeatureFlag: (state, action: PayloadAction<{ key: string; enabled: boolean }>) => {
      state.features[action.payload.key] = action.payload.enabled
    },
    
    setGlobalError: (state, action: PayloadAction<string | null>) => {
      state.globalError = action.payload
    },
    
    updatePerformanceMetrics: (state, action: PayloadAction<Partial<AppState['performanceMetrics']>>) => {
      state.performanceMetrics = { ...state.performanceMetrics, ...action.payload }
    },
    
    updateCacheTimestamp: (state) => {
      state.lastCacheUpdate = new Date().toISOString()
    },
  },
})

export const {
  setAppLoading,
  setInitializing,
  setOnlineStatus,
  setNetworkType,
  toggleSidebar,
  setSidebar,
  toggleMobileMenu,
  setMobileMenu,
  addNotification,
  markNotificationRead,
  removeNotification,
  clearAllNotifications,
  openModal,
  closeModal,
  updateFeatureFlag,
  setGlobalError,
  updatePerformanceMetrics,
  updateCacheTimestamp,
} = appSlice.actions

// Selectors
export const selectApp = (state: { app: AppState }) => state.app
export const selectIsOnline = (state: { app: AppState }) => state.app.isOnline
export const selectUnreadNotifications = (state: { app: AppState }) => 
  state.app.notifications.filter(n => !n.read)
export const selectFeatureFlag = (key: string) => (state: { app: AppState }) => 
  state.app.features[key] || false

export default appSlice.reducer