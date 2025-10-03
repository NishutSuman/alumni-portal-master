import React from 'react'
import { XMarkIcon, ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  isLoading?: boolean
  invoiceData: {
    invoice: {
      id: string
      invoiceNumber: string
      amount: number
      currency: string
      createdAt: string
      dueDate?: string
      status: string
    }
    transaction: {
      id: string
      transactionNumber: string
      amount: number
      currency: string
      paymentMethod?: string
      completedAt?: string
      provider?: string
      status?: string
    }
    registration: {
      id: string
      totalAmount: number
      registrationFeePaid: number
      guestFeesPaid: number
      donationAmount?: number
      platformFee?: number
      event: {
        title: string
        eventDate: string
        venue?: string
        registrationFee: number
        guestFee?: number
      }
      guests: any[]
      totalGuests: number
      activeGuests: number
    }
    user: {
      fullName: string
      email: string
      whatsappNumber?: string
    }
    organization: {
      name: string
      officialEmail?: string
      officeAddress?: string
      logoUrl?: string
    }
  } | null
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, isLoading = false, invoiceData }) => {
  if (!isOpen) return null

  // Show loading state if no data yet
  if (isLoading || !invoiceData) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
          <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-guild-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Loading invoice...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { invoice, transaction, registration, user, organization } = invoiceData

  const handleDownloadPDF = async () => {
    try {
      // Import html2canvas and jsPDF dynamically
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default

      // Get the invoice element
      const element = document.getElementById('invoice-content')
      if (!element) return

      // Generate canvas from HTML
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })

      // Create PDF
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 295 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`invoice-${invoice.invoiceNumber}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const handlePrint = () => {
    window.print()
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

          {/* Invoice Content */}
          <div id="invoice-content" className="bg-white text-black p-8" style={{ color: '#000000' }}>
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">INVOICE</h1>
                <p className="text-gray-700">#{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-semibold text-black mb-2">{organization.name}</h2>
                {organization.officialEmail && (
                  <p className="text-gray-700">{organization.officialEmail}</p>
                )}
                {organization.officeAddress && (
                  <p className="text-gray-700 whitespace-pre-line">{organization.officeAddress}</p>
                )}
              </div>
            </div>

            {/* Bill To & Invoice Details */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-semibold text-black mb-4">Bill To:</h3>
                <div className="text-gray-800">
                  <p className="font-medium text-black">{user.fullName}</p>
                  <p className="text-gray-700">{user.email}</p>
                  {user.whatsappNumber && <p className="text-gray-700">{user.whatsappNumber}</p>}
                </div>
              </div>
              <div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Invoice Date:</span>
                    <span className="font-medium text-black">
                      {invoice.createdAt ? format(new Date(invoice.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </span>
                  </div>
                  {invoice.dueDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">Due Date:</span>
                      <span className="font-medium text-black">{format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-700">Status:</span>
                    <span className={`font-medium px-2 py-1 rounded-full text-xs ${
                      invoice.status === 'EMAILED' || invoice.status === 'PAID' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Details */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-black mb-4">Event Registration</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-black mb-2">{registration.event.title}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <span className="font-medium">Event Date:</span> {format(new Date(registration.event.eventDate), 'EEEE, MMMM dd, yyyy')}
                  </div>
                  {registration.event.venue && (
                    <div>
                      <span className="font-medium">Venue:</span> {registration.event.venue}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Guests:</span> {registration.activeGuests || registration.totalGuests || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="mb-8">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Description</th>
                    <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-black">Rate</th>
                    <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-black">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="border border-gray-300 px-4 py-3 text-black">
                      Event Registration - {registration.event.title}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-right text-black">
                      ₹{registration.registrationFeePaid || registration.event.registrationFee}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-right text-black">
                      ₹{registration.registrationFeePaid || registration.event.registrationFee}
                    </td>
                  </tr>
                  {(registration.totalGuests > 0 || registration.activeGuests > 0) && (
                    <tr className="bg-white">
                      <td className="border border-gray-300 px-4 py-3 text-black">
                        Guest Registration × {registration.activeGuests || registration.totalGuests}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right text-black">
                        ₹{registration.event.guestFee || 0}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right text-black">
                        ₹{registration.guestFeesPaid || ((registration.event.guestFee || 0) * (registration.activeGuests || registration.totalGuests))}
                      </td>
                    </tr>
                  )}
                  {registration.donationAmount && registration.donationAmount > 0 && (
                    <tr className="bg-white">
                      <td className="border border-gray-300 px-4 py-3 text-black">
                        Donation Amount
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right text-black">
                        ₹{registration.donationAmount}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right text-black">
                        ₹{registration.donationAmount}
                      </td>
                    </tr>
                  )}
                  {registration.platformFee && registration.platformFee > 0 && (
                    <tr className="bg-white">
                      <td className="border border-gray-300 px-4 py-3 text-black">
                        Platform Fee
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right text-black">
                        ₹{registration.platformFee}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right text-black">
                        ₹{registration.platformFee}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-black">Subtotal:</span>
                  <span className="text-black">₹{registration.totalAmount || invoice.amount}</span>
                </div>
                <div className="flex justify-between py-3 text-lg font-bold">
                  <span className="text-black">Total:</span>
                  <span className="text-black">₹{registration.totalAmount || invoice.amount}</span>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            {transaction.completedAt && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-black mb-2">Payment Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-700">Transaction ID:</span>
                    <span className="font-mono ml-2 text-black">{transaction.transactionNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-700">Payment Date:</span>
                    <span className="ml-2 text-black">{format(new Date(transaction.completedAt), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                  {transaction.paymentMethod && (
                    <div>
                      <span className="text-gray-700">Payment Method:</span>
                      <span className="ml-2 text-black">{transaction.paymentMethod}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-700">Amount Paid:</span>
                    <span className="ml-2 font-medium text-black">₹{transaction.amount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t text-center text-sm text-gray-600">
              <p>Thank you for your registration!</p>
              <p>This invoice was generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 mt-4 print:hidden">
            <button
              onClick={handleDownloadPDF}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-guild-600 hover:bg-guild-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-guild-500"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Download PDF
            </button>
            
            <button
              onClick={handlePrint}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-guild-500"
            >
              <PrinterIcon className="h-4 w-4 mr-2" />
              Print Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvoiceModal