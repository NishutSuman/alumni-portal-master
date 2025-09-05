// src/types/payment.ts - FIXED with proper imports
import type { User } from './auth'
import type { PaymentStatus } from './common'

export interface PaymentTransaction {
  id: string
  userId: string
  user?: User  // FIXED: Now properly imported
  amount: number
  currency: string
  description: string
  referenceType: PaymentReferenceType
  referenceId: string
  status: PaymentStatus  // FIXED: Now properly imported
  paymentMethod?: PaymentMethod
  paymentGateway?: PaymentGateway
  gatewayTransactionId?: string
  gatewayOrderId?: string
  gatewayPaymentId?: string
  razorpayOrderId?: string
  razorpayPaymentId?: string
  razorpaySignature?: string
  failureReason?: string
  processedAt?: string
  createdAt: string
  updatedAt: string
}

export type PaymentReferenceType = 
  | 'EVENT_REGISTRATION'
  | 'MEMBERSHIP'
  | 'MERCHANDISE'
  | 'DONATION'
  | 'FINE'

export type PaymentMethod = 
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'NET_BANKING'
  | 'UPI'
  | 'WALLET'
  | 'EMI'

export type PaymentGateway = 'RAZORPAY' | 'STRIPE' | 'PAYPAL'

export interface Invoice {
  id: string
  invoiceNumber: string
  transactionId: string
  transaction?: PaymentTransaction
  invoiceUrl?: string
  generatedAt: string
  sentAt?: string
}