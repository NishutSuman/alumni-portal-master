// src/pages/user/Groups.tsx
import React, { useState } from 'react'
import { 
  UserGroupIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import { useGetGroupsQuery, useGetGroupQuery, Group, GroupMember } from '@/store/api/groupsApi'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import { motion } from 'framer-motion'

const Groups: React.FC = () => {
  const { user } = useAuth()
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [isTabSwitching, setIsTabSwitching] = useState(false)
  
  // Fetch all groups
  const {
    data: groupsData,
    isLoading: groupsLoading,
    isError: groupsError,
    error,
  } = useGetGroupsQuery({
    isActive: true,
    limit: 50,
  })

  const groups = groupsData?.groups || []

  // Auto-select first group if none selected and groups are available
  React.useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id)
    }
  }, [groups, selectedGroupId])

  // Fetch selected group details with members
  const {
    data: selectedGroupData,
    isLoading: groupLoading,
    isError: groupError,
  } = useGetGroupQuery(
    { groupId: selectedGroupId!, includeMembers: true },
    { skip: !selectedGroupId }
  )

  // Handle tab switching with loading state
  const handleTabSwitch = (groupId: string) => {
    if (groupId !== selectedGroupId) {
      setIsTabSwitching(true)
      setSelectedGroupId(groupId)
    }
  }

  // Reset tab switching state when data loads
  React.useEffect(() => {
    if (selectedGroupData || groupError) {
      setIsTabSwitching(false)
    }
  }, [selectedGroupData, groupError])

  // Member card component
  const MemberCard: React.FC<{ member: GroupMember }> = ({ member }) => {
    const { user: memberUser } = member
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative group h-64 w-full"
      >
        <div className="relative w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 overflow-hidden border-b-4 border-b-blue-500 dark:border-b-blue-400">
          {/* Role Badge */}
          <div className="absolute top-2 left-2 z-10">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {member.role.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="p-4 text-center h-full flex flex-col justify-center">
            {/* Profile Image */}
            <div className="flex justify-center mb-3">
              {memberUser.profileImage ? (
                <img
                  src={`/api/users/profile-picture/${memberUser.id}`}
                  alt={memberUser.fullName}
                  className="h-16 w-16 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(memberUser.fullName)}&background=3B82F6&color=fff&size=64`
                  }}
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold border-2 border-gray-100 dark:border-gray-700">
                  {memberUser.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            
            {/* Name and Batch */}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate mb-1">
              {memberUser.fullName}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              Batch {memberUser.batch}
            </p>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {memberUser.email && (
                <a
                  href={`mailto:${memberUser.email}`}
                  className="p-2 rounded-full bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-colors"
                  title="Email"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (groupsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (groupsError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Failed to Load Groups
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {(error as any)?.data?.message || 'Something went wrong'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <UserGroupIcon className="w-8 h-8 mr-3 text-blue-600" />
              Organization Groups
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Explore committees, cells, and leadership teams in our alumni organization
            </p>
          </div>
          
          {/* Statistics Summary */}
          <div className="hidden md:flex items-center space-x-6 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {groups.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Groups
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {groups.reduce((sum, group) => sum + group.membersCount, 0)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Total Members
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Groups Tabs */}
      {groups.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Tabs Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleTabSwitch(group.id)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    selectedGroupId === group.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {group.name}
                  {group.membersCount > 0 && (
                    <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                      {group.membersCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {groupLoading || isTabSwitching || (!selectedGroupData && selectedGroupId) ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="md" />
              </div>
            ) : selectedGroupData ? (
              <>
                {/* Group Info */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {selectedGroupData.name}
                  </h2>
                  {selectedGroupData.description && (
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {selectedGroupData.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>Type: {selectedGroupData.type.replace(/_/g, ' ')}</span>
                    <span>•</span>
                    <span>{selectedGroupData.membersCount} Members</span>
                  </div>
                </div>

                {/* Members Grid */}
                {selectedGroupData.members && selectedGroupData.members.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {selectedGroupData.members.map((member) => (
                      <MemberCard key={member.id} member={member} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Members
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      This group doesn't have any members yet.
                    </p>
                  </div>
                )}
              </>
            ) : groupError ? (
              <div className="text-center py-12">
                <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Failed to Load Group Details
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Unable to load the details for this group.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            No Groups Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No groups are currently available
          </p>
        </div>
      )}
    </div>
  )
}

export default Groups