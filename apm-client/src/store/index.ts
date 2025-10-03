// src/store/index.ts
// GUILD Redux Store Configuration with RTK Query

import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

// Import slices
import authSlice from './slices/authSlice'
import userSlice from './slices/userSlice'
import themeSlice from './slices/themeSlice'
import appSlice from './slices/appSlice'

// Import API slice
import { apiSlice } from './api/apiSlice'
// Import APIs to inject endpoints
import './api/pollApi'
import './api/eventApi'

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
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/PAUSE',
          'persist/PURGE',
          'persist/REGISTER',
        ],
      },
    })
    .concat(apiSlice.middleware)
    .concat((store) => (next) => (action) => {
      // Clear RTK Query cache only on logout (user switching)
      if (action.type === 'auth/logout') {
        store.dispatch(apiSlice.util.resetApiState())
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

// Export store and persistor
export default store