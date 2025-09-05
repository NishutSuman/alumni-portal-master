// src/hooks/useTheme.ts
// GUILD Theme Management Hook

import { useSelector, useDispatch } from 'react-redux'
import { useEffect } from 'react'
import {
  setThemeMode,
  setSystemDark,
  setPrimaryColor,
  setAccentColor,
  toggleAnimations,
  setReducedMotion,
  setFontSize,
  toggleCompactMode,
  resetTheme,
  selectTheme,
  selectIsDark,
  selectAnimations,
} from '@/store/slices/themeSlice'

export const useTheme = () => {
  const dispatch = useDispatch()
  const theme = useSelector(selectTheme)
  const isDark = useSelector(selectIsDark)
  const animationsEnabled = useSelector(selectAnimations)

  // Listen to system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      dispatch(setSystemDark(e.matches))
    }
    
    // Set initial system theme
    dispatch(setSystemDark(mediaQuery.matches))
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [dispatch])

  // Listen to reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      dispatch(setReducedMotion(e.matches))
    }
    
    // Set initial preference
    dispatch(setReducedMotion(mediaQuery.matches))
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [dispatch])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    
    // Apply dark/light mode
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    
    // Apply custom colors
    root.style.setProperty('--guild-primary', theme.primaryColor)
    root.style.setProperty('--guild-accent', theme.accentColor)
    
    // Apply font size
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px',
    }
    root.style.setProperty('--base-font-size', fontSizeMap[theme.fontSize])
    
    // Apply compact mode
    if (theme.compactMode) {
      root.classList.add('compact')
    } else {
      root.classList.remove('compact')
    }
  }, [isDark, theme])

  // Theme functions
  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark'
    dispatch(setThemeMode(newMode))
  }

  const setMode = (mode: 'light' | 'dark' | 'system') => {
    dispatch(setThemeMode(mode))
  }

  const updatePrimaryColor = (color: string) => {
    dispatch(setPrimaryColor(color))
  }

  const updateAccentColor = (color: string) => {
    dispatch(setAccentColor(color))
  }

  const toggleAnimationsEnabled = () => {
    dispatch(toggleAnimations())
  }

  const updateFontSize = (size: 'small' | 'medium' | 'large') => {
    dispatch(setFontSize(size))
  }

  const toggleCompact = () => {
    dispatch(toggleCompactMode())
  }

  const resetToDefaults = () => {
    dispatch(resetTheme())
  }

  // Get current theme values
  const currentTheme = {
    mode: theme.mode,
    isDark,
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
    animations: animationsEnabled,
    fontSize: theme.fontSize,
    compactMode: theme.compactMode,
  }

  return {
    theme: currentTheme,
    toggleTheme,
    setMode,
    updatePrimaryColor,
    updateAccentColor,
    toggleAnimations: toggleAnimationsEnabled,
    updateFontSize,
    toggleCompact,
    resetToDefaults,
  }
}
