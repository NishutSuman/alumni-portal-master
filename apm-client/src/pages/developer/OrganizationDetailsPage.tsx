// src/pages/developer/OrganizationDetailsPage.tsx
// Organization Details & Edit Page for Developer Portal - Tabbed Interface

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  useGetOrganizationByIdQuery,
  useUpdateOrganizationMutation,
  useToggleMaintenanceModeMutation,
  useUpdateSubscriptionMutation,
  useGetOrganizationStatsQuery,
  // Email configuration hooks
  useGetOrganizationEmailConfigQuery,
  useSaveOrganizationEmailConfigMutation,
  useTestOrganizationEmailConfigMutation,
  useActivateOrganizationEmailConfigMutation,
  useDeactivateOrganizationEmailConfigMutation,
  useDeleteOrganizationEmailConfigMutation,
  useGetOrganizationEmailStatsQuery,
  // Types
  type EmailProvider,
} from '@/store/api/developerApi'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import { getApiUrl } from '@/utils/helpers'
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  UsersIcon,
  CalendarIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  WrenchScrewdriverIcon,
  ChartBarIcon,
  DocumentTextIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  TicketIcon,
  CurrencyRupeeIcon,
  UserGroupIcon,
  InformationCircleIcon,
  ClockIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  ArrowUpTrayIcon,
  DocumentIcon,
  TrashIcon,
  EyeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'

// Subscription status badge colors
const statusColors: Record<string, string> = {
  TRIAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  SUSPENDED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
}

// Tab definitions
const tabs = [
  { id: 'basic', name: 'Basic Info', icon: InformationCircleIcon },
  { id: 'subscription', name: 'Subscription', icon: CreditCardIcon },
  { id: 'users', name: 'Users', icon: UsersIcon },
  { id: 'statistics', name: 'Statistics', icon: ChartBarIcon },
  { id: 'activity', name: 'Activity Log', icon: ClockIcon },
  { id: 'email', name: 'Email Config', icon: EnvelopeIcon },
  { id: 'settings', name: 'Settings', icon: Cog6ToothIcon },
]

interface FormData {
  name: string
  shortName: string
  officialEmail: string
  officialContactNumber: string
  officeAddress: string
  foundationYear: number
  description: string
  mission: string
  vision: string
  maxUsers: number
  storageQuotaMB: number
}

// Helper to get proxy URL for organization files (logo, bylaw, certificate)
// Uses the backend proxy route instead of direct R2 URLs since R2 bucket is private
const getOrgFileProxyUrl = (orgId: string, fileType: 'logo' | 'bylaw' | 'certificate') => {
  return getApiUrl(`/api/organizations/${orgId}/files/${fileType}`)
}

