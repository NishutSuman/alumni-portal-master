// src/components/common/UI/ProfileEditModal.tsx
// Comprehensive Profile Edit Modal

import React, { useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  XMarkIcon,
  UserIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline'

import { UserProfile, UpdateProfileRequest, useUpdateProfileMutation } from '../../../store/api/userApi'

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  profile: UserProfile
}

// Validation schema
const profileSchema = yup.object().shape({
  fullName: yup.string().required('Full name is required').min(2, 'Full name must be at least 2 characters'),
  whatsappNumber: yup.string().matches(/^[6-9]\d{9}$/, 'Enter a valid WhatsApp number'),
  alternateNumber: yup.string().matches(/^[6-9]\d{9}$/, 'Enter a valid alternate number'),
  batch: yup.number().min(1900, 'Invalid batch year').max(2050, 'Invalid batch year'),
  admissionYear: yup.number().min(1900, 'Invalid admission year').max(2050, 'Invalid admission year'),
  passoutYear: yup.number().min(1900, 'Invalid passout year').max(2050, 'Invalid passout year'),
  dateOfBirth: yup.string(),
  bio: yup.string().max(500, 'Bio cannot exceed 500 characters'),
  linkedinUrl: yup.string().url('Enter a valid LinkedIn URL'),
  instagramUrl: yup.string().url('Enter a valid Instagram URL'),
  facebookUrl: yup.string().url('Enter a valid Facebook URL'),
  twitterUrl: yup.string().url('Enter a valid Twitter URL'),
  youtubeUrl: yup.string().url('Enter a valid YouTube URL'),
  portfolioUrl: yup.string().url('Enter a valid portfolio URL'),
})

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  profile
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'social' | 'privacy'>('basic')
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null)

  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
    watch
  } = useForm<UpdateProfileRequest>({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      fullName: profile.fullName,
      whatsappNumber: profile.whatsappNumber || '',
      alternateNumber: profile.alternateNumber || '',
      batch: profile.batch,
      admissionYear: profile.admissionYear || undefined,
      passoutYear: profile.passoutYear || undefined,
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
      bio: profile.bio || '',
      employmentStatus: profile.employmentStatus,
      linkedinUrl: profile.linkedinUrl || '',
      instagramUrl: profile.instagramUrl || '',
      facebookUrl: profile.facebookUrl || '',
      twitterUrl: profile.twitterUrl || '',
      youtubeUrl: profile.youtubeUrl || '',
      portfolioUrl: profile.portfolioUrl || '',
      isProfilePublic: profile.isProfilePublic,
      showEmail: profile.showEmail,
      showPhone: profile.showPhone,
      bloodGroup: profile.bloodGroup || undefined,
      isBloodDonor: profile.isBloodDonor,
    }
  })

  // Reset form when profile changes or modal opens
  useEffect(() => {
    if (isOpen) {
      reset({
        fullName: profile.fullName,
        whatsappNumber: profile.whatsappNumber || '',
        alternateNumber: profile.alternateNumber || '',
        batch: profile.batch,
        admissionYear: profile.admissionYear || undefined,
        passoutYear: profile.passoutYear || undefined,
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
        bio: profile.bio || '',
        employmentStatus: profile.employmentStatus,
        linkedinUrl: profile.linkedinUrl || '',
        instagramUrl: profile.instagramUrl || '',
        facebookUrl: profile.facebookUrl || '',
        twitterUrl: profile.twitterUrl || '',
        youtubeUrl: profile.youtubeUrl || '',
        portfolioUrl: profile.portfolioUrl || '',
        isProfilePublic: profile.isProfilePublic,
        showEmail: profile.showEmail,
        showPhone: profile.showPhone,
        bloodGroup: profile.bloodGroup || undefined,
        isBloodDonor: profile.isBloodDonor,
      })
      setProfileImageFile(null)
      setProfileImagePreview(null)
    }
  }, [isOpen, profile, reset])

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setProfileImageFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setProfileImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const onSubmit = async (data: UpdateProfileRequest) => {
    try {
      await updateProfile(data).unwrap()
      onClose()
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      // Handle error display
    }
  }

  const canEditBatch = profile.verificationContext?.canEditBatch

  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                    Edit Profile
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-md p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)}>
                  {/* Tab Navigation */}
                  <div className="border-b border-gray-200 dark:border-gray-700 px-6">
                    <nav className="flex space-x-8" aria-label="Tabs">
                      {[
                        { id: 'basic', name: 'Basic Info' },
                        { id: 'contact', name: 'Contact' },
                        { id: 'social', name: 'Social Links' },
                        { id: 'privacy', name: 'Privacy' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id as typeof activeTab)}
                          className={`py-3 px-1 border-b-2 font-medium text-sm ${
                            activeTab === tab.id
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                          }`}
                        >
                          {tab.name}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Form Content */}
                  <div className="px-6 py-6 max-h-96 overflow-y-auto">
                    {activeTab === 'basic' && (
                      <div className="space-y-6">
                        {/* Profile Picture */}
                        <div className="flex items-center space-x-6">
                          <div className="relative">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                              {profileImagePreview ? (
                                <img
                                  src={profileImagePreview}
                                  alt="Profile Preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : profile.profileImage ? (
                                <img
                                  src={profile.profileImage}
                                  alt={profile.fullName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <UserIcon className="h-8 w-8 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <label className="absolute bottom-0 right-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors cursor-pointer">
                              <CameraIcon className="h-3 w-3 text-white" />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                              />
                            </label>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Profile Photo</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              JPG, GIF or PNG. Max size of 2MB.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Full Name *
                            </label>
                            <input
                              {...register('fullName')}
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {errors.fullName && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.fullName.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Employment Status
                            </label>
                            <select
                              {...register('employmentStatus')}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="WORKING">Working</option>
                              <option value="STUDYING">Studying</option>
                              <option value="OPEN_TO_WORK">Open to Work</option>
                              <option value="ENTREPRENEUR">Entrepreneur</option>
                              <option value="RETIRED">Retired</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Batch Year {!canEditBatch && '(Read Only)'}
                            </label>
                            <input
                              {...register('batch')}
                              type="number"
                              disabled={!canEditBatch}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500"
                            />
                            {errors.batch && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.batch.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Date of Birth
                            </label>
                            <input
                              {...register('dateOfBirth')}
                              type="date"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Admission Year
                            </label>
                            <input
                              {...register('admissionYear')}
                              type="number"
                              placeholder="e.g., 2009"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Passout Year
                            </label>
                            <input
                              {...register('passoutYear')}
                              type="number"
                              placeholder="e.g., 2016"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Bio
                          </label>
                          <textarea
                            {...register('bio')}
                            rows={4}
                            placeholder="Tell us about yourself..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {watch('bio')?.length || 0}/500 characters
                          </p>
                          {errors.bio && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.bio.message}</p>
                          )}
                        </div>

                        {/* LifeLink Section */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                            LifeLink - Blood Donation
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Blood Group
                              </label>
                              <select
                                {...register('bloodGroup')}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="">Select Blood Group</option>
                                <option value="A_POSITIVE">A+</option>
                                <option value="A_NEGATIVE">A-</option>
                                <option value="B_POSITIVE">B+</option>
                                <option value="B_NEGATIVE">B-</option>
                                <option value="AB_POSITIVE">AB+</option>
                                <option value="AB_NEGATIVE">AB-</option>
                                <option value="O_POSITIVE">O+</option>
                                <option value="O_NEGATIVE">O-</option>
                              </select>
                            </div>

                            <div className="flex items-center">
                              <input
                                {...register('isBloodDonor')}
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                I am willing to donate blood
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'contact' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              WhatsApp Number
                            </label>
                            <input
                              {...register('whatsappNumber')}
                              type="tel"
                              placeholder="9876543210"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {errors.whatsappNumber && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.whatsappNumber.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Alternate Number
                            </label>
                            <input
                              {...register('alternateNumber')}
                              type="tel"
                              placeholder="9876543210"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {errors.alternateNumber && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.alternateNumber.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'social' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              LinkedIn Profile
                            </label>
                            <input
                              {...register('linkedinUrl')}
                              type="url"
                              placeholder="https://linkedin.com/in/yourprofile"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {errors.linkedinUrl && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.linkedinUrl.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Portfolio/Website
                            </label>
                            <input
                              {...register('portfolioUrl')}
                              type="url"
                              placeholder="https://yourwebsite.com"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {errors.portfolioUrl && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.portfolioUrl.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Instagram Profile
                            </label>
                            <input
                              {...register('instagramUrl')}
                              type="url"
                              placeholder="https://instagram.com/yourprofile"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {errors.instagramUrl && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.instagramUrl.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Facebook Profile
                            </label>
                            <input
                              {...register('facebookUrl')}
                              type="url"
                              placeholder="https://facebook.com/yourprofile"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {errors.facebookUrl && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.facebookUrl.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Twitter Profile
                            </label>
                            <input
                              {...register('twitterUrl')}
                              type="url"
                              placeholder="https://twitter.com/yourprofile"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {errors.twitterUrl && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.twitterUrl.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              YouTube Channel
                            </label>
                            <input
                              {...register('youtubeUrl')}
                              type="url"
                              placeholder="https://youtube.com/channel/yourchannel"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {errors.youtubeUrl && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.youtubeUrl.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'privacy' && (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <input
                              {...register('isProfilePublic')}
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-3 block text-sm text-gray-700 dark:text-gray-300">
                              Make my profile public
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Other alumni can view your profile information
                              </p>
                            </label>
                          </div>

                          <div className="flex items-center">
                            <input
                              {...register('showEmail')}
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-3 block text-sm text-gray-700 dark:text-gray-300">
                              Show my email address
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Display email address in your public profile
                              </p>
                            </label>
                          </div>

                          <div className="flex items-center">
                            <input
                              {...register('showPhone')}
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-3 block text-sm text-gray-700 dark:text-gray-300">
                              Show my phone number
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Display phone number in your public profile
                              </p>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {isDirty && 'You have unsaved changes'}
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdating || !isDirty}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdating ? (
                          <>
                            <CloudArrowUpIcon className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckIcon className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default ProfileEditModal