// src/components/common/Layout/AdminLayout.tsx
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
  PencilSquareIcon,
  ChartPieIcon,
  UserGroupIcon,
  PhotoIcon,
  BanknotesIcon,
  LifebuoyIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useDevice } from '@/hooks/useDevice';
import { useSelector } from 'react-redux';
import { selectIsDark } from '@/store/slices/themeSlice';
import ThemeToggle from '@/components/common/UI/ThemeToggle';
import NotificationPanel from '@/components/common/UI/NotificationPanel';
import UserProfileDropdown from '@/components/common/UI/UserProfileDropdown';
import OrganizationLogo from '@/components/common/UI/OrganizationLogo';
import BrandLogo from '@/components/common/UI/BrandLogo';
import { useGetPublicOrganizationQuery } from '@/store/api/apiSlice';
import MobileHeader from '@/components/common/Layout/MobileHeader';
import MobileBottomNav from '@/components/common/Layout/MobileBottomNav';
import MobileMoreSidebar from '@/components/common/Layout/MobileMoreSidebar';
import { getApiUrl } from '@/utils/helpers';

// Get navigation items based on user role
const getNavigationItems = (userRole: string) => {
  const baseItems = [
    {
      name: 'Dashboard',
      href: userRole === 'USER' ? '/user/dashboard' : '/admin/dashboard',
      icon: HomeIcon,
      current: false,
      description: 'Overview and analytics'
    }
  ];

  // Add user-specific navigation
  if (userRole === 'USER') {
    return [
      ...baseItems,
      {
        name: 'My Profile',
        href: '/user/profile',
        icon: UserCircleIcon,
        current: false,
        description: 'View and edit your profile'
      },
      {
        name: 'Alumni Directory',
        href: '/user/alumni',
        icon: UsersIcon,
        current: false,
        description: 'Browse and connect with alumni'
      },
      {
        name: 'Groups',
        href: '/user/groups',
        icon: UserGroupIcon,
        current: false,
        description: 'Organization groups and committees'
      },
      {
        name: 'Organization',
        href: '/organization',
        icon: BuildingOffice2Icon,
        current: false,
        description: 'View organization details'
      },
      {
        name: 'Events',
        href: '/user/events',
        icon: CalendarDaysIcon,
        current: false,
        description: 'Browse upcoming events'
      },
      {
        name: 'Social',
        href: '/user/social',
        icon: ChatBubbleLeftRightIcon,
        current: false,
        description: 'Social feed and interactions'
      },
      {
        name: 'LifeLink',
        href: '/user/lifelink',
        icon: HeartIcon,
        current: false,
        description: 'Blood donation network and emergency requests'
      },
      {
        name: 'Gallery',
        href: '/user/gallery',
        icon: PhotoIcon,
        current: false,
        description: 'Photo albums and memories'
      },
      {
        name: 'Treasury',
        href: '/user/treasury',
        icon: BanknotesIcon,
        current: false,
        description: 'View financial information'
      },
      {
        name: 'Support',
        href: '/user/support',
        icon: LifebuoyIcon,
        current: false,
        description: 'Get help and support'
      }
    ];
  }

  // Add batch admin specific items
  if (userRole === 'BATCH_ADMIN') {
    return [
      ...baseItems,
      {
        name: 'User Verification',
        href: '/admin/users',
        icon: CheckBadgeIcon,
        current: false,
        description: 'Verify alumni from your batch'
      },
      {
        name: 'Alumni Directory',
        href: '/user/alumni',
        icon: UsersIcon,
        current: false,
        description: 'Browse and connect with alumni'
      },
      {
        name: 'Groups',
        href: '/user/groups',
        icon: UserGroupIcon,
        current: false,
        description: 'Organization groups and committees'
      },
      {
        name: 'Organization',
        href: '/organization',
        icon: BuildingOffice2Icon,
        current: false,
        description: 'View organization details'
      },
      {
        name: 'My Profile',
        href: '/user/profile',
        icon: UserCircleIcon,
        current: false,
        description: 'View and edit your profile'
      },
      {
        name: 'Social',
        href: '/user/social',
        icon: ChatBubbleLeftRightIcon,
        current: false,
        description: 'Social feed and interactions'
      },
      {
        name: 'Events',
        href: '/admin/events',
        icon: CalendarDaysIcon,
        current: false,
        description: 'Browse and manage events'
      },
      {
        name: 'LifeLink',
        href: '/user/lifelink',
        icon: HeartIcon,
        current: false,
        description: 'Blood donation network and emergency requests'
      },
      {
        name: 'Gallery',
        href: '/user/gallery',
        icon: PhotoIcon,
        current: false,
        description: 'Photo albums and memories'
      },
      {
        name: 'Treasury',
        href: '/user/treasury',
        icon: BanknotesIcon,
        current: false,
        description: 'View financial information'
      },
      {
        name: 'Support',
        href: '/user/support',
        icon: LifebuoyIcon,
        current: false,
        description: 'Get help and support'
      }
    ];
  }

  // Super admin gets all features
  return [
    ...baseItems,
    {
      name: 'User Management',
      href: '/admin/users',
      icon: CheckBadgeIcon,
      current: false,
      description: 'Approve and manage users'
    },
    {
      name: 'Alumni Directory',
      href: '/user/alumni',
      icon: UsersIcon,
      current: false,
      description: 'Browse and connect with alumni'
    },
    {
      name: 'Groups',
      href: '/admin/groups',
      icon: UserGroupIcon,
      current: false,
      description: 'Manage organization groups and committees'
    },
    {
      name: 'Organization',
      href: '/admin/organization',
      icon: BuildingOffice2Icon,
      current: false,
      description: 'Organization settings'
    },
    {
      name: 'Social',
      href: '/admin/social',
      icon: ChatBubbleLeftRightIcon,
      current: false,
      description: 'Social feed and interactions'
    },
    {
      name: 'Posts Management',
      href: '/admin/posts',
      icon: PencilSquareIcon,
      current: false,
      description: 'Manage and moderate posts'
    },
    {
      name: 'Poll Management',
      href: '/admin/polls',
      icon: ChartPieIcon,
      current: false,
      description: 'Create and manage polls'
    },
    {
      name: 'Events',
      href: '/admin/events',
      icon: CalendarDaysIcon,
      current: false,
      description: 'Browse and view all events'
    },
    {
      name: 'Event Management',
      href: '/admin/events-management',
      icon: CalendarDaysIcon,
      current: false,
      description: 'Create, edit, and manage events'
    },
    {
      name: 'LifeLink',
      href: '/user/lifelink',
      icon: HeartIcon,
      current: false,
      description: 'Blood donation network and emergency requests'
    },
    {
      name: 'Gallery',
      href: '/admin/gallery',
      icon: PhotoIcon,
      current: false,
      description: 'Manage photo albums and memories'
    },
    {
      name: 'Treasury',
      href: '/admin/treasury',
      icon: BanknotesIcon,
      current: false,
      description: 'Financial management and treasury'
    },
    {
      name: 'Support',
      href: '/admin/support',
      icon: LifebuoyIcon,
      current: false,
      description: 'Support ticket management'
    }
  ];
};