export default function OrganizationDetailsPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('basic')
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    shortName: '',
    officialEmail: '',
    officialContactNumber: '',
    officeAddress: '',
    foundationYear: new Date().getFullYear(),
    description: '',
    mission: '',
    vision: '',
    maxUsers: 500,
    storageQuotaMB: 5000,
  })

  // Queries
  const { data: org, isLoading, error, refetch } = useGetOrganizationByIdQuery(orgId!, {
    skip: !orgId,
  })
  const { data: stats } = useGetOrganizationStatsQuery(orgId!, {
    skip: !orgId,
  })

  // Mutations
  const [updateOrganization, { isLoading: updating }] = useUpdateOrganizationMutation()
  const [toggleMaintenance, { isLoading: togglingMaintenance }] = useToggleMaintenanceModeMutation()
  const [updateSubscription, { isLoading: updatingSubscription }] = useUpdateSubscriptionMutation()

  // Populate form when org data loads
  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || '',
        shortName: org.shortName || '',
        officialEmail: org.officialEmail || '',
        officialContactNumber: org.officialContactNumber || '',
        officeAddress: org.officeAddress || '',
        foundationYear: org.foundationYear || new Date().getFullYear(),
        description: org.description || '',
        mission: org.mission || '',
        vision: org.vision || '',
        maxUsers: org.maxUsers || 500,
        storageQuotaMB: org.storageQuotaMB || 5000,
      })
    }
  }, [org])

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  // Save changes
  const handleSave = async () => {
    if (!orgId) return

    try {
      await updateOrganization({
        orgId,
        data: formData,
      }).unwrap()
      toast.success('Organization updated successfully!')
      setIsEditing(false)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update organization')
    }
  }

  // Cancel editing
  const handleCancel = () => {
    if (org) {
      setFormData({
        name: org.name || '',
        shortName: org.shortName || '',
        officialEmail: org.officialEmail || '',
        officialContactNumber: org.officialContactNumber || '',
        officeAddress: org.officeAddress || '',
        foundationYear: org.foundationYear || new Date().getFullYear(),
        description: org.description || '',
        mission: org.mission || '',
        vision: org.vision || '',
        maxUsers: org.maxUsers || 500,
        storageQuotaMB: org.storageQuotaMB || 5000,
      })
    }
    setIsEditing(false)
  }

  // Toggle maintenance mode
  const handleToggleMaintenance = async () => {
    if (!orgId || !org) return

    try {
      await toggleMaintenance({
        orgId,
        isMaintenanceMode: !org.isMaintenanceMode,
      }).unwrap()
      toast.success(org.isMaintenanceMode ? 'Maintenance mode disabled' : 'Maintenance mode enabled')
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to toggle maintenance mode')
    }
  }

  // Extend subscription
  const handleExtendSubscription = async (days: number) => {
    if (!orgId) return

    try {
      await updateSubscription({
        orgId,
        subscriptionDays: days,
        subscriptionStatus: 'ACTIVE',
      }).unwrap()
      toast.success(`Subscription extended by ${days} days`)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to extend subscription')
    }
  }

  // Change subscription status
  const handleChangeStatus = async (status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED') => {
    if (!orgId) return

    try {
      await updateSubscription({
        orgId,
        subscriptionStatus: status,
      }).unwrap()
      toast.success(`Status changed to ${status}`)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to change status')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <BuildingOffice2Icon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Organization not found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              The organization you're looking for doesn't exist or you don't have access to it.
            </p>
            <button
              onClick={() => navigate('/developer/organizations')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Organizations
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return <BasicInfoTab org={org} refetch={refetch} />
      case 'subscription':
        return (
          <SubscriptionTab
            org={org}
            handleExtendSubscription={handleExtendSubscription}
            handleChangeStatus={handleChangeStatus}
            handleToggleMaintenance={handleToggleMaintenance}
            updatingSubscription={updatingSubscription}
            togglingMaintenance={togglingMaintenance}
          />
        )
      case 'users':
        return <UsersTab org={org} />
      case 'statistics':
        return <StatisticsTab org={org} stats={stats} />
      case 'activity':
        return <ActivityLogTab org={org} />
      case 'email':
        return <EmailConfigTab orgId={org.id} orgName={org.name} />
      case 'settings':
        return (
          <SettingsTab
            org={org}
            formData={formData}
            isEditing={isEditing}
            handleInputChange={handleInputChange}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        {/* Organization Header */}
        <div className="px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/developer/organizations')}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-4">
                {org.logoUrl ? (
                  <img
                    className="h-12 w-12 rounded-xl object-cover shadow-sm"
                    src={getOrgFileProxyUrl(org.id, 'logo')}
                    alt={org.name}
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <span className="text-lg font-bold text-white">
                      {org.shortName.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                      {org.name}
                    </h1>
                    <code className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono text-gray-600 dark:text-gray-400">
                      {org.tenantCode}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[org.subscriptionStatus]}`}>
                      {org.subscriptionStatus}
                    </span>
                    {org.isMaintenanceMode && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded-full text-xs font-medium">
                        Maintenance
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {org._count?.users || 0} users
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Edit/Save buttons */}
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1.5" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updating}
                    className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <CheckIcon className="h-4 w-4 mr-1.5" />
                    {updating ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PencilIcon className="h-4 w-4 mr-1.5" />
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex space-x-2 overflow-x-auto pb-px" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 text-base font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}

// Basic Info Tab Component - READ-ONLY view with Logo upload only
function BasicInfoTab({ org, refetch }: any) {
  const { auth } = useAuth()
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [isSavingDetails, setIsSavingDetails] = useState(false)
  const [detailsForm, setDetailsForm] = useState({
    name: org?.name || '',
    shortName: org?.shortName || '',
    officialEmail: org?.officialEmail || '',
    officialContactNumber: org?.officialContactNumber || '',
    foundationYear: org?.foundationYear || new Date().getFullYear(),
    officeAddress: org?.officeAddress || '',
  })

  // Update form when org changes
  useEffect(() => {
    if (org) {
      setDetailsForm({
        name: org.name || '',
        shortName: org.shortName || '',
        officialEmail: org.officialEmail || '',
        officialContactNumber: org.officialContactNumber || '',
        foundationYear: org.foundationYear || new Date().getFullYear(),
        officeAddress: org.officeAddress || '',
      })
    }
  }, [org])

  // Use relative URL to leverage Vite proxy (proxies /api to http://localhost:3000)
  // const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  // Save organization details
  const handleSaveDetails = async () => {
    setIsSavingDetails(true)
    try {
      const response = await fetch(`/api/developer/organizations/${org.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${auth?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(detailsForm)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Update failed')
      }

      if (refetch) await refetch()
      setIsEditingDetails(false)
      toast.success('Organization details updated successfully!')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update organization details')
    } finally {
      setIsSavingDetails(false)
    }
  }

  // Cancel editing details
  const handleCancelEditDetails = () => {
    setDetailsForm({
      name: org?.name || '',
      shortName: org?.shortName || '',
      officialEmail: org?.officialEmail || '',
      officialContactNumber: org?.officialContactNumber || '',
      foundationYear: org?.foundationYear || new Date().getFullYear(),
      officeAddress: org?.officeAddress || '',
    })
    setIsEditingDetails(false)
  }

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!logoFile) return

    if (!org?.id) {
      toast.error('Organization ID not available')
      return
    }

    setIsUploading(true)

    // Use direct URL to backend for file uploads (Vite proxy has issues with multipart/form-data)
    const uploadUrl = getApiUrl(`/api/developer/organizations/${org.id}/upload`)

    try {
      const formData = new FormData()
      formData.append('logoFile', logoFile)

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth?.token}`,
        },
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed')
      }

      setLogoFile(null)
      if (refetch) await refetch()
      toast.success('Logo uploaded successfully!')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload logo')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle logo delete
  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to delete the logo? This action cannot be undone.')) {
      return
    }

    setIsUploading(true)

    try {
      // Use direct URL to backend for file operations
      const response = await fetch(getApiUrl(`/api/developer/organizations/${org.id}/files/logo`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth?.token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Delete failed')
      }

      if (refetch) await refetch()
      toast.success('Logo deleted successfully!')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete logo')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              As a Developer, you can edit the organization logo and basic details (name, contact info, etc.).
              About section, messages, and documents are managed by the organization's Super Admin.
            </p>
          </div>
        </div>
      </div>

      {/* Organization Logo & Basic Details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PhotoIcon className="h-5 w-5 text-blue-500" />
            Organization Logo & Details
            <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
              Editable
            </span>
          </h2>
          {!isEditingDetails ? (
            <button
              onClick={() => setIsEditingDetails(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
              Edit Details
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEditDetails}
                disabled={isSavingDetails}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleSaveDetails}
                disabled={isSavingDetails}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSavingDetails ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Logo Section - Editable */}
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Organization Logo
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                  Editable
                </span>
              </label>
              <div className="w-48 h-48 relative">
                {org.logoUrl ? (
                  <div className="relative group">
                    <img
                      src={getOrgFileProxyUrl(org.id, 'logo')}
                      alt={org.name}
                      className="w-48 h-48 object-cover rounded-xl border-2 border-gray-200 dark:border-gray-600 shadow-sm"
                      onError={(e) => {
                        e.currentTarget.src = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3f4f6"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="24">${org.shortName?.charAt(0) || 'O'}</text></svg>`)}`;
                      }}
                    />
                    {/* Hover overlay with actions */}
                    <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="p-2 bg-white rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                        <ArrowUpTrayIcon className="h-5 w-5 text-gray-700" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) setLogoFile(file)
                          }}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={handleDeleteLogo}
                        disabled={isUploading}
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="w-48 h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <PhotoIcon className="h-12 w-12 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Upload Logo</span>
                    <span className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setLogoFile(file)
                      }}
                      className="hidden"
                    />
                  </label>
                )}
                {/* Show selected file name and upload button */}
                {logoFile && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {logoFile.name}
                    </p>
                    <button
                      onClick={handleLogoUpload}
                      disabled={isUploading}
                      className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <ArrowUpTrayIcon className="h-4 w-4" />
                          Upload Logo
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Basic Details Grid - Editable */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Organization Name
                </label>
                {isEditingDetails ? (
                  <input
                    type="text"
                    value={detailsForm.name}
                    onChange={(e) => setDetailsForm({ ...detailsForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white py-2.5 px-1 font-medium">{org.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Short Name
                </label>
                {isEditingDetails ? (
                  <input
                    type="text"
                    value={detailsForm.shortName}
                    onChange={(e) => setDetailsForm({ ...detailsForm, shortName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white py-2.5 px-1 font-medium">{org.shortName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <EnvelopeIcon className="h-4 w-4" />
                  Official Email
                </label>
                {isEditingDetails ? (
                  <input
                    type="email"
                    value={detailsForm.officialEmail}
                    onChange={(e) => setDetailsForm({ ...detailsForm, officialEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white py-2.5 px-1">{org.officialEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <PhoneIcon className="h-4 w-4" />
                  Contact Number
                </label>
                {isEditingDetails ? (
                  <input
                    type="tel"
                    value={detailsForm.officialContactNumber}
                    onChange={(e) => setDetailsForm({ ...detailsForm, officialContactNumber: e.target.value })}
                    placeholder="Enter contact number"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white py-2.5 px-1">
                    {org.officialContactNumber || <span className="text-gray-400 italic">Not set</span>}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4" />
                  Foundation Year
                </label>
                {isEditingDetails ? (
                  <input
                    type="number"
                    value={detailsForm.foundationYear}
                    onChange={(e) => setDetailsForm({ ...detailsForm, foundationYear: parseInt(e.target.value) || new Date().getFullYear() })}
                    min="1800"
                    max={new Date().getFullYear()}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white py-2.5 px-1 font-medium">{org.foundationYear}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Tenant Code
                  <span className="ml-2 text-xs text-gray-400">(read-only)</span>
                </label>
                <p className="text-gray-900 dark:text-white py-2.5 font-mono text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3">
                  {org.tenantCode}
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <MapPinIcon className="h-4 w-4" />
                  Office Address
                </label>
                {isEditingDetails ? (
                  <textarea
                    value={detailsForm.officeAddress}
                    onChange={(e) => setDetailsForm({ ...detailsForm, officeAddress: e.target.value })}
                    placeholder="Enter office address"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white py-2.5 px-1">
                    {org.officeAddress || <span className="text-gray-400 italic">Not set</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Organization - Read Only */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <InformationCircleIcon className="h-5 w-5 text-purple-500" />
            About Organization
          </h2>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Description
            </label>
            <p className="text-gray-900 dark:text-white py-2 leading-relaxed bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              {org.description || <span className="text-gray-400 italic">No description set by admin</span>}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Vision
              </label>
              <p className="text-gray-900 dark:text-white py-2 leading-relaxed bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 min-h-[80px]">
                {org.vision || <span className="text-gray-400 italic">No vision set by admin</span>}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Mission
              </label>
              <p className="text-gray-900 dark:text-white py-2 leading-relaxed bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 min-h-[80px]">
                {org.mission || <span className="text-gray-400 italic">No mission set by admin</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Office Bearer Messages - Read Only */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-500" />
            Messages from Office Bearers
          </h2>
        </div>
        <div className="p-6 space-y-5">
          {/* President's Message */}
          <div className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
              President's Message
            </label>
            <p className="text-gray-900 dark:text-white leading-relaxed">
              {org.presidentMessage || <span className="text-gray-400 italic">No message from President</span>}
            </p>
          </div>

          {/* Secretary's Message */}
          <div className="bg-gradient-to-r from-green-50 to-transparent dark:from-green-900/20 dark:to-transparent rounded-lg p-4">
            <label className="block text-sm font-medium text-green-700 dark:text-green-400 mb-2">
              Secretary's Message
            </label>
            <p className="text-gray-900 dark:text-white leading-relaxed">
              {org.secretaryMessage || <span className="text-gray-400 italic">No message from Secretary</span>}
            </p>
          </div>

          {/* Treasurer's Message */}
          <div className="bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-900/20 dark:to-transparent rounded-lg p-4">
            <label className="block text-sm font-medium text-purple-700 dark:text-purple-400 mb-2">
              Treasurer's Message
            </label>
            <p className="text-gray-900 dark:text-white leading-relaxed">
              {org.treasurerMessage || <span className="text-gray-400 italic">No message from Treasurer</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Organization Documents - Read Only View */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <DocumentIcon className="h-5 w-5 text-orange-500" />
            Organization Documents
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Documents uploaded by organization admin (read-only)
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Registration Certificate */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <DocumentTextIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Registration Certificate</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF or Image format</p>
                </div>
              </div>

              {org.registrationCertUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300">Certificate uploaded</span>
                  </div>
                  <a
                    href={org.registrationCertUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium"
                  >
                    <EyeIcon className="h-4 w-4" />
                    View Certificate
                  </a>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-center">
                  <DocumentTextIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No certificate uploaded</p>
                </div>
              )}
            </div>

            {/* Bylaw Document */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DocumentTextIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Bylaw Document</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF or DOC format</p>
                </div>
              </div>

              {org.bylawDocumentUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300">Bylaw uploaded</span>
                  </div>
                  <a
                    href={org.bylawDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm font-medium"
                  >
                    <EyeIcon className="h-4 w-4" />
                    View Bylaw
                  </a>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-center">
                  <DocumentTextIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No bylaw uploaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</span>
            <p className="text-gray-900 dark:text-white font-medium mt-1">
              {new Date(org.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Updated</span>
            <p className="text-gray-900 dark:text-white font-medium mt-1">
              {new Date(org.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tenant Code</span>
            <p className="text-gray-900 dark:text-white font-medium font-mono mt-1">{org.tenantCode}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization ID</span>
            <p className="text-gray-900 dark:text-white font-medium font-mono text-xs mt-1 truncate" title={org.id}>{org.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Subscription Tab Component
function SubscriptionTab({ org, handleExtendSubscription, handleChangeStatus, handleToggleMaintenance, updatingSubscription, togglingMaintenance }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Subscription Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Subscription Status
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Current Status</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[org.subscriptionStatus]}`}>
              {org.subscriptionStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Started</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {org.subscriptionStartAt
                ? new Date(org.subscriptionStartAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })
                : 'Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Expires</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {org.subscriptionEndsAt
                ? new Date(org.subscriptionEndsAt).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })
                : 'No expiry date'}
            </span>
          </div>

          {/* Change Status */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Change Status</p>
            <div className="grid grid-cols-2 gap-2">
              {(['TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleChangeStatus(status)}
                  disabled={updatingSubscription || org.subscriptionStatus === status}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    org.subscriptionStatus === status
                      ? statusColors[status]
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Extend Subscription */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Extend Subscription
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Extend the subscription period for this organization. The expiry date will be extended from the current expiry date.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleExtendSubscription(30)}
              disabled={updatingSubscription}
              className="px-4 py-3 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              +30 Days
            </button>
            <button
              onClick={() => handleExtendSubscription(90)}
              disabled={updatingSubscription}
              className="px-4 py-3 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              +90 Days
            </button>
            <button
              onClick={() => handleExtendSubscription(365)}
              disabled={updatingSubscription}
              className="px-4 py-3 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              +1 Year
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <WrenchScrewdriverIcon className="h-5 w-5" />
            Maintenance Mode
          </h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-900 dark:text-white font-medium">
                {org.isMaintenanceMode ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {org.isMaintenanceMode
                  ? 'Users cannot access the organization'
                  : 'Organization is accessible to users'}
              </p>
            </div>
            <span className={`px-3 py-1 rounded text-sm font-medium ${
              org.isMaintenanceMode
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
              {org.isMaintenanceMode ? 'ON' : 'OFF'}
            </span>
          </div>
          <button
            onClick={handleToggleMaintenance}
            disabled={togglingMaintenance}
            className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              org.isMaintenanceMode
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {togglingMaintenance
              ? 'Processing...'
              : org.isMaintenanceMode
                ? 'Disable Maintenance Mode'
                : 'Enable Maintenance Mode'}
          </button>
        </div>
      </div>

      {/* Resource Limits */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Resource Limits
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Maximum Users</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {org._count?.users || 0} / {org.maxUsers}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${Math.min(((org._count?.users || 0) / org.maxUsers) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Storage Quota</span>
            <span className="text-gray-900 dark:text-white font-medium">{org.storageQuotaMB} MB</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Users Tab Component - Full User Management
function UsersTab({ org }: any) {
  const { auth } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [stats, setStats] = useState<any>({ total: 0, byRole: {} })
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Form states
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'USER',
    batch: new Date().getFullYear(),
    admissionYear: new Date().getFullYear() - 7,
    passoutYear: new Date().getFullYear(),
    isAlumniVerified: false,
    // Teacher-specific fields
    teacherSubject: '',
    teacherJoinYear: new Date().getFullYear(),
    isRetired: false,
    teacherLeavingYear: null as number | null
  })
  const [newPassword, setNewPassword] = useState('')

  // Use relative URL for Vite proxy

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
      })

      const response = await fetch(`/api/developer/organizations/${org.id}/users?${params}`, {
        headers: { 'Authorization': `Bearer ${auth?.token}` }
      })
      const result = await response.json()

      if (result.success) {
        setUsers(result.data.users)
        setPagination(result.data.pagination)
        setStats(result.data.stats)
      }
    } catch (error) {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (org?.id) fetchUsers()
  }, [org?.id, pagination.page, search, roleFilter, statusFilter, sortBy, sortOrder])

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ column }: { column: string }) => (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUpIcon className={`h-3 w-3 ${sortBy === column && sortOrder === 'asc' ? 'text-blue-500' : 'text-gray-400'}`} />
      <ChevronDownIcon className={`h-3 w-3 -mt-1 ${sortBy === column && sortOrder === 'desc' ? 'text-blue-500' : 'text-gray-400'}`} />
    </span>
  )

  // Create user
  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) {
      toast.error('Please fill all required fields')
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch(`/api/developer/organizations/${org.id}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
      })
      const result = await response.json()

      if (result.success) {
        toast.success(`User created successfully${result.data?.serialId ? ` (ID: ${result.data.serialId})` : ''}`)
        setShowCreateModal(false)
        setNewUser({
          email: '',
          password: '',
          fullName: '',
          role: 'USER',
          batch: new Date().getFullYear(),
          admissionYear: new Date().getFullYear() - 7,
          passoutYear: new Date().getFullYear(),
          isAlumniVerified: false,
          teacherSubject: '',
          teacherJoinYear: new Date().getFullYear(),
          isRetired: false,
          teacherLeavingYear: null
        })
        fetchUsers()
      } else {
        toast.error(result.message || 'Failed to create user')
      }
    } catch (error) {
      toast.error('Failed to create user')
    } finally {
      setActionLoading(false)
    }
  }

  // Update user
  const handleUpdateUser = async () => {
    if (!selectedUser) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/developer/organizations/${org.id}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${auth?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: selectedUser.fullName,
          email: selectedUser.email,
          role: selectedUser.role,
          batch: selectedUser.batch,
          isAlumniVerified: selectedUser.isAlumniVerified,
        })
      })
      const result = await response.json()

      if (result.success) {
        toast.success('User updated successfully')
        setShowEditModal(false)
        setSelectedUser(null)
        fetchUsers()
      } else {
        toast.error(result.message || 'Failed to update user')
      }
    } catch (error) {
      toast.error('Failed to update user')
    } finally {
      setActionLoading(false)
    }
  }

  // Reset password
  const handleResetPassword = async () => {
    if (!selectedUser || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch(`/api/developer/organizations/${org.id}/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword })
      })
      const result = await response.json()

      if (result.success) {
        toast.success('Password reset successfully')
        setShowPasswordModal(false)
        setSelectedUser(null)
        setNewPassword('')
      } else {
        toast.error(result.message || 'Failed to reset password')
      }
    } catch (error) {
      toast.error('Failed to reset password')
    } finally {
      setActionLoading(false)
    }
  }

  // Toggle user status
  const handleToggleStatus = async (user: any) => {
    if (!confirm(`${user.isActive ? 'Block' : 'Unblock'} user ${user.fullName}?`)) return

    try {
      const response = await fetch(`/api/developer/organizations/${org.id}/users/${user.id}/toggle-status`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth?.token}` }
      })
      const result = await response.json()

      if (result.success) {
        toast.success(result.message)
        fetchUsers()
      } else {
        toast.error(result.message || 'Failed to toggle status')
      }
    } catch (error) {
      toast.error('Failed to toggle status')
    }
  }

  // Delete user
  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Delete user ${user.fullName}? This action cannot be undone.`)) return

    try {
      const response = await fetch(`/api/developer/organizations/${org.id}/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth?.token}` }
      })
      const result = await response.json()

      if (result.success) {
        toast.success('User deleted successfully')
        fetchUsers()
      } else {
        toast.error(result.message || 'Failed to delete user')
      }
    } catch (error) {
      toast.error('Failed to delete user')
    }
  }

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    USER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    TEACHER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Super Admins</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.byRole?.SUPER_ADMIN || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Admins</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.byRole?.ADMIN || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Alumni</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.byRole?.USER || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Teachers</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.byRole?.TEACHER || 0}</p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 relative z-20">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search and Filters */}
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] max-w-xs px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="appearance-none px-4 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm cursor-pointer min-w-[130px]"
              >
                <option value="">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="BATCH_ADMIN">Batch Admin</option>
                <option value="USER">Alumni</option>
                <option value="TEACHER">Teacher</option>
              </select>
              <ChevronDownIcon className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none px-4 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm cursor-pointer min-w-[130px]"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Blocked</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
              <ChevronDownIcon className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          {/* Add User Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap text-sm font-medium"
          >
            <UsersIcon className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Serial ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('batch')}
                >
                  <span className="flex items-center">
                    Batch
                    <SortIcon column="batch" />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('createdAt')}
                >
                  <span className="flex items-center">
                    Joined
                    <SortIcon column="createdAt" />
                  </span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className={`${!user.isActive ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                    {/* User Name & Email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">
                              {user.fullName?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{user.fullName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Serial ID */}
                    <td className="px-4 py-3">
                      {user.serialId ? (
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                          {user.serialId}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">N/A</span>
                      )}
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${roleColors[user.role] || 'bg-gray-100 text-gray-800'}`}>
                        {user.role === 'USER' ? 'Alumni' : user.role === 'TEACHER' ? 'Teacher' : user.role}
                      </span>
                    </td>
                    {/* Batch */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {user.role === 'TEACHER' ? (
                        <span className="text-sm">{user.teacherJoinYear || user.batch}</span>
                      ) : (
                        user.batch
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full w-fit ${
                          user.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {user.isActive ? 'Active' : 'Blocked'}
                        </span>
                        {user.isAlumniVerified && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full w-fit bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Verified
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Joined Date */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedUser(user); setShowEditModal(true); }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }}
                          className="p-1.5 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400"
                          title="Reset Password"
                        >
                          <Cog6ToothIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`p-1.5 ${user.isActive ? 'text-gray-500 hover:text-orange-600' : 'text-orange-500 hover:text-green-600'}`}
                          title={user.isActive ? 'Block User' : 'Unblock User'}
                        >
                          {user.isActive ? <XMarkIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
                        </button>
                        {user.role !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 my-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New User</h3>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="USER">Alumni</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="BATCH_ADMIN">Batch Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              {/* Batch, Admission & Passout Years - Required for ALL roles */}
              <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Academic Information (Required for Serial ID)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch *</label>
                    <input
                      type="number"
                      value={newUser.batch}
                      onChange={(e) => setNewUser({ ...newUser, batch: parseInt(e.target.value), passoutYear: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admission Year *</label>
                    <input
                      type="number"
                      value={newUser.admissionYear}
                      onChange={(e) => setNewUser({ ...newUser, admissionYear: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Passout Year *</label>
                    <input
                      type="number"
                      value={newUser.passoutYear}
                      onChange={(e) => setNewUser({ ...newUser, passoutYear: parseInt(e.target.value), batch: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Alumni-specific: Verification checkbox */}
              {newUser.role === 'USER' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newUser.isAlumniVerified}
                    onChange={(e) => setNewUser({ ...newUser, isAlumniVerified: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Mark as Verified Alumni</span>
                </label>
              )}

              {/* Teacher-specific fields */}
              {newUser.role === 'TEACHER' && (
                <div className="space-y-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">Teacher Information</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject/Department</label>
                    <input
                      type="text"
                      value={newUser.teacherSubject}
                      onChange={(e) => setNewUser({ ...newUser, teacherSubject: e.target.value })}
                      placeholder="e.g., Mathematics, Physics"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Joining Year *</label>
                    <input
                      type="number"
                      value={newUser.teacherJoinYear}
                      onChange={(e) => setNewUser({ ...newUser, teacherJoinYear: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newUser.isRetired}
                        onChange={(e) => setNewUser({ ...newUser, isRetired: e.target.checked, teacherLeavingYear: e.target.checked ? newUser.teacherLeavingYear : null })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Has Left/Retired?</span>
                    </label>
                    {!newUser.isRetired && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300 text-xs rounded-full">
                        Currently Serving
                      </span>
                    )}
                  </div>
                  {newUser.isRetired && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leaving/Retirement Year *</label>
                      <input
                        type="number"
                        value={newUser.teacherLeavingYear || ''}
                        onChange={(e) => setNewUser({ ...newUser, teacherLeavingYear: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Year of leaving"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  A unique Serial ID will be automatically generated for all users based on their academic information.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreateUser} disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {actionLoading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={selectedUser.fullName}
                  onChange={(e) => setSelectedUser({ ...selectedUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select
                    value={selectedUser.role}
                    onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="USER">Alumni</option>
                    <option value="TEACHER">Teacher</option>
                    <option value="BATCH_ADMIN">Batch Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch</label>
                  <input
                    type="number"
                    value={selectedUser.batch}
                    onChange={(e) => setSelectedUser({ ...selectedUser, batch: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              {selectedUser.serialId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial ID</label>
                  <p className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300">
                    {selectedUser.serialId}
                  </p>
                </div>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedUser.isAlumniVerified}
                  onChange={(e) => setSelectedUser({ ...selectedUser, isAlumniVerified: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Verified Alumni</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleUpdateUser} disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reset Password</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Reset password for {selectedUser.fullName}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowPasswordModal(false); setSelectedUser(null); setNewPassword(''); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleResetPassword} disabled={actionLoading} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {actionLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Statistics Tab Component
function StatisticsTab({ org, stats }: any) {
  const statItems = [
    { label: 'Users', value: org._count?.users || 0, icon: UsersIcon, color: 'blue' },
    { label: 'Events', value: org._count?.events || 0, icon: CalendarDaysIcon, color: 'green' },
    { label: 'Posts', value: org._count?.posts || 0, icon: DocumentTextIcon, color: 'purple' },
    { label: 'Albums', value: org._count?.albums || 0, icon: PhotoIcon, color: 'pink' },
    { label: 'Photos', value: org._count?.photos || 0, icon: PhotoIcon, color: 'indigo' },
    { label: 'Groups', value: org._count?.groups || 0, icon: UserGroupIcon, color: 'orange' },
    { label: 'Polls', value: org._count?.polls || 0, icon: ChatBubbleLeftRightIcon, color: 'cyan' },
    { label: 'Tickets', value: org._count?.tickets || 0, icon: TicketIcon, color: 'red' },
    { label: 'Transactions', value: org._count?.transactions || 0, icon: CurrencyRupeeIcon, color: 'yellow' },
    { label: 'Sponsors', value: org._count?.sponsors || 0, icon: BuildingOffice2Icon, color: 'teal' },
    { label: 'Notifications', value: org._count?.notifications || 0, icon: DocumentTextIcon, color: 'gray' },
  ]

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    pink: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
    gray: 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400',
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Organization Statistics
          </h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {statItems.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className={`p-4 rounded-xl ${colorClasses[item.color]}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{item.value}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content Statistics */}
      {stats?.content && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Content Overview
            </h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.content.posts}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Posts</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.content.events}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Events</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.content.albums}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Albums</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.content.photos}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Photos</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.content.polls}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Polls</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Activity Log Tab Component
