// src/components/user/dashboard/QuickAccessSection.tsx
import React from 'react'
import { motion } from 'framer-motion'
import { 
  UserCircleIcon, 
  UsersIcon, 
  CalendarDaysIcon,
  InboxIcon,
  Cog6ToothIcon,
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

interface QuickAccessItem {
  name: string
  href: string
  icon: React.ComponentType<any>
  description: string
  color: string
  bgColor: string
}

const QuickAccessSection: React.FC = () => {
  const quickAccessItems: QuickAccessItem[] = [
    {
      name: 'Inbox',
      href: '/user/inbox',
      icon: InboxIcon,
      description: 'Messages and notifications',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      name: 'My Profile',
      href: '/user/profile',
      icon: UserCircleIcon,
      description: 'View and edit profile',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      name: 'Alumni Directory',
      href: '/user/alumni',
      icon: UsersIcon,
      description: 'Connect with alumni',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    {
      name: 'Events',
      href: '/user/events',
      icon: CalendarDaysIcon,
      description: 'Browse events',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    },
    {
      name: 'My Team',
      href: '/user/team',
      icon: AcademicCapIcon,
      description: 'Your batch mates',
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-900/20'
    },
    {
      name: 'Discussions',
      href: '/user/discussions',
      icon: ChatBubbleLeftRightIcon,
      description: 'Community discussions',
      color: 'text-pink-600 dark:text-pink-400',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20'
    },
    {
      name: 'Documents',
      href: '/user/documents',
      icon: DocumentTextIcon,
      description: 'Important documents',
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20'
    },
    {
      name: 'Settings',
      href: '/user/settings',
      icon: Cog6ToothIcon,
      description: 'Account preferences',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20'
    }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Access</h3>
      </div>

      {/* Quick Access Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickAccessItems.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={item.href}
                className="group block p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 rounded-lg ${item.bgColor} group-hover:scale-105 transition-transform duration-200`}>
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 rounded-b-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Access your most-used features quickly from here
        </p>
      </div>
    </motion.div>
  )
}

export default QuickAccessSection