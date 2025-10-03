import { useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { 
  useInitiatePaymentMutation, 
  useVerifyPaymentMutation,
  type InitiatePaymentRequest,
  type PaymentTransaction 
} from '@/store/api/paymentApi'

interface UsePaymentOptions {
  onSuccess?: (transaction: PaymentTransaction) => void
  onError?: (error: string) => void
  onCancel?: () => void
  autoShowToast?: boolean
}

interface PaymentState {
  isLoading: boolean
  isProcessing: boolean
  transaction: PaymentTransaction | null
  error: string | null
}

export const usePayment = (options: UsePaymentOptions = {}) => {
  const {
    onSuccess,
    onError,
    onCancel,
    autoShowToast = true
  } = options

  const [paymentState, setPaymentState] = useState<PaymentState>({
    isLoading: false,
    isProcessing: false,
    transaction: null,
    error: null
  })

  const [initiatePayment] = useInitiatePaymentMutation()
  const [verifyPayment] = useVerifyPaymentMutation()

  const resetPaymentState = useCallback(() => {
    setPaymentState({
      isLoading: false,
      isProcessing: false,
      transaction: null,
      error: null
    })
  }, [])

  const processPayment = useCallback(async (paymentData: InitiatePaymentRequest) => {
    // Check if Razorpay is loaded
    if (typeof window === 'undefined' || !window.Razorpay) {
      const error = 'Payment system not available'
      setPaymentState(prev => ({ ...prev, error }))
      if (autoShowToast) toast.error(error)
      onError?.(error)
      return
    }

    setPaymentState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Step 1: Initiate payment
      const initiateResponse = await initiatePayment(paymentData).unwrap()
      
      if (!initiateResponse.success || !initiateResponse.transaction) {
        throw new Error(initiateResponse.message || 'Failed to initiate payment')
      }

      const { transaction } = initiateResponse
      setPaymentState(prev => ({ ...prev, transaction, isLoading: false, isProcessing: true }))

      // Step 2: Configure Razorpay
      const razorpayOptions = {
        ...transaction.provider.checkoutOptions,
        handler: async (response: any) => {
          try {
            // Step 3: Verify payment
            const verifyResponse = await verifyPayment({
              transactionId: transaction.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }).unwrap()

            if (verifyResponse.success && verifyResponse.transaction) {
              setPaymentState(prev => ({ 
                ...prev, 
                isProcessing: false, 
                transaction: verifyResponse.transaction 
              }))
              
              if (autoShowToast) toast.success('Payment successful!')
              onSuccess?.(verifyResponse.transaction)
            } else {
              throw new Error(verifyResponse.message || 'Payment verification failed')
            }
          } catch (verifyError: any) {
            const errorMessage = verifyError?.data?.message || verifyError?.message || 'Payment verification failed'
            setPaymentState(prev => ({ 
              ...prev, 
              isProcessing: false, 
              error: errorMessage 
            }))
            
            if (autoShowToast) toast.error(errorMessage)
            onError?.(errorMessage)
          }
        },
        modal: {
          ...transaction.provider.checkoutOptions.modal,
          ondismiss: () => {
            setPaymentState(prev => ({ ...prev, isProcessing: false }))
            if (autoShowToast) toast.info('Payment cancelled')
            onCancel?.()
          }
        }
      }

      // Step 4: Open Razorpay
      const razorpay = new window.Razorpay(razorpayOptions)
      
      razorpay.on('payment.failed', (response: any) => {
        const errorMessage = response.error?.description || 'Payment failed'
        setPaymentState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          error: errorMessage 
        }))
        
        if (autoShowToast) toast.error(errorMessage)
        onError?.(errorMessage)
      })

      razorpay.open()

    } catch (error: any) {
      const errorMessage = error?.data?.message || error?.message || 'Failed to initiate payment'
      setPaymentState(prev => ({ 
        ...prev, 
        isLoading: false, 
        isProcessing: false, 
        error: errorMessage 
      }))
      
      if (autoShowToast) toast.error(errorMessage)
      onError?.(errorMessage)
    }
  }, [initiatePayment, verifyPayment, onSuccess, onError, onCancel, autoShowToast])

  return {
    ...paymentState,
    processPayment,
    resetPaymentState,
    isReady: typeof window !== 'undefined' && !!window.Razorpay
  }
}

// Type declaration for global Razorpay
declare global {
  interface Window {
    Razorpay: any
  }
}

export default usePayment