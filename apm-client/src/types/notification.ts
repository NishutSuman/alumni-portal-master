// src/types/notification.ts
// Notification types

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  isRead: boolean
  priority: NotificationPriority
  channels: NotificationChannel[]
  scheduledFor?: string
  sentAt?: string
  readAt?: string
  createdAt: string
  expiresAt?: string
}

export type NotificationType = 
  | 'SYSTEM'
  | 'EVENT_REGISTRATION'
  | 'EVENT_UPDATE'
  | 'EVENT_REMINDER'
  | 'LIFELINK_EMERGENCY'
  | 'LIFELINK_REMINDER'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PROFILE_UPDATE'
  | 'VERIFICATION_STATUS'
  | 'SOCIAL_INTERACTION'
  | 'ANNOUNCEMENT'

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS'