// src/App.tsx - FIXED VERSION
// Fix file casing issues and imports

import React, { useEffect, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ErrorBoundary } from 'react-error-boundary'

// Redux
import { setInitializing, setOnlineStatus, updatePerformanceMetrics } from './store/slices/appSlice'
import { selectIsAuthenticated, selectUser } from './store/slices/authSlice'
import { selectIsDark } from './store/slices/themeSlice'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useDevice } from './hooks/useDevice'

// FIXED: Correct file names with proper casing
const PublicLayout = React.lazy(() => import('./components/common/Layout/PublicLayout'))
const UserLayout = React.lazy(() => import('./components/common/Layout/UserLayout'))
const AdminLayout = React.lazy(() => import('./components/common/Layout/AdminLayout'))

// Public pages
const HomePage = React.lazy(() => import('./pages/public/HomePage'))
const EventsPage = React.lazy(() => import('./pages/public/EventsPage'))
const GalleryPage = React.lazy(() => import('./pages/public/GalleryPage'))
const ContactPage = React.lazy(() => import('./pages/public/ContactPage'))

// Auth pages
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage'))
const VerifyEmailPage = React.lazy(() => import('./pages/auth/VerifyEmailPage'))
const VerificationPendingPage = React.lazy(() => import('./pages/auth/VerificationPendingPage'))

// User pages
const UserDashboard = React.lazy(() => import('./pages/user/Dashboard'))
// const UserProfile = React.lazy(() => import('./pages/user/Profile'))
// const UserEvents = React.lazy(() => import('./pages/user/Events'))
// const UserSocial = React.lazy(() => import('./pages/user/Social'))
// const UserLifeLink = React.lazy(() => import('./pages/user/LifeLink'))
// const UserSupport = React.lazy(() => import('./pages/user/Support'))
// const UserSettings = React.lazy(() => import('./pages/user/Settings'))

// Admin pages
// const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'))
// const AdminUsers = React.lazy(() => import('./pages/admin/Users'))
// const AdminEvents = React.lazy(() => import('./pages/admin/Events'))
// const AdminFinance = React.lazy(() => import('./pages/admin/Finance'))
// const AdminContent = React.lazy(() => import('./pages/admin/Content'))
// const AdminSystem = React.lazy(() => import('./pages/admin/System'))

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0">
          <svg className="h-8 w-8 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Something went wrong</h3>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        <p>{error.message}</p>
      </div>
      <div className="mt-4">
        <button
          onClick={resetErrorBoundary}
          className="btn-guild"
        >
          Try again
        </button>
      </div>
    </div>
  </div>
)

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-guild-500 mx-auto mb-4"></div>
      <p className="text-guild-600 dark:text-guild-400 font-medium text-lg">Loading GUILD...</p>
    </div>
  </div>
)

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// Admin route component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useSelector(selectUser)
  const location = useLocation()

  if (!user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/user/dashboard" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// Verified user route component
const VerifiedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useSelector(selectUser)
  const location = useLocation()

  if (!user?.isAlumniVerified && user?.pendingVerification) {
    return <Navigate to="/auth/verification-pending" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// Main App component
function App() {
  const dispatch = useDispatch()
  const location = useLocation()
  const startTime = performance.now()
  
  // Hooks
  const { isAuthenticated, user } = useAuth()
  const isDark = useSelector(selectIsDark)
  const { isOnline } = useDevice()

  // Initialize app
  useEffect(() => {
    // Set online status
    dispatch(setOnlineStatus(isOnline))
    
    // Performance tracking
    const renderTime = performance.now() - startTime
    dispatch(updatePerformanceMetrics({ renderTime }))
    
    // Mark app as initialized
    const timer = setTimeout(() => {
      dispatch(setInitializing(false))
    }, 500)

    return () => clearTimeout(timer)
  }, [dispatch, isOnline, startTime])

  // Update online status
  useEffect(() => {
    const handleOnline = () => dispatch(setOnlineStatus(true))
    const handleOffline = () => dispatch(setOnlineStatus(false))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [dispatch])

  // Page title management
  useEffect(() => {
    const titles: { [key: string]: string } = {
      '/': 'GUILD - Alumni Network',
      '/events': 'Events - GUILD',
      '/gallery': 'Gallery - GUILD',
      '/contact': 'Contact - GUILD',
      '/auth/login': 'Login - GUILD',
      '/auth/register': 'Register - GUILD',
      '/auth/forgot-password': 'Forgot Password - GUILD',
      '/user/dashboard': 'Dashboard - GUILD',
      '/user/profile': 'Profile - GUILD',
      '/user/events': 'My Events - GUILD',
      '/user/social': 'Social Feed - GUILD',
      '/user/lifelink': 'LifeLink - GUILD',
      '/user/support': 'Support - GUILD',
      '/admin/dashboard': 'Admin Dashboard - GUILD',
      '/admin/users': 'User Management - GUILD',
      '/admin/events': 'Event Management - GUILD',
    }

    document.title = titles[location.pathname] || 'GUILD - Alumni Network'
  }, [location.pathname])

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('App Error:', error)
        // You can log to error tracking service here
      }}
    >
      <div className={`App min-h-screen ${isDark ? 'dark' : ''}`}>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="gallery" element={<GalleryPage />} />
              <Route path="contact" element={<ContactPage />} />
            </Route>

            {/* Authentication Routes */}
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
            <Route path="/auth/verification-pending" element={<VerificationPendingPage />} />

            {/* User Protected Routes */}
            <Route path="/user" element={
              <ProtectedRoute>
                <UserLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/user/dashboard" replace />} />
              <Route path="dashboard" element={<UserDashboard />} />
              {/* <Route path="profile" element={<UserProfile />} />
              <Route path="settings" element={<UserSettings />} /> */}
              
              {/* Verified user routes */}
              {/* <Route path="events" element={
                <VerifiedRoute>
                  <UserEvents />
                </VerifiedRoute>
              } />
              <Route path="social" element={
                <VerifiedRoute>
                  <UserSocial />
                </VerifiedRoute>
              } />
              <Route path="lifelink" element={
                <VerifiedRoute>
                  <UserLifeLink />
                </VerifiedRoute>
              } />
              <Route path="support" element={
                <VerifiedRoute>
                  <UserSupport />
                </VerifiedRoute>
              } /> */}
            </Route>

            {/* Admin Protected Routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              {/* <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="finance" element={<AdminFinance />} />
              <Route path="content" element={<AdminContent />} />
              <Route path="system" element={<AdminSystem />} /> */}
            </Route>

            {/* Redirect based on auth status */}
            <Route path="/dashboard" element={
              isAuthenticated 
                ? user?.role === 'SUPER_ADMIN'
                  ? <Navigate to="/admin/dashboard" replace />
                  : <Navigate to="/user/dashboard" replace />
                : <Navigate to="/auth/login" replace />
            } />

            {/* 404 Route */}
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-guild-500 mb-4">404</h1>
                  <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">Page not found</p>
                  <button
                    onClick={() => window.history.back()}
                    className="btn-guild"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            } />
          </Routes>
        </Suspense>
        
        {/* Offline indicator */}
        {!isOnline && (
          <div className="fixed bottom-4 left-4 bg-warning-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              You're offline
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App



