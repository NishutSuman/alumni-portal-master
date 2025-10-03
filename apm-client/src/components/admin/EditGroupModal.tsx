// src/components/admin/EditGroupModal.tsx
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import {
  XMarkIcon,
  UserGroupIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { 
  useUpdateGroupMutation, 
  useDeleteGroupMutation, 
  Group, 
  GroupType 
} from '@/store/api/groupsApi'
import { getRolesByGroupType } from '@/components/common/UI/RoleBadge'
import toast from 'react-hot-toast'

interface EditGroupModalProps {
  isOpen: boolean
  onClose: () => void
  group: Group | null
}

interface EditGroupFormData {
  name: string
  description: string
  isActive: boolean
  displayOrder: number
}

const EditGroupModal: React.FC<EditGroupModalProps> = ({
  isOpen,
  onClose,
  group,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [updateGroup, { isLoading: isUpdating }] = useUpdateGroupMutation()
  const [deleteGroup, { isLoading: isDeleting }] = useDeleteGroupMutation()
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditGroupFormData>({
    defaultValues: {
      name: '',
      description: '',
      isActive: true,
      displayOrder: 0,
    },
  })

  // Reset form when group changes
  useEffect(() => {
    if (group) {
      reset({
        name: group.name,
        description: group.description || '',
        isActive: group.isActive,
        displayOrder: group.displayOrder,
      })
    }
  }, [group, reset])

  const allowedRoles = group ? getRolesByGroupType(group.type) : []

  const handleClose = () => {
    reset()
    setShowDeleteConfirm(false)
    onClose()
  }

  const onSubmit = async (data: EditGroupFormData) => {
    if (!group) return

    try {
      await updateGroup({
        groupId: group.id,
        data: {
          name: data.name.trim(),
          description: data.description.trim() || undefined,
          isActive: data.isActive,
          displayOrder: data.displayOrder,
        },
      }).unwrap()
      
      toast.success('Group updated successfully!')
      handleClose()
    } catch (error: any) {
      console.error('Update group error:', error)
      toast.error(error?.data?.message || 'Failed to update group')
    }
  }

  const handleDeleteGroup = async () => {
    if (!group) return

    try {
      await deleteGroup(group.id).unwrap()
      toast.success('Group deleted successfully!')
      handleClose()
    } catch (error: any) {
      console.error('Delete group error:', error)
      toast.error(error?.data?.message || 'Failed to delete group')
    }
  }

  if (!group) return null

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                    <UserGroupIcon className="h-6 w-6 text-blue-600 mr-3" />
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                      >
                        Manage Group: {group.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {group.type.replace(/_/g, ' ').toLowerCase()} • {group.membersCount} members
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {!showDeleteConfirm ? (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Group Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Group Name *
                      </label>
                      <input
                        type="text"
                        {...register('name', {
                          required: 'Group name is required',
                          minLength: {
                            value: 2,
                            message: 'Group name must be at least 2 characters',
                          },
                          maxLength: {
                            value: 100,
                            message: 'Group name cannot exceed 100 characters',
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter group name"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    {/* Group Type (Read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Group Type
                      </label>
                      <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                        {group.type.replace(/_/g, ' ')}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Group type cannot be changed after creation
                      </p>
                      
                      {/* Available Roles Info */}
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                          Available Roles for this group type:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {allowedRoles.map((role) => (
                            <span
                              key={role}
                              className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded"
                            >
                              {role.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        {...register('description', {
                          maxLength: {
                            value: 1000,
                            message: 'Description cannot exceed 1000 characters',
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        placeholder="Enter group description (optional)"
                      />
                      {errors.description && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.description.message}
                        </p>
                      )}
                    </div>

                    {/* Display Order */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Display Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        {...register('displayOrder', {
                          min: {
                            value: 0,
                            message: 'Display order must be a non-negative number',
                          },
                          valueAsNumber: true,
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {errors.displayOrder && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.displayOrder.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Lower numbers appear first in listings
                      </p>
                    </div>

                    {/* Active Status */}
                    <div>
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="isActive"
                          {...register('isActive')}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label 
                          htmlFor="isActive" 
                          className="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Active Group
                        </label>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Inactive groups are hidden from public view
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between pt-4">
                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors flex items-center"
                      >
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Delete Group
                      </button>

                      {/* Save/Cancel */}
                      <div className="flex space-x-3">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isUpdating || !isDirty}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center"
                        >
                          {isUpdating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                              Updating...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* Delete Confirmation */
                  <div className="space-y-6">
                    <div className="flex items-center justify-center">
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                        <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Delete Group
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Are you sure you want to delete "<strong>{group.name}</strong>"?
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                        This action cannot be undone. All {group.membersCount} group members will be removed.
                      </p>
                    </div>

                    <div className="flex justify-center space-x-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteGroup}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg transition-colors flex items-center"
                      >
                        {isDeleting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <TrashIcon className="w-4 h-4 mr-2" />
                            Delete Group
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default EditGroupModal