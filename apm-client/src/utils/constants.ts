// Application constants
export const APP_NAME = 'GUILD'
export const APP_VERSION = '1.0.0'

export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  DASHBOARD: '/user/dashboard',
  ADMIN: '/admin/dashboard',
} as const

export const ROLES = {
  USER: 'USER',
  BATCH_ADMIN: 'BATCH_ADMIN', 
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const