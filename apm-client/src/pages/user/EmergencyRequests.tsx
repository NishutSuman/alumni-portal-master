// src/pages/user/EmergencyRequests.tsx
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { 
  useDiscoverRequisitionsQuery,
  useGetMyRequisitionsQuery,
  useRespondToRequisitionMutation
} from '../../store/api/lifeLinkApi'
import type { BloodRequisition, DonorResponseStatus } from '../../types/lifeLink'
import LoadingSpinner from '../../components/common/UI/LoadingSpinner'

interface RespondModalProps {
  isOpen: boolean
  onClose: () => void
  requisition: BloodRequisition | null
  onSuccess: () => void
}

const RespondModal: React.FC<RespondModalProps> = ({ isOpen, onClose, requisition, onSuccess }) => {
  const [response, setResponse] = useState<DonorResponseStatus>('WILLING')
  const [message, setMessage] = useState('')

  const [respondToRequisition, { isLoading: isResponding }] = useRespondToRequisitionMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requisition) return

    try {
      await respondToRequisition({
        requisitionId: requisition.id,
        response: { response, message: message || undefined }
      }).unwrap()
      
      onSuccess()
      onClose()
      setResponse('WILLING')
      setMessage('')
    } catch (error) {
      console.error('Failed to respond to requisition:', error)
    }
  }

  if (!isOpen || !requisition) return null

  const getResponseColor = (responseType: DonorResponseStatus) => {
    switch (responseType) {
      case 'WILLING': return 'text-green-600 bg-green-100'
      case 'NOT_AVAILABLE': return 'text-orange-600 bg-orange-100'
      case 'NOT_SUITABLE': return 'text-red-600 bg-red-100'
    }
  }

  const getResponseLabel = (responseType: DonorResponseStatus) => {
    switch (responseType) {
      case 'WILLING': return 'I can help!'
      case 'NOT_AVAILABLE': return 'Not available now'
      case 'NOT_SUITABLE': return 'Cannot donate'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg"
      >
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Respond to Emergency Request
        </h3>

        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
          <h4 className="font-medium text-gray-900 dark:text-white">
            Patient: {requisition.patientName}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {requisition.hospitalName} • {requisition.location}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Needs: {requisition.unitsNeeded} unit{requisition.unitsNeeded > 1 ? 's' : ''} of {requisition.requiredBloodGroup.replace('_', ' ')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Your Response
            </label>
            <div className="space-y-2">
              {(['WILLING', 'NOT_AVAILABLE', 'NOT_SUITABLE'] as DonorResponseStatus[]).map((option) => (
                <label
                  key={option}
                  className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    response === option
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="response"
                    value={option}
                    checked={response === option}
                    onChange={(e) => setResponse(e.target.value as DonorResponseStatus)}
                    className="mr-3 text-red-500"
                  />
                  <div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getResponseColor(option)}`}>
                      {getResponseLabel(option)}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Any additional message for the requester..."
              rows={3}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResponding}
              className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center"
            >
              {isResponding ? <LoadingSpinner size="sm" /> : 'Send Response'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

const EmergencyRequests: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'discover' | 'my-requests'>('discover')
  const [selectedRequisition, setSelectedRequisition] = useState<BloodRequisition | null>(null)
  const [showRespondModal, setShowRespondModal] = useState(false)
  const [page, setPage] = useState(1)

  const { 
    data: discoverData, 
    isLoading: loadingDiscover,
    refetch: refetchDiscover
  } = useDiscoverRequisitionsQuery({ page, limit: 10 })

  const { 
    data: myRequestsData, 
    isLoading: loadingMyRequests 
  } = useGetMyRequisitionsQuery({ page, limit: 10 })

  const handleRespond = (requisition: BloodRequisition) => {
    setSelectedRequisition(requisition)
    setShowRespondModal(true)
  }

  const handleRespondSuccess = () => {
    refetchDiscover()
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'HIGH': return 'text-red-600 bg-red-100 dark:bg-red-900/30'
      case 'MEDIUM': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
      case 'LOW': return 'text-green-600 bg-green-100 dark:bg-green-900/30'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-100 dark:bg-green-900/30'
      case 'FULFILLED': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
      case 'CANCELLED': return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30'
      case 'EXPIRED': return 'text-red-600 bg-red-100 dark:bg-red-900/30'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30'
    }
  }

  const currentData = activeTab === 'discover' ? discoverData : myRequestsData
  const isLoading = activeTab === 'discover' ? loadingDiscover : loadingMyRequests
  const requisitions = currentData?.data || []
  const pagination = currentData?.pagination

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Emergency Blood Requests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Help save lives by responding to emergency blood requests in your area
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-6">
        <button
          onClick={() => {
            setActiveTab('discover')
            setPage(1)
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'discover'
              ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
              : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          🆘 Help Others (Discover Requests)
        </button>
        <button
          onClick={() => {
            setActiveTab('my-requests')
            setPage(1)
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'my-requests'
              ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
              : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          📋 My Requests
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      ) : requisitions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">
            {activeTab === 'discover' ? '🔍' : '📋'}
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {activeTab === 'discover' 
              ? 'No emergency requests found' 
              : 'No requests created yet'
            }
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {activeTab === 'discover'
              ? 'Check back later for emergency blood requests you can help with'
              : 'Create your first emergency request when you need blood'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requisitions.map((requisition, index) => (
            <motion.div
              key={requisition.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Patient: {requisition.patientName}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(requisition.urgencyLevel)}`}>
                      {requisition.urgencyLevel} PRIORITY
                    </span>
                    {activeTab === 'my-requests' && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(requisition.status)}`}>
                        {requisition.status}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Hospital:</span> {requisition.hospitalName}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Location:</span> {requisition.location}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Required by:</span> {format(new Date(requisition.requiredByDate), 'PPP')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Blood Group:</span> 
                        <span className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                          {requisition.requiredBloodGroup.replace('_', ' ')}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Units needed:</span> {requisition.unitsNeeded}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Posted:</span> {formatDistanceToNow(new Date(requisition.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {requisition.medicalCondition && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Medical Condition:
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        {requisition.medicalCondition}
                      </p>
                    </div>
                  )}

                  {requisition.additionalNotes && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Additional Notes:
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {requisition.additionalNotes}
                      </p>
                    </div>
                  )}
                </div>

                {activeTab === 'discover' && requisition.status === 'ACTIVE' && (
                  <div className="ml-6 flex flex-col space-y-2">
                    <button
                      onClick={() => handleRespond(requisition)}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
                    >
                      🤝 I Can Help
                    </button>
                    {requisition.willingDonorsCount !== undefined && (
                      <div className="text-center">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {requisition.willingDonorsCount} willing donor{requisition.willingDonorsCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'my-requests' && (
                  <div className="ml-6 text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {requisition.willingDonorsCount || 0} responses
                    </div>
                  </div>
                )}
              </div>

              {/* Time urgency indicator */}
              {activeTab === 'discover' && requisition.status === 'ACTIVE' && (
                <div className="mt-4 flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-red-500">⏰</span>
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                      Time Critical: {formatDistanceToNow(new Date(requisition.requiredByDate), { addSuffix: true })}
                    </span>
                  </div>
                  {requisition.urgencyLevel === 'HIGH' && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">
                      URGENT
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setPage(page - 1)}
            disabled={!pagination.hasPrev}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={!pagination.hasNext}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Respond Modal */}
      <RespondModal
        isOpen={showRespondModal}
        onClose={() => setShowRespondModal(false)}
        requisition={selectedRequisition}
        onSuccess={handleRespondSuccess}
      />
    </div>
  )
}

export default EmergencyRequests