import React, { useState } from 'react'
import { 
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
  UsersIcon,
  ChartBarIcon,
  CurrencyRupeeIcon
} from '@heroicons/react/24/outline'
import { useGetEventsQuery } from '@/store/api/eventApi'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'

interface Event {
  id: string
  title: string
  eventDate: string
  status: string
}

interface PublicAnalyticsData {
  statistics: {
    totalRegistrations: number
    totalRevenue: number
    totalDonations: number
    totalGuests: number
  }
  batchStats: {
    batches: Array<{
      batch: number
      statistics: {
        registrationCount: number
        uniqueUsers: number
        totalRevenue: number
        totalDonations: number
      }
    }>
  }
  privacySettings: {
    showPaymentAmounts: boolean
    showDonationAmounts: boolean
    showUserEmails: boolean
    showUserPhones: boolean
    showGuestDetails: boolean
  }
}

interface PublicRegistrationsData {
  registrations: Array<{
    id: string
    user: {
      id: string
      fullName: string
      email?: string
      batch?: number
      profileImage?: string
    }
    totalGuests?: number
    donationAmount?: number
    totalAmount?: number
    registrationDate?: string
    status: string
  }>
  totalCount: number
  privacySettings: {
    showPaymentAmounts: boolean
    showDonationAmounts: boolean
    showUserEmails: boolean
    showUserPhones: boolean
    showGuestDetails: boolean
    showBatchInfo: boolean
    showRegistrationDate: boolean
  }
}

type SortField = 'batch' | 'date' | 'totalAmount'
type SortOrder = 'asc' | 'desc'

