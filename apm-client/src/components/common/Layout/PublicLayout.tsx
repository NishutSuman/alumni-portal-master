// src/components/common/Layout/PublicLayout.tsx - UPDATED with theme toggle
import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import ThemeToggle from '../UI/ThemeToggle'

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* Header */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="container-guild">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-guild-500 to-guild-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <h1 className="text-2xl font-bold text-gradient-guild">GUILD</h1>
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
            
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Link to="/auth/login" className="btn-outline-guild">
                Login
              </Link>
              <Link to="/auth/register" className="btn-guild">
                Join GUILD
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 dark:bg-gray-900 text-white mt-auto">
        <div className="container-guild py-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-guild-500 to-guild-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <h3 className="text-xl font-bold">GUILD</h3>
              </div>
              <p className="text-gray-400">
                Your Professional Alumni Network - Connecting Minds, Building Futures
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <div className="space-y-2">
                <Link to="/events" className="block text-gray-400 hover:text-white transition-colors">Events</Link>
                <Link to="/gallery" className="block text-gray-400 hover:text-white transition-colors">Gallery</Link>
                <Link to="/contact" className="block text-gray-400 hover:text-white transition-colors">Contact</Link>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Community</h4>
              <div className="space-y-2">
                <Link to="/auth/register" className="block text-gray-400 hover:text-white transition-colors">Join Now</Link>
                <a href="#" className="block text-gray-400 hover:text-white transition-colors">Alumni Stories</a>
                <a href="#" className="block text-gray-400 hover:text-white transition-colors">Success Network</a>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <div className="space-y-2">
                <a href="#" className="block text-gray-400 hover:text-white transition-colors">LinkedIn</a>
                <a href="#" className="block text-gray-400 hover:text-white transition-colors">Twitter</a>
                <a href="#" className="block text-gray-400 hover:text-white transition-colors">Facebook</a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center">
            <p className="text-gray-400">&copy; 2024 GUILD Alumni Network. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default PublicLayout