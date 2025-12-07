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

// Organization config
import { hasOrganizationSelected, getStoredOrgName } from './config/organizations'

// FIXED: Correct file names with proper casing
const PublicLayout = React.lazy(() => import('./components/common/Layout/PublicLayout'))
const AdminLayout = React.lazy(() => import('./components/common/Layout/AdminLayout'))

// Public pages
const HomePage = React.lazy(() => import('./pages/public/HomePage'))
const EventsPage = React.lazy(() => import('./pages/public/EventsPage'))
const GalleryPage = React.lazy(() => import('./pages/public/GalleryPage'))
const ContactPage = React.lazy(() => import('./pages/public/ContactPage'))

// Auth pages
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'))
const OrganizationSelectPage = React.lazy(() => import('./pages/auth/OrganizationSelectPage'))

// Common pages
const MobileNotifications = React.lazy(() => import('./pages/common/MobileNotifications'))
const OrganizationView = React.lazy(() => import('./pages/common/OrganizationView'))
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage'))
const VerifyEmailPage = React.lazy(() => import('./pages/auth/VerifyEmailPage'))
const VerificationPendingPage = React.lazy(() => import('./pages/auth/VerificationPendingPage'))

// User pages
const UserDashboard = React.lazy(() => import('./pages/user/Dashboard'))
const UserProfile = React.lazy(() => import('./pages/user/Profile'))
const AlumniDirectory = React.lazy(() => import('./pages/user/AlumniDirectory'))
const AlumniProfile = React.lazy(() => import('./pages/user/AlumniProfile'))
const Groups = React.lazy(() => import('./pages/user/Groups'))
const Posts = React.lazy(() => import('./pages/user/Posts'))
const UserSocial = React.lazy(() => import('./pages/user/Social'))
const UserEvents = React.lazy(() => import('./pages/user/Events'))
const UserGallery = React.lazy(() => import('./pages/user/Gallery'))
const UserLifeLink = React.lazy(() => import('./pages/user/LifeLink'))
const UserTreasury = React.lazy(() => import('./pages/user/Treasury'))
const UserSupport = React.lazy(() => import('./pages/user/Support'))
// const UserSettings = React.lazy(() => import('./pages/user/Settings'))

