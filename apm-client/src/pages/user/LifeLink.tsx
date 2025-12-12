// src/pages/user/LifeLink.tsx
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  HeartIcon,
  UserGroupIcon,
  MapPinIcon,
  ChevronDownIcon,
  XMarkIcon,
  ArrowPathIcon,
  PhoneIcon,
  SparklesIcon,
  PlusIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ChartBarIcon,
  EnvelopeIcon,
  BellIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { 
  useGetLifeLinkDashboardQuery,
  useGetBloodGroupStatsQuery,
  useGetBloodProfileQuery,
  useGetDonationStatusQuery,
  useGetMyDonationsQuery,
  useAddDonationMutation,
  useDiscoverRequisitionsQuery,
  useGetMyRequisitionsQuery,
  useCreateRequisitionMutation,
  useSearchDonorsMutation,
  useNotifyAllDonorsMutation,
  useRespondToRequisitionMutation,
} from '../../store/api/lifeLinkApi'
import { useGetPublicOrganizationQuery } from '../../store/api/apiSlice'
import LoadingSpinner from '../../components/common/UI/LoadingSpinner'
import BloodProfileModal from '../../components/common/UI/BloodProfileModal'
import BloodCompatibilityModal from '../../components/common/UI/BloodCompatibilityModal'
import type { BloodGroup, BloodProfile, CreateRequisitionRequest, UrgencyLevel, DonorResponseStatus } from '../../types/lifeLink'
import { getApiUrl } from '@/utils/helpers'

