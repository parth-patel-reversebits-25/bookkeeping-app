'use client'

import { useState, useCallback, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileUploadZone } from '@/components/file-upload-zone'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatDateTime, truncateFilename } from '@/lib/utils'
import type { BankStatement, Transaction } from '@/lib/types'

export default function BankStatementsPage() {
  const { toast } = useToast()
  const [statements, setStatements] = useState<BankStatement[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: stmts }, { data: txns }] = await Promise.all([
      supabase
        .from('bank_statements')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100),
    ])

    setStatements((stmts ?? []) as BankStatement[])
    setTransactions((txns ?? []) as Transaction[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFilesAccepted = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const file = files[0]
      setUploading(true)
      setUploadProgress(10)

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // Upload to storage
        const filePath = `${user.id}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('statements')
          .upload(filePath, file)

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
        setUploadProgress(40)

        // Create DB record
        const { data: stmt, error: dbError } = await supabase
          .from('bank_statements')
          .insert({ user_id: user.id, filename: file.name, file_path: filePath, status: 'uploading' })
          .select()
          .single()

        if (dbError || !stmt) throw new Error(`DB insert failed: ${dbError?.message}`)
        setUploadProgress(60)

        // Trigger processing
        const res = await fetch('/api/process-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statementId: stmt.id, filePath }),
        })

        setUploadProgress(90)

        if (!res.ok) {
          const { error } = await res.json() as { error: string }
          throw new Error(error)
        }

        const { count } = await res.json() as { count: number }
        setUploadProgress(100)

        toast({
          title: 'Statement processed',
          description: `Extracted ${count} transactions successfully.`,
        })
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        })
      } finally {
        setUploading(false)
        setUploadProgress(0)
        await fetchData()
      }
    },
    [fetchData, toast]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bank Statements</h2>
        <p className="text-muted-foreground">Upload and manage your bank statements</p>
      </div>

      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            onFilesAccepted={handleFilesAccepted}
            uploading={uploading}
            progress={uploadProgress}
            label="Upload Bank Statement PDF"
            description="Drag and drop your bank statement PDF here, or click to select"
          />
        </CardContent>
      </Card>

      {/* Statements list */}
      {!loading && statements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uploaded Statements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((stmt) => (
                  <TableRow key={stmt.id}>
                    <TableCell className="font-medium">
                      {truncateFilename(stmt.filename)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(stmt.uploaded_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={stmt.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transactions table */}
      {!loading && transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transactions ({transactions.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>UTR</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {tx.particulars ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">{tx.payment_type ?? '—'}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-sm font-mono text-xs">
                        {tx.utr ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm">
                        {tx.counterparty ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600">
                        {tx.debit ? formatCurrency(tx.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-green-600">
                        {tx.credit ? formatCurrency(tx.credit) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(tx.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && statements.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No bank statements"
          description="Upload your first bank statement to extract and view transactions"
        />
      )}
    </div>
  )
}
