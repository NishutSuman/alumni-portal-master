// src/main.tsx
// GUILD Application Entry Point

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { store, persistor } from './store'
import './index.css'

// Performance monitoring
const startTime = performance.now()

// Error boundary for development
if (import.meta.env.DEV) {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
  })
}

// Initialize React application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={<div className="flex items-center justify-center min-h-screen bg-guild-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-guild-500 mx-auto mb-4"></div>
          <p className="text-guild-600 dark:text-guild-400 font-medium">Loading GUILD...</p>
        </div>
      </div>} persistor={persistor}>
        <BrowserRouter>
          <App />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--tw-color-gray-900)',
                color: 'var(--tw-color-white)',
                borderRadius: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                padding: '12px 16px',
                maxWidth: '400px',
              },
              success: {
                iconTheme: {
                  primary: 'var(--tw-color-success-500)',
                  secondary: 'white',
                },
                style: {
                  background: 'var(--tw-color-success-500)',
                },
              },
              error: {
                iconTheme: {
                  primary: 'var(--tw-color-error-500)',
                  secondary: 'white',
                },
                style: {
                  background: 'var(--tw-color-error-500)',
                },
              },
              loading: {
                iconTheme: {
                  primary: 'var(--tw-color-guild-500)',
                  secondary: 'white',
                },
              },
            }}
          />
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </React.StrictMode>
)

// Log performance metrics in development
if (import.meta.env.DEV) {
  window.addEventListener('load', () => {
    const loadTime = performance.now() - startTime
    console.log(`🚀 GUILD loaded in ${loadTime.toFixed(2)}ms`)
  })
}
