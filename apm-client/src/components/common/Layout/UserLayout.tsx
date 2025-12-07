// src/components/common/Layout/UserLayout.tsx - UPDATED with theme toggle and mobile navigation
import React, { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HomeIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { useDevice } from '@/hooks/useDevice'
import { useSelector } from 'react-redux'
import { selectIsDark } from '@/store/slices/themeSlice'
import ThemeToggle from '../UI/ThemeToggle'
import LogoutButton from '../UI/LogoutButton'
import OrganizationLogo from '../UI/OrganizationLogo'

const UserLayout = () => {
  const { user } = useAuth()
  const isDark = useSelector(selectIsDark)
  const location = useLocation()
  const { isMobile } = useDevice()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (path: string) => location.pathname.startsWith(path)

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/user/dashboard',
      icon: HomeIcon,
    },
    {
      name: 'Events',
      href: '/user/events',
      icon: CalendarDaysIcon,
    },
    {
      name: 'Social',
      href: '/user/social',
      icon: ChatBubbleLeftRightIcon,
    },
    {
      name: 'Groups',
      href: '/user/groups',
      icon: UserGroupIcon,
    },
    {
      name: 'LifeLink',
      href: '/user/lifelink',
      icon: HeartIcon,
    },
    {
      name: 'Organization',
      href: '/organization',
      icon: BuildingOffice2Icon,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="container-guild">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mr-3"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>

              <Link to="/user/dashboard" className="flex items-center">
                <div className="h-10">
                  <img
                    src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                    alt="GUILD"
                    className="h-full w-auto object-contain"
                  />
                </div>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-6">
              {navigationItems.map((item) => (
                <Link 
                  key={item.href}
                  to={item.href} 
                  className={`px-3 py-2 rounded-lg transition-all ${
                    isActive(item.href) 
                      ? 'bg-guild-500 text-white' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-guild-600 dark:hover:text-guild-400'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
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
              
              <LogoutButton variant="default" />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-800 shadow-xl z-50 md:hidden overflow-y-auto"
          >
            <div className="p-4">
              {/* Close button */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center">
                  <div className="h-10">
                    <img
                      src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                      alt="GUILD"
                      className="h-full w-auto object-contain"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* User Info */}
              <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-guild-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg font-medium">
                      {user?.fullName?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {user?.fullName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Batch {user?.batch}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-2 mb-8">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                        isActive(item.href)
                          ? 'bg-guild-500 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-guild-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  )
                })}
              </nav>

              {/* Logout Button */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <LogoutButton variant="default" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="container-guild py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default UserLayout