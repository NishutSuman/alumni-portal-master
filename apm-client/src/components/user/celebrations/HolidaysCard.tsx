// src/components/user/celebrations/HolidaysCard.tsx
import React from 'react'
import { motion } from 'framer-motion'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { useGetTodaysFestivalsQuery, useGetUpcomingFestivalsQuery, Festival } from '../../../store/api/celebrationsApi'
// Note: Using native Date methods instead of date-fns for now

const HolidaysCard: React.FC = () => {
  const { data: todaysFestivals, isLoading: todaysLoading } = useGetTodaysFestivalsQuery()
  const { data: upcomingFestivals, isLoading: upcomingLoading } = useGetUpcomingFestivalsQuery({ days: 30 })

  const [currentFestivalIndex, setCurrentFestivalIndex] = React.useState(0)

  // Get the festivals to display (today's first, then upcoming)
  const allFestivals = React.useMemo(() => {
    const festivals: Festival[] = []
    if (todaysFestivals?.festivals) {
      festivals.push(...todaysFestivals.festivals)
    }
    if (upcomingFestivals?.upcomingFestivals) {
      upcomingFestivals.upcomingFestivals.forEach(day => {
        festivals.push(...day.festivals)
      })
    }
    return festivals
  }, [todaysFestivals, upcomingFestivals])

  const currentFestival = allFestivals[currentFestivalIndex]

  const nextFestival = () => {
    setCurrentFestivalIndex((prev) => (prev + 1) % allFestivals.length)
  }

  const prevFestival = () => {
    setCurrentFestivalIndex((prev) => (prev - 1 + allFestivals.length) % allFestivals.length)
  }

  const formatFestivalDate = (festival: Festival) => {
    const date = new Date(festival.date.iso)
    if (festival.isToday) {
      return 'Today'
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  if (todaysLoading && upcomingLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
          </div>
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (!allFestivals.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Holidays</h3>
        </div>
        <div className="text-center py-8">
          <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No upcoming festivals</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Holidays</h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {allFestivals.length > 1 && `${currentFestivalIndex + 1} of ${allFestivals.length}`}
        </div>
      </div>

      {/* Festival Content */}
      {currentFestival && (
        <div className="relative">
          {/* Navigation Buttons */}
          {allFestivals.length > 1 && (
            <>
              <button
                onClick={prevFestival}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white dark:bg-gray-700 shadow-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronLeftIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={nextFestival}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white dark:bg-gray-700 shadow-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronRightIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
            </>
          )}

          {/* Festival Card */}
          <motion.div
            key={currentFestival.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-6"
            style={{ 
              background: `linear-gradient(135deg, ${currentFestival.backgroundColor}15, ${currentFestival.backgroundColor}05)`,
            }}
          >
            {/* Festival Icon/Image */}
            <div className="flex items-start gap-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-md"
                style={{ 
                  backgroundColor: currentFestival.backgroundColor,
                  color: currentFestival.textColor 
                }}
              >
                {currentFestival.vectorImage ? (
                  <img 
                    src={currentFestival.vectorImage} 
                    alt={currentFestival.name}
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        parent.textContent = currentFestival.name.charAt(0).toUpperCase()
                      }
                    }}
                  />
                ) : (
                  currentFestival.name.charAt(0).toUpperCase()
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Festival Name */}
                <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {currentFestival.name}
                </h4>

                {/* Date */}
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  {formatFestivalDate(currentFestival)}
                </p>

                {/* Description */}
                {currentFestival.description && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    {currentFestival.description}
                  </p>
                )}

                {/* Festival Type Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: `${currentFestival.backgroundColor}20`,
                      color: currentFestival.backgroundColor 
                    }}
                  >
                    {currentFestival.festivalType.replace('_', ' ')}
                  </span>
                  {currentFestival.priority === 'MAJOR' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                      Major Holiday
                    </span>
                  )}
                </div>

                {/* Greeting Message */}
                {currentFestival.greetingMessage && (
                  <p className="text-sm italic text-gray-600 dark:text-gray-400 border-l-2 pl-3 ml-1"
                     style={{ borderColor: currentFestival.backgroundColor }}>
                    {currentFestival.greetingMessage}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* View All Link */}
      {allFestivals.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
          <button className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
            View All ({allFestivals.length})
          </button>
        </div>
      )}
    </motion.div>
  )
}

export default HolidaysCard