// Blood group options for filtering
const BLOOD_GROUP_OPTIONS: Array<{ value: BloodGroup | ''; label: string; color: string }> = [
  { value: '', label: 'All Blood Groups', color: 'gray' },
  { value: 'O_NEGATIVE', label: 'O−', color: 'red' },
  { value: 'O_POSITIVE', label: 'O+', color: 'orange' },
  { value: 'A_NEGATIVE', label: 'A−', color: 'blue' },
  { value: 'A_POSITIVE', label: 'A+', color: 'indigo' },
  { value: 'B_NEGATIVE', label: 'B−', color: 'green' },
  { value: 'B_POSITIVE', label: 'B+', color: 'emerald' },
  { value: 'AB_NEGATIVE', label: 'AB−', color: 'purple' },
  { value: 'AB_POSITIVE', label: 'AB+', color: 'pink' },
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

// Modal Components
const MyDonationsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [page, setPage] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDonation, { isLoading: isAdding }] = useAddDonationMutation()
  
  const { data: donationsData, isLoading, refetch } = useGetMyDonationsQuery({ page, limit: 5 })
  const { data: statusData } = useGetDonationStatusQuery()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    defaultValues: {
      donationDate: new Date().toISOString().split('T')[0],
      location: '',
      units: 1,
      notes: ''
    }
  })

  const onSubmit = async (data: any) => {
    try {
      await addDonation(data).unwrap()
      refetch()
      setShowAddForm(false)
      reset()
    } catch (error) {
      console.error('Failed to add donation:', error)
    }
  }

  const donations = donationsData?.donations || []
  const summary = donationsData?.summary

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-4xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                My Blood Donations
              </DialogTitle>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Donation
                </button>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Status Card */}
            {statusData && (
              <div className={`p-4 rounded-lg mb-6 ${
                statusData.eligibility.isEligible
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
              }`}>
                <h3 className={`font-semibold ${
                  statusData.eligibility.isEligible
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-orange-800 dark:text-orange-200'
                }`}>
                  {statusData.eligibility.isEligible ? '✅ Eligible to Donate' : '⏳ Not Eligible Yet'}
                </h3>
                <p className="text-sm mt-1">{statusData.eligibility.message}</p>
              </div>
            )}

            {/* Summary Stats */}
            {summary && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-500">{summary.totalDonations || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Donations</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">{summary.totalUnits || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Units Donated</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Last Donation</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {summary.lastDonationDate ? format(new Date(summary.lastDonationDate), 'MMM dd, yyyy') : 'None'}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-500">~{(summary.totalUnits || 0) * 3}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Lives Impacted</div>
                </div>
              </div>
            )}

            {/* Add Donation Form */}
            {showAddForm && (
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                <h4 className="font-semibold mb-4">Add New Donation</h4>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Donation Date</label>
                      <input
                        {...register('donationDate', { required: true })}
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Units</label>
                      <select {...register('units')} className="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500">
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} unit{n>1?'s':''}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Location</label>
                    <input
                      {...register('location', { required: true })}
                      placeholder="e.g., Red Cross Center, AIIMS Hospital"
                      className="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
                    <textarea
                      {...register('notes')}
                      rows={2}
                      className="w-full p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isAdding}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      {isAdding ? <LoadingSpinner size="sm" /> : 'Add Donation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Donations List */}
            {isLoading ? (
              <LoadingSpinner />
            ) : donations.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🩸</div>
                <h3 className="text-lg font-medium mb-2">No donations recorded yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Start your life-saving journey!</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Add Your First Donation
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {donations.map((donation) => (
                  <div key={donation.id} className="border rounded-lg p-4 dark:border-gray-600">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{donation.location}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {format(new Date(donation.donationDate), 'PPP')}
                        </p>
                        {donation.notes && (
                          <p className="text-sm text-gray-500 mt-1">{donation.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-red-500">
                          {donation.units} unit{donation.units > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

const EmergencyRequestsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'discover' | 'my-requests'>('discover')
  const [selectedRequisition, setSelectedRequisition] = useState<any>(null)
  const [showRespondForm, setShowRespondForm] = useState(false)
  
  const { data: discoverData, isLoading: loadingDiscover } = useDiscoverRequisitionsQuery({ page: 1, limit: 10 })
  const { data: myRequestsData, isLoading: loadingMyRequests } = useGetMyRequisitionsQuery({ page: 1, limit: 10 })
  const [respondToRequisition, { isLoading: isResponding }] = useRespondToRequisitionMutation()

  const isLoading = activeTab === 'discover' ? loadingDiscover : loadingMyRequests
  const requisitions = activeTab === 'discover'
    ? (discoverData?.requisitions || [])
    : (myRequestsData?.requisitions || [])

  const {
    register,
    handleSubmit,
    reset,
  } = useForm({
    defaultValues: {
      response: 'WILLING' as DonorResponseStatus,
      message: ''
    }
  })

  const onRespondSubmit = async (data: any) => {
    if (!selectedRequisition) return
    try {
      await respondToRequisition({
        requisitionId: selectedRequisition.id,
        response: data
      }).unwrap()
      setShowRespondForm(false)
      setSelectedRequisition(null)
      reset()
    } catch (error) {
      console.error('Failed to respond:', error)
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-5xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                Emergency Blood Requests
              </DialogTitle>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
              <button
                onClick={() => setActiveTab('discover')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'discover'
                    ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                🆘 Help Others
              </button>
              <button
                onClick={() => setActiveTab('my-requests')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'my-requests'
                    ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                📋 My Requests
              </button>
            </div>

            {/* Content */}
            {isLoading ? (
              <LoadingSpinner />
            ) : requisitions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">{activeTab === 'discover' ? '🔍' : '📋'}</div>
                <h3 className="text-lg font-medium mb-2">
                  {activeTab === 'discover' ? 'No emergency requests found' : 'No requests created yet'}
                </h3>
              </div>
            ) : (
              <div className="space-y-4">
                {requisitions.map((req: any) => (
                  <div key={req.id} className="border rounded-lg p-4 dark:border-gray-600">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">Patient: {req.patientName}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {req.hospitalName} • {req.location}
                        </p>
                        <p className="text-sm">
                          Needs: {req.unitsNeeded} unit{req.unitsNeeded > 1 ? 's' : ''} of {req.requiredBloodGroup.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-500">
                          Required by: {format(new Date(req.requiredByDate), 'PPP')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          req.urgencyLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                          req.urgencyLevel === 'MEDIUM' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {req.urgencyLevel} PRIORITY
                        </span>
                        {activeTab === 'discover' && req.status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              setSelectedRequisition(req)
                              setShowRespondForm(true)
                            }}
                            className="block mt-2 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                          >
                            🤝 I Can Help
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Respond Form Modal */}
            {showRespondForm && selectedRequisition && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-10">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                  <h3 className="text-lg font-bold mb-4">Respond to Request</h3>
                  <form onSubmit={handleSubmit(onRespondSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Your Response</label>
                      <select {...register('response')} className="w-full p-2 border rounded-lg dark:bg-gray-700">
                        <option value="WILLING">I can help!</option>
                        <option value="NOT_AVAILABLE">Not available now</option>
                        <option value="NOT_SUITABLE">Cannot donate</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Message (Optional)</label>
                      <textarea
                        {...register('message')}
                        rows={3}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700"
                        placeholder="Any message for the requester..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isResponding}
                        className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                      >
                        {isResponding ? <LoadingSpinner size="sm" /> : 'Send Response'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRespondForm(false)}
                        className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

const CreateEmergencyRequestModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1)
  const [donorCount, setDonorCount] = useState<number | null>(null)
  const [searchingDonors, setSearchingDonors] = useState(false)
  
  const [createRequisition, { isLoading: isCreating }] = useCreateRequisitionMutation()
  const [searchDonors] = useSearchDonorsMutation()
  const [notifyAllDonors] = useNotifyAllDonorsMutation()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    reset
  } = useForm<CreateRequisitionRequest>({
    mode: 'onChange',
    defaultValues: {
      unitsNeeded: 1,
      urgencyLevel: 'HIGH',
      allowContactReveal: true,
      requiredByDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  })

  const watchedValues = watch()

  // Check donor count when blood group and location change
  useEffect(() => {
    const checkDonorCount = async () => {
      if (watchedValues.requiredBloodGroup && watchedValues.location && watchedValues.location.length > 2) {
        setSearchingDonors(true)
        try {
          const result = await searchDonors({
            requiredBloodGroup: watchedValues.requiredBloodGroup,
            location: watchedValues.location,
            limit: 100
          }).unwrap()
          setDonorCount(result.totalFound || 0)
        } catch (error) {
          setDonorCount(0)
        } finally {
          setSearchingDonors(false)
        }
      } else {
        setDonorCount(null)
      }
    }

    const timer = setTimeout(checkDonorCount, 500)
    return () => clearTimeout(timer)
  }, [watchedValues.requiredBloodGroup, watchedValues.location, searchDonors])

  const onSubmit = async (data: CreateRequisitionRequest) => {
    try {
      const result = await createRequisition({
        ...data,
        requiredByDate: new Date(data.requiredByDate).toISOString()
      }).unwrap()
      
      // Auto-notify all donors
      try {
        await notifyAllDonors({ requisitionId: result.id }).unwrap()
        toast.success(`Emergency request created and ${donorCount} donors notified!`)
      } catch (error) {
        console.error('Failed to notify donors:', error)
        toast.error('Request created but failed to notify donors')
      }
      
      onClose()
      reset()
      setStep(1)
    } catch (error) {
      console.error('Failed to create requisition:', error)
      toast.error('Failed to create emergency request')
    }
  }

  const nextStep = () => setStep(step + 1)
  const prevStep = () => setStep(step - 1)

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                Create Emergency Blood Request
              </DialogTitle>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              {[1, 2, 3].map((stepNumber) => (
                <React.Fragment key={stepNumber}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    step >= stepNumber
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {stepNumber}
                  </div>
                  {stepNumber < 3 && (
                    <div className={`w-12 h-1 mx-2 ${
                      step > stepNumber ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 1: Patient & Hospital */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Patient & Hospital Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Patient Name *</label>
                      <input
                        {...register('patientName', { required: 'Required' })}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Enter patient's full name"
                      />
                      {errors.patientName && <p className="text-red-500 text-xs">{errors.patientName.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Hospital Name *</label>
                      <input
                        {...register('hospitalName', { required: 'Required' })}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        placeholder="e.g., AIIMS Hospital"
                      />
                      {errors.hospitalName && <p className="text-red-500 text-xs">{errors.hospitalName.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Contact Number *</label>
                      <input
                        {...register('contactNumber', { 
                          required: 'Required',
                          pattern: { value: /^[6-9]\d{9}$/, message: 'Invalid number' }
                        })}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        placeholder="10-digit mobile number"
                      />
                      {errors.contactNumber && <p className="text-red-500 text-xs">{errors.contactNumber.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Alternate Number</label>
                      <input
                        {...register('alternateNumber')}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Alternative contact"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={nextStep}
                      disabled={!watchedValues.patientName || !watchedValues.hospitalName || !watchedValues.contactNumber}
                      className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Blood Requirements */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Blood Requirements</h3>
                  
                  {/* Blood Group Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Required Blood Group *</label>
                    <div className="grid grid-cols-4 gap-2">
                      {BLOOD_GROUP_OPTIONS.slice(1).map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center justify-center p-2 border-2 rounded-lg cursor-pointer transition-colors ${
                            watchedValues.requiredBloodGroup === option.value
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <input
                            {...register('requiredBloodGroup', { required: true })}
                            type="radio"
                            value={option.value}
                            className="sr-only"
                          />
                          <span className="font-medium">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Hospital Location */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Hospital Location/Area *</label>
                    <input
                      {...register('location', { required: 'Required' })}
                      className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      placeholder="e.g., Sector 14, Gurgaon, Haryana"
                    />
                    {errors.location && <p className="text-red-500 text-xs">{errors.location.message}</p>}
                  </div>

                  {/* Donor Count Display */}
                  {(donorCount !== null || searchingDonors) && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <UserGroupIcon className="h-5 w-5 text-blue-600" />
                        {searchingDonors ? (
                          <span className="text-blue-800 dark:text-blue-200">Searching for donors...</span>
                        ) : (
                          <span className="text-blue-800 dark:text-blue-200">
                            <strong>{donorCount}</strong> potential donor{donorCount !== 1 ? 's' : ''} found in this area
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Units Needed *</label>
                      <select
                        {...register('unitsNeeded')}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      >
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <option key={n} value={n}>{n} unit{n>1?'s':''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Required By Date *</label>
                      <input
                        {...register('requiredByDate', { required: true })}
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Urgency Level *</label>
                    <div className="space-y-2">
                      {URGENCY_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                            watchedValues.urgencyLevel === option.value
                              ? option.color
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <input
                            {...register('urgencyLevel')}
                            type="radio"
                            value={option.value}
                            className="mt-1 mr-3"
                          />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{option.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="px-6 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      onClick={nextStep}
                      disabled={!watchedValues.requiredBloodGroup || !watchedValues.location}
                      className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Additional Details */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Additional Details</h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Medical Condition (Optional)</label>
                    <textarea
                      {...register('medicalCondition')}
                      rows={3}
                      className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      placeholder="Brief description of the medical condition..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Additional Notes (Optional)</label>
                    <textarea
                      {...register('additionalNotes')}
                      rows={2}
                      className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      placeholder="Any additional information..."
                    />
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <label className="flex items-center space-x-2">
                      <input
                        {...register('allowContactReveal')}
                        type="checkbox"
                        className="text-red-500"
                      />
                      <div>
                        <div className="font-medium">Allow Contact Information Sharing</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Willing donors will see your contact information
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Alert Notification Section */}
                  {donorCount !== null && donorCount > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <BellIcon className="h-5 w-5 text-amber-600" />
                        <span className="font-medium text-amber-800 dark:text-amber-200">
                          Alert Notification Ready
                        </span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        When you submit this request, all {donorCount} potential donors in the area will be immediately notified via push notification about this emergency.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="px-6 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      ← Previous
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating || !isValid}
                      className="px-8 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center space-x-2"
                    >
                      {isCreating ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span>Creating & Alerting...</span>
                        </>
                      ) : (
                        <>
                          <span>🆘</span>
                          <span>Create & Alert Donors</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

const LifeLink: React.FC = () => {
  // Modal states
  const [showDonationsModal, setShowDonationsModal] = useState(false)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false)
  const [showCompatibilityGuide, setShowCompatibilityGuide] = useState(false)

  // State for search and filters
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<BloodGroup | ''>('')
  const [eligibleOnly, setEligibleOnly] = useState('false')
  const [searchCity, setSearchCity] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [showStats, setShowStats] = useState(true)
  const [selectedDonor, setSelectedDonor] = useState<BloodProfile | null>(null)
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const limit = 12

  // Debounced search city
  const [debouncedSearchCity, setDebouncedSearchCity] = useState('')
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchCity(searchCity)
      setCurrentPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchCity])

  // API Queries
  const { data: organizationData } = useGetPublicOrganizationQuery()
  const { data: bloodProfile, isLoading: profileLoading } = useGetBloodProfileQuery()
  const { data: donationStatus, isLoading: statusLoading } = useGetDonationStatusQuery(undefined, {
    skip: !bloodProfile?.isBloodDonor
  })
  const { data: statsData, isLoading: statsLoading } = useGetBloodGroupStatsQuery()
  const { 
    data: dashboardData, 
    isLoading: dashboardLoading,
    isFetching,
    refetch 
  } = useGetLifeLinkDashboardQuery({
    bloodGroup: selectedBloodGroup || undefined,
    eligibleOnly,
    page: currentPage,
    limit,
    city: debouncedSearchCity || undefined,
  })

  const donors = dashboardData?.donors || []
  const pagination = dashboardData?.pagination
  const dashboardStats = dashboardData?.stats
  const bloodStats = statsData?.stats

  // Check if user needs to set up blood profile
  useEffect(() => {
    if (bloodProfile && !bloodProfile.bloodGroup) {
      setShowProfileSetup(true)
    }
  }, [bloodProfile])

  // Get blood group color
  const getBloodGroupColor = (bloodGroup: BloodGroup) => {
    const option = BLOOD_GROUP_OPTIONS.find(opt => opt.value === bloodGroup)
    return option?.color || 'gray'
  }

  // Format blood group display
  const formatBloodGroup = (bloodGroup: BloodGroup) => {
    const option = BLOOD_GROUP_OPTIONS.find(opt => opt.value === bloodGroup)
    return option?.label || bloodGroup
  }

  // Reset filters
  const resetFilters = () => {
    setSelectedBloodGroup('')
    setEligibleOnly('false')
    setSearchCity('')
    setCurrentPage(1)
  }

  // Active filters count
  const activeFiltersCount = [
    selectedBloodGroup,
    eligibleOnly === 'true' ? 'eligible' : null,
    debouncedSearchCity,
  ].filter(Boolean).length

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-red-900/20 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="bg-gradient-to-r from-red-500 to-pink-500 p-2 sm:p-2.5 rounded-full mr-3 sm:mr-4"
            >
              <HeartSolidIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              LifeLink Network
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Connect with blood donors in our alumni community. Every donation can save up to three lives.
          </p>
          {organizationData && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {organizationData.name} Blood Donation Network
            </p>
          )}
        </motion.div>

        {/* User Status Card */}
        {bloodProfile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-center space-x-3 sm:space-x-4 flex-1">
                  <div className={`p-2 sm:p-3 rounded-full flex-shrink-0 ${
                    bloodProfile.isBloodDonor
                      ? 'bg-gradient-to-r from-red-500 to-pink-500'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {bloodProfile.isBloodDonor ? (
                      <HeartSolidIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    ) : (
                      <HeartIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">
                      {bloodProfile.isBloodDonor ? 'Registered Blood Donor' : 'Not a Blood Donor'}
                    </h3>
                    {bloodProfile.bloodGroup ? (
                      <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2 flex-wrap">
                        <span className="inline-flex items-center px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 border-2 border-red-200 dark:border-red-800">
                          🩸 {formatBloodGroup(bloodProfile.bloodGroup)}
                        </span>
                        {(bloodProfile.totalUnitsDonated > 0 || bloodProfile.totalBloodDonations > 0) && (
                          <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 sm:px-3 py-1 rounded-lg whitespace-nowrap">
                            {bloodProfile.totalUnitsDonated || bloodProfile.totalBloodDonations} {(bloodProfile.totalUnitsDonated || bloodProfile.totalBloodDonations) === 1 ? 'unit' : 'units'} donated
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Complete your blood profile to join the network
                      </p>
                    )}
                  </div>
                </div>

                {/* Donation Status */}
                {bloodProfile.isBloodDonor && donationStatus && (
                  <div className="sm:text-right flex-shrink-0">
                    <div className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                      donationStatus.eligibility.isEligible
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                    }`}>
                      {donationStatus.eligibility.isEligible ? (
                        <CheckCircleIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      ) : (
                        <ClockIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      )}
                      <span className="hidden sm:inline">{donationStatus.eligibility.isEligible ? 'Eligible to Donate' : 'Not Eligible Yet'}</span>
                      <span className="sm:hidden">{donationStatus.eligibility.isEligible ? 'Eligible' : 'Not Eligible'}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {donationStatus.eligibility.message}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Action Buttons */}
              <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
                {!bloodProfile.bloodGroup && (
                  <button
                    onClick={() => setShowProfileSetup(true)}
                    className="inline-flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 border border-transparent text-xs sm:text-sm leading-4 font-medium rounded-md text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Complete Blood Profile</span>
                    <span className="sm:hidden">Complete Profile</span>
                  </button>
                )}
                {bloodProfile.isBloodDonor && (
                  <>
                    <button
                      onClick={() => setShowDonationsModal(true)}
                      className="inline-flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 text-xs sm:text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      🩸 <span className="hidden sm:inline ml-1">View My Donations</span>
                      <span className="sm:hidden ml-1">Donations</span>
                    </button>
                    <button
                      onClick={() => setShowEmergencyModal(true)}
                      className="inline-flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 text-xs sm:text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      🆘 <span className="hidden sm:inline ml-1">Emergency Requests</span>
                      <span className="sm:hidden ml-1">Requests</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowCreateRequestModal(true)}
                  className="inline-flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 border border-red-300 text-xs sm:text-sm leading-4 font-medium rounded-md text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <ExclamationTriangleIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Create Emergency Request</span>
                  <span className="sm:hidden">Create Request</span>
                </button>
                <button
                  onClick={() => setShowCompatibilityGuide(true)}
                  className="inline-flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 text-xs sm:text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <InformationCircleIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Blood Compatibility Guide</span>
                  <span className="sm:hidden">Compatibility</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Statistics Section */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 sm:mb-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 sm:gap-4">
                {/* Total Donors - Compact */}
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-xl shadow-lg lg:col-span-2">
                  <div className="text-center">
                    <UserGroupIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 mx-auto mb-1.5 sm:mb-2" />
                    <dt className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">
                      Total Donors
                    </dt>
                    <dd className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      {dashboardStats?.totalDonors || 0}
                    </dd>
                  </div>
                </div>

                {/* Available Donors - Compact */}
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-xl shadow-lg lg:col-span-2">
                  <div className="text-center">
                    <CheckCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 mx-auto mb-1.5 sm:mb-2" />
                    <dt className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">
                      Available Donors
                    </dt>
                    <dd className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      {dashboardStats?.eligibleDonors || 0}
                    </dd>
                  </div>
                </div>

                {/* Blood Group Distribution - Individual Cards */}
                <div className="lg:col-span-6 grid grid-cols-4 gap-2 sm:gap-3">
                  {bloodStats ? (
                    BLOOD_GROUP_OPTIONS.slice(1).map((group) => (
                      <div key={group.value} className="bg-white dark:bg-gray-800 p-2 sm:p-3 rounded-xl shadow-lg">
                        <div className="text-center">
                          <div className="text-red-500 text-sm sm:text-lg font-bold mb-0.5 sm:mb-1">{group.label}</div>
                          <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                            {bloodStats[group.value as BloodGroup] || 0}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-4 text-center py-3 sm:py-4">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">No data available</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search and Filter Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            {/* Search Bar */}
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  placeholder="Search by city (e.g., Mumbai, Delhi, Bangalore)..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-600 text-white text-xs">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
                
                <button
                  onClick={() => setShowStats(!showStats)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <ChartBarIcon className="h-4 w-4 mr-1" />
                  {showStats ? 'Hide' : 'Show'} Stats
                </button>
              </div>
            </div>

            {/* Expandable Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-gray-200 dark:border-gray-700 pt-4"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Blood Group Filter */}
                    <div className="relative">
                      <select
                        value={selectedBloodGroup}
                        onChange={(e) => {
                          setSelectedBloodGroup(e.target.value as BloodGroup | '')
                          setCurrentPage(1)
                        }}
                        className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      >
                        {BLOOD_GROUP_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="h-4 w-4 text-gray-400 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Eligible Only Toggle */}
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={eligibleOnly === 'true'}
                        onChange={(e) => {
                          setEligibleOnly(e.target.checked ? 'true' : 'false')
                          setCurrentPage(1)
                        }}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Eligible to donate only
                      </span>
                    </label>

                    {/* Clear Filters */}
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={resetFilters}
                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Available Donors Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Available Donors</h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {donors.length} donor{donors.length !== 1 ? 's' : ''} found
            </span>
          </div>

          {dashboardLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm h-32 sm:h-36">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2"></div>
                  <div className="h-3 sm:h-3.5 bg-gray-200 dark:bg-gray-700 rounded mb-1.5"></div>
                  <div className="h-2.5 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded mb-1.5"></div>
                  <div className="h-2.5 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
                </div>
              ))}
            </div>
          ) : donors.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                🩸
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No donors found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {selectedBloodGroup || debouncedSearchCity ? 'Try adjusting your filters' : 'No donors are currently available'}
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {donors.map((donor, index) => (
                <motion.div
                  key={donor.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-800 rounded-lg p-4 border border-red-500 hover:border-red-400 transition-colors cursor-pointer"
                  onClick={() => setSelectedDonor(donor)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center">
                        {donor.profileImage ? (
                          <img
                            src={getApiUrl(`/api/users/profile-picture/${donor.id}`)}
                            alt={donor.fullName}
                            className="h-10 w-10 rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(donor.fullName)}&background=6B7280&color=fff&size=40`
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm font-medium">
                            {donor.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-orange-400 font-medium text-sm">
                          {donor.fullName}
                        </h3>
                        <p className="text-gray-400 text-xs">
                          {donor.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-red-400 text-lg font-bold">
                        {formatBloodGroup(donor.bloodGroup)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex justify-center"
          >
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.hasPrev}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    page === currentPage
                      ? 'text-white bg-gradient-to-r from-red-500 to-pink-500'
                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasNext}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </motion.div>
        )}

        {/* Donor Details Modal */}
        <AnimatePresence>
          {selectedDonor && (
            <Dialog
              open={!!selectedDonor}
              onClose={() => setSelectedDonor(null)}
              className="relative z-50"
            >
              <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
              <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="mx-auto max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
                  <div className="p-6">
                    <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Donor Details
                    </DialogTitle>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {selectedDonor.firstName} {selectedDonor.lastName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedDonor.addresses[0] ? `${selectedDonor.addresses[0].city}, ${selectedDonor.addresses[0].state}` : 'Location not specified'}
                        </p>
                      </div>

                      {selectedDonor.bloodGroup && (
                        <div>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${getBloodGroupColor(selectedDonor.bloodGroup)}-100 text-${getBloodGroupColor(selectedDonor.bloodGroup)}-800 dark:bg-${getBloodGroupColor(selectedDonor.bloodGroup)}-900 dark:text-${getBloodGroupColor(selectedDonor.bloodGroup)}-300`}>
                            🩸
                            {formatBloodGroup(selectedDonor.bloodGroup)} Blood Group
                          </span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <HeartSolidIcon className="h-4 w-4 text-red-500 mr-2" />
                          {selectedDonor.totalBloodDonations} total donations
                        </div>
                        {selectedDonor.showPhone && selectedDonor.phone ? (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <PhoneIcon className="h-4 w-4 mr-2" />
                            {selectedDonor.phone}
                          </div>
                        ) : (
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <InformationCircleIcon className="h-4 w-4 mr-2" />
                            Contact details not shared
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => setSelectedDonor(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </DialogPanel>
              </div>
            </Dialog>
          )}
        </AnimatePresence>

        {/* Blood Profile Setup Modal */}
        <BloodProfileModal
          isOpen={showProfileSetup}
          onClose={() => setShowProfileSetup(false)}
          onSuccess={() => {
            setShowProfileSetup(false)
            refetch()
          }}
        />

        {/* Feature Modals */}
        <MyDonationsModal isOpen={showDonationsModal} onClose={() => setShowDonationsModal(false)} />
        <EmergencyRequestsModal isOpen={showEmergencyModal} onClose={() => setShowEmergencyModal(false)} />
        <CreateEmergencyRequestModal isOpen={showCreateRequestModal} onClose={() => setShowCreateRequestModal(false)} />

        {/* Blood Compatibility Guide Modal */}
        <BloodCompatibilityModal
          isOpen={showCompatibilityGuide}
          onClose={() => setShowCompatibilityGuide(false)}
        />
      </div>
    </div>
  )
}

export default LifeLink