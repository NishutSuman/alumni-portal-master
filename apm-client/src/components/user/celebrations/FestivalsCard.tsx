// src/components/user/celebrations/FestivalsCard.tsx
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CalendarIcon, 
  SparklesIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { useGetTodaysFestivalsQuery, useGetUpcomingFestivalsQuery, useGetFestivalCalendarQuery, Festival } from '../../../store/api/celebrationsApi'

const FestivalsCard: React.FC = () => {
  const { data: todaysFestivals, isLoading: todaysLoading } = useGetTodaysFestivalsQuery()
  const { data: upcomingFestivals, isLoading: upcomingLoading } = useGetUpcomingFestivalsQuery({ days: 90 })
  const { data: festivalCalendar, isLoading: calendarLoading, error: calendarError } = useGetFestivalCalendarQuery({ year: new Date().getFullYear() })

  const [showCalendarModal, setShowCalendarModal] = React.useState(false)
  const [selectedMonth, setSelectedMonth] = React.useState<number>(new Date().getMonth())
  const [showAccordion, setShowAccordion] = React.useState(true) // Open by default
  const [openMonthAccordions, setOpenMonthAccordions] = React.useState<Set<number>>(new Set([new Date().getMonth()]))

  const todayCount = todaysFestivals?.festivals?.length || 0
  const upcomingCount = upcomingFestivals?.upcomingFestivals?.reduce((total, day) => total + day.festivals.length, 0) || 0

  // Get next upcoming festival with date info
  const nextFestival = React.useMemo(() => {
    if (!upcomingFestivals?.upcomingFestivals?.length) return null
    const firstDay = upcomingFestivals.upcomingFestivals[0]
    const firstFestival = firstDay?.festivals[0]
    if (!firstFestival) return null
    
    return {
      ...firstFestival,
      date: firstDay.date,
      daysUntil: firstDay.daysUntil,
      dayName: firstDay.dayName
    }
  }, [upcomingFestivals])

  // Month names for calendar
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Get festivals for a specific month from calendar (handle both new and cached structure)
  const getFestivalsForMonth = React.useCallback((monthIndex: number) => {
    if (!festivalCalendar) return []
    
    // New structure uses 'calendar' array
    if (festivalCalendar.calendar) {
      const monthData = festivalCalendar.calendar.find(m => m.month === monthIndex + 1)
      return monthData?.festivals || []
    }
    
    // Legacy/cached structure uses 'months' array
    if ((festivalCalendar as any).months) {
      const monthData = (festivalCalendar as any).months.find((m: any) => m.monthNumber === monthIndex + 1)
      return monthData?.festivals || []
    }
    
    return []
  }, [festivalCalendar])

  // Toggle month accordion
  const toggleMonthAccordion = (monthIndex: number) => {
    const newSet = new Set(openMonthAccordions)
    if (newSet.has(monthIndex)) {
      newSet.delete(monthIndex)
    } else {
      newSet.add(monthIndex)
    }
    setOpenMonthAccordions(newSet)
  }

  if (todaysLoading && upcomingLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {/* Accordion Header */}
        <button
          onClick={() => setShowAccordion(!showAccordion)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <SparklesIcon className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Festivals & Holidays</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowCalendarModal(true)
              }}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
            >
              <CalendarIcon className="h-4 w-4" />
              <span>View Calendar</span>
              <ChevronRightIcon className="h-3 w-3" />
            </button>
            <motion.div
              animate={{ rotate: showAccordion ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronUpIcon className="h-5 w-5 text-gray-400" />
            </motion.div>
          </div>
        </button>

        {/* Accordion Content */}
        <AnimatePresence initial={false}>
          {showAccordion && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
            >
              <div className="p-6">
          {/* Today's Festivals */}
          {todayCount > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <span className="text-lg mr-2">🎊</span>
                Celebrating Today
              </h4>
              <div className="space-y-3">
                {todaysFestivals?.festivals?.slice(0, 2).map((festival) => (
                  <motion.div
                    key={festival.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800"
                  >
                    {/* Festival Image - Keka Style */}
                    <div className="flex-shrink-0 mr-4">
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: festival.styling?.backgroundColor || '#f8f9fa' }}
                      >
                        {festival.styling?.vectorImage ? (
                          <img 
                            src={festival.styling.vectorImage} 
                            alt={festival.name}
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent) {
                                parent.innerHTML = `<span style="color: ${festival.styling?.textColor || '#333'}; font-size: 20px; font-weight: bold;">${festival.name.charAt(0)}</span>`
                              }
                            }}
                          />
                        ) : (
                          <span 
                            className="text-xl font-bold"
                            style={{ color: festival.styling?.textColor || '#333' }}
                          >
                            {festival.name.charAt(0)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Festival Info - Keka Style */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">
                        {festival.name}
                      </h3>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <CalendarIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        <span>Today, {new Date().toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric' 
                        })}</span>
                      </div>
                    </div>
                    
                    {/* View All Link */}
                    <div className="flex-shrink-0 ml-4">
                      <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium">
                        View All
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Next Upcoming Festival */}
          {nextFestival && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <span className="text-lg mr-2">📅</span>
                Coming Next
              </h4>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800"
              >
                {/* Festival Image - Keka Style */}
                <div className="flex-shrink-0 mr-4">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: nextFestival.styling?.backgroundColor || nextFestival.backgroundColor || '#f8f9fa' }}
                  >
                    {(nextFestival.styling?.vectorImage || nextFestival.vectorImage) ? (
                      <img 
                        src={nextFestival.name === 'Gandhi Jayanti' ? '/icons/festivals/Archie-Mahatma-Gandhi.svg' : (nextFestival.styling?.vectorImage || nextFestival.vectorImage)} 
                        alt={nextFestival.name}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `<span style="color: ${nextFestival.styling?.textColor || nextFestival.textColor || '#333'}; font-size: 24px; font-weight: bold;">${nextFestival.name.charAt(0)}</span>`
                          }
                        }}
                      />
                    ) : (
                      <span 
                        className="text-2xl font-bold"
                        style={{ color: nextFestival.styling?.textColor || nextFestival.textColor || '#333' }}
                      >
                        {nextFestival.name.charAt(0)}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Festival Info - Keka Style */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">
                    {nextFestival.name}
                  </h3>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <CalendarIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                    <span>{new Date(nextFestival.date?.iso || nextFestival.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      day: '2-digit', 
                      month: 'short',
                      year: 'numeric'
                    })}</span>
                  </div>
                </div>
                
                {/* Days remaining */}
                <div className="flex-shrink-0 ml-4 text-right">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {nextFestival.daysUntil || 'Soon'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    days to go
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{upcomingCount}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Upcoming Festivals</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {festivalCalendar?.totalFestivals || 0}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">This Year</div>
            </div>
          </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Calendar Modal - Inspired by Keka */}
      <AnimatePresence>
        {showCalendarModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCalendarModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Festivals & Holidays {new Date().getFullYear()}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Celebrate traditions throughout the year
                  </p>
                </div>
                <button
                  onClick={() => setShowCalendarModal(false)}
                  className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* 2-Column Month Accordions Layout */}
              <div className="p-6 max-h-96 overflow-y-auto">
                {calendarLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column: January - June */}
                    <div className="space-y-3">
                      {monthNames.slice(0, 6).map((month, index) => {
                        const monthFestivals = getFestivalsForMonth(index)
                        const isOpen = openMonthAccordions.has(index)
                        
                        return (
                          <div key={month} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                            {/* Month Header */}
                            <button
                              onClick={() => toggleMonthAccordion(index)}
                              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex items-center space-x-3">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {month}
                                </span>
                                {monthFestivals.length > 0 && (
                                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium px-2 py-1 rounded-full">
                                    {monthFestivals.length}
                                  </span>
                                )}
                              </div>
                              <motion.div
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                              </motion.div>
                            </button>

                            {/* Month Content */}
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="border-t border-gray-200 dark:border-gray-600"
                                >
                                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                                    {monthFestivals.length === 0 ? (
                                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                                        No festivals this month
                                      </p>
                                    ) : (
                                      <div className="space-y-3">
                                        {monthFestivals.map((festival) => (
                                          <div
                                            key={festival.id}
                                            className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                                          >
                                            {/* Festival Icon */}
                                            <div 
                                              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
                                              style={{ backgroundColor: festival.styling?.backgroundColor || festival.backgroundColor || '#f8f9fa' }}
                                            >
                                              {(festival.styling?.vectorImage || festival.vectorImage) ? (
                                                <img 
                                                  src={festival.styling?.vectorImage || festival.vectorImage} 
                                                  alt={festival.name}
                                                  className="w-6 h-6 object-contain"
                                                  onError={(e) => {
                                                    const target = e.target as HTMLImageElement
                                                    target.style.display = 'none'
                                                    const parent = target.parentElement
                                                    if (parent) {
                                                      parent.innerHTML = `<span style="color: ${festival.styling?.textColor || festival.textColor || '#333'}; font-size: 14px; font-weight: bold;">${festival.name.charAt(0)}</span>`
                                                    }
                                                  }}
                                                />
                                              ) : (
                                                <span 
                                                  className="text-sm font-bold"
                                                  style={{ color: festival.styling?.textColor || festival.textColor || '#333' }}
                                                >
                                                  {festival.name.charAt(0)}
                                                </span>
                                              )}
                                            </div>

                                            {/* Festival Info */}
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                                {festival.name}
                                              </h4>
                                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                                {new Date(festival.date).toLocaleDateString('en-US', {
                                                  day: 'numeric',
                                                  month: 'short'
                                                })}
                                              </p>
                                              {festival.description && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                                  {festival.description}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>

                    {/* Right Column: July - December */}
                    <div className="space-y-3">
                      {monthNames.slice(6).map((month, index) => {
                        const monthIndex = index + 6 // Adjust for second half of year
                        const monthFestivals = getFestivalsForMonth(monthIndex)
                        const isOpen = openMonthAccordions.has(monthIndex)
                        
                        return (
                          <div key={month} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                            {/* Month Header */}
                            <button
                              onClick={() => toggleMonthAccordion(monthIndex)}
                              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex items-center space-x-3">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {month}
                                </span>
                                {monthFestivals.length > 0 && (
                                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium px-2 py-1 rounded-full">
                                    {monthFestivals.length}
                                  </span>
                                )}
                              </div>
                              <motion.div
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                              </motion.div>
                            </button>

                            {/* Month Content */}
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="border-t border-gray-200 dark:border-gray-600"
                                >
                                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                                    {monthFestivals.length === 0 ? (
                                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                                        No festivals this month
                                      </p>
                                    ) : (
                                      <div className="space-y-3">
                                        {monthFestivals.map((festival) => (
                                          <div
                                            key={festival.id}
                                            className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                                          >
                                            {/* Festival Icon */}
                                            <div 
                                              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
                                              style={{ backgroundColor: festival.styling?.backgroundColor || festival.backgroundColor || '#f8f9fa' }}
                                            >
                                              {(festival.styling?.vectorImage || festival.vectorImage) ? (
                                                <img 
                                                  src={festival.styling?.vectorImage || festival.vectorImage} 
                                                  alt={festival.name}
                                                  className="w-6 h-6 object-contain"
                                                  onError={(e) => {
                                                    const target = e.target as HTMLImageElement
                                                    target.style.display = 'none'
                                                    const parent = target.parentElement
                                                    if (parent) {
                                                      parent.innerHTML = `<span style="color: ${festival.styling?.textColor || festival.textColor || '#333'}; font-size: 14px; font-weight: bold;">${festival.name.charAt(0)}</span>`
                                                    }
                                                  }}
                                                />
                                              ) : (
                                                <span 
                                                  className="text-sm font-bold"
                                                  style={{ color: festival.styling?.textColor || festival.textColor || '#333' }}
                                                >
                                                  {festival.name.charAt(0)}
                                                </span>
                                              )}
                                            </div>

                                            {/* Festival Info */}
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                                {festival.name}
                                              </h4>
                                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                                {new Date(festival.date).toLocaleDateString('en-US', {
                                                  day: 'numeric',
                                                  month: 'short'
                                                })}
                                              </p>
                                              {festival.description && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                                  {festival.description}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default FestivalsCard