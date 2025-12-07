// src/types/lifeLink.ts
import type { User } from './auth'

export type BloodGroup = 
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE'

export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type RequisitionStatus = 
  | 'ACTIVE'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'EXPIRED'

export type NotificationStatus = 'SENT' | 'DELIVERED' | 'READ'

export type DonorResponseStatus = 'WILLING' | 'NOT_AVAILABLE' | 'NOT_SUITABLE'

// Blood Profile
export interface BloodProfile {
  id: string
  bloodGroup?: BloodGroup
  isBloodDonor: boolean
  lastBloodDonationDate?: string
  totalBloodDonations: number  // Count of donation events
  totalUnitsDonated: number  // Total units donated
  firstName: string
  lastName: string
  showPhone: boolean
  phone?: string
  addresses: Array<{
    city: string
    state: string
    addressType: string
  }>
}

// Blood Donation Record
export interface BloodDonation {
  id: string
  donorId: string
  donationDate: string
  location: string
  units: number
  notes?: string
  createdAt: string
  updatedAt: string
  donor?: User
}

// Blood Requisition
export interface BloodRequisition {
  id: string
  requesterId: string
  patientName: string
  hospitalName: string
  contactNumber: string
  alternateNumber?: string
  requiredBloodGroup: BloodGroup
  unitsNeeded: number
  urgencyLevel: UrgencyLevel
  medicalCondition?: string
  location: string
  additionalNotes?: string
  requiredByDate: string
  allowContactReveal: boolean
  status: RequisitionStatus
  expiresAt?: string
  createdAt: string
  updatedAt: string
  requester?: User
  donorResponses?: DonorResponse[]
  willingDonorsCount?: number
}

// Donor Notification
export interface DonorNotification {
  id: string
  requisitionId: string
  donorId: string
  message: string
  customMessage?: string
  status: NotificationStatus
  sentAt: string
  readAt?: string
  createdAt: string
  updatedAt: string
  donor?: User
  requisition?: BloodRequisition
}

// Donor Response
export interface DonorResponse {
  id: string
  requisitionId: string
  donorId: string
  response: DonorResponseStatus
  message?: string
  respondedAt: string
  createdAt: string
  updatedAt: string
  donor?: User
  requisition?: BloodRequisition
}

// API Request/Response Types
export interface LifeLinkDashboardParams {
  bloodGroup?: BloodGroup
  eligibleOnly?: string
  page?: number
  limit?: number
  city?: string
}

export interface LifeLinkDashboardResponse {
  donors: BloodProfile[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNext: boolean
    hasPrev: boolean
  }
  stats: {
    totalDonors: number
    eligibleDonors: number
    byBloodGroup: Record<BloodGroup, number>
  }
}

export interface BloodGroupStatsResponse {
  stats: Record<BloodGroup, number>
  totalDonors: number
}

export interface DonationStatusResponse {
  totalDonations: number
  lastDonationDate: string | null
  eligibility: {
    isEligible: boolean
    daysSinceLastDonation?: number | null
    nextEligibleDate?: string | null
    daysRemaining?: number
    message: string
  }
}

export interface SearchDonorsRequest {
  requiredBloodGroup: BloodGroup
  location: string
  limit?: number
}

export interface SearchDonorsResponse {
  donors: Array<BloodProfile & {
    eligibility: {
      isEligible: boolean
      daysSinceLastDonation?: number
      nextEligibleDate?: string
      message: string
    }
    contactAvailable: boolean
  }>
  totalFound: number
}

export interface CreateRequisitionRequest {
  patientName: string
  hospitalName: string
  contactNumber: string
  alternateNumber?: string
  requiredBloodGroup: BloodGroup
  unitsNeeded: number
  urgencyLevel: UrgencyLevel
  medicalCondition?: string
  location: string
  additionalNotes?: string
  requiredByDate: string
  allowContactReveal: boolean
}

export interface AddDonationRequest {
  donationDate?: string
  location: string
  units?: number
  notes?: string
}

export interface UpdateBloodProfileRequest {
  bloodGroup?: BloodGroup
  isBloodDonor?: boolean
}

export interface NotifyDonorsRequest {
  donorIds: string[]
  customMessage?: string
}

export interface RespondToRequisitionRequest {
  response: DonorResponseStatus
  message?: string
}

// Paginated Response Types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface BloodDonationsResponse {
  donations: BloodDonation[]
  summary: {
    totalDonations: number  // Count of donation events (how many times donated)
    totalUnits: number  // Total units donated
    lastDonationDate: string | null
    eligibility: {
      isEligible: boolean
      daysSinceLastDonation?: number | null
      nextEligibleDate?: string | null
      daysRemaining?: number
      message: string
    }
  }
  pagination: {
    currentPage: number
    limit: number
    totalCount: number
    totalPages: number
  }
}
export type DonorNotificationsResponse = PaginatedResponse<DonorNotification>

export interface BloodRequisitionsResponse {
  requisitions: BloodRequisition[]
  pagination: {
    currentPage: number
    limit: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface DiscoverRequisitionsResponse {
  requisitions: BloodRequisition[]
  donorInfo: {
    bloodGroup: BloodGroup
    canDonateTo: BloodGroup[]
    location: string
  }
  pagination: {
    currentPage: number
    limit: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Admin Analytics Types
export interface LifeLinkAnalytics {
  totalDonors: number
  totalRequisitions: number
  totalDonations: number
  activeRequisitions: number
  recentActivity: {
    newDonors: number
    newRequisitions: number
    successfulMatches: number
  }
  bloodGroupDistribution: Record<BloodGroup, number>
  monthlyStats: Array<{
    month: string
    donations: number
    requisitions: number
    matches: number
  }>
}

export interface RequisitionAnalytics {
  requisition: BloodRequisition
  donorsNotified: number
  responsesReceived: number
  willingDonors: number
  responseBreakdown: Record<DonorResponseStatus, number>
  responseTimeline: Array<{
    date: string
    responses: number
  }>
}