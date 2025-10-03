// src/pages/auth/LoginPage.tsx - FIXED undefined result issue
import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from '@/components/common/UI/ThemeToggle'
import OrganizationLogo from '@/components/common/UI/OrganizationLogo'
import toast from 'react-hot-toast'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const { login, isLoading, error } = useAuth()
  const location = useLocation()
  
  // Check for email verification success
  useEffect(() => {
    if (location.state?.emailVerified) {
      toast.success(location.state.message || 'Email verified successfully! You can now sign in.')
      if (location.state.email) {
        setEmail(location.state.email)
      }
    }
  }, [location.state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const result = await login({ email, password, rememberMe })
    
    // FIXED: Now we check if result exists before accessing properties
    if (result && result.success) {
      // Navigation is handled in the login function
      console.log('Login successful')
    } else {
      console.log('Login failed:', result?.error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-guild-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <div className="max-w-md w-full mx-4">
        {/* Theme toggle in top right */}
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>
        
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <OrganizationLogo size="2xl" className="flex-shrink-0" />
            </div>
            <h1 className="text-3xl font-bold text-gradient-guild mb-2">Welcome to Alumni Portal</h1>
            <p className="text-gray-600 dark:text-gray-300">Sign in to your account</p>
          </div>

          {/* Success message for email verification */}
          {location.state?.emailVerified && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-200 p-4 rounded-lg mb-6 border border-green-200 dark:border-green-800">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {location.state.message || 'Email verified successfully! You can now sign in.'}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-200 p-4 rounded-lg mb-6 border border-error-200 dark:border-error-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="form-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-guild-600 rounded border-gray-300 focus:ring-guild-500"
                  disabled={isLoading}
                />
                <label htmlFor="remember-me" className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                  Remember me
                </label>
              </div>
              <Link
                to="/auth/forgot-password"
                className="text-sm text-guild-600 hover:text-guild-500 dark:text-guild-400 dark:hover:text-guild-300"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-guild w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Don't have an account?{' '}
              <Link to="/auth/register" className="text-guild-600 hover:text-guild-500 dark:text-guild-400 dark:hover:text-guild-300 font-medium">
                Join GUILD
              </Link>
            </p>
          </div>
          
          <div className="mt-4 text-center">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              ← Back to Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage