'use client'

import { useState, useCallback, useEffect } from 'react'
import { GitMerge, Loader2, FileText, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MatchTypeBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, truncateFilename } from '@/lib/utils'
import type { MatchWithDetails, Transaction, Receipt as ReceiptType } from '@/lib/types'

export default function MatchTransactionsPage() {
  const { toast } = useToast()
  const [matches, setMatches] = useState<MatchWithDetails[]>([])
  const [unmatchedTx, setUnmatchedTx] = useState<Transaction[]>([])
  const [unmatchedReceipts, setUnmatchedReceipts] = useState<ReceiptType[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [
      { data: matchData },
      { data: txData },
      { data: matchedTxIds },
      { data: receiptData },
      { data: matchedReceiptIds },
    ] = await Promise.all([
      supabase
        .from('matches')
        .select('*, transaction:transactions(*), receipt:receipts(*)')
        .eq('user_id', user.id)
        .order('matched_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false }),
      supabase.from('matches').select('transaction_id').eq('user_id', user.id),
      supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'done')
        .order('uploaded_at', { ascending: false }),
      supabase.from('matches').select('receipt_id').eq('user_id', user.id),
    ])

    const matchedTxSet = new Set(matchedTxIds?.map((m) => m.transaction_id) ?? [])
    const matchedReceiptSet = new Set(matchedReceiptIds?.map((m) => m.receipt_id) ?? [])

    setMatches((matchData ?? []) as unknown as MatchWithDetails[])
    setUnmatchedTx(((txData ?? []) as Transaction[]).filter((tx) => !matchedTxSet.has(tx.id)))
    setUnmatchedReceipts(
      ((receiptData ?? []) as ReceiptType[]).filter((r) => !matchedReceiptSet.has(r.id))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRunMatching = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/run-matching', { method: 'POST' })

      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }

      const { matched } = await res.json() as { matched: number }
      toast({
        title: 'Matching complete',
        description: `Found ${matched} new match${matched !== 1 ? 'es' : ''}.`,
      })
      await fetchData()
    } catch (err) {
      toast({
        title: 'Matching failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Match Transactions</h2>
          <p className="text-muted-foreground">Match bank transactions with receipts</p>
        </div>
        <Button onClick={handleRunMatching} disabled={running}>
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GitMerge className="mr-2 h-4 w-4" />
          )}
          Run Matching
        </Button>
      </div>

      {/* Matched pairs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matched Pairs ({matches.length})</CardTitle>
        </CardHeader>
        <CardContent className={matches.length === 0 ? 'p-6' : 'p-0'}>
          {matches.length === 0 ? (
            <EmptyState
              icon={GitMerge}
              title="No matches yet"
              description="Click 'Run Matching' to automatically match transactions with receipts"
              className="border-0 py-8"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Match Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell className="max-w-[180px] truncate text-sm">
                        {match.transaction.particulars ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(match.transaction.date)}
                      </TableCell>
                      <TableCell className="text-sm text-red-600">
                        {formatCurrency(match.transaction.debit)}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm">
                        {truncateFilename(match.receipt.filename, 25)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {match.receipt.merchant_name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <MatchTypeBadge matchType={match.match_type} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unmatched transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unmatched Transactions ({unmatchedTx.length})</CardTitle>
          </CardHeader>
          <CardContent className={unmatchedTx.length === 0 ? 'p-6' : 'p-0'}>
            {unmatchedTx.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="All transactions matched"
                description="Great job! Every transaction has a matching receipt"
                className="border-0 py-8"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Counterparty</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedTx.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm">
                          {tx.counterparty ?? tx.particulars ?? '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-red-600">
                          {tx.debit ? formatCurrency(tx.debit) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unmatched receipts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unmatched Receipts ({unmatchedReceipts.length})</CardTitle>
          </CardHeader>
          <CardContent className={unmatchedReceipts.length === 0 ? 'p-6' : 'p-0'}>
            {unmatchedReceipts.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="All receipts matched"
                description="Every receipt has a corresponding bank transaction"
                className="border-0 py-8"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedReceipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell className="max-w-[150px] truncate text-sm">
                          {receipt.merchant_name ?? truncateFilename(receipt.filename, 25)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(receipt.date)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(receipt.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
