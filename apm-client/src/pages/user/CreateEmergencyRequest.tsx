// src/pages/user/CreateEmergencyRequest.tsx
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useCreateRequisitionMutation } from '../../store/api/lifeLinkApi'
import type { CreateRequisitionRequest, BloodGroup, UrgencyLevel } from '../../types/lifeLink'
import LoadingSpinner from '../../components/common/UI/LoadingSpinner'

const BLOOD_GROUP_OPTIONS: { value: BloodGroup; label: string }[] = [
  { value: 'A_POSITIVE', label: 'A+' },
  { value: 'A_NEGATIVE', label: 'A-' },
  { value: 'B_POSITIVE', label: 'B+' },
  { value: 'B_NEGATIVE', label: 'B-' },
  { value: 'AB_POSITIVE', label: 'AB+' },
  { value: 'AB_NEGATIVE', label: 'AB-' },
  { value: 'O_POSITIVE', label: 'O+' },
  { value: 'O_NEGATIVE', label: 'O-' }
]

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string; description: string; color: string }[] = [
  { 
    value: 'HIGH', 
    label: 'High Priority', 
    description: 'Emergency surgery, critical condition', 
    color: 'border-red-500 bg-red-50 dark:bg-red-900/20' 
  },
  { 
    value: 'MEDIUM', 
    label: 'Medium Priority', 
    description: 'Planned surgery, stable condition', 
    color: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
  },
  { 
    value: 'LOW', 
    label: 'Low Priority', 
    description: 'Scheduled procedure, non-urgent', 
    color: 'border-green-500 bg-green-50 dark:bg-green-900/20' 
  }
]

