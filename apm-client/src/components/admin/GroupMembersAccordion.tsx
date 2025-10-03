// src/components/admin/GroupMembersAccordion.tsx
import React, { useState } from 'react'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
  UsersIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { useGetGroupQuery, useRemoveGroupMemberMutation, Group } from '@/store/api/groupsApi'
import RoleBadge from '@/components/common/UI/RoleBadge'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import toast from 'react-hot-toast'

interface GroupMembersAccordionProps {
  group: Group
  className?: string
}

const GroupMembersAccordion: React.FC<GroupMembersAccordionProps> = ({
  group,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  // Fetch detailed group data with members when accordion is opened
  const { 
    data: groupDetails, 
    isLoading: isLoadingMembers,
    refetch,
  } = useGetGroupQuery(
    { groupId: group.id, includeMembers: true },
    { skip: !isOpen }
  )

  const [removeGroupMember] = useRemoveGroupMemberMutation()

  const members = groupDetails?.members || []

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from ${group.name}?`)) {
      return
    }

    setRemovingMemberId(userId)
    try {
      await removeGroupMember({
        groupId: group.id,
        userId,
      }).unwrap()
      
      toast.success(`${memberName} removed from ${group.name}`)
      refetch() // Refresh the member list
    } catch (error: any) {
      console.error('Remove member error:', error)
      toast.error(error?.data?.message || 'Failed to remove member')
    } finally {
      setRemovingMemberId(null)
    }
  }

  const toggleAccordion = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 ${className}`}>
      {/* Accordion Header */}
      <button
        onClick={toggleAccordion}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
      >
        <div className="flex items-center space-x-3">
          <UsersIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">
            Group Members ({group.membersCount})
          </span>
        </div>
        {isOpen ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {isLoadingMembers ? (
            <div className="p-6 flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : members.length === 0 ? (
            <div className="p-6 text-center">
              <UserIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No members in this group yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {/* Member Info */}
                  <div className="flex items-center space-x-3">
                    {/* Profile Photo */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {member.user.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Member Details */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.user.fullName}
                        </h4>
                        <RoleBadge 
                          role={member.role} 
                          groupType={group.type}
                          size="sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {member.user.email}
                        {!member.isActive && (
                          <span className="ml-2 text-red-500">• Inactive</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveMember(member.user.id, member.user.fullName)}
                    disabled={removingMemberId === member.user.id}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Remove ${member.user.fullName} from group`}
                  >
                    {removingMemberId === member.user.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                    ) : (
                      <TrashIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GroupMembersAccordion