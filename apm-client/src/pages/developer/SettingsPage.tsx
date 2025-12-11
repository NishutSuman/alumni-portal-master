// src/pages/developer/SettingsPage.tsx
// Settings Page for Developer Portal

import { useAuth } from '@/hooks/useAuth'
import {
  CogIcon,
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
  KeyIcon,
} from '@heroicons/react/24/outline'

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage your developer account and preferences
          </p>
        </div>

        {/* Profile Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <UserCircleIcon className="h-6 w-6 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Profile Information
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {user?.fullName?.charAt(0)?.toUpperCase() || 'D'}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {user?.fullName || 'Developer'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {user?.email || 'developer@guild.com'}
                </p>
                <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  Developer Account
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <BellIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Configure email and push notification preferences
            </p>
            <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
              Configure
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <ShieldCheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Security</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Manage two-factor authentication and security settings
            </p>
            <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
              Configure
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <KeyIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">API Keys</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Generate and manage API keys for integrations
            </p>
            <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
              Manage Keys
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <CogIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Preferences</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Customize your developer portal experience
            </p>
            <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
              Configure
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
