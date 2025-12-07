// src/components/common/UI/BloodProfileModal.tsx
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  XMarkIcon,
  HeartIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { 
  useGetBloodProfileQuery,
  useUpdateBloodProfileMutation,
} from '../../../store/api/lifeLinkApi'
import LoadingSpinner from './LoadingSpinner'
import type { BloodGroup, UpdateBloodProfileRequest } from '../../../types/lifeLink'

interface BloodProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

// Blood group options
const BLOOD_GROUP_OPTIONS: Array<{ value: BloodGroup; label: string; color: string; description: string }> = [
  { value: 'O_NEGATIVE', label: 'O−', color: 'red', description: 'Universal donor - can donate to all blood types' },
  { value: 'O_POSITIVE', label: 'O+', color: 'orange', description: 'Most common blood type - can donate to all positive types' },
  { value: 'A_NEGATIVE', label: 'A−', color: 'blue', description: 'Can donate to A and AB types' },
  { value: 'A_POSITIVE', label: 'A+', color: 'indigo', description: 'Can donate to A+ and AB+ types' },
  { value: 'B_NEGATIVE', label: 'B−', color: 'green', description: 'Can donate to B and AB types' },
  { value: 'B_POSITIVE', label: 'B+', color: 'emerald', description: 'Can donate to B+ and AB+ types' },
  { value: 'AB_NEGATIVE', label: 'AB−', color: 'purple', description: 'Universal plasma donor' },
  { value: 'AB_POSITIVE', label: 'AB+', color: 'pink', description: 'Universal plasma donor - can receive from all types' },
]

interface FormData {
  bloodGroup: BloodGroup
  isBloodDonor: boolean
}

