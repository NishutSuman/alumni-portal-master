// src/components/admin/AddMembersModal.tsx
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import {
  XMarkIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { useSearchAlumniQuery } from '@/store/api/alumniApi'
import { useAddGroupMemberMutation, Group, GroupMemberRole } from '@/store/api/groupsApi'
import { getRolesByGroupType } from '@/components/common/UI/RoleBadge'
import toast from 'react-hot-toast'
import { getApiUrl } from '@/utils/helpers'

interface AddMembersModalProps {
  isOpen: boolean
  onClose: () => void
  group: Group
}

interface AddMemberFormData {
  userId: string
  role: GroupMemberRole
}

const AddMembersModal: React.FC<AddMembersModalProps> = ({
  isOpen,
  onClose,
  group,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  
  const [addMember, { isLoading: isAddingMember }] = useAddGroupMemberMutation()
  
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AddMemberFormData>({
    defaultValues: {
      userId: '',
      role: getRolesByGroupType(group.type)[0], // Default to first allowed role
    },
  })

  // Search for users
  const { data: searchResults, isLoading: isSearching } = useSearchAlumniQuery(
    {
      search: searchTerm,
      limit: 20,
      sortBy: 'fullName',
      sortOrder: 'asc',
    },
    {
      skip: searchTerm.length < 2, // Only search when we have at least 2 characters
    }
  )

  const allowedRoles = getRolesByGroupType(group.type)
  const selectedRole = watch('role')

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset()
      setSearchTerm('')
      setSelectedUser(null)
    }
  }, [isOpen, reset])

  const handleUserSelect = (user: any) => {
    setSelectedUser(user)
    setValue('userId', user.id)
    setSearchTerm(user.fullName) // Update search to show selected user
  }

  const onSubmit = async (data: AddMemberFormData) => {
    try {
      console.log('Adding member with data:', {
        groupId: group.id,
        groupIdLength: group.id.length,
        groupIdType: typeof group.id,
        isValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(group.id),
        data: {
          userId: data.userId,
          userIdLength: data.userId.length,
          userIdType: typeof data.userId,
          isValidUserUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.userId),
          role: data.role,
        },
      })
      
      const result = await addMember({
        groupId: group.id,
        data: {
          userId: data.userId,
          role: data.role,
        },
      }).unwrap()
      
      console.log('Add member success:', result)
      toast.success(`${selectedUser?.fullName} added to ${group.name}`)
      onClose()
    } catch (error: any) {
      console.error('Add member error:', error)
      console.error('Full error object:', JSON.stringify(error, null, 2))
      console.error('Error status:', error?.status)
      console.error('Error data:', error?.data)
      
      const errorMessage = error?.data?.message || error?.message || 'Failed to add member'
      toast.error(errorMessage)
    }
  }

  const roleOptions = allowedRoles.map(role => ({
    value: role,
    label: role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: getRoleDescription(role, group.type),
  }))

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <UserPlusIcon className="h-6 w-6 text-blue-600 mr-3" />
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                      >
                        Add Member to {group.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {group.type.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* User Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Search Alumni *
                    </label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value)
                          if (e.target.value !== selectedUser?.fullName) {
                            setSelectedUser(null)
                            setValue('userId', '')
                          }
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Type to search alumni..."
                      />
                    </div>

                    {/* Search Results */}
                    {searchTerm.length >= 2 && !selectedUser && (
                      <div className="mt-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                        {isSearching ? (
                          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                            Searching...
                          </div>
                        ) : searchResults?.data?.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                            No alumni found
                          </div>
                        ) : (
                          searchResults?.data?.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => handleUserSelect(user)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                            >
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  {user.profileImage ? (
                                    <img
                                      src={getApiUrl(`/api/users/profile-picture/${user.id}`)}
                                      alt={user.fullName}
                                      className="w-10 h-10 rounded-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                        const fallback = target.parentElement?.querySelector('.fallback-avatar') as HTMLElement
                                        if (fallback) fallback.style.display = 'flex'
                                      }}
                                    />
                                  ) : null}
                                  <div className={`fallback-avatar w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center ${user.profileImage ? 'hidden' : ''}`} style={{ display: user.profileImage ? 'none' : 'flex' }}>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {user.fullName.charAt(0)}
                                    </span>
                                  </div>
                                </div>
                                <div className="ml-3 flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {user.fullName}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Batch {user.batch} {user.email && `• ${user.email}`}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* Selected User */}
                    {selectedUser && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            {selectedUser.profileImage ? (
                              <img
                                src={getApiUrl(`/api/users/profile-picture/${selectedUser.id}`)}
                                alt={selectedUser.fullName}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const fallback = target.parentElement?.querySelector('.fallback-avatar') as HTMLElement
                                  if (fallback) fallback.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            <div className={`fallback-avatar w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center ${selectedUser.profileImage ? 'hidden' : ''}`} style={{ display: selectedUser.profileImage ? 'none' : 'flex' }}>
                              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                {selectedUser.fullName.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                              {selectedUser.fullName}
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              Batch {selectedUser.batch} {selectedUser.email && `• ${selectedUser.email}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(null)
                              setValue('userId', '')
                              setSearchTerm('')
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {errors.userId && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        Please select a user
                      </p>
                    )}
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Assign Role *
                    </label>
                    <select
                      {...register('role', { required: 'Please select a role' })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {/* Role Description */}
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-start">
                        <InformationCircleIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {roleOptions.find(r => r.value === selectedRole)?.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {errors.role && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.role.message}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isAddingMember || !selectedUser}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center"
                    >
                      {isAddingMember ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <UserPlusIcon className="h-4 w-4 mr-2" />
                          Add Member
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

// Helper function to get role descriptions
function getRoleDescription(role: GroupMemberRole, groupType: string): string {
  const descriptions: Record<GroupMemberRole, string> = {
    // Cell/Committee roles
    'CONVENER': 'Leads the group and coordinates activities',
    'CO_CONVENER': 'Assists the convener and acts as deputy',
    'STAKE_HOLDER': 'Key contributor with significant involvement',
    
    // Office Bearer roles
    'PRESIDENT': 'Chief executive officer of the organization',
    'VICE_PRESIDENT': 'Deputy to the president',
    'SECRETARY': 'Maintains records and handles correspondence',
    'JOINT_SECRETARY': 'Assists the secretary',
    'TREASURER': 'Manages finances and treasury',
    'JOINT_TREASURER': 'Assists the treasurer',
    
    // Advisor roles
    'CHIEF_ADVISOR': 'Senior advisor providing strategic guidance',
    'JOINT_ADVISOR': 'Supporting advisor role',
  }
  
  return descriptions[role] || 'Group member role'
}

export default AddMembersModal