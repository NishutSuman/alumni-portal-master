// src/pages/admin/GroupsManagement.tsx
import React, { useState } from 'react'
import { 
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'
import { useGetGroupsQuery, GroupType, Group } from '@/store/api/groupsApi'
import { useAuth } from '@/hooks/useAuth'
import GroupListCard from '@/components/common/UI/GroupListCard'
import GroupStatsDashboard from '@/components/common/UI/GroupStatsDashboard'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import CreateGroupModal from '@/components/admin/CreateGroupModal'
import AddMembersModal from '@/components/admin/AddMembersModal'
import EditGroupModal from '@/components/admin/EditGroupModal'
import GroupMembersModal from '@/components/common/UI/GroupMembersModal'

const GroupsManagement: React.FC = () => {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<GroupType | 'ALL'>('ALL')
  const [showInactive, setShowInactive] = useState(false)
  const [activeTab, setActiveTab] = useState<'groups' | 'statistics'>('groups')
  
  // Modal states
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false)
  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false)
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false)
  const [isViewMembersModalOpen, setIsViewMembersModalOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  
  // Fetch groups with current filters
  const {
    data: groupsData,
    isLoading,
    isError,
    error,
  } = useGetGroupsQuery({
    search: searchTerm,
    type: selectedType === 'ALL' ? undefined : selectedType,
    isActive: showInactive ? undefined : true,
    limit: 50,
  })

  const groups = groupsData?.groups || []
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // Filter options
  const typeOptions: { value: GroupType | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'All Groups' },
    { value: 'CELL', label: 'Cells' },
    { value: 'COMMITTEE', label: 'Committees' },
    { value: 'OFFICE_BEARERS', label: 'Office Bearers' },
    { value: 'ADVISORS', label: 'Advisors' },
  ]

  const handleGroupView = (group: Group) => {
    console.log('View group details:', group)
    // TODO: Navigate to group detail page or show modal
  }

  const handleGroupEdit = (group: Group) => {
    setSelectedGroup(group)
    setIsEditGroupModalOpen(true)
  }

  const handleCreateGroup = () => {
    setIsCreateGroupModalOpen(true)
  }

  const handleAddMembers = (group: Group) => {
    setSelectedGroup(group)
    setIsAddMembersModalOpen(true)
  }

  const handleViewMembers = (group: Group) => {
    setSelectedGroup(group)
    setIsViewMembersModalOpen(true)
  }

  const handleCloseCreateGroupModal = () => {
    setIsCreateGroupModalOpen(false)
  }

  const handleCloseAddMembersModal = () => {
    setIsAddMembersModalOpen(false)
    setSelectedGroup(null)
  }

  const handleCloseEditGroupModal = () => {
    setIsEditGroupModalOpen(false)
    setSelectedGroup(null)
  }

  const handleCloseViewMembersModal = () => {
    setIsViewMembersModalOpen(false)
    setSelectedGroup(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError) {
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
              Groups Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage organization groups, committees, and member assignments
            </p>
          </div>
          
          {/* Create Group Button (Super Admin Only) */}
          {isSuperAdmin && (
            <button
              onClick={handleCreateGroup}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Group
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('groups')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'groups'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center">
              <UserGroupIcon className="w-5 h-5 mr-2" />
              Groups ({groups.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'statistics'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center">
              <ChartBarIcon className="w-5 h-5 mr-2" />
              Statistics
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'groups' && (
        <>
          {/* Filters and Search */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search groups..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div className="sm:w-48">
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as GroupType | 'ALL')}
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show Inactive Toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showInactive"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                <label 
                  htmlFor="showInactive" 
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Show inactive
                </label>
              </div>
            </div>
          </div>

          {/* Groups Grid */}
          {groups.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" style={{ gridAutoRows: 'auto' }}>
              {groups.map((group) => (
                <GroupListCard
                  key={group.id}
                  group={group}
                  onView={handleGroupView}
                  onEdit={isSuperAdmin ? handleGroupEdit : undefined}
                  onAddMembers={isSuperAdmin ? handleAddMembers : undefined}
                  onViewMembers={handleViewMembers}
                  showActions={isSuperAdmin}
                  showViewButton={!isSuperAdmin}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                No Groups Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm || selectedType !== 'ALL' || showInactive
                  ? 'Try adjusting your search or filters'
                  : 'No groups are currently available'
                }
              </p>
              {isSuperAdmin && !searchTerm && selectedType === 'ALL' && (
                <button
                  onClick={handleCreateGroup}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Create Your First Group
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Statistics Tab */}
      {activeTab === 'statistics' && (
        <GroupStatsDashboard />
      )}

      
      {/* Modals */}
      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={handleCloseCreateGroupModal}
      />
      
      <EditGroupModal
        isOpen={isEditGroupModalOpen}
        onClose={handleCloseEditGroupModal}
        group={selectedGroup}
      />
      
      {selectedGroup && (
        <AddMembersModal
          isOpen={isAddMembersModalOpen}
          onClose={handleCloseAddMembersModal}
          group={selectedGroup}
        />
      )}

      <GroupMembersModal
        isOpen={isViewMembersModalOpen}
        onClose={handleCloseViewMembersModal}
        group={selectedGroup}
        showRemoveButton={isSuperAdmin}
      />
    </div>
  )
}

export default GroupsManagement