// Admin pages
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'))
const BatchAdminDashboard = React.lazy(() => import('./pages/admin/BatchAdminDashboard'))
const UserManagement = React.lazy(() => import('./pages/admin/UserManagement'))
const OrganizationManagement = React.lazy(() => import('./pages/admin/OrganizationManagement'))
const PostsManagement = React.lazy(() => import('./pages/admin/PostsManagement'))
const PollManagement = React.lazy(() => import('./pages/admin/PollManagement'))
const GroupsManagement = React.lazy(() => import('./pages/admin/GroupsManagement'))
const EventsManagement = React.lazy(() => import('./pages/admin/EventsManagement'))
const GalleryManagement = React.lazy(() => import('./pages/admin/GalleryManagement'))
const AdminSocial = React.lazy(() => import('./pages/admin/Social'))
const AdminEvents = React.lazy(() => import('./pages/admin/Events'))
const AdminTreasury = React.lazy(() => import('./pages/admin/Treasury'))
const AdminSupport = React.lazy(() => import('./pages/admin/Support'))

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

  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'BATCH_ADMIN')) {
    return <Navigate to="/user/dashboard" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// Dashboard router component
const DashboardRouter = () => {
  const user = useSelector(selectUser)
  
  if (user?.role === 'BATCH_ADMIN') {
    return <BatchAdminDashboard />
  }
  
  return <AdminDashboard />
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

// Organization required route - redirects to org selection if no org selected
const RequireOrganization = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()

  // Check if organization is selected
  if (!hasOrganizationSelected()) {
    return <Navigate to="/select-organization" state={{ from: location }} replace />
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
    const orgName = getStoredOrgName()
    const appName = orgName || 'GUILD - Alumni Network'

    const titles: { [key: string]: string } = {
      '/': appName,
      '/select-organization': 'Select Organization - GUILD',
      '/events': 'Events - GUILD',
      '/gallery': 'Gallery - GUILD',
      '/contact': 'Contact - GUILD',
      '/auth/login': 'Login - GUILD',
      '/auth/register': 'Register - GUILD',
      '/auth/forgot-password': 'Forgot Password - GUILD',
      '/user/dashboard': 'Dashboard - GUILD',
      '/user/profile': 'Profile - GUILD',
      '/user/alumni': 'Alumni Directory - GUILD',
      '/user/groups': 'Groups - GUILD',
      '/user/social': 'Social - GUILD',
      '/user/posts': 'Posts - GUILD',
      '/user/events': 'My Events - GUILD',
      '/user/gallery': 'Gallery - GUILD',
      '/user/lifelink': 'LifeLink - GUILD',
      '/user/treasury': 'Treasury - GUILD',
      '/user/support': 'Support - GUILD',
      '/admin/dashboard': 'Admin Dashboard - GUILD',
      '/admin/treasury': 'Treasury - GUILD',
      '/admin/support': 'Support Management - GUILD',
      '/admin/users': 'User Management - GUILD',
      '/admin/organization': 'Organization Management - GUILD',
      '/admin/groups': 'Groups Management - GUILD',
      '/admin/social': 'Social - GUILD',
      '/admin/posts': 'Posts Management - GUILD',
      '/admin/polls': 'Poll Management - GUILD',
      '/admin/events-management': 'Event Management - GUILD',
      '/admin/events': 'Events - GUILD',
      '/admin/gallery': 'Gallery Management - GUILD',
      '/organization': 'Organization - GUILD',
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

            {/* Organization Selection Route - First screen for multi-tenant */}
            <Route path="/select-organization" element={<OrganizationSelectPage />} />

            {/* Authentication Routes - Require organization to be selected */}
            <Route path="/auth/login" element={
              <RequireOrganization>
                <LoginPage />
              </RequireOrganization>
            } />
            <Route path="/auth/register" element={
              <RequireOrganization>
                <RegisterPage />
              </RequireOrganization>
            } />
            <Route path="/auth/forgot-password" element={
              <RequireOrganization>
                <ForgotPasswordPage />
              </RequireOrganization>
            } />
            <Route path="/auth/reset-password" element={
              <RequireOrganization>
                <ResetPasswordPage />
              </RequireOrganization>
            } />
            <Route path="/auth/verify-email" element={
              <RequireOrganization>
                <VerifyEmailPage />
              </RequireOrganization>
            } />
            <Route path="/auth/verification-pending" element={
              <RequireOrganization>
                <VerificationPendingPage />
              </RequireOrganization>
            } />

            {/* Common Protected Routes */}
            <Route path="/notifications" element={
              <ProtectedRoute>
                <MobileNotifications />
              </ProtectedRoute>
            } />

            {/* User Protected Routes - Using AdminLayout for all users */}
            <Route path="/user" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/user/dashboard" replace />} />
              <Route path="dashboard" element={
                <VerifiedRoute>
                  <UserDashboard />
                </VerifiedRoute>
              } />
              <Route path="profile" element={<UserProfile />} />
              <Route path="alumni" element={
                <VerifiedRoute>
                  <AlumniDirectory />
                </VerifiedRoute>
              } />
              <Route path="alumni/:userId" element={
                <VerifiedRoute>
                  <AlumniProfile />
                </VerifiedRoute>
              } />
              <Route path="groups" element={
                <VerifiedRoute>
                  <Groups />
                </VerifiedRoute>
              } />
              <Route path="social" element={
                <VerifiedRoute>
                  <UserSocial />
                </VerifiedRoute>
              } />
              <Route path="posts" element={
                <VerifiedRoute>
                  <Posts />
                </VerifiedRoute>
              } />
              <Route path="events" element={
                <VerifiedRoute>
                  <UserEvents />
                </VerifiedRoute>
              } />
              <Route path="gallery" element={
                <VerifiedRoute>
                  <UserGallery />
                </VerifiedRoute>
              } />
              <Route path="lifelink" element={
                <VerifiedRoute>
                  <UserLifeLink />
                </VerifiedRoute>
              } />
              <Route path="treasury" element={
                <VerifiedRoute>
                  <UserTreasury />
                </VerifiedRoute>
              } />
              <Route path="support" element={
                <VerifiedRoute>
                  <UserSupport />
                </VerifiedRoute>
              } />
            </Route>

            {/* Organization route - accessible to all authenticated users */}
            <Route path="/organization" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<OrganizationView />} />
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
              <Route path="dashboard" element={<DashboardRouter />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="organization" element={<OrganizationManagement />} />
              <Route path="groups" element={<GroupsManagement />} />
              <Route path="events-management" element={<EventsManagement />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="social" element={<AdminSocial />} />
              <Route path="posts" element={<PostsManagement />} />
              <Route path="polls" element={<PollManagement />} />
              <Route path="gallery" element={<GalleryManagement />} />
              <Route path="treasury" element={<AdminTreasury />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="profile" element={<UserProfile />} />
            </Route>

            {/* Common Profile Route - accessible to all authenticated users */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<UserProfile />} />
            </Route>

            {/* Redirect based on auth status */}
            <Route path="/dashboard" element={
              isAuthenticated 
                ? (user?.role === 'SUPER_ADMIN' || user?.role === 'BATCH_ADMIN')
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



