// src/components/common/UI/BloodCompatibilityModal.tsx
import React from 'react'
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react'
import {
  XMarkIcon,
  HeartIcon,
  ArrowRightIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

interface BloodCompatibilityModalProps {
  isOpen: boolean
  onClose: () => void
}

const BloodCompatibilityModal: React.FC<BloodCompatibilityModalProps> = ({ isOpen, onClose }) => {
  const compatibilityData = [
    {
      donor: 'O−',
      recipients: ['O−', 'O+', 'A−', 'A+', 'B−', 'B+', 'AB−', 'AB+'],
      color: 'red',
      title: 'Universal Donor',
      description: 'Can donate to all blood types'
    },
    {
      donor: 'O+',
      recipients: ['O+', 'A+', 'B+', 'AB+'],
      color: 'orange',
      title: 'Common Donor',
      description: 'Can donate to all positive blood types'
    },
    {
      donor: 'A−',
      recipients: ['A−', 'A+', 'AB−', 'AB+'],
      color: 'blue',
      title: 'A Negative',
      description: 'Can donate to A and AB types'
    },
    {
      donor: 'A+',
      recipients: ['A+', 'AB+'],
      color: 'indigo',
      title: 'A Positive',
      description: 'Can donate to A+ and AB+'
    },
    {
      donor: 'B−',
      recipients: ['B−', 'B+', 'AB−', 'AB+'],
      color: 'green',
      title: 'B Negative',
      description: 'Can donate to B and AB types'
    },
    {
      donor: 'B+',
      recipients: ['B+', 'AB+'],
      color: 'emerald',
      title: 'B Positive',
      description: 'Can donate to B+ and AB+'
    },
    {
      donor: 'AB−',
      recipients: ['AB−', 'AB+'],
      color: 'purple',
      title: 'AB Negative',
      description: 'Can donate to AB types only'
    },
    {
      donor: 'AB+',
      recipients: ['AB+'],
      color: 'pink',
      title: 'Universal Recipient',
      description: 'Can only donate to AB+ but can receive from all'
    }
  ]

  const recipientData = [
    {
      recipient: 'O−',
      canReceiveFrom: ['O−'],
      color: 'red',
      title: 'Universal Donor Blood Type',
      description: 'Can only receive from O−'
    },
    {
      recipient: 'O+',
      canReceiveFrom: ['O−', 'O+'],
      color: 'orange',
      title: 'O Positive',
      description: 'Can receive from O− and O+'
    },
    {
      recipient: 'A−',
      canReceiveFrom: ['O−', 'A−'],
      color: 'blue',
      title: 'A Negative',
      description: 'Can receive from O− and A−'
    },
    {
      recipient: 'A+',
      canReceiveFrom: ['O−', 'O+', 'A−', 'A+'],
      color: 'indigo',
      title: 'A Positive',
      description: 'Can receive from O and A types'
    },
    {
      recipient: 'B−',
      canReceiveFrom: ['O−', 'B−'],
      color: 'green',
      title: 'B Negative',
      description: 'Can receive from O− and B−'
    },
    {
      recipient: 'B+',
      canReceiveFrom: ['O−', 'O+', 'B−', 'B+'],
      color: 'emerald',
      title: 'B Positive',
      description: 'Can receive from O and B types'
    },
    {
      recipient: 'AB−',
      canReceiveFrom: ['O−', 'A−', 'B−', 'AB−'],
      color: 'purple',
      title: 'AB Negative',
      description: 'Can receive from all negative types'
    },
    {
      recipient: 'AB+',
      canReceiveFrom: ['O−', 'O+', 'A−', 'A+', 'B−', 'B+', 'AB−', 'AB+'],
      color: 'pink',
      title: 'Universal Recipient',
      description: 'Can receive from all blood types'
    }
  ]

  const colorClasses = {
    red: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
    orange: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
    blue: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
    green: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
    purple: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
    pink: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700'
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-5xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-red-600 to-pink-600 dark:from-red-700 dark:to-pink-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HeartIcon className="h-6 w-6 text-white" />
              <DialogTitle className="text-xl font-bold text-white">
                Blood Compatibility Guide
              </DialogTitle>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
            {/* Info Banner */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex gap-3">
                <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    Understanding Blood Compatibility
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    Blood type compatibility is crucial for safe transfusions. Donors can give blood to specific
                    recipients based on their blood group. This guide shows who you can help based on your blood type.
                  </p>
                </div>
              </div>
            </div>

            {/* Donor Compatibility Section */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ArrowRightIcon className="h-5 w-5 text-red-600" />
                As a Donor: Who Can I Help?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {compatibilityData.map((item) => (
                  <motion.div
                    key={item.donor}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border-2 rounded-xl bg-white dark:bg-gray-700/50 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`px-3 py-1 rounded-lg font-bold border-2 ${colorClasses[item.color as keyof typeof colorClasses]}`}>
                        {item.donor}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Can donate to:
                      </span>
                      {item.recipients.map((recipient) => (
                        <span
                          key={recipient}
                          className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-300 dark:border-green-700"
                        >
                          {recipient}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Recipient Compatibility Section */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ArrowRightIcon className="h-5 w-5 text-blue-600 rotate-180" />
                As a Recipient: Who Can Help Me?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recipientData.map((item) => (
                  <motion.div
                    key={item.recipient}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border-2 rounded-xl bg-white dark:bg-gray-700/50 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`px-3 py-1 rounded-lg font-bold border-2 ${colorClasses[item.color as keyof typeof colorClasses]}`}>
                        {item.recipient}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Can receive from:
                      </span>
                      {item.canReceiveFrom.map((donor) => (
                        <span
                          key={donor}
                          className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                        >
                          {donor}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Key Facts */}
            <div className="mt-8 p-5 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <HeartIcon className="h-5 w-5 text-red-600" />
                Key Facts About Blood Donation
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 dark:text-red-400">•</span>
                  <span><strong>O− (Universal Donor):</strong> Can save anyone in emergencies - most valuable blood type</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-600 dark:text-pink-400">•</span>
                  <span><strong>AB+ (Universal Recipient):</strong> Can receive from all types but can only help AB+</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong>Waiting Period:</strong> Must wait 90 days (3 months) between blood donations for health safety</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400">•</span>
                  <span><strong>One Donation:</strong> Can save up to 3 lives by separating blood components (red cells, platelets, plasma)</span>
                </li>
              </ul>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export default BloodCompatibilityModal
