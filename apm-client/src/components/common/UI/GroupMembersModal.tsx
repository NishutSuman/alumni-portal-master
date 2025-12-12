// src/components/common/UI/GroupMembersModal.tsx
import React, { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react'
import {
  XMarkIcon,
  UsersIcon,
  EnvelopeIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import { Group, useGetGroupQuery, useRemoveGroupMemberMutation } from '@/store/api/groupsApi'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'
import { getApiUrl } from '@/utils/helpers'

interface GroupMembersModalProps {
  isOpen: boolean
  onClose: () => void
  group: Group | null
  showRemoveButton?: boolean
}

const GroupMembersModal: React.FC<GroupMembersModalProps> = ({
  isOpen,
  onClose,
  group,
  showRemoveButton = false,
}) => {
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [removedMemberIds, setRemovedMemberIds] = useState<Set<string>>(new Set())
  const [isModalLoading, setIsModalLoading] = useState(false)

  // Fetch group details with members
  const {
    data: groupDetails,
    isLoading,
    isError,
    refetch,
  } = useGetGroupQuery(
    { groupId: group?.id || '', includeMembers: true },
    { skip: !group?.id || !isOpen }
  )

  const [removeGroupMember] = useRemoveGroupMemberMutation()

  // Filter out removed members for optimistic UI update
  const members = (groupDetails?.members || []).filter(member => 
    !removedMemberIds.has(member.user.id)
  )

  // Reset removed members and set loading when modal opens with new group
  React.useEffect(() => {
    if (isOpen && group?.id) {
      setRemovedMemberIds(new Set())
      // Show loading if we don't have cached data OR if cached data is for a different group
      if (!groupDetails || groupDetails.id !== group.id) {
        setIsModalLoading(true)
      }
    } else if (!isOpen) {
      // Reset loading state when modal closes
      setIsModalLoading(false)
    }
  }, [isOpen, group?.id, groupDetails])

  // Reset modal loading state when data loads for the current group
  React.useEffect(() => {
    if ((groupDetails && groupDetails.id === group?.id) || isError) {
      setIsModalLoading(false)
    }
  }, [groupDetails, isError, group?.id])

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!group || !confirm(`Are you sure you want to remove ${memberName} from ${group.name}?`)) {
      return
    }

    setRemovingMemberId(userId)
    try {
      // Optimistically remove member from UI
      setRemovedMemberIds(prev => new Set(prev).add(userId))
      
      await removeGroupMember({
        groupId: group.id,
        userId,
      }).unwrap()
      
      toast.success(`${memberName} removed from ${group.name}`)
    } catch (error: any) {
      // Revert optimistic update on error
      setRemovedMemberIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
      console.error('Remove member error:', error)
      toast.error(error?.data?.message || 'Failed to remove member')
    } finally {
      setRemovingMemberId(null)
    }
  }

  // Member card component
  const MemberCard: React.FC<{ member: any }> = ({ member }) => {
    const { user: memberUser } = member
    const isRemoving = removingMemberId === memberUser.id
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative group"
      >
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 overflow-hidden border-b-4 border-b-blue-500 dark:border-b-blue-400">
          {/* Role Badge */}
          <div className="absolute top-2 left-2 z-10">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {member.role.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Remove Button */}
          {showRemoveButton && (
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => handleRemoveMember(memberUser.id, memberUser.fullName)}
                disabled={isRemoving}
                className="p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                title="Remove member"
              >
                {isRemoving ? (
                  <div className="w-4 h-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : (
                  <TrashIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          <div className="p-4 text-center h-64 flex flex-col justify-center">
            {/* Profile Image */}
            <div className="flex justify-center mb-3">
              {memberUser.profileImage ? (
                <img
                  src={getApiUrl(`/api/users/profile-picture/${memberUser.id}`)}
                  alt={memberUser.fullName}
                  className="h-16 w-16 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(memberUser.fullName)}&background=3B82F6&color=fff&size=64`
                  }}
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold border-2 border-gray-100 dark:border-gray-700">
                  {memberUser.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
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

            {/* Contact Actions */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <a
                href={`mailto:${memberUser.email || ''}`}
                className="p-2 rounded-full bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-colors"
                title="Email"
              >
                <EnvelopeIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (!group) return null

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-6xl sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <UsersIcon className="w-6 h-6 text-blue-600 mr-3" />
                <div>
                  <DialogTitle as="h3" className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                    {group.name} Members
                  </DialogTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {isLoading || isModalLoading || (!groupDetails && isOpen) || (groupDetails && groupDetails.id !== group?.id) ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="md" />
                </div>
              ) : isError ? (
                <div className="text-center py-12">
                  <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Failed to Load Members
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Unable to load the member list for this group.
                  </p>
                </div>
              ) : members.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {members.map((member) => (
                    <MemberCard key={member.id} member={member} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Members
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    This group doesn't have any members yet.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}

export default GroupMembersModal