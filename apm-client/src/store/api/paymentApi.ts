import { apiSlice } from './apiSlice'

export interface PaymentTransaction {
  id: string
  transactionNumber: string
  amount: number
  currency: string
  description: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  referenceType: 'EVENT_REGISTRATION' | 'EVENT_PAYMENT' | 'MEMBERSHIP' | 'MERCHANDISE' | 'DONATION'
  referenceId: string
  breakdown: {
    registrationFee?: number
    guestCount?: number
    guestFees?: number
    merchandiseTotal?: number
    subtotal?: number
    processingFee?: number
    total: number
  }
  provider: {
    name: string
    orderId: string
    checkoutOptions: {
      key: string
      amount: number
      currency: string
      name: string
      description: string
      order_id: string
      prefill: {
        name: string
        email: string
        contact?: string
      }
      theme: {
        color: string
      }
      modal: {
        ondismiss: () => void
      }
      handler: (response: any) => void
    }
  }
  items: Array<{
    type: string
    description: string
    amount: number
  }>
}

export interface InitiatePaymentRequest {
  referenceType: 'EVENT_REGISTRATION' | 'EVENT_PAYMENT' | 'MEMBERSHIP' | 'MERCHANDISE' | 'DONATION'
  referenceId: string
  description?: string
  registrationData?: {
    mealPreference?: string
    guestCount: number
    guests: Array<{
      name: string
      email?: string
      phone?: string
      mealPreference?: string
    }>
  }
}

export interface VerifyPaymentRequest {
  transactionId: string
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface PaymentCalculationResponse {
  breakdown: {
    registrationFee?: number
    guestCount?: number
    guestFees?: number
    merchandiseTotal?: number
    subtotal?: number
    processingFee?: number
    total: number
  }
  items: Array<{
    type: string
    description: string
    amount: number
  }>
  user: {
    fullName: string
    email: string
    whatsappNumber?: string
  }
  metadata?: any
}

export const paymentApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    initiatePayment: builder.mutation<
      { success: boolean; transaction: PaymentTransaction; message: string },
      InitiatePaymentRequest
    >({
      query: (paymentData) => ({
        url: '/payments/initiate',
        method: 'POST',
        body: paymentData,
      }),
      invalidatesTags: ['Payment'],
    }),

    verifyPayment: builder.mutation<
      { success: boolean; transaction: PaymentTransaction; message: string },
      VerifyPaymentRequest
    >({
      query: (verificationData) => {
        const { transactionId, ...paymentData } = verificationData;
        return {
          url: `/payments/${transactionId}/verify`,
          method: 'POST',
          body: paymentData,
        };
      },
      invalidatesTags: ['Payment', 'Event', 'Registration'],
    }),

    calculatePayment: builder.query<
      { success: boolean; data: PaymentCalculationResponse; message: string },
      { referenceType: string; referenceId: string }
    >({
      query: ({ referenceType, referenceId }) => ({
        url: `/payments/calculate?referenceType=${referenceType}&referenceId=${referenceId}`,
        method: 'GET',
      }),
      providesTags: ['Payment'],
    }),

    getPaymentStatus: builder.query<
      { success: boolean; transaction: PaymentTransaction; message: string },
      string
    >({
      query: (transactionId) => ({
        url: `/payments/${transactionId}/status`,
        method: 'GET',
      }),
      providesTags: ['Payment'],
    }),

    getUserPayments: builder.query<
      { 
        success: boolean
        data: PaymentTransaction[]
        pagination: {
          page: number
          totalPages: number
          total: number
        }
        message: string 
      },
      { page?: number; limit?: number; referenceType?: string }
    >({
      query: (params) => ({
        url: '/payments/my-payments',
        method: 'GET',
        params,
      }),
      providesTags: ['Payment'],
    }),

  }),
})

export const {
  useInitiatePaymentMutation,
  useVerifyPaymentMutation,
  useCalculatePaymentQuery,
  useGetPaymentStatusQuery,
  useGetUserPaymentsQuery,
} = paymentApi