import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BankStatementStatus, ReceiptStatus, MatchType } from '@/lib/types'

type FileStatus = BankStatementStatus | ReceiptStatus

const statusConfig: Record<FileStatus, { label: string; className: string; spinner?: boolean }> = {
  uploading: {
    label: 'Uploading',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    spinner: true,
  },
  processing: {
    label: 'Processing',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    spinner: true,
  },
  done: {
    label: 'Done',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  error: {
    label: 'Error',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
}

const matchTypeConfig: Record<MatchType, { label: string; className: string }> = {
  utr_exact: {
    label: 'UTR Match',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  amount_date_fallback: {
    label: 'Amount + Date',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
}

type StatusBadgeProps = {
  status: FileStatus
  className?: string
}

type MatchTypeBadgeProps = {
  matchType: MatchType
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        config.className,
        className
      )}
    >
      {config.spinner && <Loader2 className="h-3 w-3 animate-spin" />}
      {config.label}
    </span>
  )
}

export function MatchTypeBadge({ matchType, className }: MatchTypeBadgeProps) {
  const config = matchTypeConfig[matchType]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
