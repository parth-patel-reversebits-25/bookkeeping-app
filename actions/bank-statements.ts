'use server'

import { createClient } from '@/lib/supabase/server'
import type { BankStatement, Transaction } from '@/lib/types'

export async function uploadBankStatement(
  filename: string,
  filePath: string
): Promise<BankStatement> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('bank_statements')
    .insert({
      user_id: user.id,
      filename,
      file_path: filePath,
      status: 'uploading',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create bank statement record: ${error.message}`)

  return data as BankStatement
}

export async function getBankStatements(): Promise<BankStatement[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('bank_statements')
    .select('*')
    .eq('user_id', user.id)
    .order('uploaded_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch bank statements: ${error.message}`)

  return (data ?? []) as BankStatement[]
}

export async function getTransactions(statementId?: string): Promise<Transaction[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (statementId) {
    query = query.eq('statement_id', statementId)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`)

  return (data ?? []) as Transaction[]
}
