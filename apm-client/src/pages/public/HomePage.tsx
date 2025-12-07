// src/pages/public/HomePage.tsx
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsDark } from '@/store/slices/themeSlice'
import Lottie from 'lottie-react'
import {
  UserGroupIcon,
  CalendarDaysIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  BanknotesIcon,
  ChartBarIcon,
  UserCircleIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline'

const HomePage = () => {
  const [animationData, setAnimationData] = useState(null)
  const isDark = useSelector(selectIsDark)

  useEffect(() => {
    // Load GUILD logo animation based on theme
    const animationPath = isDark
      ? '/brand/guild-logo-animation-dark.json'
      : '/brand/guild-logo-animation.json'

    fetch(animationPath)
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error('Failed to load animation:', err))
  }, [isDark])

  const features = [
    {
      icon: UserGroupIcon,
      title: 'Alumni Directory',
      description: 'Connect with alumni worldwide and build your professional network'
    },
    {
      icon: CalendarDaysIcon,
      title: 'Events Management',
      description: 'Join exclusive alumni events and reunions'
    },
    {
      icon: HeartIcon,
      title: 'LifeLink',
      description: 'Blood donation network to save lives in emergencies'
    },
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'Social Feed',
      description: 'Share updates, achievements, and engage with the community'
    },
    {
      icon: UserCircleIcon,
      title: 'Groups',
      description: 'Join batch groups, interest groups, and professional communities'
    },
    {
      icon: MegaphoneIcon,
      title: 'Polls & Surveys',
      description: 'Participate in community decisions and share your opinions'
    },
    {
      icon: PhotoIcon,
      title: 'Photo Gallery',
      description: 'Relive memories through shared photo albums and galleries'
    },
    {
      icon: BanknotesIcon,
      title: 'Treasury Management',
      description: 'Transparent financial tracking for the alumni association'
    },
    {
      icon: ChartBarIcon,
      title: 'Analytics & Reports',
      description: 'Comprehensive insights and reports for better decision making'
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-2 flex items-center">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM1ODUzZmMiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE0aDRWMGgtNHYxNHptMCAyMGg0VjIwaC00djE0em0tMjAgMGg0VjIwaC00djE0ek0xNiAxNGg0VjBoLTR2MTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-100"></div>
        </div>

        <div className="container-guild relative z-10">
          <div className="text-center max-w-5xl mx-auto px-2">
            {/* Large Brand Logo Container with overlays */}
            <div className="mb-4 flex justify-center relative">
              {/* Greeting text overlay - positioned above logo */}
              <div className="absolute top-8 sm:top-6 left-1/2 transform -translate-x-1/2 w-full z-20 animate-fade-in">
                <h2 className="text-xl md:text-2xl lg:text-2xl text-gray-700 dark:text-gray-300 font-semibold tracking-wide">
                  Reconnect. Engage. Thrive.
                </h2>
              </div>

              <div className="relative w-full max-w-xl md:max-w-xl overflow-x-hidden overflow-y-hidden hover:scale-105 transition-transform duration-500" style={{ height: '200px', maxHeight: '220px' }}>
                {/* Animated GUILD logo */}
                {animationData ? (
                  <div className="absolute top-1/2 left-1/2 w-full overflow-hidden" style={{ transform: 'translate(-50%, -50%) scale(1.1)' }}>
                    <Lottie
                      animationData={animationData}
                      loop={true}
                      autoplay={true}
                      className="w-auto"
                    />
                  </div>
                ) : (
                  <img
                    src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                    alt="GUILD"
                    className="w-full h-auto drop-shadow-2xl absolute top-1/2 left-1/2"
                    style={{
                      transform: 'translate(-50%, -50%) scale(1)'
                    }}
                  />
                )}
                {/* "by Digikite" overlay at bottom of logo */}
                <div className="absolute bottom-10 right-8 md:bottom-2 md:right-8">
                  <p className="text-xl md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                    by Digikite
                  </p>
                </div>
              </div>
            </div>

            {/* Main Tagline */}
            <div className="my-4">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 leading-tight">
                  Your Professional Alumni Network Portal
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 font-light max-w-3xl mx-auto">
                Connect, Collaborate, and Celebrate Your Journey Together
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
              <Link
                to="/auth/login"
                className="group relative px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-blue-600 rounded-2xl font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <span className="relative z-10">Login</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              </Link>
              <Link
                to="/auth/register"
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-2xl font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <span className="relative z-10">Join GUILD</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              </Link>
            </div>

            {/* Scroll Indicator */}
            <div className="animate-bounce">
              <svg className="w-6 h-6 mx-auto text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
        <div className="container-guild">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Why Choose GUILD?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              All the features you need to stay connected with your alumni community
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="glass-card p-6 md:p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Icon className="w-7 h-7 md:w-8 md:h-8 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold mb-3 dark:text-white text-center">
                    {feature.title}
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 text-center">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
