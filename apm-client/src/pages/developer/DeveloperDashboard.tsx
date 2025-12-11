// src/pages/developer/DeveloperDashboard.tsx
// Developer Portal Dashboard - Multi-tenant management

import { useState } from 'react'
import {
  useGetDeveloperDashboardQuery,
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

// Subscription status badge colors
const statusColors: Record<string, string> = {
  TRIAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  SUSPENDED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
}

export default function DeveloperDashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Queries
  const { data: dashboard, isLoading: dashboardLoading, error: dashboardError } = useGetDeveloperDashboardQuery()
  const { data: orgsData, isLoading: orgsLoading, error: orgsError } = useGetDeveloperOrganizationsQuery({
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
        tenantCode: formData.get('tenantCode') as string,
        officialEmail: formData.get('officialEmail') as string,
        foundationYear: parseInt(formData.get('foundationYear') as string),
        subscriptionDays: parseInt(formData.get('subscriptionDays') as string) || 30,
        maxUsers: parseInt(formData.get('maxUsers') as string) || 500,
      }).unwrap()
      setShowCreateModal(false)
    } catch (error) {
      console.error('Failed to create organization:', error)
    }
  }

  if (dashboardLoading || orgsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (dashboardError || orgsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-red-500 text-lg mb-4">Failed to load developer dashboard</div>
        <div className="text-gray-500 text-sm mb-4 max-w-lg text-center">
          {dashboardError && <div>Dashboard Error: {JSON.stringify(dashboardError)}</div>}
          {orgsError && <div>Orgs Error: {JSON.stringify(orgsError)}</div>}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Reload Page
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Developer Portal
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage multi-tenant organizations and subscriptions
          </p>
        </div>

        {/* Dashboard Stats */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-blue-600">
                {dashboard.organizations.total}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Total Organizations
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-green-600">
                {dashboard.organizations.active}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Active Organizations
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-orange-600">
                {dashboard.organizations.inMaintenance}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                In Maintenance
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-purple-600">
                {dashboard.systemTotals.users}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Total Users
              </div>
            </div>
          </div>
        )}

        {/* Subscription Breakdown */}
        {dashboard?.subscriptions && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Subscription Status Breakdown
            </h2>
            <div className="flex flex-wrap gap-4">
              {Object.entries(dashboard.subscriptions).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[status]}`}>
                    {status}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organizations List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Organizations
              </h2>
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Status</option>
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + New Organization
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tenant Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {Array.isArray(orgsData?.data) && orgsData.data.map((org) => {
                  const logoUrl = getOrgLogoUrl(org)
                  return (
                  <tr key={org.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          {logoUrl ? (
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={logoUrl}
                              alt={org.name}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                                const fallback = (e.target as HTMLImageElement).nextElementSibling
                                if (fallback) (fallback as HTMLElement).style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <div className={`h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 items-center justify-center ${logoUrl ? 'hidden' : 'flex'}`}>
                            <span className="text-blue-600 dark:text-blue-300 font-semibold">
                              {org.shortName.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                            {org.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {org.officialEmail}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                        {org.tenantCode}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[org.subscriptionStatus]}`}>
                        {org.subscriptionStatus}
                      </span>
                      {org.isMaintenanceMode && (
                        <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                          Maintenance
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {org._count?.users || 0} / {org.maxUsers}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {org.subscriptionEndsAt
                        ? new Date(org.subscriptionEndsAt).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            toggleMaintenance({
                              orgId: org.id,
                              isMaintenanceMode: !org.isMaintenanceMode,
                            })
                          }
                          className={`px-3 py-1 rounded text-xs ${
                            org.isMaintenanceMode
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                          }`}
                        >
                          {org.isMaintenanceMode ? 'Enable' : 'Maintenance'}
                        </button>
                        <button
                          onClick={() =>
                            updateSubscription({
                              orgId: org.id,
                              subscriptionDays: 30,
                              subscriptionStatus: 'ACTIVE',
                            })
                          }
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200"
                        >
                          +30 Days
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Organization Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowCreateModal(false)} />
              <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Create New Organization
                </h3>
                <form onSubmit={handleCreateOrganization} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tenant Code * (e.g., SCHOOL-ABC)
                    </label>
                    <input
                      type="text"
                      name="tenantCode"
                      required
                      pattern="[A-Za-z0-9-]+"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Official Email *
                      </label>
                      <input
                        type="email"
                        name="officialEmail"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
