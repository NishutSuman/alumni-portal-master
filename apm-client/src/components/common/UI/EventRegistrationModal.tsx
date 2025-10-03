import React, { useState } from 'react'
import { XMarkIcon, CurrencyRupeeIcon, UsersIcon, CalendarIcon, UserIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useRegisterForEventMutation } from '@/store/api/eventApi'
import { useInitiatePaymentMutation, useVerifyPaymentMutation } from '@/store/api/paymentApi'
import { toast } from 'react-hot-toast'
import LoadingSpinner from './LoadingSpinner'

interface Event {
  id: string
  title: string
  description: string
  eventDate: string
  startTime?: string
  endTime?: string
  venue?: string
  eventMode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID'
  status: string
  maxCapacity?: number
  registrationFee: string | number
  guestFee: string | number
  heroImage?: string
  hasGuests?: boolean
  hasMeals?: boolean
}

interface EventRegistrationModalProps {
  event: Event | null
  isOpen: boolean
  onClose: () => void
}

interface RegistrationFormData {
  mealPreference?: string
  guestCount: number
  guests: {
    name: string
    email: string
    phone?: string
    mealPreference?: string
  }[]
  donationAmount?: number
}

const EventRegistrationModal: React.FC<EventRegistrationModalProps> = ({ event, isOpen, onClose }) => {
  // Early return BEFORE any hooks to avoid Rules of Hooks violation
  if (!isOpen || !event) return null

  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'form' | 'payment'>('form')
  const [totalAmount, setTotalAmount] = useState(0)
  const [registrationData, setRegistrationData] = useState<RegistrationFormData | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  
  const [registerForEvent] = useRegisterForEventMutation()
  const [initiatePayment] = useInitiatePaymentMutation()
  const [verifyPayment] = useVerifyPaymentMutation()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset
  } = useForm<RegistrationFormData>({
    defaultValues: {
      guestCount: 0,
      guests: [],
      mealPreference: ''
    }
  })

  const guestCount = watch('guestCount') || 0
  const donationAmount = watch('donationAmount') || 0

  const calculateTotal = (guests: number, donation: number = 0) => {
    const registrationFee = Number(event.registrationFee) || 0
    const guestFee = Number(event.guestFee) || 0
    return registrationFee + (guests * guestFee) + donation
  }

  React.useEffect(() => {
    setTotalAmount(calculateTotal(guestCount, donationAmount))
  }, [guestCount, donationAmount, event])

  const formatEventTime = (date: string, startTime?: string) => {
    const eventDate = new Date(date)
    const dateStr = format(eventDate, 'MMM dd, yyyy')
    if (startTime) {
      return `${dateStr} at ${startTime}`
    }
    return dateStr
  }

  const handleClose = () => {
    setStep('form')
    setRegistrationData(null)
    reset()
    onClose()
  }

  const onSubmit = async (data: RegistrationFormData) => {
    // Step 1: Just store form data and proceed to payment - don't create registration yet!
    setRegistrationData(data)
    setStep('payment')
    toast.success('Please complete payment to confirm your registration')
  }

  const handlePayment = async () => {
    if (!registrationData) {
      toast.error('Registration data not found')
      return
    }

    try {
      setIsProcessingPayment(true)

      // Step 1: Initiate payment with event details (not registration yet)
      const paymentResponse = await initiatePayment({
        referenceType: 'EVENT_PAYMENT',
        referenceId: event.id, // Use event ID, not registration ID
        description: `Event Registration - ${event.title}`,
        registrationData: {
          mealPreference: registrationData.mealPreference,
          guestCount: registrationData.guestCount || 0,
          guests: registrationData.guests || [],
          donationAmount: registrationData.donationAmount || 0
        }
      }).unwrap()

      if (!paymentResponse.success) {
        throw new Error('Failed to initiate payment')
      }

      const { transaction, provider } = paymentResponse.data
      
      // Validate payment response structure
      if (!transaction || !provider || !provider.checkoutOptions) {
        throw new Error('Invalid payment response structure')
      }
      
      // Step 2: Open Razorpay checkout
      const razorpayOptions = {
        key: provider.checkoutOptions.key,
        amount: provider.checkoutOptions.amount,
        currency: provider.checkoutOptions.currency,
        name: provider.checkoutOptions.name,
        description: provider.checkoutOptions.description,
        order_id: provider.checkoutOptions.order_id,
        prefill: provider.checkoutOptions.prefill,
        theme: provider.checkoutOptions.theme,
        handler: async (response: any) => {
          try {
            // Step 3: Verify payment first
            const verifyResponse = await verifyPayment({
              transactionId: transaction.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }).unwrap()

            if (verifyResponse.success) {
              // Step 4: Registration is automatically created during payment verification
              // No need to call registerForEvent again - it's handled by EVENT_PAYMENT flow
              toast.success(`Registration confirmed! Payment of ₹${transaction.amount} completed successfully.`)
              handleClose()
              
              // Redirect to user events page and switch to Your Bookings tab
              setTimeout(() => {
                navigate('/user/events', { 
                  replace: true,
                  state: { activeTab: 'booked' }
                })
              }, 1000) // Small delay to show the success toast
            } else {
              throw new Error('Payment verification failed')
            }
          } catch (verifyError: any) {
            console.error('Payment verification error:', verifyError)
            const errorMessage = verifyError?.data?.message || verifyError?.message || 'Payment verification failed'
            toast.error(errorMessage)
          } finally {
            setIsProcessingPayment(false)
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false)
            toast.info('Payment cancelled')
          }
        }
      }

      // Check if Razorpay is loaded
      if (typeof window !== 'undefined' && window.Razorpay) {
        const razorpay = new window.Razorpay(razorpayOptions)
        
        razorpay.on('payment.failed', (response: any) => {
          setIsProcessingPayment(false)
          const errorMessage = response.error?.description || 'Payment failed'
          toast.error(errorMessage)
        })

        razorpay.open()
      } else {
        throw new Error('Payment system not available')
      }

    } catch (error: any) {
      setIsProcessingPayment(false)
      console.error('Payment initiation error:', error)
      const errorMessage = error?.data?.message || error?.message || 'Failed to initiate payment'
      toast.error(errorMessage)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleClose}></div>
        
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
          {/* Header */}
          <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-guild-500 focus:ring-offset-2"
              onClick={handleClose}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Event Summary */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Register for {event.title}
              </h3>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                <div className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {formatEventTime(event.eventDate, event.startTime)}
                </div>
                {event.venue && (
                  <div className="flex items-center">
                    <span>📍 {event.venue}</span>
                  </div>
                )}
              </div>
            </div>

            {step === 'form' ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Meal Preference Section */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Your Meal Preference *
                  </h4>
                  <select
                    {...register('mealPreference', { 
                      required: 'Meal preference is required' 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-guild-500 focus:border-guild-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select your meal preference *</option>
                    <option value="VEG">Vegetarian</option>
                    <option value="NON_VEG">Non-Vegetarian</option>
                  </select>
                  {errors.mealPreference && (
                    <p className="mt-1 text-sm text-red-600">{errors.mealPreference.message}</p>
                  )}
                </div>

                {/* Guest Information Section */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Guest Information
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Number of Guests
                      </label>
                      <select
                        {...register('guestCount', { 
                          valueAsNumber: true,
                          onChange: (e) => {
                            const count = parseInt(e.target.value)
                            const guests = Array.from({ length: count }, () => ({
                              name: '',
                              email: '',
                              phone: '',
                              mealPreference: ''
                            }))
                            setValue('guests', guests)
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-guild-500 focus:border-guild-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value={0}>0 Guests</option>
                        <option value={1}>1 Guest</option>
                        <option value={2}>2 Guests</option>
                        <option value={3}>3 Guests</option>
                        <option value={4}>4 Guests</option>
                        <option value={5}>5 Guests</option>
                      </select>
                    </div>

                    {guestCount > 0 && (
                      <div className="space-y-4">
                        <h5 className="text-md font-medium text-gray-900 dark:text-white">
                          Guest Details
                        </h5>
                        {Array.from({ length: guestCount }, (_, index) => (
                          <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
                            <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Guest {index + 1}
                            </h6>
                            
                            {/* Guest Name - Required */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Name *
                              </label>
                              <input
                                type="text"
                                {...register(`guests.${index}.name` as const, { 
                                  required: `Guest ${index + 1} name is required` 
                                })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-guild-500 focus:border-guild-500 dark:bg-gray-700 dark:text-white"
                                placeholder={`Guest ${index + 1} full name`}
                              />
                              {errors.guests?.[index]?.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.guests[index]?.name?.message}</p>
                              )}
                            </div>

                            {/* Guest Email */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Email *
                              </label>
                              <input
                                type="email"
                                {...register(`guests.${index}.email` as const, { 
                                  required: `Guest ${index + 1} email is required`,
                                  pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: `Guest ${index + 1} email must be valid`
                                  }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-guild-500 focus:border-guild-500 dark:bg-gray-700 dark:text-white"
                                placeholder={`Guest ${index + 1} email address`}
                              />
                              {errors.guests?.[index]?.email && (
                                <p className="mt-1 text-sm text-red-600">{errors.guests[index]?.email?.message}</p>
                              )}
                            </div>

                            {/* Guest Phone */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Phone Number (Optional)
                              </label>
                              <input
                                type="tel"
                                {...register(`guests.${index}.phone` as const, {
                                  pattern: {
                                    value: /^[0-9]{10}$/,
                                    message: `Guest ${index + 1} phone number must be exactly 10 digits`
                                  },
                                  minLength: {
                                    value: 10,
                                    message: `Guest ${index + 1} phone number must be exactly 10 digits`
                                  },
                                  maxLength: {
                                    value: 10,
                                    message: `Guest ${index + 1} phone number must be exactly 10 digits`
                                  }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-guild-500 focus:border-guild-500 dark:bg-gray-700 dark:text-white"
                                placeholder={`Guest ${index + 1} phone number (10 digits)`}
                                maxLength={10}
                                onInput={(e) => {
                                  // Only allow numbers
                                  const target = e.target as HTMLInputElement;
                                  target.value = target.value.replace(/[^0-9]/g, '');
                                }}
                              />
                              {errors.guests?.[index]?.phone && (
                                <p className="mt-1 text-sm text-red-600">{errors.guests[index]?.phone?.message}</p>
                              )}
                            </div>

                            {/* Guest Meal Preference */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Meal Preference
                              </label>
                              <select
                                {...register(`guests.${index}.mealPreference` as const)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-guild-500 focus:border-guild-500 dark:bg-gray-700 dark:text-white"
                              >
                                <option value="">Select preference</option>
                                <option value="VEG">Vegetarian</option>
                                <option value="NON_VEG">Non-Vegetarian</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Donation Section */}
                {(event.hasDonations || true) && ( /* Always show for testing */
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Support Our Event (Optional)
                    </h4>
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Your generous donation helps us organize better events for our alumni community. 
                          Any amount is appreciated and will be used for event improvement and future activities.
                        </p>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Donation Amount (₹) - Optional
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Enter amount (e.g., 100)"
                            {...register('donationAmount', { 
                              valueAsNumber: true,
                              min: 0
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            💚 Thank you for supporting our alumni community!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Summary */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                    Registration Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Registration Fee</span>
                      <span>₹{event.registrationFee}</span>
                    </div>
                    {guestCount > 0 && (
                      <div className="flex justify-between">
                        <span>Guest Fee ({guestCount} × ₹{event.guestFee})</span>
                        <span>₹{guestCount * Number(event.guestFee)}</span>
                      </div>
                    )}
                    {donationAmount > 0 && (
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                        <span>Donation (Thank you! 💚)</span>
                        <span>₹{donationAmount}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between font-semibold text-lg">
                      <span>Total Amount</span>
                      <span className="text-guild-600 dark:text-guild-400">₹{totalAmount}</span>
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center">
                        <span className="text-yellow-600 dark:text-yellow-300 text-sm">!</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Terms & Conditions
                      </h4>
                      <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
                        <ul className="list-disc list-inside space-y-1">
                          <li>All payments are non-refundable once processed</li>
                          <li>Event details may be subject to change</li>
                          <li>Registration confirmation will be sent via email</li>
                          <li>By proceeding, you agree to our event terms and payment policy</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isProcessingPayment}
                    className="btn-guild"
                  >
                    {isSubmitting || isProcessingPayment ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        {isProcessingPayment ? 'Creating Registration...' : 'Processing...'}
                      </>
                    ) : (
                      'Proceed to Payment'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              // Payment Step
              <div className="space-y-6">
                <div className="text-center">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Complete Your Registration
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    Please review your registration details and proceed with payment
                  </p>
                </div>

                {/* Registration Summary */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 space-y-6">
                  {/* Event Details */}
                  <div>
                    <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                      Event Details
                    </h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Event:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{event.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Date:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatEventTime(event.eventDate, event.startTime)}
                        </span>
                      </div>
                      {event.venue && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Venue:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{event.venue}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primary Registrant Details */}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <UserIcon className="h-5 w-5 mr-2" />
                      Primary Registrant
                    </h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Name:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{user?.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Email:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{user?.email}</span>
                      </div>
                      {registrationData?.mealPreference && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Meal Preference:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {registrationData.mealPreference === 'VEG' ? 'Vegetarian' : 'Non-Vegetarian'}
                          </span>
                        </div>
                      )}
                      {registrationData?.donationAmount && registrationData.donationAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Donation:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            ₹{registrationData.donationAmount} (Thank you! 💚)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Guest Details */}
                  {registrationData && registrationData.guestCount > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                      <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                        <UsersIcon className="h-5 w-5 mr-2" />
                        Guest Details ({registrationData.guestCount} {registrationData.guestCount === 1 ? 'Guest' : 'Guests'})
                      </h5>
                      <div className="space-y-3">
                        {registrationData.guests.map((guest, index) => (
                          <div key={index} className="bg-white dark:bg-gray-800 rounded-md p-3 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                Guest {index + 1}
                              </span>
                            </div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Name:</span>
                                <span className="text-gray-900 dark:text-white">{guest.name || 'Not provided'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                                <span className="text-gray-900 dark:text-white">{guest.email || 'Not provided'}</span>
                              </div>
                              {guest.phone && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                                  <span className="text-gray-900 dark:text-white">{guest.phone}</span>
                                </div>
                              )}
                              {guest.mealPreference && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Meal:</span>
                                  <span className="text-gray-900 dark:text-white">
                                    {guest.mealPreference === 'VEG' ? 'Vegetarian' : 'Non-Vegetarian'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment Breakdown */}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                      Payment Breakdown
                    </h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Registration Fee:</span>
                        <span className="font-medium text-gray-900 dark:text-white">₹{event.registrationFee}</span>
                      </div>
                      {registrationData && registrationData.guestCount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">
                            Guest Fee ({registrationData.guestCount} × ₹{event.guestFee}):
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ₹{registrationData.guestCount * Number(event.guestFee)}
                          </span>
                        </div>
                      )}
                      {registrationData && registrationData.donationAmount && registrationData.donationAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-green-600 dark:text-green-400">
                            Donation (Thank you! 💚):
                          </span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            ₹{registrationData.donationAmount}
                          </span>
                        </div>
                      )}
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between text-lg font-bold">
                        <span className="text-gray-900 dark:text-white">Total Amount:</span>
                        <span className="text-guild-600 dark:text-guild-400">₹{totalAmount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <svg 
                      className="h-4 w-4 text-green-500" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.814 3.966 10.702 9.32 12.118a.75.75 0 00.86 0 12.596 12.596 0 004.911-3.478 12.596 12.596 0 004.409-8.64c0-1.034-.126-2.036-.37-3.002a.75.75 0 00-.722-.515 11.209 11.209 0 01-7.877-3.08z" clipRule="evenodd" />
                    </svg>
                    <span>Secure payment powered by Razorpay</span>
                  </div>
                </div>

                {/* Payment Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStep('form')}
                  >
                    Back to Form
                  </button>
                  
                  <button
                    type="button"
                    className="btn-guild flex items-center"
                    onClick={handlePayment}
                    disabled={!registrationData || isProcessingPayment}
                  >
                    {isProcessingPayment ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CurrencyRupeeIcon className="h-5 w-5 mr-2" />
                        Pay ₹{totalAmount}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EventRegistrationModal