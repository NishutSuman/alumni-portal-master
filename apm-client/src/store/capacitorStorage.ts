// src/store/capacitorStorage.ts
// Custom storage adapter for redux-persist that uses Capacitor Preferences on native
// and falls back to localStorage on web. This ensures session persistence on mobile.

import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

// Create a storage adapter compatible with redux-persist
const capacitorStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key })
      return value
    }
    return localStorage.getItem(key)
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value })
    } else {
      localStorage.setItem(key, value)
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key })
    } else {
      localStorage.removeItem(key)
    }
  },
}

export default capacitorStorage
