import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UserGroupIcon,
  CalendarIcon,
  UsersIcon,
  Bars3Icon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  CalendarIcon as CalendarIconSolid,
  UsersIcon as UsersIconSolid,
  BuildingOfficeIcon as BuildingOfficeIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  AcademicCapIcon as AcademicCapIconSolid,
} from '@heroicons/react/24/solid';

interface MobileBottomNavProps {
  userRole: 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN';
  onMoreClick: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  iconSolid: React.ComponentType<any>;
  isMore?: boolean;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ userRole, onMoreClick }) => {
  const location = useLocation();

  const getNavItems = (): NavItem[] => {
    switch (userRole) {
      case 'SUPER_ADMIN':
        return [
          {
            name: 'Users',
            path: '/admin/users',
            icon: UsersIcon,
            iconSolid: UsersIconSolid,
          },
          {
            name: 'Dashboard',
            path: '/admin/dashboard',
            icon: HomeIcon,
            iconSolid: HomeIconSolid,
          },
          {
            name: 'Organization',
            path: '/admin/organization',
            icon: BuildingOfficeIcon,
            iconSolid: BuildingOfficeIconSolid,
          },
          {
            name: 'Analytics',
            path: '/admin/dashboard',
            icon: ChartBarIcon,
            iconSolid: ChartBarIconSolid,
          },
        ];

      case 'BATCH_ADMIN':
        return [
          {
            name: 'Users',
            path: '/admin/users',
            icon: UsersIcon,
            iconSolid: UsersIconSolid,
          },
          {
            name: 'Dashboard',
            path: '/admin/dashboard',
            icon: HomeIcon,
            iconSolid: HomeIconSolid,
          },
          {
            name: 'Events',
            path: '/admin/events',
            icon: CalendarIcon,
            iconSolid: CalendarIconSolid,
          },
          {
            name: 'Social',
            path: '/user/social',
            icon: ChatBubbleLeftRightIcon,
            iconSolid: ChatBubbleLeftRightIconSolid,
          },
        ];

      case 'USER':
      default:
        return [
          {
            name: 'Social',
            path: '/user/social',
            icon: ChatBubbleLeftRightIcon,
            iconSolid: ChatBubbleLeftRightIconSolid,
          },
          {
            name: 'Dashboard',
            path: '/user/dashboard',
            icon: HomeIcon,
            iconSolid: HomeIconSolid,
          },
          {
            name: 'Events',
            path: '/user/events',
            icon: CalendarIcon,
            iconSolid: CalendarIconSolid,
          },
          {
            name: 'Directory',
            path: '/user/alumni',
            icon: AcademicCapIcon,
            iconSolid: AcademicCapIconSolid,
          },
        ];
    }
  };

  const navItems = getNavItems();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 lg:hidden">
      <div className="grid grid-cols-5 h-16">
        {/* More Button - First item on left */}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          <Bars3Icon className="w-6 h-6" />
          <span className="text-xs font-medium">More</span>
        </button>

        {/* Other nav items */}
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = active ? item.iconSolid : item.icon;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                active
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
