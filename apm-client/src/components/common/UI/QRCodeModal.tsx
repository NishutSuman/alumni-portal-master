import React, { useEffect, useRef, useState } from 'react'
import { XMarkIcon, ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

// QR Code Generator Component
const QRCodeGenerator: React.FC<{ qrCode: string }> = ({ qrCode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
          width: 192, // 48 * 4 (w-48 = 192px)
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        
        setQrImageData(qrDataURL)
        setIsLoading(false)
      } catch (error) {
        console.error('Error generating QR code:', error)
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
      <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-guild-600 mx-auto mb-2"></div>
          <div className="text-sm">Generating QR Code...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-48 h-48 bg-red-50 border-2 border-red-200 flex items-center justify-center text-red-600">
        <div className="text-center p-4">
          <div className="text-sm font-medium mb-1">QR Generation Failed</div>
          <div className="text-xs">{error}</div>
        </div>
      </div>
    )
  }

  if (qrImageData) {
    return (
      <img 
        src={qrImageData} 
        alt="QR Code" 
        className="w-48 h-48"
      />
    )
  }

  return <canvas ref={canvasRef} className="w-48 h-48" />
}

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  qrData: {
    qrCode: string
    qrImageUrl?: string
    event: {
      title: string
      eventDate: string
      venue?: string
    }
    user: {
      fullName: string
      email: string
    }
    registrationId: string
  } | null
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, qrData }) => {
  if (!isOpen || !qrData) return null

  const handleDownload = () => {
    if (qrData.qrImageUrl) {
      // Download existing QR image
      const link = document.createElement('a')
      link.href = qrData.qrImageUrl
      link.download = `qr-code-${qrData.registrationId}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      // Generate QR code image and download
      generateAndDownloadQR()
    }
  }

  const generateAndDownloadQR = async () => {
    try {
      // Import QR code library dynamically
      const QRCode = (await import('qrcode')).default
      
      // Generate QR code as data URL
      const qrDataURL = await QRCode.toDataURL(qrData.qrCode, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      // Create download link
      const link = document.createElement('a')
      link.href = qrDataURL
      link.download = `qr-code-${qrData.registrationId}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error generating QR code:', error)
      alert('Failed to generate QR code. Please try again.')
    }
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Event QR Code - ${qrData.event.title}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 20px;
                margin: 0;
              }
              .qr-container {
                max-width: 600px;
                margin: 0 auto;
                border: 2px solid #000;
                padding: 30px;
                border-radius: 10px;
              }
              .qr-code {
                margin: 20px 0;
              }
              .qr-code img {
                width: 300px;
                height: 300px;
              }
              .event-details {
                margin: 20px 0;
                line-height: 1.6;
              }
              .title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .subtitle {
                font-size: 18px;
                color: #666;
                margin-bottom: 20px;
              }
              .details {
                font-size: 14px;
                color: #333;
              }
              @media print {
                body { margin: 0; }
                .qr-container { border: 1px solid #000; }
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="title">${qrData.event.title}</div>
              <div class="subtitle">Event Check-in QR Code</div>
              <div class="qr-code">
                <canvas id="qr-canvas"></canvas>
              </div>
              <div class="event-details">
                <div class="details">
                  <strong>Participant:</strong> ${qrData.user.fullName}<br>
                  <strong>Email:</strong> ${qrData.user.email}<br>
                  <strong>Event Date:</strong> ${format(new Date(qrData.event.eventDate), 'EEEE, MMMM dd, yyyy')}<br>
                  ${qrData.event.venue ? `<strong>Venue:</strong> ${qrData.event.venue}<br>` : ''}
                  <strong>Registration ID:</strong> ${qrData.registrationId}<br>
                  <br>
                  <em>Please present this QR code at the event entrance for quick check-in</em>
                </div>
              </div>
            </div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
            <script>
              // Generate QR code
              const qr = qrcode(0, 'M');
              qr.addData('${qrData.qrCode}');
              qr.make();
              
              // Create canvas and draw QR code
              const canvas = document.getElementById('qr-canvas');
              const ctx = canvas.getContext('2d');
              const cellSize = 8;
              const moduleCount = qr.getModuleCount();
              canvas.width = moduleCount * cellSize;
              canvas.height = moduleCount * cellSize;
              
              for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                  ctx.fillStyle = qr.isDark(row, col) ? '#000000' : '#FFFFFF';
                  ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                }
              }
              
              // Auto print after loading
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
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
          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                Event Check-in QR Code
              </h3>
              <div className="mt-4">
                {/* Event Info */}
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{qrData.event.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {format(new Date(qrData.event.eventDate), 'EEEE, MMMM dd, yyyy')}
                  </p>
                  {qrData.event.venue && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">{qrData.event.venue}</p>
                  )}
                </div>

                {/* QR Code Display */}
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-white rounded-lg shadow-inner">
                    {qrData.qrImageUrl ? (
                      <img 
                        src={qrData.qrImageUrl} 
                        alt="QR Code" 
                        className="w-48 h-48"
                      />
                    ) : (
                      <QRCodeGenerator qrCode={qrData.qrCode} />
                    )}
                  </div>
                </div>

                {/* User Info */}
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <strong>Participant:</strong> {qrData.user.fullName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Registration ID: {qrData.registrationId}
                  </p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg mb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    📱 <strong>Instructions:</strong> Present this QR code at the event entrance for quick check-in.
                    You can download or print this QR code for easy access.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleDownload}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-guild-600 hover:bg-guild-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-guild-500"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Download QR
                  </button>
                  
                  <button
                    onClick={handlePrint}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-guild-500"
                  >
                    <PrinterIcon className="h-4 w-4 mr-2" />
                    Print QR
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QRCodeModal