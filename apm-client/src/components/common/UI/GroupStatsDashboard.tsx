// src/components/common/UI/GroupStatsDashboard.tsx
import React from 'react'
import {
  UserGroupIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { useGetGroupStatisticsQuery, GroupType } from '@/store/api/groupsApi'
import LoadingSpinner from './LoadingSpinner'
import RoleBadge from './RoleBadge'

interface GroupStatsDashboardProps {
  className?: string
  showTitle?: boolean
  compact?: boolean
}

// Type configurations for display
const typeConfigs = {
  CELL: {
    label: 'Cells',
    color: 'purple',
    description: 'Specialized working groups',
  },
  COMMITTEE: {
    label: 'Committees', 
    color: 'blue',
    description: 'Advisory and decision bodies',
  },
  OFFICE_BEARERS: {
    label: 'Office Bearers',
    color: 'green', 
    description: 'Executive leadership team',
  },
  ADVISORS: {
    label: 'Advisors',
    color: 'orange',
    description: 'Advisory and guidance council',
  },
}

const GroupStatsDashboard: React.FC<GroupStatsDashboardProps> = ({
  className = '',
  showTitle = true,
  compact = false,
}) => {
  const { data: stats, isLoading, isError, error } = useGetGroupStatisticsQuery()

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !stats) {
    return (
      <div className={`${className} text-center p-8`}>
        <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          {(error as any)?.data?.message || 'Failed to load group statistics'}
        </p>
      </div>
    )
  }

  // Calculate percentages for active groups
  const activePercentage = stats.totalGroups > 0 
    ? Math.round((stats.activeGroups / stats.totalGroups) * 100) 
    : 0

  return (
    <div className={className}>
      {/* Header */}
      {showTitle && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <ChartBarIcon className="w-7 h-7 mr-3 text-blue-600" />
            Group Statistics
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Overview of organization groups and membership
          </p>
        </div>
      )}

      {/* Key Metrics */}
      <div className={`grid gap-6 mb-8 ${compact ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Groups
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalGroups}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Groups
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.activeGroups}
              </p>
              <p className="text-sm text-green-600">
                {activePercentage}% active
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <UsersIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Members
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalMembers}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <ChartBarIcon className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Avg Members
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.activeGroups > 0 
                  ? Math.round(stats.totalMembers / stats.activeGroups) 
                  : 0
                }
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                per group
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Groups by Type */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Groups by Type
        </h3>
        
        <div className="space-y-4">
          {stats.groupsByType.map((typeData) => {
            const config = typeConfigs[typeData.type as GroupType]
            if (!config) return null
            
            const percentage = stats.totalGroups > 0 
              ? Math.round((typeData.count / stats.totalGroups) * 100)
              : 0
            const activePercentage = typeData.count > 0
              ? Math.round((typeData.activeCount / typeData.count) * 100)
              : 0

            return (
              <div key={typeData.type} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className={`inline-block w-3 h-3 rounded-full mr-3 bg-${config.color}-500`} />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {config.label}
                      </span>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {config.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {typeData.activeCount}/{typeData.count}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {activePercentage}% active
                    </div>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full bg-${config.color}-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {percentage}% of total groups
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Actions (if not compact) */}
      {!compact && (
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
            Quick Actions
          </h4>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-700 transition-colors">
              <EyeIcon className="w-4 h-4 mr-2" />
              View All Groups
            </button>
            <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-700 transition-colors">
              <UsersIcon className="w-4 h-4 mr-2" />
              Member Reports
            </button>
            <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-700 transition-colors">
              <ChartBarIcon className="w-4 h-4 mr-2" />
              Export Statistics
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupStatsDashboard