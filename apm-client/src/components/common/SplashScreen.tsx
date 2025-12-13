// src/components/common/SplashScreen.tsx
// Splash screen shown on mobile app startup with Guild logo

import React from 'react'
import { useSelector } from 'react-redux'
import { selectIsDark } from '@/store/slices/themeSlice'

interface SplashScreenProps {
  onComplete?: () => void
}

const SplashScreen: React.FC<SplashScreenProps> = () => {
  const isDark = useSelector(selectIsDark)

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Logo */}
      <div className="animate-pulse">
        <img
          src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
          alt="GUILD"
          className="h-24 w-auto object-contain"
        />
      </div>

      {/* Loading indicator */}
      <div className="mt-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>

      {/* Powered by */}
      <div className="absolute bottom-8 text-center">
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Powered by{' '}
          <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            Digikite
          </span>
        </p>
      </div>
    </div>
  )
}

export default SplashScreen
