// src/pages/auth/LoginPage.tsx - FIXED undefined result issue
import React, { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router-dom'
import ThemeToggle from '@/components/common/UI/ThemeToggle'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const { login, isLoading, error } = useAuth()

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
              <div className="w-16 h-16 bg-gradient-to-br from-guild-500 to-guild-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-2xl">G</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gradient-guild mb-2">Welcome to GUILD</h1>
            <p className="text-gray-600 dark:text-gray-300">Sign in to your account</p>
          </div>

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