const PublicEventAnalytics: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<string>('all')
  const [selectedBatch, setSelectedBatch] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'registration'>('overview')
  const [analyticsData, setAnalyticsData] = useState<PublicAnalyticsData | null>(null)
  const [registrationsData, setRegistrationsData] = useState<PublicRegistrationsData | null>(null)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(false)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const { data: eventsData, isLoading: eventsLoading } = useGetEventsQuery({
    page: 1,
    limit: 100,
    status: 'PUBLISHED'
  })

  const events = eventsData?.events || []

  // Get unique batches from registration data
  const availableBatches = React.useMemo(() => {
    if (!registrationsData?.registrations) return []
    
    const batches = registrationsData.registrations
      .map(registration => registration.user?.batch)
      .filter((batch): batch is number => batch !== undefined && batch !== null)
    
    return [...new Set(batches)].sort((a, b) => b - a) // Sort descending
  }, [registrationsData])

  const fetchAnalytics = async (eventId: string) => {
    if (eventId === 'all') {
      setAnalyticsData(null)
      return
    }

    setIsLoadingAnalytics(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/events/${eventId}/public-analytics`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAnalyticsData(data.data)
      } else {
        console.error('Failed to fetch public analytics')
        setAnalyticsData(null)
      }
    } catch (error) {
      console.error('Error fetching public analytics:', error)
      setAnalyticsData(null)
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  const fetchRegistrations = async (eventId: string) => {
    if (eventId === 'all') {
      setRegistrationsData(null)
      return
    }

    setIsLoadingRegistrations(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/events/${eventId}/public-registrations`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setRegistrationsData(data.data)
      } else {
        console.error('Failed to fetch public registrations')
        setRegistrationsData(null)
      }
    } catch (error) {
      console.error('Error fetching public registrations:', error)
      setRegistrationsData(null)
    } finally {
      setIsLoadingRegistrations(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const getSortedRegistrations = () => {
    if (!registrationsData?.registrations || !sortField) {
      return registrationsData?.registrations || []
    }

    return [...registrationsData.registrations].sort((a, b) => {
      let aValue: number, bValue: number

      switch (sortField) {
        case 'batch':
          aValue = a.user?.batch || 0
          bValue = b.user?.batch || 0
          break
        case 'date':
          aValue = new Date(a.registrationDate || '').getTime()
          bValue = new Date(b.registrationDate || '').getTime()
          break
        case 'totalAmount':
          aValue = a.totalAmount || 0
          bValue = b.totalAmount || 0
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })
  }

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId)
    setSelectedBatch('all') // Reset batch filter when changing events
    setSortField(null) // Reset sorting when changing events
    if (eventId !== 'all') {
      fetchAnalytics(eventId)
      fetchRegistrations(eventId)
    } else {
      setAnalyticsData(null)
      setRegistrationsData(null)
    }
  }

  const handleTabChange = (tab: 'overview' | 'registration') => {
    setActiveTab(tab)
    // If switching to registration tab and have an event selected, fetch fresh data
    if (tab === 'registration' && selectedEventId !== 'all') {
      fetchRegistrations(selectedEventId)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode; className?: string }> = ({ field, children, className = '' }) => (
    <th 
      className={`py-4 px-4 text-gray-300 font-medium cursor-pointer hover:text-white transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-2">
        {children}
        <div className="flex flex-col opacity-80 hover:opacity-100">
          <ChevronUpIcon className={`h-4 w-4 ${sortField === field && sortOrder === 'asc' ? 'text-blue-400' : 'text-gray-400'}`} />
          <ChevronDownIcon className={`h-4 w-4 -mt-1 ${sortField === field && sortOrder === 'desc' ? 'text-blue-400' : 'text-gray-400'}`} />
        </div>
      </div>
    </th>
  )

  if (eventsLoading) return <LoadingSpinner />

  return (
    <div className="bg-gray-900 text-white min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-8">Event Analytics</h1>
        </div>

        {/* Event and Batch Selectors */}
        <div className="flex justify-center gap-4 mb-8">
          <div className="relative">
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white min-w-80 appearance-none focus:outline-none focus:border-blue-500"
            >
              <option value="all">Default All Event</option>
              {events.map((event: Event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="h-5 w-5 absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>

          {/* Batch Dropdown */}
          {selectedEventId !== 'all' && availableBatches.length > 0 && (
            <div className="relative">
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white min-w-48 appearance-none focus:outline-none focus:border-blue-500"
              >
                <option value="all">Select Batch</option>
                {availableBatches.map((batch) => (
                  <option key={batch} value={batch.toString()}>
                    {batch}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="h-5 w-5 absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => handleTabChange('overview')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'overview' 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => handleTabChange('registration')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'registration' 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Registration
            </button>
          </div>
        </div>

        {/* Content */}
        {selectedEventId === 'all' ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-lg p-8">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                Select an Event
              </h3>
              <p className="text-gray-400">
                Choose an event from the dropdown above to view its analytics
              </p>
            </div>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="bg-gray-800 rounded-2xl p-8">
            <h3 className="text-xl mb-6 text-white">Overview Analytics</h3>
            
            {isLoadingAnalytics ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                <p className="mt-2 text-gray-400">Loading overview...</p>
              </div>
            ) : !analyticsData ? (
              <div className="text-center py-8">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-8">
                  <h3 className="text-lg font-medium text-red-900 dark:text-red-200 mb-2">
                    Analytics Not Available
                  </h3>
                  <p className="text-red-700 dark:text-red-300">
                    Public analytics are not available for this event or an error occurred.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Overview Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {/* User Registration */}
                  <div className="bg-gray-700 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">User Registration</p>
                        <p className="text-2xl font-bold text-white">{analyticsData.statistics.totalRegistrations}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <UserIcon className="h-8 w-8 text-blue-400" />
                      </div>
                    </div>
                  </div>

                  {/* Guest Registration - Show only if privacy settings allow */}
                  {analyticsData.privacySettings.showGuestDetails && (
                    <div className="bg-gray-700 rounded-lg p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Guest Registration</p>
                          <p className="text-2xl font-bold text-white">{analyticsData.statistics.totalGuests}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <UsersIcon className="h-8 w-8 text-purple-400" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Total Registration */}
                  <div className="bg-gray-700 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Total Registration</p>
                        <p className="text-2xl font-bold text-white">
                          {analyticsData.statistics.totalRegistrations + analyticsData.statistics.totalGuests}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <ChartBarIcon className="h-8 w-8 text-green-400" />
                      </div>
                    </div>
                  </div>

                  {/* Total Collection - Show only if privacy settings allow */}
                  {analyticsData.privacySettings.showPaymentAmounts && (
                    <div className="bg-gray-700 rounded-lg p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Total Collection</p>
                          <p className="text-2xl font-bold text-white">{formatAmount(analyticsData.statistics.totalRevenue)}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <CurrencyRupeeIcon className="h-8 w-8 text-orange-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Batch Participation Details Table */}
                {analyticsData.batchStats.batches.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-white mb-4">Batch Participation Details</h4>
                    <div className="bg-gray-700 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-600">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Batch</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Total Users</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Active Participants</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Participation Rate</th>
                              {analyticsData.privacySettings.showPaymentAmounts && (
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Total Collection</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-600">
                            {analyticsData.batchStats.batches
                              .filter((batchData) => selectedBatch === 'all' || batchData.batch === parseInt(selectedBatch))
                              .map((batchData) => (
                              <tr key={batchData.batch} className="hover:bg-gray-600">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                                  Batch {batchData.batch}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                                  {batchData.statistics.uniqueUsers}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                                  {batchData.statistics.registrationCount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {batchData.statistics.uniqueUsers > 0 
                                      ? ((batchData.statistics.registrationCount / batchData.statistics.uniqueUsers) * 100).toFixed(1) 
                                      : '0.0'}%
                                  </span>
                                </td>
                                {analyticsData.privacySettings.showPaymentAmounts && (
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                                    ₹{batchData.statistics.totalRevenue.toLocaleString('en-IN')}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Batch wise Revenue Sources */}
                {analyticsData.privacySettings.showPaymentAmounts && analyticsData.batchStats.batches.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Batch wise Revenue Sources</h4>
                    <div className="bg-gray-700 rounded-lg p-6">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {analyticsData.batchStats.batches.slice(0, 4).map((batchData) => {
                          const registrationRevenue = batchData.statistics.totalRevenue - (batchData.statistics.totalDonations || 0);
                          const donationRevenue = batchData.statistics.totalDonations || 0;
                          const maxRevenue = Math.max(registrationRevenue, donationRevenue);
                          
                          return (
                            <div key={batchData.batch} className="text-center">
                              <p className="text-sm text-gray-300 mb-2">Batch {batchData.batch}</p>
                              <div className="flex items-end justify-center space-x-2 h-32">
                                {/* Donations Bar */}
                                <div className="flex flex-col items-center">
                                  <div 
                                    className="w-8 bg-red-400 rounded-t"
                                    style={{ 
                                      height: maxRevenue > 0 ? `${(donationRevenue / maxRevenue) * 100}px` : '4px',
                                      minHeight: '4px'
                                    }}
                                  ></div>
                                  <p className="text-xs text-gray-400 mt-1">₹{donationRevenue.toLocaleString('en-IN')}</p>
                                </div>
                                {/* Registration Fees Bar */}
                                <div className="flex flex-col items-center">
                                  <div 
                                    className="w-8 bg-green-400 rounded-t"
                                    style={{ 
                                      height: maxRevenue > 0 ? `${(registrationRevenue / maxRevenue) * 100}px` : '4px',
                                      minHeight: '4px'
                                    }}
                                  ></div>
                                  <p className="text-xs text-gray-400 mt-1">₹{registrationRevenue.toLocaleString('en-IN')}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-center mt-6 space-x-6">
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-red-400 rounded mr-2"></div>
                          <span className="text-sm text-gray-300">Donations</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-green-400 rounded mr-2"></div>
                          <span className="text-sm text-gray-300">Registration Fees</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Registration Table */
          <div className="bg-gray-800 rounded-2xl p-8">
            {isLoadingRegistrations ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                <p className="mt-2 text-gray-400">Loading registrations...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left py-4 px-4 text-gray-300 font-medium">Name</th>
                      <SortableHeader field="batch" className="text-center">Batch</SortableHeader>
                      <th className="text-center py-4 px-4 text-gray-300 font-medium">Guest Count</th>
                      {registrationsData?.privacySettings.showDonationAmounts && (
                        <th className="text-center py-4 px-4 text-gray-300 font-medium">Donation</th>
                      )}
                      {registrationsData?.privacySettings.showPaymentAmounts && (
                        <SortableHeader field="totalAmount" className="text-center">Total Amount</SortableHeader>
                      )}
                      <SortableHeader field="date" className="text-center">Date</SortableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {registrationsData?.registrations && registrationsData.registrations.length > 0 ? (
                      getSortedRegistrations()
                        .filter((registration) => selectedBatch === 'all' || registration.user?.batch === parseInt(selectedBatch))
                        .map((registration) => (
                        <tr key={registration.id} className="border-b border-gray-700 hover:bg-gray-700">
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                                {registration.user?.profileImage ? (
                                  <img 
                                    src={`${import.meta.env.VITE_API_BASE_URL}/users/profile-picture/${registration.user.id}`}
                                    alt={registration.user?.fullName || 'User'}
                                    className="w-10 h-10 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (nextSibling) {
                                        nextSibling.style.display = 'flex';
                                      }
                                    }}
                                  />
                                ) : null}
                                <UserIcon className="h-6 w-6 text-gray-400" style={{ display: registration.user?.profileImage ? 'none' : 'block' }} />
                              </div>
                              <div>
                                <p className="text-white font-medium">{registration.user?.fullName || 'N/A'}</p>
                                {registrationsData.privacySettings.showUserEmails && registration.user?.email && (
                                  <p className="text-sm text-gray-400">{registration.user.email}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center text-gray-300">{registration.user?.batch || 'N/A'}</td>
                          <td className="py-4 px-4 text-center text-gray-300">{registration.totalGuests || 0}</td>
                          {registrationsData.privacySettings.showDonationAmounts && (
                            <td className="py-4 px-4 text-center text-gray-300">{formatAmount(registration.donationAmount || 0)}</td>
                          )}
                          {registrationsData.privacySettings.showPaymentAmounts && (
                            <td className="py-4 px-4 text-center text-gray-300">{formatAmount(registration.totalAmount || 0)}</td>
                          )}
                          <td className="py-4 px-4 text-center text-gray-300">{registration.registrationDate ? formatDate(registration.registrationDate) : 'N/A'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400">
                          {selectedBatch !== 'all' ? 'No registrations found for the selected batch' : 'No registrations available for public viewing'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Privacy Notice */}
        {selectedEventId !== 'all' && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Privacy Notice:</strong> This analytics view respects privacy settings configured by event administrators. 
              Some information may be hidden based on these settings.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PublicEventAnalytics