import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  UserCircleIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { switchOrganization } from '@/store';
import { getStoredOrgName } from '@/config/organizations';
import SettingsModal from './SettingsModal';
import { getApiUrl } from '@/utils/helpers';

interface UserProfileDropdownProps {
  className?: string;
}

const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const handleSwitchOrganization = () => {
    setIsOpen(false);
    switchOrganization();
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    setIsSettingsOpen(true);
  };

  // Get current organization name
  const currentOrgName = getStoredOrgName();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
        aria-label="User menu"
      >
        {!imageError && user?.id ? (
          <img
            src={getApiUrl(`/api/users/profile-picture/${user.id}`)}
            alt={user.fullName || 'User'}
            className="h-8 w-8 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
            onError={() => setImageError(true)}
          />
        ) : (
          <UserCircleIcon className="h-8 w-8" />
        )}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium">{user?.fullName || 'Admin User'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {user?.role?.toLowerCase().replace('_', ' ') || 'Admin'}
          </p>
        </div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile Backdrop */}
            <div 
              className="fixed inset-0 z-40 lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
            >
              {/* User Info */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  {!imageError && user?.id ? (
                    <img
                      src={getApiUrl(`/api/users/profile-picture/${user.id}`)}
                      alt={user.fullName || 'User'}
                      className="h-10 w-10 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <UserCircleIcon className="h-10 w-10 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {user?.fullName || 'Admin User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.email || 'admin@alumni.portal'}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 capitalize">
                      {user?.role?.toLowerCase().replace('_', ' ') || 'Admin'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                {/* My Profile */}
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <UserCircleIcon className="h-5 w-5 mr-3" />
                  <span>My Profile</span>
                </Link>

                {/* Theme Toggle */}
                <button
                  onClick={handleThemeToggle}
                  className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  {theme.isDark ? (
                    <SunIcon className="h-5 w-5 mr-3" />
                  ) : (
                    <MoonIcon className="h-5 w-5 mr-3" />
                  )}
                  <span>{theme.isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                {/* Settings */}
                <button
                  onClick={handleOpenSettings}
                  className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <CogIcon className="h-5 w-5 mr-3" />
                  <span>Settings</span>
                </button>

                <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

                {/* Current Organization Info */}
                {currentOrgName && (
                  <div className="px-4 py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Organization</p>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {currentOrgName}
                    </p>
                  </div>
                )}

                {/* Switch Organization */}
                <button
                  onClick={handleSwitchOrganization}
                  className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <BuildingOfficeIcon className="h-5 w-5 mr-3" />
                  <span>Change Organization</span>
                </button>

                <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5 mr-3" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default UserProfileDropdown;