const BloodProfileModal: React.FC<BloodProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'bloodGroup' | 'donorStatus' | 'confirmation'>('bloodGroup')
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<BloodGroup | null>(null)

  // API queries and mutations
  const { data: bloodProfile, isLoading: profileLoading } = useGetBloodProfileQuery(undefined, {
    skip: !isOpen
  })
  const [updateBloodProfile, { isLoading: updateLoading }] = useUpdateBloodProfileMutation()

  // Form handling
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      bloodGroup: '' as BloodGroup,
      isBloodDonor: false,
    }
  })

  const watchedValues = watch()

  // Initialize form with existing data
  useEffect(() => {
    if (bloodProfile && isOpen) {
      if (bloodProfile.bloodGroup) {
        setValue('bloodGroup', bloodProfile.bloodGroup)
        setSelectedBloodGroup(bloodProfile.bloodGroup)
        setStep('donorStatus')
      }
      setValue('isBloodDonor', bloodProfile.isBloodDonor)
    }
  }, [bloodProfile, isOpen, setValue])

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setStep('bloodGroup')
      setSelectedBloodGroup(null)
    }
  }, [isOpen])

  const handleBloodGroupSelect = (bloodGroup: BloodGroup) => {
    setSelectedBloodGroup(bloodGroup)
    setValue('bloodGroup', bloodGroup)
    setStep('donorStatus')
  }

  const handleDonorStatusSelect = (isDonor: boolean) => {
    setValue('isBloodDonor', isDonor)
    setStep('confirmation')
  }

  const onSubmit = async (data: FormData) => {
    try {
      const updateData: UpdateBloodProfileRequest = {
        bloodGroup: data.bloodGroup,
        isBloodDonor: data.isBloodDonor,
      }

      await updateBloodProfile(updateData).unwrap()
      
      toast.success('Blood profile updated successfully!')
      onSuccess?.()
      onClose()
    } catch (error: any) {
      console.error('Update profile error:', error)
      toast.error(error?.data?.message || 'Failed to update blood profile')
    }
  }

  const handleBack = () => {
    if (step === 'donorStatus') {
      setStep('bloodGroup')
    } else if (step === 'confirmation') {
      setStep('donorStatus')
    }
  }

  const getStepTitle = () => {
    switch (step) {
      case 'bloodGroup':
        return 'What\'s your blood group?'
      case 'donorStatus':
        return 'Are you willing to be a blood donor?'
      case 'confirmation':
        return 'Confirm your blood profile'
      default:
        return ''
    }
  }

  const getSelectedBloodGroupInfo = () => {
    return BLOOD_GROUP_OPTIONS.find(option => option.value === selectedBloodGroup)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          open={isOpen}
          onClose={onClose}
          className="relative z-50"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="mx-auto max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[90vh] overflow-hidden">
              <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-r from-red-500 to-pink-500 p-2 rounded-full">
                      <HeartSolidIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                        {getStepTitle()}
                      </DialogTitle>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Step {step === 'bloodGroup' ? 1 : step === 'donorStatus' ? 2 : 3} of 3
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 py-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <motion.div
                      className="bg-gradient-to-r from-red-500 to-pink-500 h-2 rounded-full"
                      initial={{ width: '33%' }}
                      animate={{ 
                        width: step === 'bloodGroup' ? '33%' : step === 'donorStatus' ? '66%' : '100%' 
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {profileLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      {/* Step 1: Blood Group Selection */}
                      {step === 'bloodGroup' && (
                        <motion.div
                          key="bloodGroup"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-6"
                        >
                          <div className="text-center mb-6">
                            <div className="text-6xl mb-4">🩸</div>
                            <p className="text-gray-600 dark:text-gray-300">
                              Select your blood group. This information helps us connect you with compatible recipients.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {BLOOD_GROUP_OPTIONS.map((option) => (
                              <motion.button
                                key={option.value}
                                type="button"
                                onClick={() => handleBloodGroupSelect(option.value)}
                                className={`p-4 rounded-lg border-2 transition-all duration-200 text-center ${
                                  selectedBloodGroup === option.value
                                    ? `border-${option.color}-500 bg-${option.color}-50 dark:bg-${option.color}-900/20`
                                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                }`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 bg-${option.color}-100 text-${option.color}-800 dark:bg-${option.color}-900 dark:text-${option.color}-300 font-bold text-lg`}>
                                  {option.label}
                                </div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {option.label} Blood
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {option.description}
                                </p>
                              </motion.button>
                            ))}
                          </div>

                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <div className="flex items-start">
                              <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                              <div className="text-sm text-blue-700 dark:text-blue-300">
                                <p className="font-medium mb-1">Don't know your blood group?</p>
                                <p>You can get it tested at any nearby clinic or hospital. It's a simple blood test that takes just a few minutes.</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 2: Donor Status */}
                      {step === 'donorStatus' && (
                        <motion.div
                          key="donorStatus"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-6"
                        >
                          <div className="text-center mb-6">
                            <HeartSolidIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-300">
                              Would you like to be part of our blood donor network? You can change this anytime.
                            </p>
                          </div>

                          <div className="space-y-4">
                            {/* Yes - Be a Donor */}
                            <motion.button
                              type="button"
                              onClick={() => handleDonorStatusSelect(true)}
                              className={`w-full p-6 rounded-lg border-2 text-left transition-all duration-200 ${
                                watchedValues.isBloodDonor
                                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                              }`}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <div className="flex items-start space-x-4">
                                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                                  <HeartSolidIcon className="h-6 w-6 text-red-500" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Yes, I want to be a blood donor
                                  </h3>
                                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                                    Join our network and help save lives. You'll receive notifications for emergency blood requests that match your blood group.
                                  </p>
                                  <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                                    <p>✓ Get notified for emergency requests</p>
                                    <p>✓ Track your donation history</p>
                                    <p>✓ Help your alumni community</p>
                                  </div>
                                </div>
                              </div>
                            </motion.button>

                            {/* No - Just Browse */}
                            <motion.button
                              type="button"
                              onClick={() => handleDonorStatusSelect(false)}
                              className={`w-full p-6 rounded-lg border-2 text-left transition-all duration-200 ${
                                !watchedValues.isBloodDonor
                                  ? 'border-gray-500 bg-gray-50 dark:bg-gray-700/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                              }`}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <div className="flex items-start space-x-4">
                                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full">
                                  <HeartIcon className="h-6 w-6 text-gray-500" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Not right now
                                  </h3>
                                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                                    You can still browse the donor directory and create emergency requests if needed.
                                  </p>
                                  <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                                    <p>✓ Browse donor directory</p>
                                    <p>✓ Create emergency requests</p>
                                    <p>✓ Can opt-in later anytime</p>
                                  </div>
                                </div>
                              </div>
                            </motion.button>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 3: Confirmation */}
                      {step === 'confirmation' && (
                        <motion.div
                          key="confirmation"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-6"
                        >
                          <div className="text-center mb-6">
                            <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-300">
                              Please review and confirm your blood profile information.
                            </p>
                          </div>

                          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6 space-y-4">
                            {/* Blood Group Confirmation */}
                            <div className="flex items-center justify-between">
                              <span className="text-gray-700 dark:text-gray-300">Blood Group:</span>
                              <div className="flex items-center space-x-2">
                                {selectedBloodGroup && (
                                  <>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${getSelectedBloodGroupInfo()?.color}-100 text-${getSelectedBloodGroupInfo()?.color}-800 dark:bg-${getSelectedBloodGroupInfo()?.color}-900 dark:text-${getSelectedBloodGroupInfo()?.color}-300`}>
                                      🩸
                                      {getSelectedBloodGroupInfo()?.label}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Donor Status Confirmation */}
                            <div className="flex items-center justify-between">
                              <span className="text-gray-700 dark:text-gray-300">Donor Status:</span>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  watchedValues.isBloodDonor
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {watchedValues.isBloodDonor ? (
                                    <HeartSolidIcon className="h-4 w-4 mr-1" />
                                  ) : (
                                    <HeartIcon className="h-4 w-4 mr-1" />
                                  )}
                                  {watchedValues.isBloodDonor ? 'Active Donor' : 'Not a Donor'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {watchedValues.isBloodDonor && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                              <div className="flex items-start">
                                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
                                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                                  <p className="font-medium mb-1">Important Notes:</p>
                                  <ul className="space-y-1 list-disc list-inside">
                                    <li>You must be 18-65 years old and weigh at least 50kg</li>
                                    <li>Wait at least 3 months between donations</li>
                                    <li>You can opt out of the donor network anytime</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={step === 'bloodGroup' ? onClose : handleBack}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    {step === 'bloodGroup' ? 'Cancel' : 'Back'}
                  </button>

                  {step === 'confirmation' ? (
                    <button
                      type="submit"
                      disabled={updateLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      {updateLoading ? (
                        <>
                          <LoadingSpinner size="small" className="mr-2" />
                          Saving...
                        </>
                      ) : (
                        'Save Profile'
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (step === 'bloodGroup' && selectedBloodGroup) {
                          setStep('donorStatus')
                        } else if (step === 'donorStatus') {
                          setStep('confirmation')
                        }
                      }}
                      disabled={step === 'bloodGroup' && !selectedBloodGroup}
                      className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      Continue
                    </button>
                  )}
                </div>
              </form>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  )
}

export default BloodProfileModal