import { FileText, Receipt, GitMerge, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge, MatchTypeBadge } from '@/components/status-badge'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, formatDateTime, truncateFilename } from '@/lib/utils'
import type { BankStatement, Receipt as ReceiptType, MatchWithDetails } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [
    { count: txCount },
    { count: receiptCount },
    { count: matchCount },
    { data: recentStatements },
    { data: recentMatches },
  ] = await Promise.all([
    supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('receipts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('bank_statements')
      .select('*')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })
      .limit(5),
    supabase
      .from('matches')
      .select('*, transaction:transactions(*), receipt:receipts(*)')
      .eq('user_id', user.id)
      .order('matched_at', { ascending: false })
      .limit(5),
  ])

  const totalTransactions = txCount ?? 0
  const totalReceipts = receiptCount ?? 0
  const matched = matchCount ?? 0
  const unmatched = Math.max(0, totalReceipts - matched)

  const stats = [
    { label: 'Total Transactions', value: totalTransactions, icon: BarChart3 },
    { label: 'Total Receipts', value: totalReceipts, icon: Receipt },
    { label: 'Matched', value: matched, icon: GitMerge },
    { label: 'Unmatched', value: unmatched, icon: FileText },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your bookkeeping activity</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Uploads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Bank Statements</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentStatements || recentStatements.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No statements yet"
                description="Upload a bank statement to get started"
                className="border-0 py-8"
              />
            ) : (
              <div className="space-y-3">
                {(recentStatements as BankStatement[]).map((stmt) => (
                  <div key={stmt.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {truncateFilename(stmt.filename)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(stmt.uploaded_at)}
                      </p>
                    </div>
                    <StatusBadge status={stmt.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Matches</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentMatches || recentMatches.length === 0 ? (
              <EmptyState
                icon={GitMerge}
                title="No matches yet"
                description="Run matching after uploading statements and receipts"
                className="border-0 py-8"
              />
            ) : (
              <div className="space-y-3">
                {(recentMatches as unknown as MatchWithDetails[]).map((match) => (
                  <div key={match.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {match.receipt.merchant_name ?? truncateFilename(match.receipt.filename)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(match.transaction.debit)} &bull; {formatDate(match.transaction.date)}
                      </p>
                    </div>
                    <MatchTypeBadge matchType={match.match_type} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
