// src/components/common/Layout/UnifiedLayout.tsx
import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  UsersIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  CogIcon,
  BellIcon,
  UserCircleIcon,
  Bars3Icon,
  XMarkIcon,
  MegaphoneIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  ShoppingBagIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  TicketIcon,
  HeartIcon,
  CheckBadgeIcon,
  ArrowRightOnRectangleIcon,
  UserGroupIcon,
  AcademicCapIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useDevice } from '@/hooks/useDevice';
import { useSelector } from 'react-redux';
import { selectIsDark } from '@/store/slices/themeSlice';
import ThemeToggle from '@/components/common/UI/ThemeToggle';
import NotificationPanel from '@/components/common/UI/NotificationPanel';
import UserProfileDropdown from '@/components/common/UI/UserProfileDropdown';

// Navigation configuration based on user role
const getNavigationItems = (role: string) => {
  const baseUserItems = [
    {
      name: 'Dashboard',
      href: '/user/dashboard',
      icon: HomeIcon,
      description: 'Your personal dashboard'
    },
    {
      name: 'Profile',
      href: '/user/profile',
      icon: UserCircleIcon,
      description: 'Manage your profile'
    },
    {
      name: 'Alumni Directory',
      href: '/user/alumni',
      icon: UsersIcon,
      description: 'Connect with fellow alumni'
    },
    {
      name: 'Events',
      href: '/user/events',
      icon: CalendarDaysIcon,
      description: 'Browse upcoming events'
    },
    {
      name: 'Organization',
      href: '/organization',
      icon: BuildingOffice2Icon,
      description: 'View organization details'
    },
    {
      name: 'Settings',
      href: '/user/settings',
      icon: CogIcon,
      description: 'Account preferences'
    }
  ];

  const batchAdminItems = [
    ...baseUserItems,
    {
      name: 'User Verification',
      href: '/admin/users',
      icon: CheckBadgeIcon,
      description: 'Verify alumni from your batch',
      adminOnly: true
    }
  ];

  const superAdminItems = [
    {
      name: 'Dashboard',
      href: '/admin/dashboard',
      icon: HomeIcon,
      description: 'Admin overview and analytics'
    },
    {
      name: 'User Management',
      href: '/admin/users',
      icon: UsersIcon,
      description: 'Manage and verify users'
    },
    {
      name: 'Organization',
      href: '/admin/organization',
      icon: BuildingOffice2Icon,
      description: 'Organization settings'
    },
    {
      name: 'Events',
      href: '/admin/events',
      icon: CalendarDaysIcon,
      description: 'Event management'
    },
    {
      name: 'Finance',
      href: '/admin/finance',
      icon: CreditCardIcon,
      description: 'Financial reports'
    },
    {
      name: 'Merchandise',
      href: '/admin/merchandise',
      icon: ShoppingBagIcon,
      description: 'Merchandise store'
    },
    {
      name: 'Communications',
      href: '/admin/communications',
      icon: ChatBubbleLeftRightIcon,
      description: 'Messages and notifications'
    },
    {
      name: 'Support',
      href: '/admin/support',
      icon: TicketIcon,
      description: 'Support tickets'
    },
    {
      name: 'Reports',
      href: '/admin/reports',
      icon: DocumentTextIcon,
      description: 'Generate reports'
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: CogIcon,
      description: 'System settings'
    },
  ];

  switch (role) {
    case 'SUPER_ADMIN':
      return superAdminItems;
    case 'BATCH_ADMIN':
      return batchAdminItems;
    default:
      return baseUserItems;
  }
};

// Mobile navigation items (simplified for mobile)
const getMobileNavItems = (role: string) => {
  const baseItems = [
    { name: 'Dashboard', href: '/user/dashboard', icon: HomeIcon },
    { name: 'Profile', href: '/user/profile', icon: UserCircleIcon },
    { name: 'Alumni', href: '/user/alumni', icon: UsersIcon },
    { name: 'Events', href: '/user/events', icon: CalendarDaysIcon },
    { name: 'Settings', href: '/user/settings', icon: CogIcon },
  ];

  const adminItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: HomeIcon },
    { name: 'Users', href: '/admin/users', icon: UsersIcon },
    { name: 'Events', href: '/admin/events', icon: CalendarDaysIcon },
    { name: 'Finance', href: '/admin/finance', icon: CreditCardIcon },
    { name: 'Settings', href: '/admin/settings', icon: CogIcon },
  ];

  if (role === 'SUPER_ADMIN') return adminItems;
  if (role === 'BATCH_ADMIN') return [...baseItems, { name: 'Verify', href: '/admin/users', icon: CheckBadgeIcon }];
  return baseItems;
};

const UnifiedLayout = () => {
  const { user, logout } = useAuth();
  const { isMobile } = useDevice();
  const isDark = useSelector(selectIsDark);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigationItems = getNavigationItems(user?.role || 'USER');
  const mobileNavItems = getMobileNavItems(user?.role || 'USER');

  // Update current navigation item
  const navItemsWithCurrent = navigationItems.map(item => ({
    ...item,
    current: location.pathname.startsWith(item.href)
  }));

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  const getPageTitle = () => {
    const currentItem = navItemsWithCurrent.find(item => item.current);
    return currentItem?.name || 'Dashboard';
  };

  const getPageDescription = () => {
    const currentItem = navItemsWithCurrent.find(item => item.current);
    return currentItem?.description || 'Alumni portal overview';
  };

  const getRoleDisplayName = () => {
    switch (user?.role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'BATCH_ADMIN': return 'Batch Admin';
      default: return 'Alumni';
    }
  };

  if (isMobile) {
    // Mobile Layout with Top Header + Bottom Navigation
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16">
        {/* Mobile Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <div className="h-10">
                  <img
                    src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                    alt="GUILD"
                    className="h-full w-auto object-contain"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <NotificationPanel />
                <UserProfileDropdown />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 pb-20">
          <Outlet />
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
          <div className="grid grid-cols-5 h-16">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.href);
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="mobileActiveTab"
                      className="absolute top-0 left-0 right-0 h-0.5 bg-blue-600"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  // Desktop Layout with Top Header Navigation
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              {/* Logo */}
              <div className="flex items-center">
                <div className="h-12">
                  <img
                    src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                    alt="GUILD"
                    className="h-full w-auto object-contain"
                  />
                </div>
              </div>

              {/* Main Navigation */}
              <nav className="hidden lg:flex space-x-1">
                {navItemsWithCurrent.slice(0, 6).map((item) => {
                  const Icon = item.icon;
                  
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`group flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors relative ${
                        item.current
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <Icon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span>{item.name}</span>
                      {item.adminOnly && (
                        <span className="ml-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs px-1.5 py-0.5 rounded-full font-medium">
                          Admin
                        </span>
                      )}
                      
                      {item.current && (
                        <motion.div
                          layoutId="activeNavItem"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full"
                        />
                      )}
                    </Link>
                  );
                })}
                
                {/* More menu for additional items */}
                {navItemsWithCurrent.length > 6 && (
                  <div className="relative group">
                    <button className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
                      More
                      <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="py-2">
                        {navItemsWithCurrent.slice(6).map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              className={`flex items-center px-4 py-2 text-sm transition-colors ${
                                item.current
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              }`}
                            >
                              <Icon className="mr-2 h-4 w-4" />
                              {item.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="hidden md:block">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-64 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <NotificationPanel />
              <UserProfileDropdown />
            </div>
          </div>
        </div>

        {/* Page Title Section */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {getPageTitle()}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getPageDescription()}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default UnifiedLayout;