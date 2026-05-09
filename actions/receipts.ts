'use server'

import { createClient } from '@/lib/supabase/server'
import type { Receipt } from '@/lib/types'

export async function uploadReceipt(filename: string, filePath: string): Promise<Receipt> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('receipts')
    .insert({
      user_id: user.id,
      filename,
      file_path: filePath,
      status: 'uploading',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create receipt record: ${error.message}`)

  return data as Receipt
}

export async function getReceipts(): Promise<Receipt[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id)
    .order('uploaded_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch receipts: ${error.message}`)

  return (data ?? []) as Receipt[]
}
