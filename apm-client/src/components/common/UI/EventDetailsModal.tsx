import React from 'react'
import { XMarkIcon, CalendarIcon, MapPinIcon, ClockIcon, UsersIcon, CurrencyRupeeIcon } from '@heroicons/react/24/outline'
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

interface EventDetailsModalProps {
  event: Event | null
  isOpen: boolean
  onClose: () => void
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ event, isOpen, onClose }) => {
  if (!isOpen || !event) return null

  const formatEventTime = (date: string, startTime?: string, endTime?: string) => {
    const eventDate = new Date(date)
    const dateStr = format(eventDate, 'EEEE, MMMM dd, yyyy')
    
    if (startTime && endTime) {
      return `${dateStr} • ${startTime} - ${endTime}`
    } else if (startTime) {
      return `${dateStr} • ${startTime}`
    }
    return dateStr
  }

  const getEventModeColor = (mode: string) => {
    switch (mode) {
      case 'VIRTUAL':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'HYBRID':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
      case 'REGISTRATION_OPEN':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'REGISTRATION_CLOSED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'DRAFT':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
          {/* Header */}
          <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-guild-500 focus:ring-offset-2"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Event Image */}
          {event.heroImage && (
            <div className="mb-6">
              <img
                src={`http://localhost:3000/api/events/${event.id}/hero-image`}
                alt={event.title}
                className="w-full h-64 object-cover rounded-lg"
                onError={(e) => {
                  console.error('Image failed to load:', event.heroImage);
                  console.error('Proxy URL:', `http://localhost:3000/api/events/${event.id}/hero-image`);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onLoad={() => {
                  console.log('Event image loaded successfully in modal via proxy:', `http://localhost:3000/api/events/${event.id}/hero-image`);
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-6">
            {/* Title and Category */}
            <div>
              <div className="flex items-center justify-between mb-2">
                {event.category && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    {event.category.name}
                  </span>
                )}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                  {event.status.replace('_', ' ')}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {event.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {event.description}
              </p>
            </div>

            {/* Event Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date & Time */}
              <div className="flex items-start space-x-3">
                <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Date & Time</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {formatEventTime(event.eventDate, event.startTime, event.endTime)}
                  </div>
                </div>
              </div>

              {/* Location/Mode */}
              <div className="flex items-start space-x-3">
                {event.eventMode === 'VIRTUAL' ? (
                  <ClockIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                ) : (
                  <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {event.eventMode === 'VIRTUAL' ? 'Event Mode' : 'Location'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {event.eventMode === 'VIRTUAL' ? (
                      <span className={`px-2 py-1 rounded-full text-xs ${getEventModeColor(event.eventMode)}`}>
                        Virtual Event
                      </span>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>{event.venue || 'Venue TBA'}</span>
                        {event.eventMode === 'HYBRID' && (
                          <span className={`px-2 py-1 rounded-full text-xs ${getEventModeColor(event.eventMode)}`}>
                            Hybrid
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Capacity */}
              {event.maxCapacity && (
                <div className="flex items-start space-x-3">
                  <UsersIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Capacity</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {event._count?.registrations || event.registrationCount || 0} / {event.maxCapacity} registered
                    </div>
                  </div>
                </div>
              )}

              {/* Registration Fee */}
              {Number(event.registrationFee) > 0 && (
                <div className="flex items-start space-x-3">
                  <CurrencyRupeeIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Registration Fee</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      ₹{event.registrationFee}
                      {Number(event.guestFee) > 0 && (
                        <span className="text-xs ml-1">(Guest: ₹{event.guestFee})</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Meeting Link for Virtual Events */}
            {event.eventMode !== 'PHYSICAL' && event.meetingLink && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Meeting Link
                </h4>
                <a
                  href={event.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm break-all"
                >
                  {event.meetingLink}
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
            {event.status === 'REGISTRATION_OPEN' && (
              <button
                type="button"
                className="btn-guild"
              >
                Register Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EventDetailsModal