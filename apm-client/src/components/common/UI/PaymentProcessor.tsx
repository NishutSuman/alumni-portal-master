import React, { useEffect, useState } from 'react'
import { CurrencyRupeeIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { 
  useInitiatePaymentMutation, 
  useVerifyPaymentMutation,
  type InitiatePaymentRequest,
  type PaymentTransaction 
} from '@/store/api/paymentApi'
import LoadingSpinner from './LoadingSpinner'

interface PaymentProcessorProps {
  /** Payment configuration */
  paymentData: InitiatePaymentRequest
  /** Callback when payment is successful */
  onSuccess: (transaction: PaymentTransaction) => void
  /** Callback when payment is cancelled or fails */
  onError: (error: string) => void
  /** Callback when payment is cancelled by user */
  onCancel?: () => void
  /** Whether to show the payment button */
  showPayButton?: boolean
  /** Custom button text */
  buttonText?: string
  /** Custom button class */
  buttonClass?: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Loading state from parent */
  loading?: boolean
}

declare global {
  interface Window {
    Razorpay: any
  }
}

const PaymentProcessor: React.FC<PaymentProcessorProps> = ({
  paymentData,
  onSuccess,
  onError,
  onCancel,
  showPayButton = true,
  buttonText,
  buttonClass = "btn-guild",
  disabled = false,
  loading = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [razorpayLoaded, setRazorpayLoaded] = useState(false)
  
  const [initiatePayment] = useInitiatePaymentMutation()
  const [verifyPayment] = useVerifyPaymentMutation()

  // Load Razorpay script
  useEffect(() => {
    const loadRazorpay = () => {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          setRazorpayLoaded(true)
          resolve(true)
          return
        }

        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => {
          setRazorpayLoaded(true)
          resolve(true)
        }
        script.onerror = () => {
          console.error('Failed to load Razorpay SDK')
          resolve(false)
        }
        document.body.appendChild(script)
      })
    }

    loadRazorpay()
  }, [])

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      toast.error('Payment system is loading. Please wait.')
      return
    }

    setIsProcessing(true)

    try {
      // Step 1: Initiate payment and get transaction details
      const initiateResponse = await initiatePayment(paymentData).unwrap()
      
      if (!initiateResponse.success || !initiateResponse.transaction) {
        throw new Error(initiateResponse.message || 'Failed to initiate payment')
      }

      const { transaction } = initiateResponse
      const { provider } = transaction

      // Step 2: Configure Razorpay options
      const razorpayOptions = {
        ...provider.checkoutOptions,
        handler: async (response: any) => {
          try {
            // Step 3: Verify payment on backend
            const verifyResponse = await verifyPayment({
              transactionId: transaction.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }).unwrap()

            if (verifyResponse.success && verifyResponse.transaction) {
              toast.success('Payment successful!')
              onSuccess(verifyResponse.transaction)
            } else {
              throw new Error(verifyResponse.message || 'Payment verification failed')
            }
          } catch (verifyError: any) {
            console.error('Payment verification error:', verifyError)
            const errorMessage = verifyError?.data?.message || verifyError?.message || 'Payment verification failed'
            toast.error(errorMessage)
            onError(errorMessage)
          } finally {
            setIsProcessing(false)
          }
        },
        modal: {
          ...provider.checkoutOptions.modal,
          ondismiss: () => {
            setIsProcessing(false)
            toast.info('Payment cancelled')
            onCancel?.()
          }
        }
      }

      // Step 4: Open Razorpay checkout
      const razorpay = new window.Razorpay(razorpayOptions)
      
      razorpay.on('payment.failed', (response: any) => {
        setIsProcessing(false)
        const errorMessage = response.error?.description || 'Payment failed'
        toast.error(errorMessage)
        onError(errorMessage)
      })

      razorpay.open()

    } catch (error: any) {
      setIsProcessing(false)
      console.error('Payment initiation error:', error)
      const errorMessage = error?.data?.message || error?.message || 'Failed to initiate payment'
      toast.error(errorMessage)
      onError(errorMessage)
    }
  }

  const isLoading = loading || isProcessing || !razorpayLoaded

  if (!showPayButton) {
    return null
  }

  return (
    <div className="payment-processor">
      <button
        type="button"
        className={`${buttonClass} flex items-center justify-center ${isLoading || disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handlePayment}
        disabled={isLoading || disabled}
      >
        {isProcessing ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Processing Payment...
          </>
        ) : !razorpayLoaded ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Loading Payment System...
          </>
        ) : (
          <>
            <CurrencyRupeeIcon className="h-5 w-5 mr-2" />
            {buttonText || 'Pay Now'}
          </>
        )}
      </button>

      {/* Payment Status Messages */}
      {isProcessing && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center">
            <LoadingSpinner size="sm" className="mr-3" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Processing Payment
              </h4>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                Please complete the payment in the popup window. Do not close this page.
              </p>
            </div>
          </div>
        </div>
      )}

      {!razorpayLoaded && (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Loading Payment System
              </h4>
              <p className="text-sm text-yellow-600 dark:text-yellow-300">
                Initializing secure payment gateway...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentProcessor