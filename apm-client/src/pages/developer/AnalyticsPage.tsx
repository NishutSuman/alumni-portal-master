// src/pages/developer/AnalyticsPage.tsx
// Analytics Page for Developer Portal

import { useGetDeveloperDashboardQuery } from '@/store/api/developerApi'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import {
  ChartBarIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'

export default function AnalyticsPage() {
  const { data: dashboard, isLoading } = useGetDeveloperDashboardQuery()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics & Reports
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Platform usage statistics and performance metrics
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Organizations</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {dashboard?.organizations?.total || 0}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <BuildingOffice2Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-500 font-medium">
                {dashboard?.organizations?.active || 0} active
              </span>
              <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
              <span className="text-orange-500 font-medium">
                {dashboard?.organizations?.inMaintenance || 0} maintenance
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {dashboard?.systemTotals?.users?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <UserGroupIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Across all organizations
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Posts</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {dashboard?.systemTotals?.posts?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Content created
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Events</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {dashboard?.systemTotals?.events?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <CalendarIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Events organized
            </div>
          </div>
        </div>

        {/* Subscription Breakdown */}
        {dashboard?.subscriptions && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Subscription Distribution
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(dashboard.subscriptions).map(([status, count]) => {
                const colors: Record<string, string> = {
                  TRIAL: 'bg-yellow-500',
                  ACTIVE: 'bg-green-500',
                  EXPIRED: 'bg-red-500',
                  SUSPENDED: 'bg-gray-500',
                }
                return (
                  <div
                    key={status}
                    className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-3 w-3 rounded-full ${colors[status] || 'bg-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {status}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {count as number}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Placeholder for charts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center h-64 text-center">
            <div>
              <ChartBarIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Detailed Analytics Coming Soon
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Charts and detailed metrics will be available in the next update
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
