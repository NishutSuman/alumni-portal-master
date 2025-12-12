// src/pages/user/AlumniDirectory.tsx
import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  UserGroupIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  MapPinIcon,
  ChevronDownIcon,
  XMarkIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  PhoneIcon,
  LinkIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  UsersIcon,
  SparklesIcon,
  UserIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react'
import { useSearchAlumniQuery, useGetAlumniStatsQuery, useGetAlumniProfileQuery } from '../../store/api/alumniApi'
import { useGetPublicOrganizationQuery } from '../../store/api/apiSlice'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../../components/common/UI/LoadingSpinner'
import BrandedLoader from '../../components/common/UI/BrandedLoader'
import { getApiUrl } from '@/utils/helpers'

// Employment status options
const EMPLOYMENT_STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'WORKING', label: 'Working' },
  { value: 'STUDYING', label: 'Studying' },
  { value: 'OPEN_TO_WORK', label: 'Open to Work' },
  { value: 'ENTREPRENEUR', label: 'Entrepreneur' },
  { value: 'RETIRED', label: 'Retired' },
]

const AlumniDirectory: React.FC = () => {
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBatch, setSelectedBatch] = useState<number | undefined>()
  const [selectedEmploymentStatus, setSelectedEmploymentStatus] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedState, setSelectedState] = useState('')
  const [sortBy, setSortBy] = useState<'fullName' | 'batch' | 'createdAt'>('fullName')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [showStats, setShowStats] = useState(true)
  const [selectedAlumni, setSelectedAlumni] = useState<any>(null)
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set())
  const limit = 12

  // Debounced search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setCurrentPage(1) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // API Queries
  const { data: statsData, isLoading: statsLoading } = useGetAlumniStatsQuery()
  const { data: organizationData } = useGetPublicOrganizationQuery()
  const { 
    data: alumniData, 
    isLoading: alumniLoading,
    isFetching,
    refetch 
  } = useSearchAlumniQuery({
    search: debouncedSearchTerm,
    batch: selectedBatch,
    employmentStatus: selectedEmploymentStatus,
    city: selectedCity,
    state: selectedState,
    sortBy,
    sortOrder,
    page: currentPage,
    limit,
  })

  const stats = statsData?.data?.stats
  const alumni = alumniData?.data || []
  const pagination = alumniData?.pagination
  

  // Random card flip effect
  useEffect(() => {
    if (!alumni || alumni.length === 0) return

    const flipRandomCard = () => {
      const randomIndex = Math.floor(Math.random() * alumni.length)
      const randomCard = alumni[randomIndex]
      if (randomCard) {
        setFlippedCards(prev => new Set(prev).add(randomCard.id))
        
        // Flip back after 3 seconds
        setTimeout(() => {
          setFlippedCards(prev => {
            const newSet = new Set(prev)
            newSet.delete(randomCard.id)
            return newSet
          })
        }, 3000)
      }
    }

    // Start flipping cards at random intervals between 8-15 seconds
    const interval = setInterval(() => {
      flipRandomCard()
    }, Math.random() * 7000 + 8000)

    return () => clearInterval(interval)
  }, [alumni])
  
  // Query for selected alumni profile details
  const { data: selectedAlumniData, isLoading: profileLoading } = useGetAlumniProfileQuery(
    selectedAlumni?.id || '', 
    { skip: !selectedAlumni }
  )
  
  const selectedAlumniProfile = selectedAlumniData?.data?.user

  // Extract unique batches from stats for filter dropdown
  const batchOptions = useMemo(() => {
    if (!stats?.batchDistribution) return []
    return stats.batchDistribution.map(b => ({
      value: b.year,
      label: `Batch ${b.year}`,
      count: b.totalMembers
    }))
  }, [stats])

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('')
    setSelectedBatch(undefined)
    setSelectedEmploymentStatus('')
    setSelectedCity('')
    setSelectedState('')
    setSortBy('fullName')
    setSortOrder('asc')
    setCurrentPage(1)
  }

  // Check if any filter is active
  const hasActiveFilters = searchTerm || selectedBatch || selectedEmploymentStatus || selectedCity || selectedState

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

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        /* Hide scrollbar on mobile */
        .hide-scrollbar-mobile::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar-mobile {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        /* Show scrollbar on desktop */
        @media (min-width: 1024px) {
          .hide-scrollbar-mobile::-webkit-scrollbar {
            display: block;
            width: 8px;
          }
          .hide-scrollbar-mobile::-webkit-scrollbar-track {
            background: transparent;
          }
          .hide-scrollbar-mobile::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
          }
          .hide-scrollbar-mobile::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
          .hide-scrollbar-mobile {
            -ms-overflow-style: auto;
            scrollbar-width: thin;
          }
        }
      `}</style>
      {/* Header - Fixed Section */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserGroupIcon className="h-6 w-6 lg:h-8 lg:w-8 text-blue-600" />
                Alumni Directory
              </h1>
              <p className="mt-1 text-xs lg:text-sm text-gray-600 dark:text-gray-400">
                Connect with {stats?.totalAlumni || 0} verified alumni from our community
              </p>
            </div>
            <button
              onClick={() => setShowStats(!showStats)}
              className="inline-flex items-center px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <ChartBarIcon className="h-4 w-4 mr-2" />
              {showStats ? 'Hide' : 'Show'} Stats
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Section - Fixed Section */}
      <AnimatePresence>
        {showStats && !statsLoading && stats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
              <div className="grid grid-cols-2 gap-3 lg:gap-4">
                {/* Total Alumni */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 lg:p-4">
                  <div className="flex items-center gap-2 lg:gap-3">
                    <UsersIcon className="h-6 w-6 lg:h-8 lg:w-8 text-white/80" />
                    <div>
                      <p className="text-xl lg:text-3xl font-bold">{stats.totalAlumni}</p>
                      <p className="text-xs lg:text-sm text-white/80">Total Alumni</p>
                    </div>
                  </div>
                </div>

                {/* Recent Joins */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 lg:p-4">
                  <div className="flex items-center gap-2 lg:gap-3">
                    <SparklesIcon className="h-6 w-6 lg:h-8 lg:w-8 text-white/80" />
                    <div>
                      <p className="text-xl lg:text-3xl font-bold">{stats.recentJoins}</p>
                      <p className="text-xs lg:text-sm text-white/80">New (30 days)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Filters - Fixed Section */}
      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 pt-4 lg:pt-6 pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 lg:p-4">
          {/* Search Bar */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, company, institution, or role..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-xs">
                    •
                  </span>
                )}
              </button>
              
              <button
                onClick={refetch}
                disabled={isFetching}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
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
                className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Batch Filter */}
                  <select
                    value={selectedBatch || ''}
                    onChange={(e) => setSelectedBatch(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Batches</option>
                    {batchOptions.map((batch) => (
                      <option key={batch.value} value={batch.value}>
                        {batch.label} ({batch.count})
                      </option>
                    ))}
                  </select>

                  {/* Employment Status Filter */}
                  <select
                    value={selectedEmploymentStatus}
                    onChange={(e) => setSelectedEmploymentStatus(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {/* City Filter */}
                  <input
                    type="text"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    placeholder="City"
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  {/* State Filter */}
                  <input
                    type="text"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    placeholder="State"
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  {/* Sort Options */}
                  <div className="flex gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="fullName">Name</option>
                      <option value="batch">Batch</option>
                      <option value="createdAt">Joined</option>
                    </select>
                    
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <XMarkIcon className="h-4 w-4 mr-1" />
                      Clear all filters
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Alumni Grid - Scrollable Section */}
      <div className="flex-1 overflow-hidden">
        {alumniLoading ? (
          <div className="h-full flex justify-center items-center">
            <BrandedLoader message="" size="lg" />
          </div>
        ) : (
        <div className="h-full overflow-y-auto pb-20 lg:pb-8 hide-scrollbar-mobile">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2">
        {alumniLoading === undefined ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        ) : alumni.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No alumni found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {hasActiveFilters 
                ? 'Try adjusting your filters or search term'
                : 'No alumni have joined the directory yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {alumni.map((alumnus) => {
                const isFlipped = flippedCards.has(alumnus.id)
                return (
                  <motion.div
                    key={alumnus.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group h-56 md:h-64 w-full perspective-1000"
                  >
                    <div
                      className={`relative w-full h-full transform-style-preserve-3d transition-transform duration-700 ${
                        isFlipped ? 'rotate-y-180' : ''
                      }`}
                    >
                      {/* Front Side */}
                      <div className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 overflow-hidden border-b-4 border-b-blue-500 dark:border-b-blue-400">
                        {/* Eye Icon - Top Right Corner */}
                        <button
                          onClick={() => setSelectedAlumni(alumnus)}
                          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-white dark:hover:bg-gray-700 transition-colors shadow-sm"
                          title="View Profile"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>

                        <div className="p-3 md:p-4 text-center h-full flex flex-col justify-center">
                          {/* Profile Image */}
                          <div className="flex justify-center mb-2 md:mb-3">
                            {alumnus.profileImage ? (
                              <img
                                src={getApiUrl(`/api/users/profile-picture/${alumnus.id}`)}
                                alt={alumnus.fullName}
                                className="h-12 w-12 md:h-16 md:w-16 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(alumnus.fullName)}&background=3B82F6&color=fff&size=64`
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm md:text-lg font-bold border-2 border-gray-100 dark:border-gray-700">
                                {alumnus.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Name and Batch */}
                          <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white truncate mb-1 px-1">
                            {alumnus.fullName}
                          </h3>
                          <p className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400 mb-2 md:mb-4">
                            Batch {alumnus.batch}
                          </p>

                          {/* Social Links */}
                          <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-4">
                            {alumnus.linkedinUrl && (
                              <a
                                href={alumnus.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 md:p-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                title="LinkedIn"
                              >
                                <svg className="h-3 w-3 md:h-4 md:w-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                </svg>
                              </a>
                            )}
                            {alumnus.email && (
                              <a
                                href={`mailto:${alumnus.email}`}
                                className="p-1.5 md:p-2 rounded-full bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-colors"
                                title="Email"
                              >
                                <EnvelopeIcon className="h-3 w-3 md:h-4 md:w-4" />
                              </a>
                            )}
                            {alumnus.whatsappNumber && (
                              <a
                                href={`https://wa.me/${alumnus.whatsappNumber.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 md:p-2 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                title="WhatsApp"
                              >
                                <PhoneIcon className="h-3 w-3 md:h-4 md:w-4" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Bio Hover Effect - Slides from Bottom with Blue Theme */}
                        {alumnus.bio && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-blue-600/95 via-blue-500/90 to-transparent p-3 md:p-4 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out">
                            <p className="text-[10px] md:text-xs leading-relaxed line-clamp-2 md:line-clamp-3">
                              {alumnus.bio}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Back Side - Organization Logo */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-sm border border-blue-500 dark:border-blue-400 overflow-hidden border-b-4 border-b-yellow-400">
                        <div className="h-full flex flex-col items-center justify-center text-white p-3 md:p-4">
                          {/* Organization Logo */}
                          <div className="w-12 h-12 md:w-20 md:h-20 flex items-center justify-center mb-2 md:mb-4">
                            {organizationData ? (
                              <img
                                src={getApiUrl('/api/organization/files/logo')}
                                alt={organizationData.name || 'Organization Logo'}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const parent = target.parentElement
                                  if (parent) {
                                    parent.innerHTML = `<svg class="h-8 w-8 md:h-10 md:w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>`
                                  }
                                }}
                              />
                            ) : (
                              <BuildingOfficeIcon className="h-8 w-8 md:h-10 md:w-10 text-white" />
                            )}
                          </div>

                          {/* Organization Name */}
                          <h3 className="text-xs md:text-lg font-bold mb-1 md:mb-2 text-center px-2 line-clamp-2">
                            {organizationData?.name || 'Alumni Portal'}
                          </h3>

                          {/* Organization Short Name or Tagline */}
                          <p className="text-[10px] md:text-sm text-center text-white/80 mb-1 md:mb-2 px-2 line-clamp-2">
                            {organizationData?.shortName || 'Connecting generations of excellence'}
                          </p>

                          {/* Foundation Year */}
                          {organizationData?.foundationYear && (
                            <p className="text-[10px] md:text-xs text-white/60 mb-1 md:mb-2">
                              Est. {organizationData.foundationYear}
                            </p>
                          )}

                          {/* Member Since */}
                          <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-white/60">
                            Member since {new Date(alumnus.createdAt).getFullYear()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!pagination.hasPrev}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const pageNumber = i + 1
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`px-3 py-1 text-sm font-medium rounded-lg ${
                          pageNumber === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    )
                  })}
                  {pagination.totalPages > 5 && (
                    <>
                      <span className="px-2 text-gray-500">...</span>
                      <button
                        onClick={() => setCurrentPage(pagination.totalPages)}
                        className={`px-3 py-1 text-sm font-medium rounded-lg ${
                          pagination.totalPages === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pagination.totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!pagination.hasNext}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
          </div>
        </div>
        )}
      </div>

      {/* Alumni Profile Modal */}
      <Dialog open={!!selectedAlumni} onClose={() => setSelectedAlumni(null)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Alumni Profile
              </DialogTitle>
              <button
                onClick={() => setSelectedAlumni(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {profileLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : selectedAlumniProfile ? (
                <div>
                  {/* Profile Header */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className="flex-shrink-0">
                      {selectedAlumniProfile.profileImage ? (
                        <img
                          src={getApiUrl(`/api/users/profile-picture/${selectedAlumniProfile.id}`)}
                          alt={selectedAlumniProfile.fullName}
                          className="h-20 w-20 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedAlumniProfile.fullName)}&background=3B82F6&color=fff&size=80`
                          }}
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-gray-100 dark:border-gray-700">
                          {selectedAlumniProfile.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {selectedAlumniProfile.fullName}
                      </h3>
                      <div className="flex flex-wrap gap-3 mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                          Batch {selectedAlumniProfile.batch}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEmploymentStatusColor(selectedAlumniProfile.employmentStatus)}`}>
                          {selectedAlumniProfile.employmentStatus.replace('_', ' ')}
                        </span>
                      </div>
                      {selectedAlumniProfile.serialId && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Serial ID:</span> {selectedAlumniProfile.serialId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  {selectedAlumniProfile.bio && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">About</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {selectedAlumniProfile.bio}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Contact Information */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Contact Info</h4>
                      <div className="space-y-2">
                        {selectedAlumniProfile.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                            <a href={`mailto:${selectedAlumniProfile.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {selectedAlumniProfile.email}
                            </a>
                          </div>
                        )}
                        {selectedAlumniProfile.whatsappNumber && (
                          <div className="flex items-center gap-2 text-sm">
                            <PhoneIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {selectedAlumniProfile.whatsappNumber}
                            </span>
                          </div>
                        )}
                        {selectedAlumniProfile.currentAddress && (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {selectedAlumniProfile.currentAddress.city}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Additional Info</h4>
                      <div className="space-y-2">
                        {selectedAlumniProfile.dateOfBirth && (
                          <div className="flex items-center gap-2 text-sm">
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300">
                              Born {new Date(selectedAlumniProfile.dateOfBirth).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-700 dark:text-gray-300">
                            Member since {new Date(selectedAlumniProfile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Career Information */}
                  {selectedAlumniProfile.workHistory && selectedAlumniProfile.workHistory.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Current/Latest Work</h4>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        {selectedAlumniProfile.workHistory.slice(0, 1).map((work) => (
                          <div key={work.id} className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                              <BriefcaseIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{work.jobRole}</p>
                              <p className="text-sm text-blue-600 dark:text-blue-400">{work.companyName}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {work.fromYear} - {work.isCurrentJob ? 'Present' : work.toYear}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education Information */}
                  {selectedAlumniProfile.educationHistory && selectedAlumniProfile.educationHistory.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Latest Education</h4>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        {selectedAlumniProfile.educationHistory.slice(0, 1).map((edu) => (
                          <div key={edu.id} className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                              <AcademicCapIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {edu.course}
                                {edu.stream && ` - ${edu.stream}`}
                              </p>
                              <p className="text-sm text-purple-600 dark:text-purple-400">{edu.institution}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {edu.fromYear} - {edu.isOngoing ? 'Ongoing' : edu.toYear}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Social Links */}
                  {(selectedAlumniProfile.linkedinUrl || selectedAlumniProfile.portfolioUrl) && (
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex gap-3">
                        {selectedAlumniProfile.linkedinUrl && (
                          <a
                            href={selectedAlumniProfile.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          >
                            <LinkIcon className="h-4 w-4 mr-2" />
                            LinkedIn
                          </a>
                        )}
                        {selectedAlumniProfile.portfolioUrl && (
                          <a
                            href={selectedAlumniProfile.portfolioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/30 rounded-lg transition-colors"
                          >
                            <GlobeAltIcon className="h-4 w-4 mr-2" />
                            Portfolio
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Profile not available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    This profile is private or couldn't be loaded.
                  </p>
                </div>
              )}
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  )
}

export default AlumniDirectory