// src/components/user/celebrations/BirthdaysCard.tsx
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CakeIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { useGetTodaysBirthdaysQuery, useGetUpcomingBirthdaysQuery, Birthday } from '../../../store/api/celebrationsApi'

// Static celebration particles component
const StaticParticles: React.FC = () => {
  const particles = [
    { emoji: '🎉', top: '10%', right: '15%', opacity: 0.6 },
    { emoji: '✨', top: '5%', right: '25%', opacity: 0.4 },
    { emoji: '🎊', top: '15%', right: '8%', opacity: 0.5 },
    { emoji: '⭐', top: '20%', right: '20%', opacity: 0.3 },
    { emoji: '🎈', top: '8%', right: '30%', opacity: 0.4 },
    { emoji: '🌟', top: '25%', right: '12%', opacity: 0.3 },
  ]

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle, index) => (
        <div
          key={index}
          className="absolute text-lg"
          style={{
            top: particle.top,
            right: particle.right,
            opacity: particle.opacity,
            transform: `rotate(${Math.random() * 30 - 15}deg)`,
          }}
        >
          {particle.emoji}
        </div>
      ))}
    </div>
  )
}

const BirthdaysCard: React.FC = () => {
  const { data: todaysBirthdays, isLoading: todaysLoading, refetch: refetchTodays } = useGetTodaysBirthdaysQuery(undefined, {
    refetchOnMountOrArgChange: true
  })
  const { data: upcomingBirthdays, isLoading: upcomingLoading, refetch: refetchUpcoming } = useGetUpcomingBirthdaysQuery({ days: 7 }, {
    refetchOnMountOrArgChange: true
  })

  const [showAccordion, setShowAccordion] = React.useState(true) // Open by default

  // Force refresh on mount to bypass cache
  React.useEffect(() => {
    refetchTodays()
    refetchUpcoming()
  }, [refetchTodays, refetchUpcoming])

  const todayCount = todaysBirthdays?.birthdays?.length || 0
  const upcomingCount = upcomingBirthdays?.upcomingBirthdays?.reduce((total, day) => total + day.birthdays.length, 0) || 0

  const upcomingList = React.useMemo(() => {
    if (!upcomingBirthdays?.upcomingBirthdays) return []
    
    const list: (Birthday & { dayName: string; daysFromToday: number })[] = []
    upcomingBirthdays.upcomingBirthdays.forEach(day => {
      day.birthdays.forEach(birthday => {
        list.push({
          ...birthday,
          dayName: day.dayName,
          daysFromToday: day.daysFromToday,
        })
      })
    })
    return list.slice(0, 12) // Limit to 12 for UI
  }, [upcomingBirthdays])

  if (todaysLoading && upcomingLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          <div className="flex space-x-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="space-y-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
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
      {/* Accordion Header - Clean without counts */}
      <button
        onClick={() => setShowAccordion(!showAccordion)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CakeIcon className="h-5 w-5 text-pink-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Birthdays</span>
          </div>
        </div>
        <motion.div
          animate={{ rotate: showAccordion ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronUpIcon className="h-5 w-5 text-gray-400" />
        </motion.div>
      </button>

      {/* Accordion Content */}
      <AnimatePresence initial={false}>
        {showAccordion && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 relative overflow-hidden"
          >
            {/* Static celebration particles - only show if there are birthdays today */}
            {todayCount > 0 && <StaticParticles />}
            
            <div className="p-6 space-y-6 relative z-10">
              
              {/* Today's Birthdays Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Birthdays today
                  </h4>
                  <span className="bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 px-2 py-1 rounded-full text-xs font-medium">
                    {todayCount}
                  </span>
                </div>
                
                {todayCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-3 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <CakeIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
                      No birthdays today.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {todaysBirthdays?.birthdays?.map((birthday) => (
                      <motion.div
                        key={birthday.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center group"
                      >
                        <div className="w-16 h-16 mx-auto mb-3 relative">
                          <motion.div
                            animate={{ 
                              scale: [1, 1.1, 1],
                              rotate: [0, 5, -5, 0]
                            }}
                            transition={{ 
                              duration: 2,
                              repeat: Infinity,
                              repeatDelay: Math.random() * 3 + 2
                            }}
                          >
                            {birthday.profileImage ? (
                              <img
                                src={`http://localhost:3000/api/users/profile-picture/${birthday.id}`}
                                alt={birthday.fullName}
                                className="w-16 h-16 rounded-full object-cover border-2 border-pink-400 shadow-lg"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(birthday.fullName)}&background=EC4899&color=fff&size=64`
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white text-sm font-bold border-2 border-pink-300 shadow-lg">
                                {birthday.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </motion.div>
                          {/* Birthday hat emoji */}
                          <div className="absolute -top-2 -right-1 text-xl animate-bounce">
                            🎂
                          </div>
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate mb-1">
                          {birthday.fullName.split(' ')[0]}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Batch {birthday.batch}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Birthdays Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Upcoming Birthdays (7 days)
                  </h4>
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium">
                    {upcomingCount}
                  </span>
                </div>
                
                {upcomingList.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                    No upcoming birthdays this week.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {upcomingList.map((birthday) => (
                      <motion.div
                        key={`${birthday.id}-${birthday.daysFromToday}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                      >
                        <div className="w-14 h-14 mx-auto mb-2 relative">
                          {birthday.profileImage ? (
                            <img
                              src={`http://localhost:3000/api/users/profile-picture/${birthday.id}`}
                              alt={birthday.fullName}
                              className="w-14 h-14 rounded-full object-cover border border-blue-300 dark:border-blue-600"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(birthday.fullName)}&background=3B82F6&color=fff&size=56`
                              }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold border border-blue-300">
                              {birthday.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate mb-1">
                          {birthday.fullName.split(' ')[0]}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Batch {birthday.batch}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {birthday.daysFromToday === 1 ? 'Tomorrow' : 
                           birthday.daysFromToday < 7 ? new Date(Date.now() + birthday.daysFromToday * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) :
                           `${birthday.daysFromToday} days`}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default BirthdaysCard