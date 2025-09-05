// src/hooks/useDevice.ts
// Device Detection and Responsive Hook

import { useState, useEffect } from 'react'

interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  screenWidth: number
  screenHeight: number
  orientation: 'portrait' | 'landscape'
  isOnline: boolean
  isTouchDevice: boolean
  devicePixelRatio: number
  platform: string
}

export const useDevice = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenWidth: 1920,
        screenHeight: 1080,
        orientation: 'landscape',
        isOnline: true,
        isTouchDevice: false,
        devicePixelRatio: 1,
        platform: 'unknown',
      }
    }

    const width = window.innerWidth
    const height = window.innerHeight
    
    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      screenWidth: width,
      screenHeight: height,
      orientation: width > height ? 'landscape' : 'portrait',
      isOnline: navigator.onLine,
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      devicePixelRatio: window.devicePixelRatio || 1,
      platform: navigator.platform,
    }
  })

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      setDeviceInfo({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        screenWidth: width,
        screenHeight: height,
        orientation: width > height ? 'landscape' : 'portrait',
        isOnline: navigator.onLine,
        isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        devicePixelRatio: window.devicePixelRatio || 1,
        platform: navigator.platform,
      })
    }

    const handleResize = () => updateDeviceInfo()
    const handleOnline = () => setDeviceInfo(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setDeviceInfo(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('resize', handleResize)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return deviceInfo
}