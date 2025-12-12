import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { useSelector } from 'react-redux';
import { selectUser } from '@/store/slices/authSlice';
import OrganizationLogo from '@/components/common/UI/OrganizationLogo';
import { getApiUrl } from '@/utils/helpers';

interface MobileHeaderProps {
  unreadNotifications?: number;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ unreadNotifications = 0 }) => {
  const user = useSelector(selectUser);
  const [imageError, setImageError] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 lg:hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="px-4 py-3">
        {/* Single Row - User Icon & Notification (left), Org Logo (right) */}
        <div className="flex items-center justify-between">
          {/* Left - User Avatar & Notifications */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            {/* User Avatar */}
            <Link to="/profile" className="relative flex-shrink-0">
              {!imageError && user?.id ? (
                <img
                  src={getApiUrl(`/api/users/profile-picture/${user.id}`)}
                  alt={user.name || 'User'}
                  className="w-10 h-10 rounded-full object-cover border-2 border-purple-500 dark:border-purple-400"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg border-2 border-purple-500 dark:border-purple-400">
                  {user?.name?.charAt(0) || user?.fullName?.charAt(0) || 'U'}
                </div>
              )}
            </Link>

            {/* Notifications Button */}
            <Link
              to="/notifications"
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Notifications"
            >
              <BellIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
          </div>

          {/* Right - Organization Logo */}
          <div className="flex-shrink-0">
            <OrganizationLogo size="lg" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
