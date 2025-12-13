// src/pages/auth/OrganizationSelectPage.tsx
// Organization selection page - First screen users see to select their school/organization

import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { selectIsDark } from '@/store/slices/themeSlice'
import ThemeToggle from '@/components/common/UI/ThemeToggle'
import {
  ORGANIZATIONS,
  getOrganizationByCode,
  storeOrganization,
  getOrgLogoUrl,
  fetchOrgDetails,
  fetchAllOrganizations,
  fetchOrganizationsByEmail,
  type Organization,
} from '@/config/organizations'
import { BuildingOfficeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

// Component for organization logo with fallback
const OrgLogo: React.FC<{ org: Organization; className?: string }> = ({ org, className = '' }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(getOrgLogoUrl(org))
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(!logoUrl)

  // Fetch logo from org's API if not provided statically
  useEffect(() => {
    if (!logoUrl && !imageError) {
      fetchOrgDetails(org).then((details) => {
        if (details?.logoUrl) {
          setLogoUrl(details.logoUrl)
        }
        setIsLoading(false)
      })
    }
  }, [org, logoUrl, imageError])

  // Show initials fallback
  const renderInitials = () => {
    const initials = org.shortName
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()

    return (
      <div className={`bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold ${className}`}>
        {initials}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse ${className}`} />
    )
  }

  if (imageError || !logoUrl) {
    return renderInitials()
  }

  return (
    <img
      src={logoUrl}
      alt={org.name}
      className={`rounded-lg object-cover ${className}`}
      onError={() => setImageError(true)}
    />
  )
}

const OrganizationSelectPage: React.FC = () => {
  const [orgCode, setOrgCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>(ORGANIZATIONS)
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false) // Track if user is switching orgs
  const [switchEmail, setSwitchEmail] = useState<string | null>(null) // Store email when switching
  const isDark = useSelector(selectIsDark)

  // Fetch organizations from API on mount
  // CRITICAL: If user is switching orgs, only show orgs they belong to
  useEffect(() => {
    const loadOrganizations = async () => {
      setIsLoadingOrgs(true)
      try {
        // Check if user is switching organizations (email stored in sessionStorage)
        const storedEmail = sessionStorage.getItem('guild-switch-org-email')

        if (storedEmail) {
          // User is switching orgs - only show their organizations
          setIsSwitchingOrg(true)
          setSwitchEmail(storedEmail)

          const userOrgs = await fetchOrganizationsByEmail(storedEmail)
          if (userOrgs.length > 0) {
            setOrganizations(userOrgs)
          } else {
            // No orgs found for this email - show error
            setError('No organizations found for your account.')
            setOrganizations([])
          }

          // Clear the stored email after use (one-time use)
          sessionStorage.removeItem('guild-switch-org-email')
        } else {
          // New user - show all organizations
          const fetchedOrgs = await fetchAllOrganizations()
          if (fetchedOrgs.length > 0) {
            setOrganizations(fetchedOrgs)
          } else {
            // Fall back to static organizations if API returns empty
            setOrganizations(ORGANIZATIONS)
          }
        }
      } catch (err) {
        console.error('Failed to fetch organizations:', err)
        // Fall back to static organizations on error
        setOrganizations(ORGANIZATIONS)
      } finally {
        setIsLoadingOrgs(false)
      }
    }
    loadOrganizations()
  }, [])

  // Filter organizations based on search query
  // Also filter out LOCAL-DEV which is only for development
  const filteredOrganizations = organizations.filter(
    (org) =>
      // Exclude LOCAL-DEV from public display
      org.code.toUpperCase() !== 'LOCAL-DEV' &&
      (org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.shortName.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Handle organization selection from list
  const handleSelectOrganization = (org: Organization) => {
    setIsLoading(true)
    setError(null)

    // Store organization in localStorage
    storeOrganization(org)

    // Small delay for UX, then reload to reinitialize API with new URL
    setTimeout(() => {
      window.location.href = '/auth/login'
    }, 300)
  }

  // Handle manual org code entry
  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!orgCode.trim()) {
      setError('Please enter an organization code')
      return
    }

    const org = getOrganizationByCode(orgCode.trim())

    if (!org) {
      setError('Invalid organization code. Please check and try again.')
      return
    }

    handleSelectOrganization(org)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
      {/* Fixed Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center h-10">
              <img
                src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                alt="GUILD"
                className="h-full w-auto object-contain"
              />
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center pt-16 px-4 py-4">
        <div className="max-w-lg w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8">
            {/* Header */}
            <div className="text-center mb-5">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <BuildingOfficeIcon className="w-7 h-7 text-white" />
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                  {isSwitchingOrg ? 'Switch Organization' : 'Select Your Organization'}
                </span>
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isSwitchingOrg
                  ? `Select an organization linked to ${switchEmail}`
                  : 'Choose your school or enter your organization code'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800 text-sm">
                {error}
              </div>
            )}

            {/* Search Box */}
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search organizations..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            {/* Organization List */}
            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {isLoadingOrgs ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading organizations...</p>
                </div>
              ) : filteredOrganizations.length > 0 ? (
                filteredOrganizations.map((org) => (
                  <button
                    key={org.code}
                    onClick={() => handleSelectOrganization(org)}
                    disabled={isLoading}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      {/* Organization Logo */}
                      <OrgLogo org={org} className="w-10 h-10 text-sm flex-shrink-0" />

                      {/* Organization Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {org.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Code: {org.code}
                        </p>
                      </div>

                      {/* Arrow indicator */}
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))
              ) : searchQuery ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                  <p>No organizations found matching "{searchQuery}"</p>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                  <p>No organizations available. Please enter your organization code below.</p>
                </div>
              )}
            </div>

            {/* Manual Code Entry - Only show for new users, not when switching orgs */}
            {!isSwitchingOrg && (
              <>
                {/* Divider */}
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      Or enter code manually
                    </span>
                  </div>
                </div>

                {/* Manual Code Entry Form */}
                <form onSubmit={handleSubmitCode} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Organization Code
                    </label>
                    <input
                      type="text"
                      value={orgCode}
                      onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                      placeholder="Enter organization code (e.g., NAAO)"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all uppercase text-sm"
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !orgCode.trim()}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isLoading ? 'Connecting...' : 'Continue'}
                  </button>
                </form>

                {/* Help Text */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Don't know your organization code?{' '}
                    <span className="text-blue-600 dark:text-blue-400">
                      Contact your alumni administrator
                    </span>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Company Credit */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Powered by{' '}
              <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Digikite
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrganizationSelectPage
