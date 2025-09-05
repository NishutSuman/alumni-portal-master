// src/components/common/Layout/UserLayout.tsx - UPDATED with theme toggle
import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '../UI/ThemeToggle'

const UserLayout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="container-guild">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/user/dashboard" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-guild-500 to-guild-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <h1 className="text-2xl font-bold text-gradient-guild">GUILD</h1>
              </Link>
            </div>
            
            <nav className="hidden md:flex space-x-6">
              <Link 
                to="/user/dashboard" 
                className={`px-3 py-2 rounded-lg transition-all ${
                  isActive('/user/dashboard') 
                    ? 'bg-guild-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-guild-600 dark:hover:text-guild-400'
                }`}
              >
                Dashboard
              </Link>
              <Link 
                to="/user/events" 
                className={`px-3 py-2 rounded-lg transition-all ${
                  isActive('/user/events') 
                    ? 'bg-guild-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-guild-600 dark:hover:text-guild-400'
                }`}
              >
                Events
              </Link>
              <Link 
                to="/user/social" 
                className={`px-3 py-2 rounded-lg transition-all ${
                  isActive('/user/social') 
                    ? 'bg-guild-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-guild-600 dark:hover:text-guild-400'
                }`}
              >
                Social
              </Link>
              <Link 
                to="/user/lifelink" 
                className={`px-3 py-2 rounded-lg transition-all ${
                  isActive('/user/lifelink') 
                    ? 'bg-guild-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-guild-600 dark:hover:text-guild-400'
                }`}
              >
                LifeLink
              </Link>
            </nav>
            
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.fullName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Batch {user?.batch}
                  </p>
                </div>
                
                <div className="w-8 h-8 bg-guild-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.fullName?.charAt(0)}
                  </span>
                </div>
              </div>
              
              <button onClick={logout} className="btn-outline-guild">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-guild py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default UserLayout