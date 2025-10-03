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
              className: '',
              style: {
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: '500',
                padding: '12px 16px',
                maxWidth: '400px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: 'white',
                },
                style: {
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                },
                className: 'dark:bg-green-600 dark:text-white',
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: 'white',
                },
                style: {
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                },
                className: 'dark:bg-red-600 dark:text-white',
              },
              loading: {
                iconTheme: {
                  primary: '#3b82f6',
                  secondary: 'white',
                },
                style: {
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                },
                className: 'dark:bg-blue-600 dark:text-white',
              },
              // Default toast for info messages
              blank: {
                style: {
                  background: 'white',
                  color: '#374151',
                },
                className: 'dark:bg-gray-800 dark:text-white dark:border-gray-700',
              },
            }}
            containerClassName=""
            containerStyle={{}}
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
