// src/pages/admin/EventsManagement.tsx
import React, { useState } from 'react'
import { 
  MagnifyingGlassIcon,
  PlusIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { 
  useGetEventsQuery, 
  useGetEventCategoriesQuery,
  useDeleteEventMutation,
  useUpdateEventStatusMutation,
  useUpdateEventMutation,
  Event 
} from '@/store/api/eventApi'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import CreateEventForm from '@/components/admin/CreateEventForm'
import EventAnalyticsDashboard from '@/components/admin/EventAnalyticsDashboard'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EventsManagement: React.FC = () => {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [selectedMode, setSelectedMode] = useState<string>('ALL')
  const [activeTab, setActiveTab] = useState<'events' | 'create' | 'analytics'>('events')
  const [currentPage, setCurrentPage] = useState(1)
  
  // Modal states
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  
  // Fetch events with current filters
  const {
    data: eventsData,
    isLoading,
    isError,
    error,
  } = useGetEventsQuery({
    page: currentPage,
    limit: 20,
    search: searchTerm || undefined,
    category: selectedCategory === 'ALL' ? undefined : selectedCategory,
    status: selectedStatus === 'ALL' ? undefined : selectedStatus,
    mode: selectedMode === 'ALL' ? undefined : selectedMode,
  })

  // Fetch categories for filter
  const { data: categoriesData } = useGetEventCategoriesQuery()

  const [deleteEvent] = useDeleteEventMutation()
  const [updateEventStatus] = useUpdateEventStatusMutation()
  const [updateEvent] = useUpdateEventMutation()

  const events = eventsData?.events || []
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const categories = categoriesData?.categories || []


  // Filter options
  const statusOptions = [
    { value: 'ALL', label: 'All Status' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PUBLISHED', label: 'Published' },
    { value: 'REGISTRATION_OPEN', label: 'Registration Open' },
    { value: 'REGISTRATION_CLOSED', label: 'Registration Closed' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ]

  const modeOptions = [
    { value: 'ALL', label: 'All Modes' },
    { value: 'PHYSICAL', label: 'Physical' },
    { value: 'VIRTUAL', label: 'Virtual' },
    { value: 'HYBRID', label: 'Hybrid' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
      case 'PUBLISHED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'REGISTRATION_OPEN': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'REGISTRATION_CLOSED': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'COMPLETED': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'PHYSICAL': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'VIRTUAL': return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'HYBRID': return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      default: return 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteEvent(eventId).unwrap()
      toast.success('Event deleted successfully')
    } catch (error: any) {
      console.error('Delete event error:', error)
      toast.error(error?.data?.message || 'Failed to delete event')
    }
  }

  const handleUpdateStatus = async (eventId: string, newStatus: string) => {
    try {
      await updateEventStatus({ id: eventId, status: newStatus }).unwrap()
      toast.success('Event status updated successfully')
    } catch (error: any) {
      console.error('Update status error:', error)
      toast.error(error?.data?.message || 'Failed to update event status')
    }
  }

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event)
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setSelectedEvent(null)
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
            Failed to Load Events
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {(error as any)?.data?.message || 'Something went wrong'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-shrink-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                <CalendarDaysIcon className="w-8 h-8 mr-3 text-blue-600" />
                Events Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage organization events, registrations, and categories
              </p>
            </div>
            
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'events'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center">
              <CalendarDaysIcon className="w-5 h-5 mr-2" />
              Events ({events.length})
            </div>
          </button>
          {isSuperAdmin && (
            <>
              <button
                onClick={() => setActiveTab('create')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'create'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Create Event
                </div>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'analytics'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <ChartBarIcon className="w-5 h-5 mr-2" />
                  Analytics
                </div>
              </button>
            </>
          )}
          </nav>
        </div>
      </div>

      {/* Tab Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      {activeTab === 'events' && (
        <>
          {/* Filters and Search */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search events..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 lg:w-auto">
                {/* Category Filter */}
                <div className="sm:w-48">
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="sm:w-48">
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mode Filter */}
                <div className="sm:w-48">
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={selectedMode}
                    onChange={(e) => setSelectedMode(e.target.value)}
                  >
                    {modeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Events Table */}
          {events.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Mode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Registrations
                      </th>
                      {isSuperAdmin && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {events.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-12 w-12">
                              {event.heroImage ? (
                                <img
                                  className="h-12 w-12 rounded-lg object-cover"
                                  src={`${import.meta.env.VITE_API_BASE_URL}/events/${event.id}/hero-image`}
                                  alt={event.title}
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                  <CalendarDaysIcon className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {event.title}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {event.category?.name || 'No category'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {format(new Date(event.eventDate), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {event.startTime && event.endTime
                              ? `${event.startTime} - ${event.endTime}`
                              : 'Time TBD'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(event.status)}`}>
                            {event.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getModeColor(event.eventMode)}`}>
                            {event.eventMode}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {event.totalAttendees || event._count?.registrations || 0}
                          {event.maxCapacity && ` / ${event.maxCapacity}`}
                        </td>
                        {isSuperAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleEditEvent(event)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Edit
                              </button>
                              {(event.totalAttendees || event._count?.registrations || 0) === 0 ? (
                                <button
                                  onClick={() => handleDeleteEvent(event.id, event.title)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Delete
                                </button>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 text-xs cursor-not-allowed" title="Cannot delete event with registrations">
                                  Delete Disabled
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <CalendarDaysIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                No Events Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || selectedMode !== 'ALL'
                  ? 'Try adjusting your search or filters'
                  : 'No events are currently available'}
              </p>
              {isSuperAdmin && !searchTerm && selectedCategory === 'ALL' && (
                <button
                  onClick={() => setActiveTab('create')}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Create Your First Event
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Event Tab */}
      {activeTab === 'create' && isSuperAdmin && (
        <CreateEventForm />
      )}


      {/* Analytics Tab */}
      {activeTab === 'analytics' && isSuperAdmin && (
        <EventAnalyticsDashboard />
      )}

        </div>
      </div>

      {/* Edit Event Modal */}
      {showEditModal && selectedEvent && (
        <EditEventModal
          event={selectedEvent}
          categories={categories}
          onClose={handleCloseEditModal}
          onUpdate={updateEvent}
        />
      )}
    </div>
  )
}

// Edit Event Modal Component  
interface EditEventModalProps {
  event: Event
  categories: any[]
  onClose: () => void
  onUpdate: any
}

interface EditEventFormData {
  title: string
  description: string
  eventDate: string
  startTime: string
  endTime: string
  categoryId: string
  venue: string
  meetingLink: string
  maxCapacity: string
  eventMode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID'
  registrationStartDate: string
  registrationEndDate: string
  hasRegistration: boolean
  hasExternalLink: boolean
  externalRegistrationLink: string
  hasCustomForm: boolean
  hasMeals: boolean
  hasGuests: boolean
  hasDonations: boolean
  hasPrizes: boolean
  hasOrganizers: boolean
  allowFormModification: boolean
  formModificationDeadlineHours: string
  prizeDetails: string
  organizerDetails: string
  status: string
  heroImage: File | null
}

const EditEventModal: React.FC<EditEventModalProps> = ({ event, categories, onClose, onUpdate }) => {
  const [isUpdating, setIsUpdating] = useState(false)
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<EditEventFormData>({
    title: '',
    description: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    categoryId: '',
    venue: '',
    meetingLink: '',
    maxCapacity: '',
    eventMode: 'PHYSICAL',
    registrationStartDate: '',
    registrationEndDate: '',
    hasRegistration: false,
    hasExternalLink: false,
    externalRegistrationLink: '',
    hasCustomForm: false,
    hasMeals: false,
    hasGuests: false,
    hasDonations: false,
    hasPrizes: false,
    hasOrganizers: false,
    allowFormModification: false,
    formModificationDeadlineHours: '24',
    prizeDetails: '',
    organizerDetails: '',
    status: 'DRAFT',
    heroImage: null,
  })

  // Initialize form data when event changes
  React.useEffect(() => {
    if (event) {
      console.log('Initializing form with event:', event)
      const newFormData = {
        title: event.title || '',
        description: event.description || '',
        eventDate: event.eventDate ? event.eventDate.split('T')[0] : '',
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        categoryId: event.categoryId || event.category?.id || '',
        venue: event.venue || '',
        meetingLink: event.meetingLink || '',
        maxCapacity: event.maxCapacity?.toString() || '',
        eventMode: event.eventMode || 'PHYSICAL',
        registrationStartDate: event.registrationStartDate ? event.registrationStartDate.split('T')[0] : '',
        registrationEndDate: event.registrationEndDate ? event.registrationEndDate.split('T')[0] : '',
        hasRegistration: Boolean(event.hasRegistration),
        hasExternalLink: Boolean(event.hasExternalLink),
        externalRegistrationLink: event.externalRegistrationLink || '',
        hasCustomForm: Boolean(event.hasCustomForm),
        hasMeals: Boolean(event.hasMeals),
        hasGuests: Boolean(event.hasGuests),
        hasDonations: Boolean(event.hasDonations),
        hasPrizes: Boolean(event.hasPrizes),
        hasOrganizers: Boolean(event.hasOrganizers),
        allowFormModification: Boolean(event.allowFormModification),
        formModificationDeadlineHours: event.formModificationDeadlineHours?.toString() || '24',
        prizeDetails: event.prizeDetails || '',
        organizerDetails: event.organizerDetails || '',
        status: event.status || 'DRAFT',
        heroImage: null,
      }
      console.log('Setting form data to:', newFormData)
      setFormData(newFormData)
    }
  }, [event])

  // Set initial hero image preview
  React.useEffect(() => {
    if (event.heroImage) {
      setHeroImagePreview(`${import.meta.env.VITE_API_BASE_URL}/events/${event.id}/hero-image`)
    }
  }, [event])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => {
        let newData = { ...prev, [name]: value }
        
        // Clear irrelevant fields when event mode changes
        if (name === 'eventMode') {
          if (value === 'VIRTUAL') {
            newData.venue = ''
            newData.hasMeals = false
            newData.hasGuests = false
            newData.prizeDetails = ''
            newData.organizerDetails = ''
          } else if (value === 'PHYSICAL') {
            newData.meetingLink = ''
          }
        }
        
        return newData
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      setFormData(prev => ({ ...prev, heroImage: file }))
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      setHeroImagePreview(previewUrl)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error('Event title is required')
      return
    }

    if (!formData.eventDate) {
      toast.error('Event date is required')
      return
    }

    // Conditional validation based on event mode
    if (formData.eventMode === 'PHYSICAL' && !formData.venue.trim()) {
      toast.error('Venue is required for physical events')
      return
    }

    if (formData.eventMode === 'VIRTUAL' && !formData.meetingLink.trim()) {
      toast.error('Meeting link is required for virtual events')
      return
    }

    if (formData.eventMode === 'HYBRID' && !formData.venue.trim() && !formData.meetingLink.trim()) {
      toast.error('Either venue or meeting link is required for hybrid events')
      return
    }

    setIsUpdating(true)

    try {
      const updateFormData = new FormData()
      
      // Add required fields
      updateFormData.append('title', formData.title.trim())
      updateFormData.append('eventDate', formData.eventDate)
      updateFormData.append('eventMode', formData.eventMode)
      updateFormData.append('status', formData.status)

      // Add optional text fields only if they have values
      if (formData.description.trim()) {
        updateFormData.append('description', formData.description.trim())
      }
      if (formData.startTime) {
        updateFormData.append('startTime', formData.startTime)
      }
      if (formData.endTime) {
        updateFormData.append('endTime', formData.endTime)
      }
      if (formData.categoryId) {
        updateFormData.append('categoryId', formData.categoryId)
      }
      if (formData.venue.trim()) {
        updateFormData.append('venue', formData.venue.trim())
      }
      if (formData.meetingLink.trim()) {
        updateFormData.append('meetingLink', formData.meetingLink.trim())
      }
      if (formData.maxCapacity) {
        updateFormData.append('maxCapacity', formData.maxCapacity)
      }
      if (formData.registrationStartDate) {
        updateFormData.append('registrationStartDate', formData.registrationStartDate)
      }
      if (formData.registrationEndDate) {
        updateFormData.append('registrationEndDate', formData.registrationEndDate)
      }
      if (formData.formModificationDeadlineHours) {
        updateFormData.append('formModificationDeadlineHours', formData.formModificationDeadlineHours)
      }
      if (formData.externalRegistrationLink.trim()) {
        updateFormData.append('externalRegistrationLink', formData.externalRegistrationLink.trim())
      }

      // Add boolean fields as strings
      updateFormData.append('hasRegistration', formData.hasRegistration.toString())
      updateFormData.append('hasExternalLink', formData.hasExternalLink.toString())
      updateFormData.append('hasCustomForm', formData.hasCustomForm.toString())
      updateFormData.append('hasMeals', formData.hasMeals.toString())
      updateFormData.append('hasGuests', formData.hasGuests.toString())
      updateFormData.append('hasDonations', formData.hasDonations.toString())
      updateFormData.append('hasPrizes', formData.hasPrizes.toString())
      updateFormData.append('hasOrganizers', formData.hasOrganizers.toString())
      updateFormData.append('allowFormModification', formData.allowFormModification.toString())

      // Add conditional details fields
      if (formData.hasPrizes && formData.prizeDetails.trim()) {
        updateFormData.append('prizeDetails', formData.prizeDetails.trim())
      }
      if (formData.hasOrganizers && formData.organizerDetails.trim()) {
        updateFormData.append('organizerDetails', formData.organizerDetails.trim())
      }

      // Add file if present
      if (formData.heroImage) {
        updateFormData.append('heroImage', formData.heroImage)
      }

      await onUpdate({ id: event.id, data: updateFormData }).unwrap()
      toast.success('Event updated successfully')
      onClose()
    } catch (error: any) {
      console.error('Update event error:', error)
      toast.error(error?.data?.message || 'Failed to update event')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-6xl sm:p-6">
          {/* Header */}
          <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Event: {event.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Update event details and settings
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="md:col-span-2">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    📋 Basic Information
                  </h4>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter event title"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Event description..."
                  />
                </div>

                <div>
                  <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    id="categoryId"
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="REGISTRATION_OPEN">Registration Open</option>
                    <option value="REGISTRATION_CLOSED">Registration Closed</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                {/* Hero Image */}
                <div className="md:col-span-2">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    🖼️ Event Image
                  </h4>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="heroImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hero Image
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      {heroImagePreview ? (
                        <div className="relative">
                          <img
                            src={heroImagePreview}
                            alt="Preview"
                            className="mx-auto h-32 w-auto rounded-md object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setHeroImagePreview(null)
                              setFormData(prev => ({ ...prev, heroImage: null }))
                            }}
                            className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <>
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="flex text-sm text-gray-600 dark:text-gray-400">
                            <label htmlFor="heroImage" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                              <span>Upload a file</span>
                              <input
                                id="heroImage"
                                name="heroImage"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="sr-only"
                              />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                        </>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  </div>
                </div>

                {/* Date and Time */}
                <div className="md:col-span-2">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    📅 Date and Time
                  </h4>
                </div>

                <div>
                  <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    id="eventDate"
                    name="eventDate"
                    value={formData.eventDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="maxCapacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    id="maxCapacity"
                    name="maxCapacity"
                    value={formData.maxCapacity}
                    onChange={handleInputChange}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Maximum attendees"
                  />
                </div>

                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Location */}
                <div className="md:col-span-2">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    📍 Location
                  </h4>
                </div>

                <div>
                  <label htmlFor="eventMode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Mode *
                  </label>
                  <select
                    id="eventMode"
                    name="eventMode"
                    value={formData.eventMode}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="PHYSICAL">🏢 Physical Event</option>
                    <option value="VIRTUAL">💻 Virtual Event</option>
                    <option value="HYBRID">🔄 Hybrid Event</option>
                  </select>
                </div>

                <div className="md:col-span-1">
                </div>

                {(formData.eventMode === 'PHYSICAL' || formData.eventMode === 'HYBRID') && (
                  <div>
                    <label htmlFor="venue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Venue {formData.eventMode === 'PHYSICAL' && '*'}
                    </label>
                    <input
                      type="text"
                      id="venue"
                      name="venue"
                      value={formData.venue}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Event venue address"
                      required={formData.eventMode === 'PHYSICAL'}
                    />
                  </div>
                )}

                {(formData.eventMode === 'VIRTUAL' || formData.eventMode === 'HYBRID') && (
                  <div>
                    <label htmlFor="meetingLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Meeting Link {formData.eventMode === 'VIRTUAL' && '*'}
                    </label>
                    <input
                      type="url"
                      id="meetingLink"
                      name="meetingLink"
                      value={formData.meetingLink}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://meet.google.com/..."
                      required={formData.eventMode === 'VIRTUAL'}
                    />
                  </div>
                )}

                {/* Registration */}
                <div className="md:col-span-2">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    📝 Registration Settings
                  </h4>
                </div>

                {/* Registration and Guest Fees (Read-only) */}
                <div>
                  <label htmlFor="registrationFee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Registration Fee (₹) <span className="text-xs text-gray-500">(Read-only)</span>
                  </label>
                  <input
                    type="number"
                    id="registrationFee"
                    value={event.registrationFee || 0}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="guestFee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Guest Fee (₹) <span className="text-xs text-gray-500">(Read-only)</span>
                  </label>
                  <input
                    type="number"
                    id="guestFee"
                    value={event.guestFee || 0}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="registrationStartDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Registration Start Date
                  </label>
                  <input
                    type="date"
                    id="registrationStartDate"
                    name="registrationStartDate"
                    value={formData.registrationStartDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="registrationEndDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Registration End Date
                  </label>
                  <input
                    type="date"
                    id="registrationEndDate"
                    name="registrationEndDate"
                    value={formData.registrationEndDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {formData.hasExternalLink && (
                  <div className="md:col-span-2">
                    <label htmlFor="externalRegistrationLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      External Registration Link
                    </label>
                    <input
                      type="url"
                      id="externalRegistrationLink"
                      name="externalRegistrationLink"
                      value={formData.externalRegistrationLink}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://external-registration-site.com"
                    />
                  </div>
                )}

                {/* Features */}
                <div className="md:col-span-2">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    ⚙️ Event Features
                  </h4>
                </div>

                <div className="md:col-span-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="hasRegistration"
                        checked={formData.hasRegistration}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Registration</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="hasExternalLink"
                        checked={formData.hasExternalLink}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">External Link</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="hasCustomForm"
                        checked={formData.hasCustomForm}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Custom Form</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="hasMeals"
                        checked={formData.hasMeals}
                        onChange={handleInputChange}
                        disabled={formData.eventMode === 'VIRTUAL'}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Meals</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="hasGuests"
                        checked={formData.hasGuests}
                        onChange={handleInputChange}
                        disabled={formData.eventMode === 'VIRTUAL'}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Guests</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="hasDonations"
                        checked={formData.hasDonations}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Donations</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="hasPrizes"
                        checked={formData.hasPrizes}
                        onChange={handleInputChange}
                        disabled={formData.eventMode === 'VIRTUAL'}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Prizes</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="hasOrganizers"
                        checked={formData.hasOrganizers}
                        onChange={handleInputChange}
                        disabled={formData.eventMode === 'VIRTUAL'}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Organizers</span>
                    </label>
                  </div>
                </div>

                {/* Conditional Details */}
                {formData.hasPrizes && (
                  <div className="md:col-span-2">
                    <label htmlFor="prizeDetails" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Prize Details
                    </label>
                    <textarea
                      id="prizeDetails"
                      name="prizeDetails"
                      value={formData.prizeDetails}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Describe the prizes available..."
                    />
                  </div>
                )}

                {formData.hasOrganizers && (
                  <div className="md:col-span-2">
                    <label htmlFor="organizerDetails" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Organizer Details
                    </label>
                    <textarea
                      id="organizerDetails"
                      name="organizerDetails"
                      value={formData.organizerDetails}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Information about event organizers..."
                    />
                  </div>
                )}

                {/* Form Modification Settings */}
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="allowFormModification"
                        checked={formData.allowFormModification}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Allow form modification
                      </span>
                    </label>

                    {formData.allowFormModification && (
                      <div className="flex items-center space-x-2">
                        <label htmlFor="formModificationDeadlineHours" className="text-sm text-gray-700 dark:text-gray-300">
                          Deadline (hours):
                        </label>
                        <input
                          type="number"
                          id="formModificationDeadlineHours"
                          name="formModificationDeadlineHours"
                          value={formData.formModificationDeadlineHours}
                          onChange={handleInputChange}
                          min="1"
                          className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isUpdating && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isUpdating ? 'Updating...' : 'Update Event'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EventsManagement