// src/store/index.ts
// GUILD Redux Store Configuration with RTK Query

import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

// Import slices
import authSlice, { logout } from './slices/authSlice'
import userSlice from './slices/userSlice'
import themeSlice from './slices/themeSlice'
import appSlice from './slices/appSlice'

// Import API slice
import { apiSlice } from './api/apiSlice'
// Import APIs to inject endpoints
import './api/pollApi'
import './api/eventApi'
import './api/galleryApi'

// Import organization utilities
import { clearOrganization } from '@/config/organizations'

// Persist configuration for auth (to maintain login state)
const authPersistConfig = {
  key: 'guild-auth',
  storage,
  whitelist: ['user', 'token', 'refreshToken', 'isAuthenticated'] // Only persist these fields
}

// Persist configuration for theme
const themePersistConfig = {
  key: 'guild-theme',
  storage,
}

// Create persisted reducers
const persistedAuthReducer = persistReducer(authPersistConfig, authSlice)
const persistedThemeReducer = persistReducer(themePersistConfig, themeSlice)

// Configure store
export const store = configureStore({
  reducer: {
    // Persisted reducers
    auth: persistedAuthReducer,
    theme: persistedThemeReducer,
    
    // Regular reducers
    user: userSlice,
    app: appSlice,
    
    // API slice
    api: apiSlice.reducer,
  },
  
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Configure for redux-persist
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })
    .concat(apiSlice.middleware)
    .concat((storeApi) => (next) => (action: unknown) => {
      // Clear RTK Query cache on logout (user switching or org switching)
      const typedAction = action as { type?: string }
      if (typedAction.type === 'auth/logout') {
        storeApi.dispatch(apiSlice.util.resetApiState())
      }
      return next(action)
    }),
  
  // Enable Redux DevTools in development
  devTools: import.meta.env.VITE_ENABLE_REDUX_DEVTOOLS === 'true',
})

// Setup RTK Query listeners for caching, invalidation, etc.
setupListeners(store.dispatch)

// Create persistor for redux-persist
export const persistor = persistStore(store)

// Export types for TypeScript
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks for components to use
export type AppThunk = any // For complex async actions if needed

/**
 * Switch organization - clears auth state, API cache, and org selection
 * Then redirects to organization selection page
 * This should be called when user wants to switch to a different school/organization
 */
export const switchOrganization = () => {
  // 1. Dispatch logout to clear auth state and API cache
  store.dispatch(logout())

  // 2. Clear organization from localStorage
  clearOrganization()

  // 3. Clear persisted auth data
  persistor.purge()

  // 4. Redirect to organization selection (use window.location to force full reload)
  // This ensures the API is reinitialized with the new baseUrl
  window.location.href = '/select-organization'
}

// Export store and persistor
export default store