const CreateEmergencyRequest: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  
  const [createRequisition, { isLoading: isCreating }] = useCreateRequisitionMutation()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm<CreateRequisitionRequest>({
    mode: 'onChange',
    defaultValues: {
      unitsNeeded: 1,
      urgencyLevel: 'HIGH',
      allowContactReveal: true,
      requiredByDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Tomorrow
    }
  })

  const watchedValues = watch()

  const onSubmit = async (data: CreateRequisitionRequest) => {
    try {
      const result = await createRequisition({
        ...data,
        requiredByDate: new Date(data.requiredByDate).toISOString()
      }).unwrap()
      
      // Navigate to emergency requests page or show success
      navigate('/lifelink/emergency-requests', { 
        state: { message: 'Emergency request created successfully!' }
      })
    } catch (error) {
      console.error('Failed to create requisition:', error)
    }
  }

  const nextStep = () => {
    if (step < 3) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const getMinDate = () => {
    return new Date().toISOString().split('T')[0]
  }

  const getMaxDate = () => {
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 30) // 30 days from now
    return maxDate.toISOString().split('T')[0]
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Create Emergency Blood Request
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Submit an urgent blood request to connect with potential donors in your area
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((stepNumber) => (
          <React.Fragment key={stepNumber}>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium ${
              step >= stepNumber
                ? 'bg-red-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {stepNumber}
            </div>
            {stepNumber < 3 && (
              <div className={`w-16 h-1 mx-2 ${
                step > stepNumber ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step 1: Patient & Hospital Information */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Patient & Hospital Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Patient Name *
                </label>
                <input
                  {...register('patientName', { 
                    required: 'Patient name is required',
                    minLength: { value: 2, message: 'Name must be at least 2 characters' }
                  })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter patient's full name"
                />
                {errors.patientName && (
                  <p className="text-red-500 text-sm mt-1">{errors.patientName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hospital Name *
                </label>
                <input
                  {...register('hospitalName', { 
                    required: 'Hospital name is required',
                    minLength: { value: 3, message: 'Hospital name must be at least 3 characters' }
                  })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="e.g., AIIMS Hospital"
                />
                {errors.hospitalName && (
                  <p className="text-red-500 text-sm mt-1">{errors.hospitalName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contact Number *
                </label>
                <input
                  {...register('contactNumber', { 
                    required: 'Contact number is required',
                    pattern: {
                      value: /^[6-9]\d{9}$/,
                      message: 'Please enter a valid 10-digit mobile number'
                    }
                  })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="10-digit mobile number"
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-sm mt-1">{errors.contactNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alternate Number (Optional)
                </label>
                <input
                  {...register('alternateNumber', {
                    pattern: {
                      value: /^[6-9]\d{9}$/,
                      message: 'Please enter a valid 10-digit mobile number'
                    }
                  })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Alternative contact number"
                />
                {errors.alternateNumber && (
                  <p className="text-red-500 text-sm mt-1">{errors.alternateNumber.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hospital Location/Area *
                </label>
                <input
                  {...register('location', { 
                    required: 'Location is required',
                    minLength: { value: 3, message: 'Location must be at least 3 characters' }
                  })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="e.g., Sector 14, Gurgaon, Haryana"
                />
                {errors.location && (
                  <p className="text-red-500 text-sm mt-1">{errors.location.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={nextStep}
                disabled={!watchedValues.patientName || !watchedValues.hospitalName || !watchedValues.contactNumber || !watchedValues.location}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Step →
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Blood Requirements */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Blood Requirements
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Required Blood Group *
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {BLOOD_GROUP_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        watchedValues.requiredBloodGroup === option.value
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        {...register('requiredBloodGroup', { required: 'Blood group is required' })}
                        type="radio"
                        value={option.value}
                        className="sr-only"
                      />
                      <span className="font-medium">{option.label}</span>
                    </label>
                  ))}
                </div>
                {errors.requiredBloodGroup && (
                  <p className="text-red-500 text-sm mt-1">{errors.requiredBloodGroup.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Units Needed *
                  </label>
                  <select
                    {...register('unitsNeeded', { required: 'Units needed is required' })}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(unit => (
                      <option key={unit} value={unit}>{unit} unit{unit > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Required By Date *
                  </label>
                  <input
                    {...register('requiredByDate', { required: 'Required by date is required' })}
                    type="date"
                    min={getMinDate()}
                    max={getMaxDate()}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  {errors.requiredByDate && (
                    <p className="text-red-500 text-sm mt-1">{errors.requiredByDate.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Urgency Level *
                </label>
                <div className="space-y-3">
                  {URGENCY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        watchedValues.urgencyLevel === option.value
                          ? option.color
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        {...register('urgencyLevel', { required: 'Urgency level is required' })}
                        type="radio"
                        value={option.value}
                        className="mt-1 mr-3 text-red-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {option.label}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {option.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={prevStep}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={nextStep}
                disabled={!watchedValues.requiredBloodGroup || !watchedValues.urgencyLevel}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Step →
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Additional Details */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Additional Details
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Medical Condition (Optional)
                </label>
                <textarea
                  {...register('medicalCondition')}
                  rows={4}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Brief description of the medical condition or reason for blood requirement..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  {...register('additionalNotes')}
                  rows={3}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Any additional information that might help donors..."
                />
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <label className="flex items-start space-x-3">
                  <input
                    {...register('allowContactReveal')}
                    type="checkbox"
                    className="mt-1 text-red-500 focus:ring-red-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      Allow Contact Information Sharing
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Willing donors will be able to see your contact information to coordinate directly
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={prevStep}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                ← Previous
              </button>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="px-6 py-3 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Preview Request
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !isValid}
                  className="px-8 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isCreating ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>🆘</span>
                      <span>Create Emergency Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </form>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Preview Emergency Request
            </h3>

            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                  🆘 Emergency Blood Request
                </h4>
                <p className="text-red-700 dark:text-red-300">
                  Patient: {watchedValues.patientName} needs {watchedValues.unitsNeeded} unit{watchedValues.unitsNeeded > 1 ? 's' : ''} of {watchedValues.requiredBloodGroup?.replace('_', ' ')} blood
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Hospital:</span> {watchedValues.hospitalName}
                </div>
                <div>
                  <span className="font-medium">Location:</span> {watchedValues.location}
                </div>
                <div>
                  <span className="font-medium">Contact:</span> {watchedValues.contactNumber}
                </div>
                <div>
                  <span className="font-medium">Required By:</span> {watchedValues.requiredByDate}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Urgency:</span> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    watchedValues.urgencyLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                    watchedValues.urgencyLevel === 'MEDIUM' ? 'bg-orange-100 text-orange-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {watchedValues.urgencyLevel} PRIORITY
                  </span>
                </div>
              </div>

              {watchedValues.medicalCondition && (
                <div>
                  <span className="font-medium">Medical Condition:</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{watchedValues.medicalCondition}</p>
                </div>
              )}

              {watchedValues.additionalNotes && (
                <div>
                  <span className="font-medium">Additional Notes:</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{watchedValues.additionalNotes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  setShowPreview(false)
                  handleSubmit(onSubmit)()
                }}
                disabled={isCreating}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                Confirm & Submit
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default CreateEmergencyRequest