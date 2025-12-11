// src/pages/developer/OrganizationsPage.tsx
// Organizations Management Page for Developer Portal - Card View

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  useGetDeveloperOrganizationsQuery,
  useCreateOrganizationMutation,
  useToggleMaintenanceModeMutation,
  useUpdateSubscriptionMutation,
  type Organization,
} from '@/store/api/developerApi'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import { getApiBaseUrl } from '@/config/organizations'

// Helper to construct full logo URL - use proxy endpoint for R2 files
const getOrgLogoUrl = (org: Organization): string | null => {
  // If org has a logo, use the proxy endpoint (works with R2)
  if (org.logoUrl) {
    const baseUrl = getApiBaseUrl()
    const serverUrl = baseUrl.replace(/\/api$/, '')
    return `${serverUrl}/api/organizations/${org.id}/files/logo`
  }
  return null
}
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
  XMarkIcon,
  UsersIcon,
  CalendarIcon,
  WrenchScrewdriverIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

// Subscription status badge colors
const statusColors: Record<string, string> = {
  TRIAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  SUSPENDED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
}

// Status dot colors for cards
const statusDotColors: Record<string, string> = {
  TRIAL: 'bg-yellow-500',
  ACTIVE: 'bg-green-500',
  EXPIRED: 'bg-red-500',
  SUSPENDED: 'bg-gray-500',
}

