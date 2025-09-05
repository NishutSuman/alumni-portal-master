export interface User {
  id: string
  email: string
  fullName: string
  role: UserRole
  batch: number
  admissionYear?: number
  passoutYear?: number
  isAlumniVerified: boolean
  pendingVerification: boolean
  isEmailVerified?: boolean  // ADDED: Missing property
  profilePictureUrl?: string
  whatsappNumber?: string
  personalEmail?: string
  currentLocation?: string
  bio?: string
  employmentStatus?: EmploymentStatus
  serialId?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export type UserRole = 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN'

export type EmploymentStatus = 
  | 'STUDENT' 
  | 'EMPLOYED' 
  | 'UNEMPLOYED' 
  | 'ENTREPRENEUR' 
  | 'FREELANCER'
  | 'RETIRED'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  email: string
  password: string
  confirmPassword: string
  fullName: string
  batch: number
  admissionYear?: number
  passoutYear?: number
  whatsappNumber?: string
  personalEmail?: string
  currentLocation?: string
  dateOfBirth?: string
}

export interface UserEducation {
  id: string
  course: string
  stream?: string
  institution: string
  fromYear: number
  toYear?: number
  isOngoing: boolean
  description?: string
}

export interface UserWorkExperience {
  id: string
  companyName: string
  jobRole: string
  companyType?: CompanyType
  workAddress?: string
  fromYear: number
  toYear?: number
  isCurrentJob: boolean
  description?: string
}

export type CompanyType = 
  | 'STARTUP'
  | 'MNC' 
  | 'GOVERNMENT'
  | 'NGO'
  | 'FREELANCE'
  | 'SELF_EMPLOYED'