// src/components/admin/CreateEventForm.tsx
import React, { useState } from 'react'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'
import { useGetEventCategoriesQuery, useCreateEventMutation } from '@/store/api/eventApi'
import LoadingSpinner from '@/components/common/UI/LoadingSpinner'
import toast from 'react-hot-toast'

interface EventFormData {
  title: string
  description: string
  eventDate: string
  startTime: string
  endTime: string
  categoryId: string
  venue: string
  meetingLink: string
  maxCapacity: string
  eventMode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID'
  registrationStartDate: string
  registrationEndDate: string
  registrationFee: string
  guestFee: string
  hasRegistration: boolean
  hasExternalLink: boolean
  hasCustomForm: boolean
  hasMeals: boolean
  hasGuests: boolean
  hasDonations: boolean
  hasPrizes: boolean
  hasOrganizers: boolean
  allowFormModification: boolean
  formModificationDeadlineHours: string
  prizeDetails: string
  organizerDetails: string
  heroImage: File | null
}

const CreateEventForm: React.FC = () => {
  const { data: categoriesData } = useGetEventCategoriesQuery()
  const [createEvent, { isLoading: isCreating }] = useCreateEventMutation()

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    categoryId: '',
    venue: '',
    meetingLink: '',
    maxCapacity: '',
    eventMode: 'PHYSICAL',
    registrationStartDate: '',
    registrationEndDate: '',
    registrationFee: '0',
    guestFee: '0',
    hasRegistration: true,
    hasExternalLink: false,
    hasCustomForm: false,
    hasMeals: false,
    hasGuests: false,
    hasDonations: false,
    hasPrizes: false,
    hasOrganizers: false,
    allowFormModification: false,
    formModificationDeadlineHours: '24',
    prizeDetails: '',
    organizerDetails: '',
    heroImage: null,
  })

  const categories = categoriesData?.categories || []

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => {
        let newData = { ...prev, [name]: value }
        
        // Clear irrelevant fields when event mode changes
        if (name === 'eventMode') {
          if (value === 'VIRTUAL') {
            // Clear physical-only fields
            newData.venue = ''
            newData.hasMeals = false
            newData.hasGuests = false
            newData.guestFee = '0'
            newData.prizeDetails = ''
            newData.organizerDetails = ''
          } else if (value === 'PHYSICAL') {
            // Clear virtual-only fields
            newData.meetingLink = ''
          }
          // HYBRID keeps all fields available
        }
        
        return newData
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setFormData(prev => ({ ...prev, heroImage: file }))
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      eventDate: '',
      startTime: '',
      endTime: '',
      categoryId: '',
      venue: '',
      meetingLink: '',
      maxCapacity: '',
      eventMode: 'PHYSICAL',
      registrationStartDate: '',
      registrationEndDate: '',
      registrationFee: '0',
      guestFee: '0',
      hasRegistration: true,
      hasExternalLink: false,
      hasCustomForm: false,
      hasMeals: false,
      hasGuests: false,
      hasDonations: false,
      hasPrizes: false,
      hasOrganizers: false,
      allowFormModification: false,
      formModificationDeadlineHours: '24',
      prizeDetails: '',
      organizerDetails: '',
      heroImage: null,
    })
    // Reset file input
    const fileInput = document.getElementById('heroImage') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Event title is required')
      return
    }

    if (!formData.eventDate) {
      toast.error('Event date is required')
      return
    }

    // Conditional validation based on event mode
    if (formData.eventMode === 'PHYSICAL' && !formData.venue.trim()) {
      toast.error('Venue is required for physical events')
      return
    }

    if (formData.eventMode === 'VIRTUAL' && !formData.meetingLink.trim()) {
      toast.error('Meeting link is required for virtual events')
      return
    }

    if (formData.eventMode === 'HYBRID' && !formData.venue.trim() && !formData.meetingLink.trim()) {
      toast.error('Either venue or meeting link is required for hybrid events')
      return
    }

    try {
      const formDataToSend = new FormData()
      
      // Add required fields
      formDataToSend.append('title', formData.title.trim())
      formDataToSend.append('eventDate', formData.eventDate)
      formDataToSend.append('eventMode', formData.eventMode)
      
      // Add optional text fields only if they have values
      if (formData.description.trim()) {
        formDataToSend.append('description', formData.description.trim())
      }
      if (formData.startTime) {
        formDataToSend.append('startTime', formData.startTime)
      }
      if (formData.endTime) {
        formDataToSend.append('endTime', formData.endTime)
      }
      if (formData.categoryId) {
        formDataToSend.append('categoryId', formData.categoryId)
      }
      if (formData.venue.trim()) {
        formDataToSend.append('venue', formData.venue.trim())
      }
      if (formData.meetingLink.trim()) {
        formDataToSend.append('meetingLink', formData.meetingLink.trim())
      }
      if (formData.maxCapacity) {
        formDataToSend.append('maxCapacity', formData.maxCapacity)
      }
      if (formData.registrationStartDate) {
        formDataToSend.append('registrationStartDate', formData.registrationStartDate)
      }
      if (formData.registrationEndDate) {
        formDataToSend.append('registrationEndDate', formData.registrationEndDate)
      }
      if (formData.registrationFee) {
        formDataToSend.append('registrationFee', formData.registrationFee)
      }
      // Guest fee only for PHYSICAL and HYBRID events
      if (formData.guestFee && (formData.eventMode === 'PHYSICAL' || formData.eventMode === 'HYBRID')) {
        formDataToSend.append('guestFee', formData.guestFee)
      }
      if (formData.formModificationDeadlineHours) {
        formDataToSend.append('formModificationDeadlineHours', formData.formModificationDeadlineHours)
      }

      // Add boolean fields as strings
      formDataToSend.append('hasRegistration', formData.hasRegistration.toString())
      formDataToSend.append('hasExternalLink', formData.hasExternalLink.toString())
      formDataToSend.append('hasCustomForm', formData.hasCustomForm.toString())
      formDataToSend.append('hasMeals', formData.hasMeals.toString())
      formDataToSend.append('hasGuests', formData.hasGuests.toString())
      formDataToSend.append('hasDonations', formData.hasDonations.toString())
      formDataToSend.append('hasPrizes', formData.hasPrizes.toString())
      formDataToSend.append('hasSponsors', 'false') // Always false since we removed sponsors
      formDataToSend.append('hasOrganizers', formData.hasOrganizers.toString())
      formDataToSend.append('allowFormModification', formData.allowFormModification.toString())

      // Add conditional details fields
      if (formData.hasPrizes && formData.prizeDetails.trim()) {
        formDataToSend.append('prizeDetails', formData.prizeDetails.trim())
      }
      if (formData.hasOrganizers && formData.organizerDetails.trim()) {
        formDataToSend.append('organizerDetails', formData.organizerDetails.trim())
      }

      // Add file if present
      if (formData.heroImage) {
        formDataToSend.append('heroImage', formData.heroImage)
      }

      await createEvent(formDataToSend).unwrap()
      toast.success('Event created successfully!')
      resetForm()
      
    } catch (error: any) {
      console.error('Create event error:', error)
      toast.error(error?.data?.message || 'Failed to create event')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create New Event
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Fill out the form below to create a new event
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="md:col-span-2">
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                📋 Basic Information
              </h4>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter event title"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter event description"
              />
            </div>

            <div>
              <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                id="categoryId"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="eventMode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Event Mode *
              </label>
              <select
                id="eventMode"
                name="eventMode"
                value={formData.eventMode}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="PHYSICAL">Physical</option>
                <option value="VIRTUAL">Virtual</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>

            {/* Date and Time */}
            <div className="md:col-span-2">
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 mt-6 flex items-center">
                📅 Date & Time
              </h4>
            </div>

            <div>
              <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Event Date *
              </label>
              <input
                type="date"
                id="eventDate"
                name="eventDate"
                value={formData.eventDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="maxCapacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Capacity
              </label>
              <input
                type="number"
                id="maxCapacity"
                name="maxCapacity"
                value={formData.maxCapacity}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 100"
              />
            </div>

            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time
              </label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time
              </label>
              <input
                type="time"
                id="endTime"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Location */}
            <div className="md:col-span-2">
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 mt-6 flex items-center">
                📍 Location & Platform
              </h4>
            </div>

            {/* Physical Location (PHYSICAL and HYBRID events only) */}
            {(formData.eventMode === 'PHYSICAL' || formData.eventMode === 'HYBRID') && (
              <div>
                <label htmlFor="venue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Venue {formData.eventMode === 'PHYSICAL' ? '*' : ''}
                </label>
                <input
                  type="text"
                  id="venue"
                  name="venue"
                  value={formData.venue}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Event venue or location"
                  required={formData.eventMode === 'PHYSICAL'}
                />
              </div>
            )}

            {/* Virtual Platform (VIRTUAL and HYBRID events only) */}
            {(formData.eventMode === 'VIRTUAL' || formData.eventMode === 'HYBRID') && (
              <div>
                <label htmlFor="meetingLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Meeting Link {formData.eventMode === 'VIRTUAL' ? '*' : ''}
                </label>
                <input
                  type="url"
                  id="meetingLink"
                  name="meetingLink"
                  value={formData.meetingLink}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://meet.google.com/..."
                  required={formData.eventMode === 'VIRTUAL'}
                />
              </div>
            )}

            {/* Registration */}
            <div className="md:col-span-2">
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 mt-6 flex items-center">
                🎫 Registration Settings
              </h4>
            </div>

            <div>
              <label htmlFor="registrationStartDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Registration Start Date
              </label>
              <input
                type="datetime-local"
                id="registrationStartDate"
                name="registrationStartDate"
                value={formData.registrationStartDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="registrationEndDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Registration End Date
              </label>
              <input
                type="datetime-local"
                id="registrationEndDate"
                name="registrationEndDate"
                value={formData.registrationEndDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="registrationFee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Registration Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                id="registrationFee"
                name="registrationFee"
                value={formData.registrationFee}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>

            {/* Guest Fee - Only for PHYSICAL and HYBRID events with hasGuests enabled */}
            {(formData.eventMode === 'PHYSICAL' || formData.eventMode === 'HYBRID') && formData.hasGuests && (
              <div>
                <label htmlFor="guestFee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Guest Fee (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  id="guestFee"
                  name="guestFee"
                  value={formData.guestFee}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
            )}

            {/* Feature Flags */}
            <div className="md:col-span-2">
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 mt-6 flex items-center">
                ⚙️ Event Features
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Features filtered by event mode */}
                {[
                  { key: 'hasRegistration', label: 'Registration Required', modes: ['PHYSICAL', 'VIRTUAL', 'HYBRID'] },
                  { key: 'hasGuests', label: 'Allow Guests', modes: ['PHYSICAL', 'HYBRID'] },
                  { key: 'hasDonations', label: 'Accept Donations', modes: ['PHYSICAL', 'VIRTUAL', 'HYBRID'] },
                  { key: 'hasPrizes', label: 'Has Prizes', modes: ['PHYSICAL', 'VIRTUAL', 'HYBRID'] },
                  { key: 'hasOrganizers', label: 'Show Organizers', modes: ['PHYSICAL', 'VIRTUAL', 'HYBRID'] },
                  { key: 'hasCustomForm', label: 'Custom Form', modes: ['PHYSICAL', 'VIRTUAL', 'HYBRID'] },
                  { key: 'allowFormModification', label: 'Allow Form Edits', modes: ['PHYSICAL', 'VIRTUAL', 'HYBRID'] },
                  { key: 'hasMeals', label: 'Include Meals', modes: ['PHYSICAL', 'HYBRID'] },
                ].filter(({ modes }) => modes.includes(formData.eventMode)).map(({ key, label }) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      name={key}
                      checked={formData[key as keyof EventFormData] as boolean}
                      onChange={handleInputChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>

              {/* Conditional Prize Details Field */}
              {formData.hasPrizes && (
                <div className="mt-4">
                  <label htmlFor="prizeDetails" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prize Details
                  </label>
                  <textarea
                    id="prizeDetails"
                    name="prizeDetails"
                    rows={3}
                    value={formData.prizeDetails}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter details about prizes, winners categories, etc."
                  />
                </div>
              )}

              {/* Conditional Organizer Details Field */}
              {formData.hasOrganizers && (
                <div className="mt-4">
                  <label htmlFor="organizerDetails" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Organizer Details
                  </label>
                  <textarea
                    id="organizerDetails"
                    name="organizerDetails"
                    rows={3}
                    value={formData.organizerDetails}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter organizer names, contact details, etc."
                  />
                </div>
              )}
              
              {/* Event mode specific notice */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {formData.eventMode === 'PHYSICAL' && '📍 Physical event: All features available including venue, meals, and guest management.'}
                  {formData.eventMode === 'VIRTUAL' && '💻 Virtual event: Streamlined for online participation. Guest management not applicable.'}
                  {formData.eventMode === 'HYBRID' && '🔄 Hybrid event: Full feature set available for both physical and virtual participation.'}
                </p>
              </div>
            </div>

            {/* Hero Image */}
            <div className="md:col-span-2">
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 mt-6 flex items-center">
                🖼️ Event Image
              </h4>
              <div>
                <label htmlFor="heroImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hero Image
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                      <label
                        htmlFor="heroImage"
                        className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>Upload a file</span>
                        <input
                          id="heroImage"
                          name="heroImage"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    {formData.heroImage && (
                      <p className="text-sm text-green-600">Selected: {formData.heroImage.name}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-end space-x-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Reset Form
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <div className="flex items-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Creating Event...</span>
                </div>
              ) : (
                'Create Event'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateEventForm