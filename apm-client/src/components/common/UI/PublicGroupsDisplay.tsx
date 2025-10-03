// src/components/common/UI/PublicGroupsDisplay.tsx
import React from 'react'
import {
  UserGroupIcon,
  UsersIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { useGetPublicGroupsQuery } from '@/store/api/groupsApi'
import GroupListCard from './GroupListCard'
import LoadingSpinner from './LoadingSpinner'

interface PublicGroupsDisplayProps {
  title?: string
  subtitle?: string
  maxItems?: number
  showAll?: boolean
  className?: string
}

const PublicGroupsDisplay: React.FC<PublicGroupsDisplayProps> = ({
  title = "Our Organization",
  subtitle = "Meet the teams and committees that drive our alumni community forward",
  maxItems = 6,
  showAll = false,
  className = "",
}) => {
  const { data: groups, isLoading, isError } = useGetPublicGroupsQuery()

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  if (isError || !groups || groups.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400 mb-2">
            No Groups Available
          </h3>
          <p className="text-gray-500 dark:text-gray-500">
            Group information will be displayed here when available.
          </p>
        </div>
      </div>
    )
  }

  // Filter only active groups and limit if needed
  const activeGroups = groups.filter(group => group.isActive)
  const displayGroups = showAll ? activeGroups : activeGroups.slice(0, maxItems)

  // Calculate statistics
  const totalMembers = activeGroups.reduce((sum, group) => sum + group.membersCount, 0)
  const groupsByType = activeGroups.reduce((acc, group) => {
    acc[group.type] = (acc[group.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className={`${className}`}>
      {/* Header Section */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-6">
          <UserGroupIcon className="w-12 h-12 text-blue-600 mr-4" />
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <div className="text-center bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {activeGroups.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Active Groups
          </div>
        </div>
        <div className="text-center bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {totalMembers}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total Members
          </div>
        </div>
        <div className="text-center bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {groupsByType.COMMITTEE || 0}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Committees
          </div>
        </div>
        <div className="text-center bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="text-3xl font-bold text-orange-600 mb-2">
            {groupsByType.CELL || 0}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Cells
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {displayGroups.map((group) => (
          <GroupListCard
            key={group.id}
            group={group}
            isPublic={true}
            className="h-full"
          />
        ))}
      </div>

      {/* Show More Button */}
      {!showAll && activeGroups.length > maxItems && (
        <div className="text-center mt-12">
          <button className="inline-flex items-center px-6 py-3 text-lg font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors">
            View All Groups
            <ArrowRightIcon className="w-5 h-5 ml-2" />
          </button>
        </div>
      )}

      {/* Bottom Info Section */}
      <div className="mt-16 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-8">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Get Involved
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
            Our alumni organization thrives through the active participation of dedicated members. 
            Join one of our groups and contribute to building a stronger alumni community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <UsersIcon className="w-5 h-5 mr-2" />
              <span className="text-sm">Open to all verified alumni</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <UserGroupIcon className="w-5 h-5 mr-2" />
              <span className="text-sm">Multiple leadership opportunities</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PublicGroupsDisplay