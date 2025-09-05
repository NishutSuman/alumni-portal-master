// Utility functions for formatting data
export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString()
}

export const formatCurrency = (amount: number, currency = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount)
}