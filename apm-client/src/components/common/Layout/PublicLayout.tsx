// src/components/common/Layout/PublicLayout.tsx - UPDATED with theme toggle
import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsDark } from '@/store/slices/themeSlice'
import ThemeToggle from '../UI/ThemeToggle'

const PublicLayout = () => {
  const isDark = useSelector(selectIsDark)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* Header */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="container-guild">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center h-10">
                <img
                  src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                  alt="GUILD"
                  className="h-full w-auto object-contain"
                />
              </Link>
            </div>
            
            <nav className="hidden md:flex space-x-8">
              <Link to="/" className="text-gray-600 dark:text-gray-300 hover:text-guild-600 dark:hover:text-guild-400 transition-colors">
                Home
              </Link>
              <Link to="/events" className="text-gray-600 dark:text-gray-300 hover:text-guild-600 dark:hover:text-guild-400 transition-colors">
                Events
              </Link>
              <Link to="/gallery" className="text-gray-600 dark:text-gray-300 hover:text-guild-600 dark:hover:text-guild-400 transition-colors">
                Gallery
              </Link>
              <Link to="/contact" className="text-gray-600 dark:text-gray-300 hover:text-guild-600 dark:hover:text-guild-400 transition-colors">
                Contact
              </Link>
            </nav>
            
            <div className="flex items-center">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default PublicLayout