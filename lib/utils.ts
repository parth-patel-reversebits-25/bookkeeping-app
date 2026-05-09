import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'd MMM yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'd MMM yyyy, h:mm a')
  } catch {
    return dateStr
  }
}

export function truncateFilename(filename: string, maxLength = 40): string {
  if (filename.length <= maxLength) return filename
  const ext = filename.split('.').pop() ?? ''
  const base = filename.slice(0, maxLength - ext.length - 4)
  return `${base}...${ext}`
}
