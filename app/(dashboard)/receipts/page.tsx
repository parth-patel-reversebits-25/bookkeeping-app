'use client'

import { useState, useCallback, useEffect } from 'react'
import { Receipt } from 'lucide-react'
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
import type { Receipt as ReceiptType } from '@/lib/types'

export default function ReceiptsPage() {
  const { toast } = useToast()
  const [receipts, setReceipts] = useState<ReceiptType[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchReceipts = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })

    setReceipts((data ?? []) as ReceiptType[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchReceipts()
  }, [fetchReceipts])

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

        const filePath = `${user.id}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, file)

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
        setUploadProgress(40)

        const { data: receipt, error: dbError } = await supabase
          .from('receipts')
          .insert({ user_id: user.id, filename: file.name, file_path: filePath, status: 'uploading' })
          .select()
          .single()

        if (dbError || !receipt) throw new Error(`DB insert failed: ${dbError?.message}`)
        setUploadProgress(60)

        const res = await fetch('/api/process-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptId: receipt.id, filePath }),
        })

        setUploadProgress(90)

        if (!res.ok) {
          const { error } = await res.json() as { error: string }
          throw new Error(error)
        }

        setUploadProgress(100)

        toast({
          title: 'Receipt processed',
          description: 'Receipt data extracted successfully.',
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
        await fetchReceipts()
      }
    },
    [fetchReceipts, toast]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Receipts</h2>
        <p className="text-muted-foreground">Upload and manage your receipts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Receipt</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            onFilesAccepted={handleFilesAccepted}
            accept={{
              'application/pdf': ['.pdf'],
              'image/png': ['.png'],
              'image/jpeg': ['.jpg', '.jpeg'],
            }}
            uploading={uploading}
            progress={uploadProgress}
            label="Upload Receipt"
            description="Drag and drop your receipt (PDF or image) here, or click to select"
          />
        </CardContent>
      </Card>

      {!loading && receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipts ({receipts.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>UTR</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-medium">
                        {truncateFilename(receipt.filename, 30)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {receipt.merchant_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatCurrency(receipt.amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(receipt.date)}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate font-mono text-xs">
                        {receipt.utr ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(receipt.uploaded_at)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={receipt.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && receipts.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="No receipts yet"
          description="Upload your first receipt to start tracking your expenses"
        />
      )}
    </div>
  )
}