export default function OrganizationsPage() {
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Queries
  const { data: orgsData, isLoading, error, refetch } = useGetDeveloperOrganizationsQuery({
    search: searchQuery || undefined,
    status: statusFilter || undefined,
    limit: 50,
  })


  // Mutations
  const [createOrganization, { isLoading: creating }] = useCreateOrganizationMutation()
  const [toggleMaintenance] = useToggleMaintenanceModeMutation()
  const [updateSubscription] = useUpdateSubscriptionMutation()

  // Create organization handler
  const handleCreateOrganization = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    try {
      await createOrganization({
        name: formData.get('name') as string,
        shortName: formData.get('shortName') as string,
        tenantCode: (formData.get('tenantCode') as string).toUpperCase(),
        officialEmail: formData.get('officialEmail') as string,
        foundationYear: parseInt(formData.get('foundationYear') as string),
        subscriptionDays: parseInt(formData.get('subscriptionDays') as string) || 30,
        maxUsers: parseInt(formData.get('maxUsers') as string) || 500,
      }).unwrap()

      toast.success('Organization created successfully!')
      setShowCreateModal(false)
      refetch()
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create organization')
      console.error('Failed to create organization:', error)
    }
  }

  // Toggle maintenance handler
  const handleToggleMaintenance = async (e: React.MouseEvent, orgId: string, currentStatus: boolean) => {
    e.stopPropagation()
    try {
      await toggleMaintenance({
        orgId,
        isMaintenanceMode: !currentStatus,
      }).unwrap()
      toast.success(currentStatus ? 'Maintenance mode disabled' : 'Maintenance mode enabled')
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to toggle maintenance mode')
    }
  }

  // Extend subscription handler
  const handleExtendSubscription = async (e: React.MouseEvent, orgId: string) => {
    e.stopPropagation()
    try {
      await updateSubscription({
        orgId,
        subscriptionDays: 30,
        subscriptionStatus: 'ACTIVE',
      }).unwrap()
      toast.success('Subscription extended by 30 days')
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to extend subscription')
    }
  }

  // Navigate to org details
  const handleCardClick = (orgId: string) => {
    navigate(`/developer/organizations/${orgId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="text-red-500 text-lg mb-4">Failed to load organizations</div>
        <div className="text-gray-500 text-sm mb-4">
          {JSON.stringify(error)}
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Organizations
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Manage tenant organizations and their subscriptions
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Organization
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {/* Organizations Grid */}
        {!Array.isArray(orgsData?.data) || orgsData.data.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <BuildingOffice2Icon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No organizations yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Create your first tenant organization to get started
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Organization
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(orgsData?.data) && orgsData.data.map((org) => {
              const logoUrl = getOrgLogoUrl(org)
              return (
              <div
                key={org.id}
                onClick={() => handleCardClick(org.id)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 cursor-pointer group overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      {/* Logo */}
                      <div className="flex-shrink-0">
                        {logoUrl ? (
                          <img
                            className="h-14 w-14 rounded-lg object-cover shadow-sm"
                            src={logoUrl}
                            alt={org.name}
                            onError={(e) => {
                              // Hide broken image
                              (e.target as HTMLImageElement).style.display = 'none'
                              const fallback = (e.target as HTMLImageElement).nextElementSibling
                              if (fallback) (fallback as HTMLElement).style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div
                          className={`h-14 w-14 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 items-center justify-center shadow-sm ${logoUrl ? 'hidden' : 'flex'}`}
                        >
                          <span className="text-xl font-bold text-white">
                            {org.shortName.charAt(0)}
                          </span>
                        </div>
                      </div>
                      {/* Name and Code */}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {org.name}
                        </h3>
                        <code className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono text-gray-600 dark:text-gray-400">
                          {org.tenantCode}
                        </code>
                      </div>
                    </div>
                    {/* Arrow indicator */}
                    <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[org.subscriptionStatus]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusDotColors[org.subscriptionStatus]}`}></span>
                      {org.subscriptionStatus}
                    </span>
                    {org.isMaintenanceMode && (
                      <span className="inline-flex items-center px-2.5 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded-full text-xs font-medium">
                        <WrenchScrewdriverIcon className="h-3 w-3 mr-1" />
                        Maintenance
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <UsersIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>
                        <span className="font-medium text-gray-900 dark:text-white">{org._count?.users || 0}</span>
                        <span className="text-gray-400"> / {org.maxUsers}</span>
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>
                        {org.subscriptionEndsAt
                          ? new Date(org.subscriptionEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'No expiry'}
                      </span>
                    </div>
                  </div>

                  {/* Email */}
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-4">
                    {org.officialEmail}
                  </p>

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={(e) => handleToggleMaintenance(e, org.id, org.isMaintenanceMode)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        org.isMaintenanceMode
                          ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-200 dark:hover:bg-green-900'
                          : 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:hover:bg-orange-900'
                      }`}
                    >
                      {org.isMaintenanceMode ? 'Enable' : 'Maintenance'}
                    </button>
                    <button
                      onClick={(e) => handleExtendSubscription(e, org.id)}
                      className="flex-1 px-3 py-2 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900 rounded-lg text-xs font-medium transition-colors"
                    >
                      +30 Days
                    </button>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}

        {/* Create Organization Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowCreateModal(false)}
              />
              <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Create New Organization
                  </h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateOrganization} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g., ABC School Alumni"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Short Name *
                    </label>
                    <input
                      type="text"
                      name="shortName"
                      required
                      placeholder="e.g., ABC"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tenant Code * <span className="text-xs text-gray-500">(e.g., SCHOOL-ABC)</span>
                    </label>
                    <input
                      type="text"
                      name="tenantCode"
                      required
                      pattern="[A-Za-z0-9-]+"
                      placeholder="SCHOOL-ABC"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Official Email *
                    </label>
                    <input
                      type="email"
                      name="officialEmail"
                      required
                      placeholder="admin@school.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Foundation Year *
                    </label>
                    <input
                      type="number"
                      name="foundationYear"
                      required
                      min={1800}
                      max={new Date().getFullYear()}
                      defaultValue={new Date().getFullYear()}
                      placeholder="e.g., 1995"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trial Days
                      </label>
                      <input
                        type="number"
                        name="subscriptionDays"
                        defaultValue={30}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Max Users
                      </label>
                      <input
                        type="number"
                        name="maxUsers"
                        defaultValue={500}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {creating ? 'Creating...' : 'Create Organization'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
