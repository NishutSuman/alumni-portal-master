// src/components/common/UI/ThemeToggle.tsx
// Beautiful theme toggle component with animations

import React from 'react'
import { useTheme } from '@/hooks/useTheme'

const ThemeToggle = () => {
  const { theme, toggleTheme, setMode } = useTheme()

  return (
    <div className="relative">
      {/* Simple toggle for now */}
      <button
        onClick={toggleTheme}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/20 dark:bg-gray-800/20 backdrop-blur-md border border-white/20 dark:border-gray-700/20 hover:bg-white/30 dark:hover:bg-gray-700/30 transition-all duration-300 group"
        title={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {/* Sun icon (light mode) */}
        <svg
          className={`w-5 h-5 text-yellow-500 transition-all duration-300 ${
            theme.isDark ? 'scale-0 rotate-90' : 'scale-100 rotate-0'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>

        {/* Moon icon (dark mode) */}
        <svg
          className={`absolute w-5 h-5 text-blue-400 transition-all duration-300 ${
            theme.isDark ? 'scale-100 rotate-0' : 'scale-0 -rotate-90'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>

        {/* Glow effect */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-yellow-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
      </button>
    </div>
  )
}

export default ThemeToggle