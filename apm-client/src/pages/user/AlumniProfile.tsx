// src/pages/user/AlumniProfile.tsx
import React from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftIcon,
  MapPinIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  EnvelopeIcon,
  PhoneIcon,
  LinkIcon,
  CalendarIcon,
  UserIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import { useGetAlumniProfileQuery } from '../../store/api/alumniApi'
import LoadingSpinner from '../../components/common/UI/LoadingSpinner'
import { getApiUrl } from '@/utils/helpers'

const AlumniProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  
  const { data, isLoading, error } = useGetAlumniProfileQuery(userId!, {
    skip: !userId
  })

  const profile = data?.data?.user

  // Get employment status color
  const getEmploymentStatusColor = (status: string) => {
    switch (status) {
      case 'WORKING':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'STUDYING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'OPEN_TO_WORK':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'ENTREPRENEUR':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'RETIRED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Profile not found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This alumni profile is either private or doesn't exist.
          </p>
          <Link
            to="/user/alumni"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Directory
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/user/alumni')}
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Alumni Directory
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8"
        >
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-32"></div>
          <div className="px-8 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end gap-6 -mt-16">
              {/* Profile Picture */}
              <div className="relative">
                {profile.profileImage ? (
                  <img
                    src={getApiUrl(`/api/users/profile-picture/${profile.id}`)}
                    alt={profile.fullName}
                    className="h-32 w-32 rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-800 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.fullName)}&background=3B82F6&color=fff&size=128`
                    }}
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full border-4 border-white dark:border-gray-800 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
                    {profile.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 sm:pb-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {profile.fullName}
                </h1>
                <div className="flex flex-wrap gap-4 items-center mb-4">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">
                    Batch {profile.batch}
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getEmploymentStatusColor(profile.employmentStatus)}`}>
                    {profile.employmentStatus.replace('_', ' ')}
                  </span>
                </div>

                {/* Contact Actions */}
                <div className="flex flex-wrap gap-3">
                  {profile.email && (
                    <a
                      href={`mailto:${profile.email}`}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <EnvelopeIcon className="h-4 w-4 mr-2" />
                      Email
                    </a>
                  )}
                  {profile.whatsappNumber && (
                    <a
                      href={`https://wa.me/${profile.whatsappNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <PhoneIcon className="h-4 w-4 mr-2" />
                      WhatsApp
                    </a>
                  )}
                  {profile.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
                    >
                      <LinkIcon className="h-4 w-4 mr-2" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            {profile.bio && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">About</h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {profile.bio}
                </p>
              </motion.div>
            )}

            {/* Work Experience */}
            {profile.workHistory && profile.workHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <BriefcaseIcon className="h-5 w-5 mr-2" />
                  Work Experience
                </h2>
                <div className="space-y-4">
                  {profile.workHistory.map((work, index) => (
                    <div key={work.id} className="flex gap-4 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                          <BuildingOfficeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {work.jobRole}
                        </h3>
                        <p className="text-blue-600 dark:text-blue-400 font-medium">
                          {work.companyName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {work.fromYear} - {work.isCurrentJob ? 'Present' : work.toYear}
                          {work.isCurrentJob && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Current
                            </span>
                          )}
                        </p>
                        {work.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            {work.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Education */}
            {profile.educationHistory && profile.educationHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <AcademicCapIcon className="h-5 w-5 mr-2" />
                  Education
                </h2>
                <div className="space-y-4">
                  {profile.educationHistory.map((edu, index) => (
                    <div key={edu.id} className="flex gap-4 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                          <AcademicCapIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {edu.course}
                          {edu.stream && ` - ${edu.stream}`}
                        </h3>
                        <p className="text-purple-600 dark:text-purple-400 font-medium">
                          {edu.institution}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {edu.fromYear} - {edu.isOngoing ? 'Ongoing' : edu.toYear}
                          {edu.isOngoing && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              Ongoing
                            </span>
                          )}
                        </p>
                        {edu.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            {edu.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Info</h3>
              <div className="space-y-3">
                {profile.email && (
                  <div className="flex items-center gap-3">
                    <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                    <a
                      href={`mailto:${profile.email}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {profile.email}
                    </a>
                  </div>
                )}
                {profile.whatsappNumber && (
                  <div className="flex items-center gap-3">
                    <PhoneIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {profile.whatsappNumber}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Location */}
            {profile.currentAddress && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Location</h3>
                <div className="flex items-start gap-3">
                  <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {[profile.currentAddress.city, profile.currentAddress.state, profile.currentAddress.country]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Social Links */}
            {(profile.linkedinUrl || profile.instagramUrl || profile.facebookUrl || profile.twitterUrl || profile.youtubeUrl || profile.portfolioUrl) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Social Links</h3>
                <div className="space-y-3">
                  {profile.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                      LinkedIn
                    </a>
                  )}
                  {profile.portfolioUrl && (
                    <a
                      href={profile.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <GlobeAltIcon className="h-4 w-4" />
                      Portfolio
                    </a>
                  )}
                  {/* Add other social links similarly */}
                </div>
              </motion.div>
            )}

            {/* Member Since */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Member Since</h3>
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {new Date(profile.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlumniProfile