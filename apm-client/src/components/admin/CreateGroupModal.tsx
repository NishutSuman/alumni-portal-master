// src/components/admin/CreateGroupModal.tsx
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import {
  XMarkIcon,
  UserGroupIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { useCreateGroupMutation, GroupType } from '@/store/api/groupsApi'
import { getRolesByGroupType } from '@/components/common/UI/RoleBadge'
import toast from 'react-hot-toast'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
}

interface CreateGroupFormData {
  name: string
  type: GroupType
  description: string
  displayOrder: number
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [createGroup, { isLoading }] = useCreateGroupMutation()
  
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateGroupFormData>({
    defaultValues: {
      name: '',
      type: 'COMMITTEE',
      description: '',
      displayOrder: 0,
    },
  })

  const selectedType = watch('type')
  const allowedRoles = getRolesByGroupType(selectedType)

  const groupTypes = [
    { value: 'COMMITTEE' as GroupType, label: 'Committee', description: 'Advisory and decision-making bodies' },
    { value: 'CELL' as GroupType, label: 'Cell', description: 'Specialized working groups' },
    { value: 'OFFICE_BEARERS' as GroupType, label: 'Office Bearers', description: 'Executive leadership team' },
    { value: 'ADVISORS' as GroupType, label: 'Advisors', description: 'Advisory and guidance council' },
  ]

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = async (data: CreateGroupFormData) => {
    try {
      await createGroup({
        name: data.name.trim(),
        type: data.type,
        description: data.description.trim(),
        displayOrder: data.displayOrder || undefined,
      }).unwrap()
      
      toast.success('Group created successfully!')
      handleClose()
    } catch (error: any) {
      console.error('Create group error:', error)
      toast.error(error?.data?.message || 'Failed to create group')
    }
  }

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
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                    >
                      Create New Group
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

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

                  {/* Group Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Group Type *
                    </label>
                    <select
                      {...register('type', { required: 'Group type is required' })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {groupTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    {errors.type && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.type.message}
                      </p>
                    )}
                    
                    {/* Type Description */}
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-start">
                        <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            {groupTypes.find(t => t.value === selectedType)?.description}
                          </p>
                          <div className="mt-2">
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Available Roles:
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
                      placeholder="0"
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

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create Group'
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

export default CreateGroupModal