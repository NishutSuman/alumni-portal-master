// src/components/common/UI/GroupListCard.tsx
import React from 'react'
import {
  UserGroupIcon,
  EyeIcon,
  CogIcon,
  UsersIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'
import { Group } from '@/store/api/groupsApi'
import RoleBadge, { getRolesByGroupType } from './RoleBadge'

interface GroupListCardProps {
  group: Group
  showActions?: boolean
  onEdit?: (group: Group) => void
  onView?: (group: Group) => void
  onAddMembers?: (group: Group) => void
  onViewMembers?: (group: Group) => void
  className?: string
  isPublic?: boolean
  showViewButton?: boolean
}

// Group type display configurations
const groupTypeConfig = {
  CELL: {
    label: 'Cell',
    description: 'Specialized working groups',
    colorClass: 'bg-purple-100 text-purple-800 border-purple-200',
    iconColor: 'text-purple-600',
  },
  COMMITTEE: {
    label: 'Committee',
    description: 'Advisory and decision-making bodies',
    colorClass: 'bg-blue-100 text-blue-800 border-blue-200',
    iconColor: 'text-blue-600',
  },
  OFFICE_BEARERS: {
    label: 'Office Bearers',
    description: 'Executive leadership team',
    colorClass: 'bg-green-100 text-green-800 border-green-200',
    iconColor: 'text-green-600',
  },
  ADVISORS: {
    label: 'Advisors',
    description: 'Experienced guidance providers',
    colorClass: 'bg-orange-100 text-orange-800 border-orange-200',
    iconColor: 'text-orange-600',
  },
}

const GroupListCard: React.FC<GroupListCardProps> = ({
  group,
  showActions = false,
  onEdit,
  onView,
  onAddMembers,
  onViewMembers,
  className = '',
  isPublic = false,
  showViewButton = true,
}) => {
  const typeConfig = groupTypeConfig[group.type] || groupTypeConfig.CELL
  const allowedRoles = getRolesByGroupType(group.type)

  return (
    <div className={`group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 ${className}`}>
      {/* Main Content */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            {/* Group Icon */}
            <div className={`p-3 rounded-lg ${typeConfig.colorClass.replace('text-', 'bg-').replace('-800', '-100')} ${typeConfig.colorClass.replace('bg-', 'text-').replace('-100', '-600')}`}>
              <UserGroupIcon className={`w-6 h-6 ${typeConfig.iconColor}`} />
            </div>

            {/* Group Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {group.name}
                </h3>
                
                {/* Active/Inactive Status */}
                <div className={`w-2 h-2 rounded-full ${
                  group.isActive ? 'bg-green-400' : 'bg-gray-400'
                }`} title={group.isActive ? 'Active' : 'Inactive'} />
              </div>

              {/* Group Type Badge */}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${typeConfig.colorClass}`}>
                {typeConfig.label}
              </span>
            </div>
          </div>

          {/* Members Count */}
          <div className="text-right flex-shrink-0 ml-4">
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <UsersIcon className="w-5 h-5 mr-2" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {group.membersCount}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {group.membersCount === 1 ? 'Member' : 'Members'}
            </p>
          </div>
        </div>

        {/* Description */}
        {group.description && (
          <p className="text-gray-600 dark:text-gray-300 mt-4 leading-relaxed">
            {group.description}
          </p>
        )}
      </div>

      {/* Roles Section */}
      <div className="px-6 pb-4">
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Available Roles:
          </h4>
          <div className="flex flex-wrap gap-2">
            {allowedRoles.map((role) => (
              <RoleBadge 
                key={role} 
                role={role} 
                groupType={group.type}
                size="sm"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      {(showActions || !isPublic) && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="space-y-3">
            {/* Add Members Button (For admin only) */}
            {showActions && onAddMembers && (
              <button
                onClick={() => onAddMembers(group)}
                className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors border border-blue-200 dark:border-blue-700"
              >
                <UserPlusIcon className="w-4 h-4 mr-2" />
                Add Members
              </button>
            )}

            <div className="flex space-x-3">
              {/* View Members Button */}
              {onViewMembers && group.membersCount > 0 && (
                <button
                  onClick={() => onViewMembers(group)}
                  className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                >
                  <UsersIcon className="w-4 h-4 mr-2" />
                  View Members
                </button>
              )}

              {/* Manage Button (Admin only) */}
              {showActions && onEdit && (
                <button
                  onClick={() => onEdit(group)}
                  className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <CogIcon className="w-4 h-4 mr-2" />
                  Manage
                </button>
              )}

              {/* View Details Button (User side) */}
              {showViewButton && onView && !showActions && (
                <button
                  onClick={() => onView(group)}
                  className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors border border-blue-200 dark:border-blue-700"
                >
                  <EyeIcon className="w-4 h-4 mr-2" />
                  View Details
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupListCard