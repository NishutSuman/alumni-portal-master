import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
  CogIcon,
  XMarkIcon,
  CurrencyRupeeIcon,
  GiftIcon,
  UsersIcon
} from '@heroicons/react/24/outline'
import { useGetEventsQuery } from '../../store/api/eventApi'
import { useGetEventRegistrationsAdminQuery, useGetUserBatchesQuery } from '../../store/api/adminApi'
import type { RootState } from '../../store'
import toast from 'react-hot-toast'
import { getApiUrl } from '@/utils/helpers'

interface Event {
  id: string
  title: string
  eventDate: string
  status: string
}

interface Registration {
  id: string
  user: {
    id: string
    fullName: string
    batch: number
    profileImage?: string
  }
  totalGuests: number
  donationAmount: number
  totalAmount: number
  registrationDate: string
  status: string
}

interface EventRegistrationData {
  registrations: Registration[]
  totalCount: number
}

type SortField = 'batch' | 'date' | 'totalAmount'
type SortOrder = 'asc' | 'desc'

const EventAnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'registration'>('registration')
  const [selectedEventId, setSelectedEventId] = useState<string>('all')
  const [selectedBatch, setSelectedBatch] = useState<string>('all')
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [privacySettings, setPrivacySettings] = useState({
    showPaymentAmounts: false,
    showDonationAmounts: false,
    enablePublicDashboard: true
  })
  const [isSaving, setIsSaving] = useState(false)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  
  // Get auth token from Redux store
  const auth = useSelector((state: RootState) => state.auth)
  
  // Direct fetch for events (RTK Query has auth issues)
  const [eventsData, setEventsData] = useState<any>(null)
  const [eventsLoading, setEventsLoading] = useState(true)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setEventsLoading(true)
        const response = await fetch(getApiUrl('/api/events?status=PUBLISHED&limit=100'))
        const data = await response.json()
        setEventsData(data)
      } catch (error) {
        console.error('Direct fetch events error:', error)
      } finally {
        setEventsLoading(false)
      }
    }
    
    fetchEvents()
  }, [])

  // Fetch privacy settings when event is selected
  useEffect(() => {
    const fetchPrivacySettings = async () => {
      if (selectedEventId === 'all') {
        setPrivacySettings({
          showPaymentAmounts: false,
          showDonationAmounts: false,
          enablePublicDashboard: true
        })
        return
      }

      try {
        const token = auth.token || localStorage.getItem('token')
        const response = await fetch(getApiUrl(`/api/events/${selectedEventId}/privacy-settings`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setPrivacySettings({
            showPaymentAmounts: data.data.settings.showPaymentAmounts || false,
            showDonationAmounts: data.data.settings.showDonationAmounts || false,
            enablePublicDashboard: data.data.settings.enablePublicDashboard !== false
          })
        }
      } catch (error) {
        console.error('Error fetching privacy settings:', error)
      }
    }

    fetchPrivacySettings()
  }, [selectedEventId])
  
  // Use RTK Query for batches
  const { data: batchesData, isLoading: batchesLoading, error: batchesError } = useGetUserBatchesQuery()
  
  // Build query parameters - RTK Query filters out undefined values automatically
  const queryParams: any = {
    page: 1,
    limit: 50,
  }
  
  // Only add eventId if it's not 'all'
  if (selectedEventId !== 'all') {
    queryParams.eventId = selectedEventId
  }
  
  // Only add batch if it's not 'all'
  if (selectedBatch !== 'all') {
    queryParams.batch = selectedBatch
  }
  


  // Call registrations API for registration tab
  const { data: registrationsData, isLoading: registrationsLoading } = useGetEventRegistrationsAdminQuery(queryParams, {
    skip: activeTab !== 'registration' || selectedEventId === 'all'
  })

  // Call admin dashboard API for overview tab - different endpoint with full analytics
  const { data: overviewData, isLoading: overviewLoading } = useGetEventRegistrationsAdminQuery({
    eventId: selectedEventId,
    page: 1,
    limit: 1, // We only need the analytics data, not the actual registrations
  }, {
    skip: activeTab !== 'overview' || selectedEventId === 'all'
  })
  
  const events = eventsData?.data || []
  const batches = Array.isArray(batchesData?.data) ? batchesData.data : 
                  Array.isArray(batchesData) ? batchesData :
                  [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015]
  // Handle different possible response structures
  const registrations = registrationsData?.data?.registrations || 
                        registrationsData?.registrations || 
                        (Array.isArray(registrationsData) ? registrationsData : [])
  const loading = eventsLoading || batchesLoading || (activeTab === 'registration' ? registrationsLoading : overviewLoading)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const getSortedRegistrations = () => {
    if (!registrations || !sortField) {
      return registrations
    }

    return [...registrations].sort((a, b) => {
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
  



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`
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

  const savePrivacySettings = async () => {
    if (selectedEventId === 'all') {
      toast.error('Please select an event first')
      return
    }

    setIsSaving(true)
    try {
      const token = auth.token || localStorage.getItem('token')
      
      const response = await fetch(getApiUrl(`/api/events/${selectedEventId}/privacy-settings`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(privacySettings)
      })

      if (response.ok) {
        toast.success('Privacy settings saved successfully!')
        setShowSettingsModal(false)
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving privacy settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-8">Event Analytics</h1>
        </div>

        {/* Filters */}
        <div className="flex justify-center gap-4 mb-8">
          {/* Event Dropdown */}
          <div className="relative">
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value)
                setSortField(null) // Reset sorting when changing events
              }}
              className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white min-w-80 appearance-none focus:outline-none focus:border-blue-500"
            >
              <option value="all">Default All Event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="h-5 w-5 absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>

          {/* Batch Dropdown */}
          <div className="relative">
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white min-w-48 appearance-none focus:outline-none focus:border-blue-500"
            >
              <option value="all">Select Batch</option>
              {batches.map((batch) => (
                <option key={batch} value={batch.toString()}>
                  {batch}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="h-5 w-5 absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>

          {/* Event Settings Button */}
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
          >
            <CogIcon className="h-5 w-5 text-gray-300" />
            <span className="text-sm text-gray-300">Settings</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'overview' 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('registration')}
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
        {activeTab === 'overview' ? (
          <div className="bg-gray-800 rounded-2xl p-8">
            <h3 className="text-xl mb-6 text-white">Overview Analytics</h3>
            
            {selectedEventId === 'all' ? (
              <div className="text-center py-8">
                <p className="text-gray-400">Please select an event from the dropdown to view analytics</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                <p className="mt-2 text-gray-400">Loading overview...</p>
              </div>
            ) : (
              <>
                {/* Overview Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {/* Total Registrations - Include users + guests */}
                  <div className="bg-gray-700 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Total Registrations</p>
                        <p className="text-2xl font-bold text-white">
                          {(overviewData?.statistics?.totalRegistrations || 0) + (overviewData?.statistics?.totalGuests || 0)}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <UserIcon className="h-8 w-8 text-blue-400" />
                      </div>
                    </div>
                  </div>

                  {/* Total Guests */}
                  <div className="bg-gray-700 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Total Guests</p>
                        <p className="text-2xl font-bold text-white">{overviewData?.statistics?.totalGuests || 0}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <UsersIcon className="h-8 w-8 text-purple-400" />
                      </div>
                    </div>
                  </div>

                  {/* Total Donations */}
                  <div className="bg-gray-700 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Total Donations</p>
                        <p className="text-2xl font-bold text-white">
                          ₹{(overviewData?.statistics?.totalDonations || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <GiftIcon className="h-8 w-8 text-yellow-400" />
                      </div>
                    </div>
                  </div>

                  {/* Total Collection - Sum of all totalAmount minus Razorpay fees */}
                  <div className="bg-gray-700 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Total Collection</p>
                        <p className="text-2xl font-bold text-white">
                          ₹{(overviewData?.statistics?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <CurrencyRupeeIcon className="h-8 w-8 text-green-400" />
                      </div>
                    </div>
                  </div>
                </div>


                {/* Batch Participation Details Table */}
                {overviewData?.batchStats?.batches && overviewData.batchStats.batches.length > 0 && (
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
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Total Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-600">
                            {overviewData.batchStats.batches.map((batchData: any) => (
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
                                    {((batchData.statistics.registrationCount / batchData.statistics.uniqueUsers) * 100).toFixed(1)}%
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                                  ₹{batchData.statistics.totalRevenue.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Batch wise Revenue Sources */}
                {overviewData?.batchStats?.batches && overviewData.batchStats.batches.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Batch wise Revenue Sources</h4>
                    <div className="bg-gray-700 rounded-lg p-6">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {overviewData.batchStats.batches.slice(0, 4).map((batchData: any) => {
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
            {loading ? (
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
                      <th className="text-center py-4 px-4 text-gray-300 font-medium">Donation</th>
                      <SortableHeader field="totalAmount" className="text-center">Total Amount</SortableHeader>
                      <SortableHeader field="date" className="text-center">Date</SortableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.length > 0 ? (
                      getSortedRegistrations().map((registration) => (
                        <tr key={registration.id} className="border-b border-gray-700 hover:bg-gray-700">
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                                {registration.user?.profileImage ? (
                                  <img
                                    src={getApiUrl(`/api/users/profile-picture/${registration.user.id}`)}
                                    alt={registration.user.fullName}
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
                                <p className="text-white font-medium">{registration.user?.fullName}</p>
                                <p className="text-sm text-gray-400">{registration.user?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center text-gray-300">{registration.user?.batch}</td>
                          <td className="py-4 px-4 text-center text-gray-300">{registration.totalGuests}</td>
                          <td className="py-4 px-4 text-center text-gray-300">{formatAmount(registration.donationAmount)}</td>
                          <td className="py-4 px-4 text-center text-gray-300">{formatAmount(registration.totalAmount)}</td>
                          <td className="py-4 px-4 text-center text-gray-300">{formatDate(registration.registrationDate)}</td>
                        </tr>
                      ))
                    ) : selectedEventId === 'all' ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                          Please select an event from the dropdown to view registrations
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                          No registrations found for the selected event and filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Event Privacy Settings</h2>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Show Payment Amounts</h3>
                  <p className="text-gray-400 text-sm">Display payment amounts to public users</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={privacySettings.showPaymentAmounts}
                    onChange={(e) => setPrivacySettings({
                      ...privacySettings,
                      showPaymentAmounts: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Show Donation Amounts</h3>
                  <p className="text-gray-400 text-sm">Display donation amounts to public users</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={privacySettings.showDonationAmounts}
                    onChange={(e) => setPrivacySettings({
                      ...privacySettings,
                      showDonationAmounts: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button 
                onClick={savePrivacySettings}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventAnalyticsDashboard