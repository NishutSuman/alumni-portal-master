import type { User } from './auth'

export interface Event {
  id: string
  title: string
  description: string
  eventDate: string
  endDate?: string
  venue: string
  eventType: EventType
  categoryId?: string
  category?: EventCategory
  registrationDeadline: string
  maxRegistrations?: number
  currentRegistrations?: number
  registrationFee?: number
  guestFee?: number
  allowGuests: boolean
  maxGuestsPerUser?: number
  status: EventStatus
  tags: string[]
  eventImages?: string[]
  virtualEventLink?: string
  createdBy: string
  creator?: User  // FIXED: Now properly imported
  isPublic: boolean
  requiresVerification: boolean
  createdAt: string
  updatedAt: string
}

export type EventType = 'PHYSICAL' | 'VIRTUAL' | 'HYBRID'

export type EventStatus = 
  | 'DRAFT'
  | 'PUBLISHED'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED'

export interface EventCategory {
  id: string
  name: string
  description?: string
  icon?: string
  colorCode?: string
  isActive: boolean
}

export interface EventRegistration {
  id: string
  eventId: string
  userId: string
  user?: User  // FIXED: Now properly imported
  event?: Event
  registrationDate: string
  numberOfGuests: number
  totalAmount: number
  paymentStatus: PaymentStatus
  attendanceStatus?: AttendanceStatus
  checkInTime?: string
  guests?: EventGuest[]
  specialRequests?: string
  qrCode?: string
}

export interface EventGuest {
  id: string
  name: string
  email?: string
  phone?: string
  relation: string
  registrationId: string
  status: GuestStatus
}

export type AttendanceStatus = 
  | 'REGISTERED'
  | 'CHECKED_IN'
  | 'ATTENDED'
  | 'NO_SHOW'

export type GuestStatus = 'ACTIVE' | 'CANCELLED'

// Import PaymentStatus from common
import type { PaymentStatus } from './common'