// src/pages/user/MyDonations.tsx
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { 
  useGetMyDonationsQuery, 
  useAddDonationMutation, 
  useGetDonationStatusQuery 
} from '../../store/api/lifeLinkApi'
import LoadingSpinner from '../../components/common/UI/LoadingSpinner'

interface AddDonationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const AddDonationModal: React.FC<AddDonationModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    donationDate: new Date().toISOString().split('T')[0],
    location: '',
    units: 1,
    notes: ''
  })

  const [addDonation, { isLoading: isAdding }] = useAddDonationMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await addDonation({
        donationDate: formData.donationDate,
        location: formData.location,
        units: formData.units,
        notes: formData.notes || undefined
      }).unwrap()
      
      onSuccess()
      onClose()
      setFormData({
        donationDate: new Date().toISOString().split('T')[0],
        location: '',
        units: 1,
        notes: ''
      })
    } catch (error) {
      console.error('Failed to add donation:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md"
      >
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Add Blood Donation Record
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Donation Date
            </label>
            <input
              type="date"
              value={formData.donationDate}
              onChange={(e) => setFormData({ ...formData, donationDate: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Donation Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Red Cross Center, AIIMS Hospital"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Units Donated
            </label>
            <select
              value={formData.units}
              onChange={(e) => setFormData({ ...formData, units: parseInt(e.target.value) })}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              {[1, 2, 3, 4, 5].map(unit => (
                <option key={unit} value={unit}>{unit} unit{unit > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes about the donation..."
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
              disabled={isAdding}
              className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center"
            >
              {isAdding ? <LoadingSpinner size="sm" /> : 'Add Donation'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

const MyDonations: React.FC = () => {
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)

  const { 
    data: donationsData, 
    isLoading: loadingDonations, 
    refetch: refetchDonations 
  } = useGetMyDonationsQuery({ page, limit: 10 })

  const { 
    data: statusData, 
    isLoading: loadingStatus 
  } = useGetDonationStatusQuery()

  const handleAddSuccess = () => {
    refetchDonations()
  }

  if (loadingDonations || loadingStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  const donations = donationsData?.data || []
  const summary = donationsData?.summary
  const pagination = donationsData?.pagination
  const eligibility = statusData

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Blood Donations
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your blood donation history and contribution
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
        >
          <span>🩸</span>
          Add Donation
        </button>
      </div>

      {/* Donation Status Card */}
      {eligibility && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-xl shadow-lg mb-6 ${
            eligibility.isEligible 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`text-lg font-semibold ${
                eligibility.isEligible 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-orange-800 dark:text-orange-200'
              }`}>
                {eligibility.isEligible ? '✅ Eligible to Donate' : '⏳ Not Eligible Yet'}
              </h3>
              <p className={`mt-1 ${
                eligibility.isEligible 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-orange-700 dark:text-orange-300'
              }`}>
                {eligibility.message}
              </p>
              {eligibility.nextEligibleDate && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Next eligible date: {format(new Date(eligibility.nextEligibleDate), 'PPP')}
                </p>
              )}
            </div>
            {eligibility.daysSinceLastDonation !== undefined && (
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {eligibility.daysSinceLastDonation}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  days since last donation
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg"
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500 mb-2">
                {summary.totalDonations || 0}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Total Donations
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg"
          >
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Last Donation
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {summary.lastDonationDate 
                  ? format(new Date(summary.lastDonationDate), 'MMM dd, yyyy')
                  : 'No donations yet'
                }
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg"
          >
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Lives Impacted
              </div>
              <div className="text-2xl font-bold text-green-500">
                ~{(summary.totalDonations || 0) * 3}
              </div>
              <div className="text-sm text-gray-500">
                Each donation can save up to 3 lives
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Donations List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg"
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Donation History
          </h2>
        </div>

        {donations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🩸</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No donations recorded yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start your life-saving journey by recording your first blood donation!
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Add Your First Donation
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {donations.map((donation, index) => (
              <motion.div
                key={donation.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🩸</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {donation.location}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(donation.donationDate), 'PPP')}
                      </p>
                      {donation.notes && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {donation.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-red-500">
                      {donation.units} unit{donation.units > 1 ? 's' : ''}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(donation.createdAt), 'MMM dd')}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
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
          </div>
        )}
      </motion.div>

      {/* Add Donation Modal */}
      <AddDonationModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}

export default MyDonations