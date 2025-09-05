// src/types/organization.ts - FIXED with proper imports
import type { User } from './auth'
import type { ContactInfo } from './common'

export interface Organization {
  id: string
  name: string
  shortName: string
  foundationYear: number
  officialEmail: string
  officialContactNumber?: string
  officeAddress?: string
  logoUrl?: string
  bylawDocumentUrl?: string
  registrationCertUrl?: string
  websiteUrl?: string
  socialMediaLinks?: ContactInfo  // FIXED: Now properly imported
  foundingMembers?: FoundingMember[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface FoundingMember {
  name: string
  role: string
  year: number
}

export interface Batch {
  id: string
  year: number
  name: string
  description?: string
  totalMembers: number
  admissionYear?: number
  passoutYear?: number
  batchDisplayName?: string
  admins?: User[]  // FIXED: Now properly imported
  members?: User[]  // FIXED: Now properly imported
  createdAt: string
  updatedAt: string
}