// Get mobile navigation items based on user role
const getMobileNavItems = (userRole: string) => {
  if (userRole === 'USER') {
    return [
      {
        name: 'Dashboard',
        href: '/user/dashboard',
        icon: HomeIcon,
      },
      {
        name: 'Groups',
        href: '/user/groups',
        icon: UserGroupIcon,
      },
      {
        name: 'Organization',
        href: '/organization',
        icon: BuildingOffice2Icon,
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
        name: 'Profile',
        href: '/profile',
        icon: UserCircleIcon,
      },
    ];
  }

  if (userRole === 'BATCH_ADMIN') {
    return [
      {
        name: 'Dashboard',
        href: '/admin/dashboard',
        icon: HomeIcon,
      },
      {
        name: 'Users',
        href: '/admin/users',
        icon: UsersIcon,
      },
      {
        name: 'Groups',
        href: '/user/groups',
        icon: UserGroupIcon,
      },
      {
        name: 'Organization',
        href: '/organization',
        icon: BuildingOffice2Icon,
      },
      {
        name: 'Social',
        href: '/user/social',
        icon: ChatBubbleLeftRightIcon,
      },
      {
        name: 'Events',
        href: '/admin/events',
        icon: CalendarDaysIcon,
      },
      {
        name: 'Profile',
        href: '/profile',
        icon: UserCircleIcon,
      },
    ];
  }

  // Super admin mobile nav
  return [
    {
      name: 'Dashboard',
      href: '/admin/dashboard',
      icon: HomeIcon,
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: UsersIcon,
    },
    {
      name: 'Groups',
      href: '/admin/groups',
      icon: UserGroupIcon,
    },
    {
      name: 'Social',
      href: '/admin/social',
      icon: ChatBubbleLeftRightIcon,
    },
    {
      name: 'Events',
      href: '/admin/events',
      icon: CalendarDaysIcon,
    },
    {
      name: 'Organization',
      href: '/admin/organization',
      icon: BuildingOffice2Icon,
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: UserCircleIcon,
    },
  ];
};

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { isMobile } = useDevice();
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = useSelector(selectIsDark);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [moreSidebarOpen, setMoreSidebarOpen] = useState(false);

  // Fetch organization data from public endpoint
  const { data: organization } = useGetPublicOrganizationQuery();
  const organizationName = organization?.name || 'Organization';

  // Get navigation items based on user role
  const navigationItems = getNavigationItems(user?.role || 'USER');
  const mobileNavItems = getMobileNavItems(user?.role || 'USER');
  
  // Update current navigation item - use exact match or specific logic for routes
  const navItemsWithCurrent = navigationItems.map(item => {
    // Handle exact matches for most routes
    if (item.href === location.pathname) {
      return { ...item, current: true };
    }
    
    // Handle special cases for routes that should be active for child routes
    if (item.href === '/admin/events' && location.pathname === '/admin/events') {
      return { ...item, current: true };
    }
    
    if (item.href === '/admin/events-management' && location.pathname === '/admin/events-management') {
      return { ...item, current: true };
    }
    
    // For other routes that have sub-routes, use startsWith but exclude conflicts
    if (location.pathname.startsWith(item.href) && 
        !(item.href === '/admin/events' && location.pathname.startsWith('/admin/events-'))) {
      return { ...item, current: true };
    }
    
    return { ...item, current: false };
  });

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

  if (isMobile) {
    // Mobile Layout with New Header and Bottom Navigation
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Mobile Header */}
        <MobileHeader unreadNotifications={0} />

        {/* Main Content - Add padding for fixed header and bottom nav */}
        <main className="pb-20 pt-2">
          <Outlet />
        </main>

        {/* Bottom Navigation */}
        <MobileBottomNav
          userRole={user?.role || 'USER'}
          onMoreClick={() => setMoreSidebarOpen(true)}
        />

        {/* More Sidebar */}
        <MobileMoreSidebar
          isOpen={moreSidebarOpen}
          onClose={() => setMoreSidebarOpen(false)}
          userRole={user?.role || 'USER'}
          userName={user?.name || user?.fullName || 'User'}
          userEmail={user?.email || ''}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  // Desktop Layout with Sidebar + Navbar
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: sidebarOpen || !isMobile ? 0 : -320,
        }}
        className="fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-gray-800 shadow-lg lg:sticky lg:top-0 lg:h-screen lg:z-0 flex flex-col"
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-center px-8 h-[80px] border-b border-gray-200 dark:border-gray-700 relative">
          {/* GUILD Brand Logo - Full width */}
          <div className="w-full h-14">
            <img
              src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
              alt="GUILD"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Close button (mobile only) - positioned absolutely */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute right-6 lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItemsWithCurrent.map((item) => {
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors relative ${
                  item.current
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.description}
                  </div>
                </div>
                
                {item.current && (
                  <motion.div
                    layoutId="activeNavItem"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="p-4">
            <div className="flex items-center space-x-3">
              {/* Profile Avatar */}
              <div className="flex-shrink-0">
                {!imageError && user?.id ? (
                  <img
                    src={getApiUrl(`/api/users/profile-picture/${user.id}`)}
                    alt={user.fullName}
                    className="h-10 w-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.fullName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 
                   user?.role === 'BATCH_ADMIN' ? 'Batch Admin' : 
                   user?.email}
                </p>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex-shrink-0 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Sign out"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Additional User Info */}
            {user?.batch && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Batch {user.batch} • {user?.role === 'BATCH_ADMIN' ? 'Admin' : 'Member'}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
          <div className="px-6 h-[80px] flex items-center">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                {/* Menu button for mobile */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mr-4"
                >
                  <Bars3Icon className="h-6 w-6" />
                </button>
                
                {/* Organization Logo and Name */}
                <div className="flex items-center space-x-3">
                  <OrganizationLogo size="lg" className="flex-shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {organizationName}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {user?.role === 'SUPER_ADMIN' ? 'Super Admin Portal' :
                       user?.role === 'BATCH_ADMIN' ? 'Batch Admin Portal' :
                       'Alumni Portal'}
                    </p>
                  </div>
                </div>
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

                {/* Notifications */}
                <NotificationPanel />

                {/* Profile Dropdown */}
                <UserProfileDropdown />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;