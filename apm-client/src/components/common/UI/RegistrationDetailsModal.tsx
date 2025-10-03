import React from 'react'
import { XMarkIcon, CalendarIcon, MapPinIcon, UsersIcon, CurrencyRupeeIcon, DocumentTextIcon, QrCodeIcon, TicketIcon } from '@heroicons/react/24/outline'
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
  registrationFee: string | number
  guestFee: string | number
  category?: {
    name: string
  }
}

interface Guest {
  id: string
  name: string
  email: string
  phone?: string
  mealPreference?: string
}

interface QRCode {
  id: string
  qrCode: string
  qrImageUrl?: string
  generatedAt: string
  scanCount: number
  isActive: boolean
}

interface Registration {
  id: string
  event: Event
  status: string
  paymentStatus: string
  mealPreference?: string
  registrationDate: string
  totalAmount: number
  guests: Guest[]
  qr?: QRCode
}

interface RegistrationDetailsModalProps {
  registration: Registration | null
  isOpen: boolean
  onClose: () => void
  onViewInvoice?: () => void
  onViewQR?: () => void
  onViewTicket?: () => void
  isLoadingInvoice?: boolean
  isLoadingTicket?: boolean
}

const RegistrationDetailsModal: React.FC<RegistrationDetailsModalProps> = ({
  registration,
  isOpen,
  onClose,
  onViewInvoice,
  onViewQR,
  onViewTicket,
  isLoadingInvoice = false,
  isLoadingTicket = false
}) => {
  if (!isOpen || !registration) return null

  const { event } = registration

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
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

          {/* Content */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Registration Details
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Your registration information for {event.title}
              </p>
            </div>

            {/* Status Badges */}
            <div className="flex space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(registration.status)}`}>
                Registration: {registration.status}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(registration.paymentStatus)}`}>
                Payment: {registration.paymentStatus}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Event Details */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Event Information
                  </h4>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                    <h5 className="font-semibold text-gray-900 dark:text-white">
                      {event.title}
                    </h5>
                    
                    {event.category && (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200">
                        {event.category.name}
                      </span>
                    )}

                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {formatEventTime(event.eventDate, event.startTime, event.endTime)}
                      </div>
                      
                      <div className="flex items-center">
                        <MapPinIcon className="h-4 w-4 mr-2" />
                        {event.eventMode === 'VIRTUAL' ? 'Virtual Event' : event.venue || 'Venue TBA'}
                      </div>

                      {Number(event.registrationFee) > 0 && (
                        <div className="flex items-center">
                          <CurrencyRupeeIcon className="h-4 w-4 mr-2" />
                          ₹{event.registrationFee}
                          {Number(event.guestFee) > 0 && (
                            <span className="ml-1">(Guest: ₹{event.guestFee})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Guest Information */}
                {registration.guests && registration.guests.length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Guest Information ({registration.guests.length})
                    </h4>
                    
                    <div className="space-y-3">
                      {registration.guests.map((guest, index) => (
                        <div key={guest.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h6 className="font-medium text-gray-900 dark:text-white">
                            Guest {index + 1}: {guest.name}
                          </h6>
                          <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                            <p><strong>Email:</strong> {guest.email || 'Not provided'}</p>
                            <p><strong>Phone:</strong> {guest.phone || 'Not provided'}</p>
                            <p><strong>Meal Preference:</strong> {guest.mealPreference || 'Not specified'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Registration Details */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Registration Information
                  </h4>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">Registration ID:</span>
                        <span className="font-mono text-gray-900 dark:text-white">{registration.id}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">Registration Date:</span>
                        <span className="text-gray-900 dark:text-white">
                          {format(new Date(registration.registrationDate), 'MMM dd, yyyy')}
                        </span>
                      </div>

                      {registration.mealPreference && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Your Meal:</span>
                          <span className="text-gray-900 dark:text-white">{registration.mealPreference}</span>
                        </div>
                      )}

                      <div className="flex justify-between font-semibold text-lg border-t pt-2 mt-3">
                        <span className="text-gray-600 dark:text-gray-300">Total Amount:</span>
                        <span className="text-gray-900 dark:text-white">₹{registration.totalAmount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Actions
                  </h4>
                  
                  <div className="space-y-3">
                    <button
                      onClick={onViewInvoice}
                      className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-guild-500"
                    >
                      <DocumentTextIcon className="h-5 w-5 mr-2" />
                      View Invoice
                    </button>

                    {registration.qr && (
                      <button
                        onClick={onViewQR}
                        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-guild-500"
                      >
                        <QrCodeIcon className="h-5 w-5 mr-2" />
                        Get QR for Check-in
                      </button>
                    )}

                    <button
                      onClick={onViewTicket}
                      disabled={isLoadingTicket}
                      className="w-full flex items-center justify-center px-4 py-2 bg-guild-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-guild-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-guild-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoadingTicket ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      ) : (
                        <TicketIcon className="h-5 w-5 mr-2" />
                      )}
                      {isLoadingTicket ? 'Loading Ticket...' : 'View Your Ticket'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegistrationDetailsModal