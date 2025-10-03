// src/components/common/UI/MemberProfileCard.tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { 
  UserCircleIcon,
  CalendarIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'
import { GroupMember, GroupType } from '@/store/api/groupsApi'
import RoleBadge from './RoleBadge'
import { formatDate } from '@/utils/format'

interface MemberProfileCardProps {
  member: GroupMember
  groupType?: GroupType
  showActions?: boolean
  onEdit?: (member: GroupMember) => void
  onRemove?: (member: GroupMember) => void
  className?: string
}

const MemberProfileCard: React.FC<MemberProfileCardProps> = ({
  member,
  groupType,
  showActions = false,
  onEdit,
  onRemove,
  className = '',
}) => {
  const { user, role, isActive, addedAt } = member

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Member Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start space-x-4">
          {/* Profile Photo */}
          <div className="flex-shrink-0">
            {user.profilePhoto ? (
              <img
                src={user.profilePhoto}
                alt={user.fullName}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                <UserCircleIcon className="w-8 h-8 text-gray-500 dark:text-gray-400" />
              </div>
            )}
          </div>

          {/* Member Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Name */}
                <Link 
                  to={`/user/alumni/${user.id}`}
                  className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate block"
                >
                  {user.fullName}
                </Link>
                
                {/* Batch Year */}
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <CalendarIcon className="w-4 h-4 mr-1" />
                  <span>Batch {user.batchYear}</span>
                </div>

                {/* Email */}
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <EnvelopeIcon className="w-4 h-4 mr-1" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex-shrink-0 ml-2">
                <div className={`w-3 h-3 rounded-full ${
                  isActive 
                    ? 'bg-green-400' 
                    : 'bg-gray-400'
                }`} title={isActive ? 'Active Member' : 'Inactive Member'} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role and Metadata */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between">
          {/* Role Badge */}
          <RoleBadge 
            role={role} 
            groupType={groupType}
            size="sm"
          />
          
          {/* Added Date */}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Added {formatDate(addedAt, 'MMM dd, yyyy')}
          </span>
        </div>
      </div>

      {/* Actions (only shown for admins) */}
      {showActions && (onEdit || onRemove) && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex space-x-2">
            {onEdit && (
              <button
                onClick={() => onEdit(member)}
                className="flex-1 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-2 rounded-md transition-colors font-medium"
              >
                Edit Role
              </button>
            )}
            {onRemove && (
              <button
                onClick={() => onRemove(member)}
                className="flex-1 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-2 rounded-md transition-colors font-medium"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inactive Member Overlay */}
      {!isActive && (
        <div className="absolute inset-0 bg-gray-500 bg-opacity-20 dark:bg-gray-900 dark:bg-opacity-40 rounded-lg flex items-center justify-center">
          <div className="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
            Inactive
          </div>
        </div>
      )}
    </div>
  )
}

export default MemberProfileCard