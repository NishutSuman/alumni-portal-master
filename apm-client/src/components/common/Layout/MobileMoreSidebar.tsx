import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  XMarkIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  BellIcon,
  UserGroupIcon,
  PhotoIcon,
  MegaphoneIcon,
  TicketIcon,
  BanknotesIcon,
  LifebuoyIcon,
  HeartIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
  BuildingOffice2Icon,
  UsersIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  AcademicCapIcon,
  CheckBadgeIcon,
  PencilSquareIcon,
  ChartPieIcon,
  ShoppingBagIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import { selectIsDark } from '@/store/slices/themeSlice';
import { selectUser } from '@/store/slices/authSlice';
import ThemeToggle from '@/components/common/UI/ThemeToggle';
import SettingsModal from '@/components/common/UI/SettingsModal';

interface MobileMoreSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'USER' | 'TEACHER' | 'BATCH_ADMIN' | 'SUPER_ADMIN' | 'DEVELOPER';
  userName: string;
  userEmail: string;
  onLogout: () => void;
}

interface MenuItem {
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  section?: string;
}

const MobileMoreSidebar: React.FC<MobileMoreSidebarProps> = ({
  isOpen,
  onClose,
  userRole,
  userName,
  userEmail,
  onLogout,
}) => {
  const navigate = useNavigate();
  const isDark = useSelector(selectIsDark);
  const user = useSelector(selectUser);
  const [imageError, setImageError] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLogout = () => {
    onClose();
    onLogout();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  const getMenuItems = (): MenuItem[] => {
    switch (userRole) {
      case 'SUPER_ADMIN':
        return [
          { name: 'Dashboard', path: '/admin/dashboard', icon: HomeIcon },
          { name: 'User Management', path: '/admin/users', icon: CheckBadgeIcon },
          { name: 'Alumni Directory', path: '/user/alumni', icon: UsersIcon },
          { name: 'Groups', path: '/admin/groups', icon: UserGroupIcon },
          { name: 'Organization', path: '/admin/organization', icon: BuildingOffice2Icon },
          { name: 'Social', path: '/admin/social', icon: ChatBubbleLeftRightIcon },
          { name: 'Posts Management', path: '/admin/posts', icon: PencilSquareIcon },
          { name: 'Poll Management', path: '/admin/polls', icon: ChartPieIcon },
          { name: 'Events', path: '/admin/events', icon: CalendarDaysIcon },
          { name: 'Event Management', path: '/admin/events-management', icon: CalendarDaysIcon },
          { name: 'Treasury', path: '/admin/treasury', icon: BanknotesIcon },
          { name: 'Merchandise', path: '/admin/merchandise', icon: ShoppingBagIcon },
          { name: 'Communications', path: '/admin/communications', icon: ChatBubbleLeftRightIcon },
          { name: 'Support', path: '/admin/support', icon: LifebuoyIcon },
          { name: 'LifeLink', path: '/user/lifelink', icon: HeartIcon },
          { name: 'Gallery', path: '/user/gallery', icon: PhotoIcon },
          { name: 'Reports', path: '/admin/reports', icon: DocumentTextIcon },
        ];

      case 'BATCH_ADMIN':
        return [
          { name: 'Dashboard', path: '/admin/dashboard', icon: HomeIcon },
          { name: 'User Verification', path: '/admin/users', icon: CheckBadgeIcon },
          { name: 'Alumni Directory', path: '/user/alumni', icon: UsersIcon },
          { name: 'Groups', path: '/user/groups', icon: UserGroupIcon },
          { name: 'Organization', path: '/organization', icon: BuildingOffice2Icon },
          { name: 'My Profile', path: '/user/profile', icon: UserCircleIcon },
          { name: 'Social', path: '/user/social', icon: ChatBubbleLeftRightIcon },
          { name: 'Events', path: '/admin/events', icon: CalendarDaysIcon },
          { name: 'LifeLink', path: '/user/lifelink', icon: HeartIcon },
          { name: 'Treasury', path: '/user/treasury', icon: BanknotesIcon },
          { name: 'Gallery', path: '/user/gallery', icon: PhotoIcon },
          { name: 'Support', path: '/user/support', icon: LifebuoyIcon },
        ];

      case 'USER':
      default:
        return [
          { name: 'Dashboard', path: '/user/dashboard', icon: HomeIcon },
          { name: 'My Profile', path: '/user/profile', icon: UserCircleIcon },
          { name: 'Alumni Directory', path: '/user/alumni', icon: UsersIcon },
          { name: 'Groups', path: '/user/groups', icon: UserGroupIcon },
          { name: 'Organization', path: '/organization', icon: BuildingOffice2Icon },
          { name: 'Events', path: '/user/events', icon: CalendarDaysIcon },
          { name: 'Social', path: '/user/social', icon: ChatBubbleLeftRightIcon },
          { name: 'LifeLink', path: '/user/lifelink', icon: HeartIcon },
          { name: 'Treasury', path: '/user/treasury', icon: BanknotesIcon },
          { name: 'Gallery', path: '/user/gallery', icon: PhotoIcon },
          { name: 'Support', path: '/user/support', icon: LifebuoyIcon },
        ];
    }
  };

  const menuItems = getMenuItems();

  return (
    <>
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50 lg:hidden">
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        {/* Sidebar */}
        <Transition.Child
          as={Fragment}
          enter="transition ease-in-out duration-300 transform"
          enterFrom="-translate-x-full"
          enterTo="translate-x-0"
          leave="transition ease-in-out duration-300 transform"
          leaveFrom="translate-x-0"
          leaveTo="-translate-x-full"
        >
          <Dialog.Panel className="fixed left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* User Profile Picture */}
                <div className="flex-shrink-0">
                  {!imageError && user?.id ? (
                    <img
                      src={`/api/users/profile-picture/${user.id}`}
                      alt={userName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-purple-500 dark:border-purple-400"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-base border-2 border-purple-500 dark:border-purple-400">
                      {userName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {userName}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {userEmail}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                <XMarkIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Menu Items - Scrollable */}
            <div className="flex-1 overflow-y-auto py-2">
              <div className="space-y-1 px-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className="w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer - Theme Toggle & Logout */}
            <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-3">
              {/* Theme, Notifications & Settings */}
              <div className="flex items-center justify-center space-x-6 px-3 py-2">
                <ThemeToggle />
                <button
                  onClick={() => handleNavigation('/notifications')}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Notifications"
                >
                  <BellIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Settings"
                >
                  <Cog6ToothIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </button>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                <span className="text-sm font-semibold">Logout</span>
              </button>

              {/* Close Sidebar Button */}
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
                <span className="text-sm font-semibold">Close Menu</span>
              </button>

              {/* GUILD Logo */}
              <div className="flex justify-center pt-2">
                <img
                  src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                  alt="GUILD"
                  className="h-12 w-auto object-contain opacity-60"
                />
              </div>
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </Dialog>
    </Transition>

    {/* Settings Modal */}
    <SettingsModal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
    />
    </>
  );
};

export default MobileMoreSidebar;
