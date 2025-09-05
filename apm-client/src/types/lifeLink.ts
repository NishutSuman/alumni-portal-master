// src/types/lifelink.ts - FIXED with proper User import (note: lowercase filename)
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

export interface BloodRequisition {
  id: string
  requiredBloodGroup: BloodGroup
  unitsNeeded: number
  urgencyLevel: UrgencyLevel
  patientName: string
  hospitalName: string
  hospitalAddress: string
  contactPerson: string
  contactNumber: string
  additionalNotes?: string
  requiredBy: string
  status: RequisitionStatus
  createdBy: string
  creator?: User  // FIXED: Now properly imported
  responses?: DonorResponse[]
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type RequisitionStatus = 
  | 'ACTIVE'
  | 'FULFILLED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface DonorResponse {
  id: string
  requisitionId: string
  donorId: string
  donor?: User  // FIXED: Now properly imported
  isWilling: boolean
  canDonateBy?: string
  additionalNotes?: string
  contactShared: boolean
  createdAt: string
}

export interface DonationRecord {
  id: string
  donorId: string
  donor?: User  // FIXED: Now properly imported
  donationDate: string
  location: string
  bloodGroup: BloodGroup
  unitsdonated: number
  recipientInfo?: string
  certificateUrl?: string
  verifiedBy?: string
  verifier?: User  // FIXED: Now properly imported
  nextEligibleDate: string
  createdAt: string
}