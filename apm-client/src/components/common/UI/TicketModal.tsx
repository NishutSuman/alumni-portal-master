import React, { useEffect, useRef, useState } from 'react'
import { XMarkIcon, ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

// QR Code Generator Component for Tickets
const QRCodeGeneratorForTicket: React.FC<{ qrCode: string }> = ({ qrCode }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrImageData, setQrImageData] = useState<string | null>(null)

  useEffect(() => {
    const generateQR = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        if (!qrCode) {
          throw new Error('No QR code data provided')
        }
        
        const QRCode = (await import('qrcode')).default
        
        // Generate QR as data URL directly instead of canvas
        const qrDataURL = await QRCode.toDataURL(qrCode, {
          width: 128, // 32 * 4 (w-32 = 128px)
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        
        setQrImageData(qrDataURL)
        setIsLoading(false)
      } catch (error) {
        console.error('Error generating ticket QR code:', error)
        setError(error instanceof Error ? error.message : 'Failed to generate QR code')
        setIsLoading(false)
      }
    }

    if (qrCode) {
      generateQR()
    } else {
      setError('No QR code data available')
      setIsLoading(false)
    }
  }, [qrCode])

  if (isLoading) {
    return (
      <div className="w-32 h-32 mx-auto mb-3 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-guild-600 mx-auto mb-1"></div>
          <div className="text-xs text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-32 h-32 mx-auto mb-3 bg-red-50 border border-red-200 flex items-center justify-center">
        <div className="text-center p-2">
          <div className="text-xs text-red-600">QR Error</div>
        </div>
      </div>
    )
  }

  if (qrImageData) {
    return (
      <img 
        src={qrImageData} 
        alt="QR Code" 
        className="w-32 h-32 mx-auto mb-3"
      />
    )
  }

  return null
}

interface TicketModalProps {
  isOpen: boolean
  onClose: () => void
  isLoading?: boolean
  ticketData: {
    registration: {
      id: string
      status: string
      event: {
        title: string
        description: string
        eventDate: string
        startTime?: string
        endTime?: string
        venue?: string
        eventMode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID'
        category?: {
          name: string
        }
      }
      mealPreference?: string
      guests: any[]
      qr?: {
        qrCode: string
        qrImageUrl?: string
      }
    }
    user: {
      fullName: string
      email: string
      batch?: number
    }
    organization: {
      name: string
    }
  } | null
}

