// src/components/admin/EventCategoriesManagement.tsx
import React, { useState } from 'react'
import { 
  PlusIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { 
  useGetEventCategoriesQuery,
  useCreateEventCategoryMutation,
  useUpdateEventCategoryMutation,
  useDeleteEventCategoryMutation,
  EventCategory 
} from '@/store/api/eventApi'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import toast from 'react-hot-toast'

const EventCategoriesManagement: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })

  const { data: categoriesData, isLoading } = useGetEventCategoriesQuery()
  const [createCategory, { isLoading: isCreating }] = useCreateEventCategoryMutation()
  const [updateCategory, { isLoading: isUpdating }] = useUpdateEventCategoryMutation()
  const [deleteCategory] = useDeleteEventCategoryMutation()

  const categories = categoriesData?.categories || []

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Category name is required')
      return
    }

    try {
      await createCategory({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      }).unwrap()
      
      toast.success('Category created successfully')
      setIsCreateModalOpen(false)
      setFormData({ name: '', description: '' })
    } catch (error: any) {
      console.error('Create category error:', error)
      toast.error(error?.data?.message || 'Failed to create category')
    }
  }

  const handleUpdate = async () => {
    if (!editingCategory || !formData.name.trim()) {
      toast.error('Category name is required')
      return
    }

    try {
      await updateCategory({
        id: editingCategory.id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      }).unwrap()
      
      toast.success('Category updated successfully')
      setEditingCategory(null)
      setFormData({ name: '', description: '' })
    } catch (error: any) {
      console.error('Update category error:', error)
      toast.error(error?.data?.message || 'Failed to update category')
    }
  }

  const handleDelete = async (category: EventCategory) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteCategory(category.id).unwrap()
      toast.success('Category deleted successfully')
    } catch (error: any) {
      console.error('Delete category error:', error)
      toast.error(error?.data?.message || 'Failed to delete category')
    }
  }

  const handleEdit = (category: EventCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
    })
  }

  const handleCancel = () => {
    setIsCreateModalOpen(false)
    setEditingCategory(null)
    setFormData({ name: '', description: '' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Event Categories
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage event categories for organizing events
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Category
        </button>
      </div>

      {/* Categories List */}
      {categories.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {categories.map((category) => (
              <div key={category.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <FunnelIcon className="w-5 h-5 text-blue-600" />
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {category.name}
                        </h3>
                        {category.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {category.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {category._count?.events || 0} events
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            category.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {category.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(category)}
                      className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Edit category"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete category"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <FunnelIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            No Categories Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first event category to get started
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Create Category
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(isCreateModalOpen || editingCategory) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCancel}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      {editingCategory ? 'Edit Category' : 'Create Category'}
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Name *
                        </label>
                        <input
                          type="text"
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter category name"
                        />
                      </div>
                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Description
                        </label>
                        <textarea
                          id="description"
                          rows={3}
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter category description (optional)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={editingCategory ? handleUpdate : handleCreate}
                  disabled={isCreating || isUpdating}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {isCreating || isUpdating ? (
                    <LoadingSpinner size="sm" />
                  ) : editingCategory ? (
                    'Update'
                  ) : (
                    'Create'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventCategoriesManagement