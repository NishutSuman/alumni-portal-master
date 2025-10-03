// src/store/api/invoiceApi.ts
import { apiSlice } from './apiSlice'

export interface InvoiceData {
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
  }
  registration?: {
    id: string
    event: {
      title: string
      eventDate: string
      venue?: string
      registrationFee: number
      guestFee?: number
    }
    guests: any[]
    mealPreference?: string
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
  }
}

// API endpoints
export const invoiceApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get invoice data for a transaction
    getInvoice: builder.query<InvoiceData, string>({
      query: (transactionId) => `/payments/${transactionId}/invoice`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, transactionId) => [{ type: 'Invoice', id: transactionId }],
    }),

    // Generate invoice for a transaction
    generateInvoice: builder.mutation<InvoiceData, string>({
      query: (transactionId) => ({
        url: `/payments/${transactionId}/invoice`,
        method: 'POST',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, transactionId) => [{ type: 'Invoice', id: transactionId }],
    }),

    // Download invoice PDF
    downloadInvoicePDF: builder.query<Blob, string>({
      query: (transactionId) => ({
        url: `/payments/${transactionId}/invoice/pdf`,
        responseHandler: (response) => response.blob(),
      }),
      keepUnusedDataFor: 0, // Don't cache blob data
    }),

    // Resend invoice email
    resendInvoiceEmail: builder.mutation<void, string>({
      query: (transactionId) => ({
        url: `/payments/${transactionId}/invoice/resend`,
        method: 'POST',
      }),
      transformResponse: (response: any) => response.data,
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetInvoiceQuery,
  useGenerateInvoiceMutation,
  useLazyDownloadInvoicePDFQuery,
  useResendInvoiceEmailMutation,
} = invoiceApi

export default invoiceApi