const TicketModal: React.FC<TicketModalProps> = ({ isOpen, onClose, ticketData, isLoading = false }) => {
  if (!isOpen) return null

  // If loading or no data, we'll handle it in the render
  const registration = ticketData?.registration
  const user = ticketData?.user
  const organization = ticketData?.organization
  const event = registration?.event

  const handleDownload = async () => {
    try {
      // Import html2canvas dynamically
      const html2canvas = (await import('html2canvas')).default

      // Get the ticket element
      const element = document.getElementById('ticket-content')
      if (!element) return

      // Generate canvas from HTML
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })

      // Create download link
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `ticket-${event.title.replace(/[^a-zA-Z0-9]/g, '-')}-${registration.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error generating ticket image:', error)
      alert('Failed to download ticket. Please try again.')
    }
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Event Ticket - ${event.title}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Arial', sans-serif;
                background: #f5f5f5;
                padding: 20px;
              }
              .ticket {
                width: 800px;
                margin: 0 auto;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                position: relative;
              }
              .ticket::before {
                content: '';
                position: absolute;
                width: 40px;
                height: 40px;
                background: #f5f5f5;
                border-radius: 50%;
                left: -20px;
                top: 50%;
                transform: translateY(-50%);
              }
              .ticket::after {
                content: '';
                position: absolute;
                width: 40px;
                height: 40px;
                background: #f5f5f5;
                border-radius: 50%;
                right: -20px;
                top: 50%;
                transform: translateY(-50%);
              }
              .ticket-content {
                padding: 40px;
                color: white;
                position: relative;
              }
              .ticket-header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px dashed rgba(255,255,255,0.3);
                padding-bottom: 20px;
              }
              .ticket-title {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
              }
              .organization-name {
                font-size: 18px;
                opacity: 0.9;
                margin-bottom: 20px;
              }
              .ticket-body {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 40px;
                align-items: center;
              }
              .event-details {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
              }
              .detail-item {
                margin-bottom: 15px;
              }
              .detail-label {
                font-size: 14px;
                opacity: 0.8;
                margin-bottom: 5px;
              }
              .detail-value {
                font-size: 18px;
                font-weight: 600;
              }
              .qr-section {
                text-align: center;
                background: white;
                padding: 20px;
                border-radius: 15px;
                box-shadow: 0 10px 20px rgba(0,0,0,0.1);
              }
              .qr-code {
                width: 150px;
                height: 150px;
                margin-bottom: 10px;
              }
              .qr-text {
                color: #333;
                font-size: 12px;
                font-weight: 600;
              }
              .ticket-footer {
                margin-top: 30px;
                text-align: center;
                padding-top: 20px;
                border-top: 2px dashed rgba(255,255,255,0.3);
                font-size: 14px;
                opacity: 0.8;
              }
              @media print {
                body { margin: 0; padding: 10px; }
                .ticket { box-shadow: none; }
              }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="ticket-content">
                <div class="ticket-header">
                  <div class="ticket-title">${event.title}</div>
                  <div class="organization-name">${organization.name}</div>
                  ${event.category ? `<div style="background: rgba(255,255,255,0.2); display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; margin-top: 10px;">${event.category.name}</div>` : ''}
                </div>
                
                <div class="ticket-body">
                  <div class="event-details">
                    <div class="detail-item">
                      <div class="detail-label">PARTICIPANT</div>
                      <div class="detail-value">${user.fullName}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">EMAIL</div>
                      <div class="detail-value">${user.email}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">EVENT DATE</div>
                      <div class="detail-value">${format(new Date(event.eventDate), 'MMM dd, yyyy')}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">TIME</div>
                      <div class="detail-value">${event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : event.startTime || 'TBD'}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">VENUE</div>
                      <div class="detail-value">${event.eventMode === 'VIRTUAL' ? 'Virtual Event' : event.venue || 'TBD'}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">STATUS</div>
                      <div class="detail-value">${registration.status}</div>
                    </div>
                  </div>
                  
                  ${registration.qr ? `
                  <div class="qr-section">
                    <canvas id="qr-canvas" class="qr-code"></canvas>
                    <div class="qr-text">SCAN FOR CHECK-IN</div>
                  </div>
                  ` : ''}
                </div>
                
                <div class="ticket-footer">
                  <div>Registration ID: ${registration.id}</div>
                  <div>This ticket is valid for the specified event only</div>
                  <div>Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}</div>
                </div>
              </div>
            </div>
            
            ${registration.qr ? `
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
            <script>
              // Generate QR code
              const qr = qrcode(0, 'M');
              qr.addData('${registration.qr.qrCode}');
              qr.make();
              
              // Create canvas and draw QR code
              const canvas = document.getElementById('qr-canvas');
              const ctx = canvas.getContext('2d');
              const cellSize = 6;
              const moduleCount = qr.getModuleCount();
              canvas.width = moduleCount * cellSize;
              canvas.height = moduleCount * cellSize;
              
              for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                  ctx.fillStyle = qr.isDark(row, col) ? '#000000' : '#FFFFFF';
                  ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                }
              }
            </script>
            ` : ''}
            
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                }
              }
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
          
            {/* Header */}
            <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block print:hidden">
              <button
                type="button"
                className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-guild-500 focus:ring-offset-2"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-guild-600 mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 text-lg">Loading your ticket...</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Please wait while we prepare your event ticket</p>
              </div>
            )}

            {/* Ticket Preview */}
            {!isLoading && ticketData && (
              <div id="ticket-content" className="max-w-4xl mx-auto">
                <div className="relative bg-gradient-to-r from-guild-500 to-purple-600 rounded-2xl overflow-hidden shadow-2xl">
                {/* Decorative circles */}
                <div className="absolute w-8 h-8 bg-white rounded-full -left-4 top-1/2 transform -translate-y-1/2"></div>
                <div className="absolute w-8 h-8 bg-white rounded-full -right-4 top-1/2 transform -translate-y-1/2"></div>
                
                {/* Ticket Content */}
                <div className="p-8 text-white">
                  {/* Header */}
                  <div className="text-center mb-6 border-b-2 border-dashed border-white/30 pb-4">
                    <h1 className="text-3xl font-bold mb-2 text-shadow-lg">{event.title}</h1>
                    <p className="text-lg opacity-90">{organization.name}</p>
                    {event.category && (
                      <span className="inline-block mt-2 px-4 py-1 bg-white/20 rounded-full text-sm">
                        {event.category.name}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                    {/* Event & User Details */}
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm opacity-80">PARTICIPANT</p>
                        <p className="text-lg font-semibold">{user.fullName}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm opacity-80">EMAIL</p>
                        <p className="text-lg font-semibold">{user.email}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm opacity-80">EVENT DATE</p>
                        <p className="text-lg font-semibold">{format(new Date(event.eventDate), 'MMM dd, yyyy')}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm opacity-80">TIME</p>
                        <p className="text-lg font-semibold">
                          {event.startTime && event.endTime 
                            ? `${event.startTime} - ${event.endTime}` 
                            : event.startTime || 'TBD'
                          }
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm opacity-80">VENUE</p>
                        <p className="text-lg font-semibold">
                          {event.eventMode === 'VIRTUAL' ? 'Virtual Event' : event.venue || 'TBD'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm opacity-80">STATUS</p>
                        <p className="text-lg font-semibold">{registration.status}</p>
                      </div>

                      {registration.mealPreference && (
                        <div className="space-y-1">
                          <p className="text-sm opacity-80">MEAL</p>
                          <p className="text-lg font-semibold">{registration.mealPreference}</p>
                        </div>
                      )}

                      {registration.guests.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm opacity-80">GUESTS</p>
                          <p className="text-lg font-semibold">{registration.guests.length}</p>
                        </div>
                      )}
                    </div>

                    {/* QR Code Section */}
                    {registration.qr && (
                      <div className="text-center bg-white rounded-xl p-6 shadow-lg">
                        {registration.qr.qrImageUrl ? (
                          <img 
                            src={registration.qr.qrImageUrl} 
                            alt="QR Code" 
                            className="w-32 h-32 mx-auto mb-3"
                          />
                        ) : registration.qr.qrCode ? (
                          <QRCodeGeneratorForTicket qrCode={registration.qr.qrCode} />
                        ) : (
                          <div className="w-32 h-32 mx-auto mb-3 bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-500 text-xs">QR Code</span>
                          </div>
                        )}
                        <p className="text-gray-800 text-sm font-semibold">SCAN FOR CHECK-IN</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t-2 border-dashed border-white/30 text-center text-sm opacity-80">
                    <p>Registration ID: {registration.id}</p>
                    <p className="mt-1">This ticket is valid for the specified event only</p>
                    <p className="mt-1">Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isLoading && ticketData && (
              <div className="flex space-x-3 mt-6 print:hidden">
                <button
                  onClick={handleDownload}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-guild-600 hover:bg-guild-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-guild-500"
                >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Download Ticket
                </button>
              
                <button
                  onClick={handlePrint}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-guild-500"
                >
                  <PrinterIcon className="h-4 w-4 mr-2" />
                  Print Ticket
                </button>
              </div>
            )}
          
        </div>
      </div>
    </div>
  )
}

export default TicketModal