function ActivityLogTab({ org }: any) {
  const { auth } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [actionFilter, setActionFilter] = useState('')

  // Use relative URL for Vite proxy

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(actionFilter && { action: actionFilter }),
      })

      const response = await fetch(`/api/developer/organizations/${org.id}/activity-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${auth?.token}` }
      })
      const result = await response.json()

      if (result.success) {
        setLogs(result.data.logs)
        setPagination(result.data.pagination)
      }
    } catch (error) {
      toast.error('Failed to load activity logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (org?.id) fetchLogs()
  }, [org?.id, pagination.page, actionFilter])

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('register')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    if (action.includes('update') || action.includes('edit')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    if (action.includes('delete') || action.includes('remove')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    if (action.includes('login') || action.includes('logout')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <input
            type="text"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full sm:w-64"
          />
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Activity Logs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-5 w-5 text-blue-500" />
            Activity Logs
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({pagination.total} records)
            </span>
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No activity logs found</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {log.user?.avatarUrl ? (
                      <img src={log.user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-gray-600 dark:text-gray-300 font-medium">
                          {log.user?.fullName?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {log.user?.fullName || 'Unknown User'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full w-fit ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {log.user?.email}
                      {log.user?.role && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                          {log.user.role}
                        </span>
                      )}
                    </p>
                    {log.details && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs text-gray-600 dark:text-gray-400 font-mono overflow-x-auto">
                        {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                      {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Email Config Tab Component
function EmailConfigTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [formData, setFormData] = useState<{
    provider: EmailProvider
    smtpHost: string
    smtpPort: number
    smtpSecure: boolean
    smtpUser: string
    smtpPassword: string
    sendgridApiKey: string
    resendApiKey: string
    mailgunApiKey: string
    mailgunDomain: string
    mailersendApiKey: string
    fromEmail: string
    fromName: string
    replyTo: string
    dailyEmailLimit: number
    monthlyEmailLimit: number
  }>({
    provider: 'SMTP',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    sendgridApiKey: '',
    resendApiKey: '',
    mailgunApiKey: '',
    mailgunDomain: '',
    mailersendApiKey: '',
    fromEmail: '',
    fromName: orgName,
    replyTo: '',
    dailyEmailLimit: 1000,
    monthlyEmailLimit: 25000,
  })

  const { data: emailConfigData, isLoading, refetch } = useGetOrganizationEmailConfigQuery(orgId)
  const { data: emailStatsData } = useGetOrganizationEmailStatsQuery(orgId)
  const [saveEmailConfig, { isLoading: saving }] = useSaveOrganizationEmailConfigMutation()
  const [testEmailConfig, { isLoading: testing }] = useTestOrganizationEmailConfigMutation()
  const [activateEmailConfig, { isLoading: activating }] = useActivateOrganizationEmailConfigMutation()
  const [deactivateEmailConfig, { isLoading: deactivating }] = useDeactivateOrganizationEmailConfigMutation()
  const [deleteEmailConfig, { isLoading: deleting }] = useDeleteOrganizationEmailConfigMutation()

  const config = emailConfigData?.config
  const dnsRecords = emailConfigData?.dnsRecords
  const stats = emailStatsData?.stats

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      setFormData({
        provider: config.provider || 'SMTP',
        smtpHost: config.smtpHost || '',
        smtpPort: config.smtpPort || 587,
        smtpSecure: config.smtpSecure || false,
        smtpUser: config.smtpUser || '',
        smtpPassword: '', // Don't populate password (it's masked)
        sendgridApiKey: '',
        resendApiKey: '',
        mailgunApiKey: '',
        mailgunDomain: config.mailgunDomain || '',
        mailersendApiKey: '',
        fromEmail: config.fromEmail || '',
        fromName: config.fromName || orgName,
        replyTo: config.replyTo || '',
        dailyEmailLimit: config.dailyEmailLimit || 1000,
        monthlyEmailLimit: config.monthlyEmailLimit || 25000,
      })
    }
  }, [config, orgName])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  const handleSave = async () => {
    try {
      await saveEmailConfig({ orgId, data: formData }).unwrap()
      toast.success('Email configuration saved! Test and activate to enable.')
      refetch()
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to save email configuration')
    }
  }

  const handleTest = async () => {
    try {
      const result = await testEmailConfig({ orgId, testEmail: testEmail || undefined }).unwrap()
      if (result.success) {
        toast.success(result.testEmailSent ? 'Connection verified and test email sent!' : 'Connection verified!')
        refetch()
      } else {
        toast.error(result.error || 'Test failed')
      }
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to test email configuration')
    }
  }

  const handleActivate = async () => {
    try {
      await activateEmailConfig(orgId).unwrap()
      toast.success('Email configuration activated!')
      refetch()
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to activate email configuration')
    }
  }

  const handleDeactivate = async () => {
    try {
      await deactivateEmailConfig(orgId).unwrap()
      toast.success('Email configuration deactivated. Using default system emails.')
      refetch()
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to deactivate email configuration')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete the email configuration? This cannot be undone.')) return
    try {
      await deleteEmailConfig(orgId).unwrap()
      toast.success('Email configuration deleted')
      refetch()
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete email configuration')
    }
  }

  const providers = [
    { value: 'SMTP', label: 'Custom SMTP', description: 'Use your own SMTP server' },
    { value: 'GMAIL', label: 'Gmail', description: 'Gmail with App Password' },
    { value: 'SENDGRID', label: 'SendGrid', description: 'SendGrid email API' },
    { value: 'RESEND', label: 'Resend', description: 'Resend email API' },
    { value: 'MAILGUN', label: 'Mailgun', description: 'Mailgun email API' },
    { value: 'MAILERSEND', label: 'MailerSend', description: 'MailerSend email API' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {config && (
        <div className={`p-4 rounded-lg ${
          config.isActive
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : config.isVerified
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
            : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                config.isActive ? 'bg-green-100 dark:bg-green-800' : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <EnvelopeIcon className={`h-5 w-5 ${
                  config.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                }`} />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {config.isActive ? 'Custom Email Active' : config.isVerified ? 'Ready to Activate' : 'Not Configured'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {config.isActive
                    ? `Sending from ${config.fromEmail}`
                    : config.isVerified
                    ? 'Configuration verified. Click Activate to enable.'
                    : 'Configure and test your email settings below.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {config.isActive ? (
                <button
                  onClick={handleDeactivate}
                  disabled={deactivating}
                  className="px-3 py-1.5 text-sm border border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 rounded-lg"
                >
                  {deactivating ? 'Deactivating...' : 'Deactivate'}
                </button>
              ) : config.isVerified ? (
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg"
                >
                  {activating ? 'Activating...' : 'Activate'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Email Usage Stats */}
      {stats && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Usage</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Daily Usage</p>
              <div className="mt-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>{stats.dailyEmailsSent} / {stats.dailyEmailLimit}</span>
                  <span>{stats.dailyUsagePercent}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${stats.dailyUsagePercent > 80 ? 'bg-red-500' : stats.dailyUsagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(stats.dailyUsagePercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Usage</p>
              <div className="mt-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>{stats.monthlyEmailsSent} / {stats.monthlyEmailLimit}</span>
                  <span>{stats.monthlyUsagePercent}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${stats.monthlyUsagePercent > 80 ? 'bg-red-500' : stats.monthlyUsagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(stats.monthlyUsagePercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provider Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Provider</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {providers.map(provider => (
              <button
                key={provider.value}
                onClick={() => setFormData(prev => ({ ...prev, provider: provider.value as any }))}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  formData.provider === provider.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <p className="font-medium text-gray-900 dark:text-white">{provider.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{provider.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Provider-specific Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {formData.provider === 'SMTP' ? 'SMTP Settings' : `${formData.provider} Configuration`}
          </h2>
        </div>
        <div className="p-5 space-y-4">
          {/* SMTP/Gmail Fields */}
          {(formData.provider === 'SMTP' || formData.provider === 'GMAIL') && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SMTP Host {formData.provider === 'GMAIL' && <span className="text-gray-400">(smtp.gmail.com)</span>}
                  </label>
                  <input
                    type="text"
                    name="smtpHost"
                    value={formData.smtpHost}
                    onChange={handleInputChange}
                    placeholder={formData.provider === 'GMAIL' ? 'smtp.gmail.com' : 'smtp.example.com'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    name="smtpPort"
                    value={formData.smtpPort}
                    onChange={handleInputChange}
                    placeholder="587"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username / Email
                  </label>
                  <input
                    type="text"
                    name="smtpUser"
                    value={formData.smtpUser}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password {formData.provider === 'GMAIL' && <span className="text-gray-400">(App Password)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="smtpPassword"
                      value={formData.smtpPassword}
                      onChange={handleInputChange}
                      placeholder={config?.smtpPassword ? '••••••••' : 'Enter password'}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="smtpSecure"
                  checked={formData.smtpSecure}
                  onChange={handleInputChange}
                  id="smtpSecure"
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <label htmlFor="smtpSecure" className="text-sm text-gray-700 dark:text-gray-300">
                  Use SSL/TLS (Port 465)
                </label>
              </div>
            </>
          )}

          {/* SendGrid */}
          {formData.provider === 'SENDGRID' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SendGrid API Key
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                name="sendgridApiKey"
                value={formData.sendgridApiKey}
                onChange={handleInputChange}
                placeholder={config?.sendgridApiKey ? '••••••••' : 'SG.xxxxx...'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Resend */}
          {formData.provider === 'RESEND' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resend API Key
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                name="resendApiKey"
                value={formData.resendApiKey}
                onChange={handleInputChange}
                placeholder={config?.resendApiKey ? '••••••••' : 're_xxxxx...'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Mailgun */}
          {formData.provider === 'MAILGUN' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mailgun API Key
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="mailgunApiKey"
                  value={formData.mailgunApiKey}
                  onChange={handleInputChange}
                  placeholder={config?.mailgunApiKey ? '••••••••' : 'key-xxxxx...'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mailgun Domain
                </label>
                <input
                  type="text"
                  name="mailgunDomain"
                  value={formData.mailgunDomain}
                  onChange={handleInputChange}
                  placeholder="mg.yourdomain.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* MailerSend */}
          {formData.provider === 'MAILERSEND' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                MailerSend API Key
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                name="mailersendApiKey"
                value={formData.mailersendApiKey}
                onChange={handleInputChange}
                placeholder={config?.mailersendApiKey ? '••••••••' : 'mlsn.xxxxx...'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from MailerSend dashboard → Email → Domains → API Tokens
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sender Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sender Details</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                From Email *
              </label>
              <input
                type="email"
                name="fromEmail"
                value={formData.fromEmail}
                onChange={handleInputChange}
                placeholder="noreply@yourdomain.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                From Name *
              </label>
              <input
                type="text"
                name="fromName"
                value={formData.fromName}
                onChange={handleInputChange}
                placeholder="Alumni Portal"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reply-To Email (optional)
            </label>
            <input
              type="email"
              name="replyTo"
              value={formData.replyTo}
              onChange={handleInputChange}
              placeholder="support@yourdomain.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Rate Limits */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rate Limits</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Daily Email Limit
              </label>
              <input
                type="number"
                name="dailyEmailLimit"
                value={formData.dailyEmailLimit}
                onChange={handleInputChange}
                min={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Monthly Email Limit
              </label>
              <input
                type="number"
                name="monthlyEmailLimit"
                value={formData.monthlyEmailLimit}
                onChange={handleInputChange}
                min={1000}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* DNS Records (if available) */}
      {dnsRecords && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">DNS Records (For Domain Verification)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Add these records to your domain's DNS settings for better deliverability.
            </p>
          </div>
          <div className="p-5 space-y-4">
            {Object.entries(dnsRecords).map(([key, record]) => (
              <div key={key} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{key}</span>
                  <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                    {record.type}
                  </span>
                </div>
                <p className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">{record.name}</p>
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1 break-all">{record.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test & Save Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Test Configuration</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Send Test Email To (optional)
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave empty to only verify connection without sending a test email.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !formData.fromEmail || !formData.fromName}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !config}
              className="px-4 py-2 border border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg disabled:opacity-50 transition-colors"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            {config && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 transition-colors ml-auto"
              >
                {deleting ? 'Deleting...' : 'Delete Config'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Settings Tab Component
function SettingsTab({ org, formData, isEditing, handleInputChange }: any) {
  return (
    <div className="space-y-6">
      {/* Resource Limits */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Resource Limits
          </h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <UsersIcon className="h-4 w-4 inline mr-1" />
                Maximum Users
              </label>
              {isEditing ? (
                <input
                  type="number"
                  name="maxUsers"
                  value={formData.maxUsers}
                  onChange={handleInputChange}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 dark:text-white py-2">
                  <span className="font-medium">{org._count?.users || 0}</span>
                  <span className="text-gray-400"> / {org.maxUsers}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Storage Quota (MB)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  name="storageQuotaMB"
                  value={formData.storageQuotaMB}
                  onChange={handleInputChange}
                  min={100}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 dark:text-white py-2">{org.storageQuotaMB} MB</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900">
        <div className="p-5 border-b border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 rounded-t-xl">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
            Danger Zone
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Deactivate Organization</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Temporarily disable this organization. Users will not be able to access it.
              </p>
            </div>
            <button className="px-4 py-2 border border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20 rounded-lg font-medium transition-colors">
              Deactivate
            </button>
          </div>
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Delete Organization</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Permanently delete this organization and all its data. This action cannot be undone.
              </p>
            </div>
            <button className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
