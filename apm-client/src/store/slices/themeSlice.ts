// src/store/slices/themeSlice.ts
// GUILD Theme Management (Dark/Light Mode)

import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface ThemeState {
  mode: 'light' | 'dark' | 'system'
  isSystemDark: boolean
  primaryColor: string
  accentColor: string
  animations: boolean
  reducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large'
  compactMode: boolean
}

const initialState: ThemeState = {
  mode: 'system',
  isSystemDark: false,
  primaryColor: '#3b82f6', // GUILD blue
  accentColor: '#a855f7',  // GUILD purple
  animations: true,
  reducedMotion: false,
  fontSize: 'medium',
  compactMode: false,
}

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.mode = action.payload
    },
    setSystemDark: (state, action: PayloadAction<boolean>) => {
      state.isSystemDark = action.payload
    },
    setPrimaryColor: (state, action: PayloadAction<string>) => {
      state.primaryColor = action.payload
    },
    setAccentColor: (state, action: PayloadAction<string>) => {
      state.accentColor = action.payload
    },
    toggleAnimations: (state) => {
      state.animations = !state.animations
    },
    setReducedMotion: (state, action: PayloadAction<boolean>) => {
      state.reducedMotion = action.payload
    },
    setFontSize: (state, action: PayloadAction<'small' | 'medium' | 'large'>) => {
      state.fontSize = action.payload
    },
    toggleCompactMode: (state) => {
      state.compactMode = !state.compactMode
    },
    resetTheme: () => initialState,
  },
})

export const {
  setThemeMode,
  setSystemDark,
  setPrimaryColor,
  setAccentColor,
  toggleAnimations,
  setReducedMotion,
  setFontSize,
  toggleCompactMode,
  resetTheme,
} = themeSlice.actions

// Selectors
export const selectTheme = (state: { theme: ThemeState }) => state.theme
export const selectIsDark = (state: { theme: ThemeState }) => 
  state.theme.mode === 'dark' || (state.theme.mode === 'system' && state.theme.isSystemDark)
export const selectAnimations = (state: { theme: ThemeState }) => 
  state.theme.animations && !state.theme.reducedMotion

export default themeSlice.reducer



