import React, { useState, useEffect } from 'react'
import { CalendarIcon, MapPinIcon, ClockIcon, UsersIcon, CurrencyRupeeIcon, EyeIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { useGetEventsQuery } from '@/store/api/eventApi'
import { useGetMyEventRegistrationsQuery } from '@/store/api/userApi'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import EventDetailsModal from '@/components/common/UI/EventDetailsModal'
import EventRegistrationModal from '@/components/common/UI/EventRegistrationModal'
import RegistrationDetailsModal from '@/components/common/UI/RegistrationDetailsModal'
import QRCodeModal from '@/components/common/UI/QRCodeModal'
import InvoiceModal from '@/components/common/UI/InvoiceModal'
import TicketModal from '@/components/common/UI/TicketModal'
import PublicEventAnalytics from '@/components/user/PublicEventAnalytics'
import { useAuth } from '@/hooks/useAuth'
import { useGetInvoiceQuery, useGenerateInvoiceMutation } from '@/store/api/invoiceApi'
import { format } from 'date-fns'

interface Event {
  id: string
  title: string
  description: string
  eventDate: string
  startTime?: string
  endTime?: string
  venue?: string
  meetingLink?: string
  eventMode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID'
  status: string
  maxCapacity?: number
  registrationFee: string | number
  guestFee: string | number
  heroImage?: string
  category?: {
    name: string
  }
  _count?: {
    registrations: number
  }
  registrationCount?: number
}

const Events: React.FC = () => {
  const { user, auth } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState<'active' | 'booked' | 'past' | 'analytics'>('active')
  
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [showRegistrationDetailsModal, setShowRegistrationDetailsModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false)
  const [isLoadingTicket, setIsLoadingTicket] = useState(false)
  
  // Modal data states
  const [qrData, setQRData] = useState<any>(null)
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const [ticketData, setTicketData] = useState<any>(null)
  
  const { data: eventsData, isLoading, error } = useGetEventsQuery({
    page: 1,
    limit: 50,
    upcoming: undefined
  })

  const { data: registrationsData, isLoading: isLoadingRegistrations, error: registrationsError, refetch: refetchRegistrations } = useGetMyEventRegistrationsQuery({
    page: 1,
    limit: 50,
  })

  const events = eventsData?.events || []
  const registrations = registrationsData?.registrations || []
  const now = new Date()

  // Handle tab from URL query parameters or router state
  useEffect(() => {
    // First check router state (from navigation after registration)
    if (location.state?.activeTab && ['active', 'booked', 'past', 'analytics'].includes(location.state.activeTab)) {
      setActiveTab(location.state.activeTab as 'active' | 'booked' | 'past' | 'analytics')
      
      // Clear the router state after handling it to prevent unnecessary refetches
      navigate(location.pathname, { replace: true })
      return
    }
    
    // Fallback to URL query parameters
    const tabParam = searchParams.get('tab')
    if (tabParam && ['active', 'booked', 'past', 'analytics'].includes(tabParam)) {
      setActiveTab(tabParam as 'active' | 'booked' | 'past' | 'analytics')
    }
  }, [searchParams, location.state, navigate, location.pathname])

  // Refetch registrations when switching to 'booked' tab to ensure fresh data
  useEffect(() => {
    if (activeTab === 'booked') {
      refetchRegistrations()
    }
  }, [activeTab, refetchRegistrations])

  // Create a Set of registered event IDs for quick lookup
  const registeredEventIds = new Set(registrations.map(reg => reg.event?.id).filter(Boolean))

  // Filter events based on tab selection
  let filteredEvents
  if (activeTab === 'booked') {
    filteredEvents = registrations
      .filter(registration => registration.event)
      .map(registration => ({
        ...registration.event,
        registration: registration,
        hasQRCode: !!registration.qr,
        totalGuests: registration.guests?.length || 0,
        registrationStatus: registration.status,
        paymentStatus: registration.paymentStatus,
        mealPreference: registration.mealPreference,
        registrationDate: registration.createdAt,
        qrCode: registration.qr
      }))
  } else {
    filteredEvents = events.filter((event: Event) => {
      const eventDate = new Date(event.eventDate)
      if (activeTab === 'active') {
        return eventDate >= now && !['COMPLETED', 'CANCELLED'].includes(event.status)
      } else {
        return eventDate < now || ['COMPLETED', 'CANCELLED'].includes(event.status)
      }
    })
  }

  const formatEventTime = (date: string, startTime?: string, endTime?: string) => {
    const eventDate = new Date(date)
    const dateStr = format(eventDate, 'MMM dd, yyyy')
    
    if (startTime && endTime) {
      return `${dateStr} • ${startTime} - ${endTime}`
    } else if (startTime) {
      return `${dateStr} • ${startTime}`
    }
    return dateStr
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
      case 'REGISTRATION_OPEN':
        return 'bg-green-100 text-green-800'
      case 'REGISTRATION_CLOSED':
        return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleViewDetails = (event: Event) => {
    setSelectedEvent(event)
    setShowDetailsModal(true)
  }

  const handleRegister = (event: Event) => {
    setSelectedEvent(event)
    setShowRegistrationModal(true)
  }

  const handleViewRegistration = (event: any) => {
    // Find the full registration data for this event
    const registration = registrations.find(reg => reg.event?.id === event.id)
    if (registration) {
      setSelectedEvent(event)
      setSelectedRegistration(registration)
      setShowRegistrationDetailsModal(true)
    }
  }

  // Modal handlers for registration actions
  const handleViewInvoice = async () => {
    if (selectedRegistration?.paymentTransaction?.id) {
      setIsLoadingInvoice(true)
      setShowInvoiceModal(true) // Show modal immediately with loading state
      
      try {
        // Fetch both invoice data and organization details
        const [invoiceResult, orgResult] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE_URL}/payments/${selectedRegistration.paymentTransaction.id}/invoice`, {
            headers: {
              'Authorization': `Bearer ${auth.token || localStorage.getItem('token')}`,
            },
          }),
          fetch(`${import.meta.env.VITE_API_BASE_URL}/organization`, {
            headers: {
              'Authorization': `Bearer ${auth.token || localStorage.getItem('token')}`,
            },
          })
        ])
        
        if (invoiceResult.ok) {
          const invoiceResponse = await invoiceResult.json()
          let organizationData = {
            name: 'Alumni Portal Organization',
            officialEmail: 'admin@alumniportal.com',
            officeAddress: 'Organization Address'
          }

          // Use organization data if available
          if (orgResult.ok) {
            try {
              const orgResponse = await orgResult.json()
              if (orgResponse.data?.organization) {
                organizationData = {
                  name: orgResponse.data.organization.name || organizationData.name,
                  officialEmail: orgResponse.data.organization.officialEmail || organizationData.officialEmail,
                  officeAddress: orgResponse.data.organization.officeAddress || organizationData.officeAddress,
                  logoUrl: orgResponse.data.organization.logoUrl
                }
              }
            } catch (orgError) {
              console.warn('Failed to parse organization data:', orgError)
            }
          }
          
          setInvoiceData({
            invoice: invoiceResponse.data.invoice,
            transaction: selectedRegistration.paymentTransaction,
            registration: selectedRegistration,
            user: user,
            organization: organizationData
          })
        } else {
          console.error('Failed to fetch invoice data')
          alert('Failed to load invoice. Please try again.')
          setShowInvoiceModal(false)
        }
      } catch (error) {
        console.error('Error fetching invoice:', error)
        alert('Failed to load invoice. Please try again.')
        setShowInvoiceModal(false)
      } finally {
        setIsLoadingInvoice(false)
      }
    } else {
      // For free events or events without payment transactions, show a special message
      if (selectedRegistration?.totalAmount === 0) {
        alert('This is a free event. No invoice is available.')
      } else {
        alert('No payment transaction found for this registration.')
      }
    }
  }

  const handleViewQR = async () => {
    if (selectedRegistration?.qr?.qrCode) {
      // Use existing QR code if available
      setQRData({
        qrCode: selectedRegistration.qr.qrCode,
        qrImageUrl: selectedRegistration.qr.qrImageUrl,
        event: {
          title: selectedRegistration.event.title,
          eventDate: selectedRegistration.event.eventDate,
          venue: selectedRegistration.event.venue
        },
        user: {
          fullName: user?.fullName || 'User',
          email: user?.email || 'user@example.com'
        },
        registrationId: selectedRegistration.id
      })
      setShowQRModal(true)
    } else {
      // Generate QR code via API endpoint if not available
      try {
        const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/events/${selectedRegistration.event.id}/my-registration/qr-code`
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${auth.token || localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (response.ok) {
          const qrResponse = await response.json()
          
          const qrData = {
            qrCode: qrResponse.data?.qrCode || qrResponse.qrCode,
            qrImageUrl: qrResponse.data?.qrImageUrl || qrResponse.qrImageUrl,
            event: {
              title: selectedRegistration.event.title,
              eventDate: selectedRegistration.event.eventDate,
              venue: selectedRegistration.event.venue
            },
            user: {
              fullName: user?.fullName || 'User',
              email: user?.email || 'user@example.com'
            },
            registrationId: selectedRegistration.id
          }
          
          setQRData(qrData)
          setShowQRModal(true)
        } else {
          const errorText = await response.text()
          console.error('Failed to generate QR code:', response.status, errorText)
          alert(`Failed to generate QR code: ${response.status} - ${errorText}`)
        }
      } catch (error) {
        console.error('Error generating QR code:', error)
        alert('Failed to generate QR code. Please try again.')
      }
    }
  }

  const handleViewTicket = async () => {
    if (selectedRegistration) {
      setIsLoadingTicket(true)
      setShowTicketModal(true) // Show modal immediately with loading state
      
      try {
        const orgResult = await fetch(`${import.meta.env.VITE_API_BASE_URL}/organization`, {
          headers: {
            'Authorization': `Bearer ${auth.token || localStorage.getItem('token')}`,
          },
        })
        
        let organizationData = {
          name: 'Alumni Portal Organization'
        }

        if (orgResult.ok) {
          try {
            const orgResponse = await orgResult.json()
            if (orgResponse.data?.organization) {
              organizationData = {
                name: orgResponse.data.organization.name || organizationData.name,
                logoUrl: orgResponse.data.organization.logoUrl
              }
            }
          } catch (orgError) {
            console.warn('Failed to parse organization data:', orgError)
          }
        }
        
        setTicketData({
          registration: selectedRegistration,
          user: user,
          organization: organizationData
        })
        setIsLoadingTicket(false)
      } catch (error) {
        console.error('Error loading ticket:', error)
        setIsLoadingTicket(false)
        alert('Failed to load ticket.')
      }
    }
  }

  const closeModals = () => {
    setSelectedEvent(null)
    setSelectedRegistration(null)
    setQRData(null)
    setInvoiceData(null)
    setTicketData(null)
    setShowDetailsModal(false)
    setShowRegistrationModal(false)
    setShowRegistrationDetailsModal(false)
    setShowQRModal(false)
    setShowInvoiceModal(false)
    setShowTicketModal(false)
    setIsLoadingInvoice(false)
    setIsLoadingTicket(false)
  }

  const closeQRModal = () => {
    setQRData(null)
    setShowQRModal(false)
    // Keep other modals open
  }

  const closeInvoiceModal = () => {
    setInvoiceData(null)
    setShowInvoiceModal(false)
    setIsLoadingInvoice(false)
    // Keep other modals open
  }

  const closeTicketModal = () => {
    setTicketData(null)
    setShowTicketModal(false)
    setIsLoadingTicket(false)
    // Keep other modals open
  }

  const isLoadingAny = isLoading || (activeTab === 'booked' && isLoadingRegistrations)
  const errorAny = error || (activeTab === 'booked' && registrationsError)

  if (isLoadingAny) return <LoadingSpinner />

  if (errorAny) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">Failed to load events</div>
        <button 
          onClick={() => window.location.reload()} 
          className="btn-guild"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen lg:h-auto overflow-hidden lg:overflow-visible">
      {/* Header - Fixed on mobile */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 lg:bg-transparent lg:dark:bg-transparent px-4 sm:px-0 pt-4 lg:pt-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Events</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Discover and participate in alumni events
            </p>
          </div>
        </div>
      </div>

      {/* Tabs - Fixed on mobile */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 -mx-4 sm:mx-0 overflow-x-auto scrollbar-hide bg-white dark:bg-gray-900 lg:bg-transparent lg:dark:bg-transparent mt-4">
        <nav className="-mb-px flex space-x-2 sm:space-x-6 px-4 sm:px-0 min-w-min">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-2 sm:py-3 px-1.5 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'active'
                ? 'border-guild-500 text-guild-600 dark:text-guild-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-1 sm:gap-2">
              <span className="hidden sm:inline">Active Events</span>
              <span className="sm:hidden">Active</span>
              <span className="bg-guild-100 text-guild-600 dark:bg-guild-900/30 dark:text-guild-400 py-0.5 px-1.5 rounded-full text-xs">
                {events.filter((event: Event) => {
                  const eventDate = new Date(event.eventDate)
                  return eventDate >= now && !['COMPLETED', 'CANCELLED'].includes(event.status)
                }).length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('booked')}
            className={`py-2 sm:py-3 px-1.5 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'booked'
                ? 'border-guild-500 text-guild-600 dark:text-guild-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="hidden sm:inline">Your Bookings</span>
            <span className="sm:hidden">Bookings</span>
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`py-2 sm:py-3 px-1.5 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'past'
                ? 'border-guild-500 text-guild-600 dark:text-guild-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-1 sm:gap-2">
              <span className="hidden sm:inline">Past Events</span>
              <span className="sm:hidden">Past</span>
              <span className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 py-0.5 px-1.5 rounded-full text-xs">
                {events.filter((event: Event) => {
                  const eventDate = new Date(event.eventDate)
                  return eventDate < now || ['COMPLETED', 'CANCELLED'].includes(event.status)
                }).length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 sm:py-3 px-1.5 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'analytics'
                ? 'border-guild-500 text-guild-600 dark:text-guild-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-1">
              <ChartBarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </span>
          </button>
        </nav>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto lg:overflow-visible">
        <div className="py-4 sm:py-6 pb-24 lg:pb-6">
          {activeTab === 'analytics' ? (
            <div className="px-4 sm:px-0">
              <PublicEventAnalytics />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No {activeTab === 'booked' ? 'booked' : activeTab} events
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {activeTab === 'active'
                  ? "There are no upcoming events at the moment."
                  : activeTab === 'booked'
                  ? "You haven't registered for any events yet."
                  : "No past events to display."
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 px-4 sm:px-0">
          {filteredEvents.map((event: any) => (
            <div
              key={event.id}
              className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:shadow rounded-lg hover:shadow-lg transition-shadow duration-200"
            >
              {/* Event Image */}
              {event.heroImage && (
                <div className="aspect-w-16 aspect-h-9">
                  <img
                    src={`${import.meta.env.VITE_API_BASE_URL}/events/${event.id}/hero-image`}
                    alt={event.title}
                    className="w-full h-40 sm:h-48 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Event Content */}
              <div className="p-4 sm:p-6">
                {/* Category and Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  {event.category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 truncate">
                      {event.category.name}
                    </span>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(event.status)}`}>
                    {event.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Event Title */}
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {event.title}
                </h3>

                {/* Event Description */}
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4 line-clamp-2">
                  {event.description}
                </p>

                {/* Event Details */}
                <div className="space-y-1.5 sm:space-y-2">
                  {/* Date & Time */}
                  <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <CalendarIcon className="flex-shrink-0 mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="truncate">{formatEventTime(event.eventDate, event.startTime, event.endTime)}</span>
                  </div>

                  {/* Location/Mode */}
                  <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {event.eventMode === 'VIRTUAL' ? (
                      <>
                        <ClockIcon className="flex-shrink-0 mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          Virtual Event
                        </span>
                      </>
                    ) : (
                      <>
                        <MapPinIcon className="flex-shrink-0 mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="truncate flex-1">
                          {event.venue || 'Venue TBA'}
                        </span>
                        {event.eventMode === 'HYBRID' && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 whitespace-nowrap">
                            Hybrid
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Capacity & Registrations */}
                  {event.maxCapacity && (
                    <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      <UsersIcon className="flex-shrink-0 mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="truncate">{event._count?.registrations || event.registrationCount || 0} / {event.maxCapacity} registered</span>
                    </div>
                  )}

                  {/* Fee */}
                  {Number(event.registrationFee) > 0 && (
                    <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      <CurrencyRupeeIcon className="flex-shrink-0 mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="truncate">
                        ₹{event.registrationFee}
                        {Number(event.guestFee) > 0 && (
                          <span className="text-xs ml-1">(Guest: ₹{event.guestFee})</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-3 sm:mt-4 space-y-2">
                  {activeTab === 'active' ? (
                    <>
                      {/* Register Button - Show for PUBLISHED and REGISTRATION_OPEN events, hide if already registered */}
                      {(['PUBLISHED', 'REGISTRATION_OPEN'].includes(event.status)) && !registeredEventIds.has(event.id) && (
                        <button
                          className="w-full btn-guild text-xs sm:text-sm py-2.5 sm:py-2"
                          onClick={() => handleRegister(event)}
                        >
                          Register Now
                        </button>
                      )}

                      {/* Already Registered Badge */}
                      {registeredEventIds.has(event.id) && (
                        <div className="w-full text-center py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md text-xs sm:text-sm font-medium">
                          ✓ Already Registered
                        </div>
                      )}

                      {/* View Details Button */}
                      <button
                        className="w-full btn-secondary text-xs sm:text-sm py-2.5 sm:py-2 inline-flex items-center justify-center gap-1"
                        onClick={() => handleViewDetails(event)}
                      >
                        <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        View Details
                      </button>
                    </>
                  ) : activeTab === 'booked' ? (
                    /* Your Bookings - Show Registration Details */
                    <button
                      className="w-full btn-guild text-xs sm:text-sm py-2.5 sm:py-2 inline-flex items-center justify-center gap-1"
                      onClick={() => handleViewRegistration(event)}
                    >
                      <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      View Registration Details
                    </button>
                  ) : (
                    /* Past Events */
                    <button
                      className="w-full btn-secondary text-xs sm:text-sm py-2.5 sm:py-2 inline-flex items-center justify-center gap-1"
                      onClick={() => handleViewDetails(event)}
                    >
                      <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      View Event
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <EventDetailsModal
        event={selectedEvent}
        isOpen={showDetailsModal}
        onClose={closeModals}
      />
      
      <EventRegistrationModal
        event={selectedEvent}
        isOpen={showRegistrationModal}
        onClose={closeModals}
      />

      <RegistrationDetailsModal
        registration={selectedRegistration}
        isOpen={showRegistrationDetailsModal}
        onClose={closeModals}
        onViewInvoice={handleViewInvoice}
        onViewQR={handleViewQR}
        onViewTicket={handleViewTicket}
        isLoadingInvoice={isLoadingInvoice}
        isLoadingTicket={isLoadingTicket}
      />

      <QRCodeModal
        isOpen={showQRModal}
        onClose={closeQRModal}
        qrData={qrData}
      />

      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={closeInvoiceModal}
        isLoading={isLoadingInvoice}
        invoiceData={invoiceData}
      />

      <TicketModal
        isOpen={showTicketModal}
        onClose={closeTicketModal}
        ticketData={ticketData}
        isLoading={isLoadingTicket}
      />
    </div>
  )
}

export default Events