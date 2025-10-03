// src/components/common/UI/RoleBadge.tsx
import React from 'react'
import { GroupMemberRole, GroupType } from '@/store/api/groupsApi'

interface RoleBadgeProps {
  role: GroupMemberRole
  groupType?: GroupType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Role configurations with colors and display names
const roleConfigs: Record<GroupMemberRole, {
  label: string
  colorClass: string
  priority: number
}> = {
  // Cell/Committee roles
  'CONVENER': {
    label: 'Convener',
    colorClass: 'bg-purple-100 text-purple-800 border-purple-200',
    priority: 1,
  },
  'CO_CONVENER': {
    label: 'Co-Convener',
    colorClass: 'bg-purple-50 text-purple-700 border-purple-150',
    priority: 2,
  },
  'STAKE_HOLDER': {
    label: 'Stake Holder',
    colorClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    priority: 3,
  },
  
  // Office Bearer roles
  'PRESIDENT': {
    label: 'President',
    colorClass: 'bg-blue-100 text-blue-800 border-blue-200',
    priority: 1,
  },
  'VICE_PRESIDENT': {
    label: 'Vice President',
    colorClass: 'bg-blue-50 text-blue-700 border-blue-150',
    priority: 2,
  },
  'SECRETARY': {
    label: 'Secretary',
    colorClass: 'bg-green-100 text-green-800 border-green-200',
    priority: 3,
  },
  'JOINT_SECRETARY': {
    label: 'Joint Secretary',
    colorClass: 'bg-green-50 text-green-700 border-green-150',
    priority: 4,
  },
  'TREASURER': {
    label: 'Treasurer',
    colorClass: 'bg-orange-100 text-orange-800 border-orange-200',
    priority: 5,
  },
  'JOINT_TREASURER': {
    label: 'Joint Treasurer',
    colorClass: 'bg-orange-50 text-orange-700 border-orange-150',
    priority: 6,
  },
  
  // Advisor roles
  'CHIEF_ADVISOR': {
    label: 'Chief Advisor',
    colorClass: 'bg-gray-100 text-gray-800 border-gray-200',
    priority: 1,
  },
  'JOINT_ADVISOR': {
    label: 'Joint Advisor',
    colorClass: 'bg-gray-50 text-gray-700 border-gray-150',
    priority: 2,
  },
}

// Size configurations
const sizeClasses = {
  sm: 'text-xs px-2 py-1 rounded-md',
  md: 'text-sm px-3 py-1.5 rounded-lg',
  lg: 'text-base px-4 py-2 rounded-lg',
}

// Get valid roles for a group type
export const getRolesByGroupType = (groupType: GroupType): GroupMemberRole[] => {
  const rolesByType: Record<GroupType, GroupMemberRole[]> = {
    CELL: ['CONVENER', 'CO_CONVENER', 'STAKE_HOLDER'],
    COMMITTEE: ['CONVENER', 'CO_CONVENER', 'STAKE_HOLDER'],
    OFFICE_BEARERS: ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'JOINT_TREASURER'],
    ADVISORS: ['CHIEF_ADVISOR', 'JOINT_ADVISOR'],
  }
  
  return rolesByType[groupType]
}

// Validate if role is allowed for group type
export const isValidRoleForGroup = (role: GroupMemberRole, groupType: GroupType): boolean => {
  const allowedRoles = getRolesByGroupType(groupType)
  return allowedRoles.includes(role)
}

// Get role priority for sorting
export const getRolePriority = (role: GroupMemberRole): number => {
  return roleConfigs[role]?.priority || 999
}

const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  groupType,
  size = 'md',
  className = '',
}) => {
  const config = roleConfigs[role]
  
  if (!config) {
    // Fallback for unknown roles
    return (
      <span className={`inline-flex items-center font-medium bg-gray-100 text-gray-800 border border-gray-200 ${sizeClasses[size]} ${className}`}>
        {role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    )
  }
  
  // Check if role is valid for group type (if provided)
  const isValid = !groupType || isValidRoleForGroup(role, groupType)
  const colorClass = isValid 
    ? config.colorClass 
    : 'bg-red-100 text-red-800 border-red-200' // Invalid role styling
  
  return (
    <span 
      className={`inline-flex items-center font-medium border ${colorClass} ${sizeClasses[size]} ${className}`}
      title={!isValid ? `Invalid role for ${groupType} group` : config.label}
    >
      {config.label}
      {!isValid && (
        <span className="ml-1 text-xs">⚠️</span>
      )}
    </span>
  )
}

export default RoleBadge