// Utility functions for formatting data
export const formatDate = (date: string | Date, format?: string): string => {
  const dateObj = new Date(date)
  
  if (format === 'MMM dd, yyyy') {
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    })
  }
  
  return dateObj.toLocaleDateString()
}

export const formatCurrency = (amount: number, currency = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount)
}