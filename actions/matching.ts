'use server'

import { createClient } from '@/lib/supabase/server'
import type { Match, MatchWithDetails, Transaction, Receipt } from '@/lib/types'
import { differenceInDays, parseISO } from 'date-fns'

export async function runMatching(): Promise<{ matched: number; errors: string[] }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Fetch all unmatched receipts with UTR or amount+date
  const { data: receipts, error: receiptsError } = await supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'done')

  if (receiptsError) throw new Error(`Failed to fetch receipts: ${receiptsError.message}`)

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)

  if (txError) throw new Error(`Failed to fetch transactions: ${txError.message}`)

  // Get existing matches to avoid duplicates
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('transaction_id, receipt_id')
    .eq('user_id', user.id)

  const matchedTransactionIds = new Set(existingMatches?.map((m) => m.transaction_id) ?? [])
  const matchedReceiptIds = new Set(existingMatches?.map((m) => m.receipt_id) ?? [])

  const newMatches: Array<{
    user_id: string
    transaction_id: string
    receipt_id: string
    match_type: 'utr_exact' | 'amount_date_fallback'
  }> = []

  const errors: string[] = []

  // Pass 1: UTR exact match
  for (const receipt of receipts as Receipt[]) {
    if (matchedReceiptIds.has(receipt.id)) continue
    if (!receipt.utr) continue

    const matchedTx = (transactions as Transaction[]).find(
      (tx) => tx.utr && tx.utr === receipt.utr && !matchedTransactionIds.has(tx.id)
    )

    if (matchedTx) {
      newMatches.push({
        user_id: user.id,
        transaction_id: matchedTx.id,
        receipt_id: receipt.id,
        match_type: 'utr_exact',
      })
      matchedTransactionIds.add(matchedTx.id)
      matchedReceiptIds.add(receipt.id)
    }
  }

  // Pass 2: Amount + Date fallback
  for (const receipt of receipts as Receipt[]) {
    if (matchedReceiptIds.has(receipt.id)) continue
    if (!receipt.amount || !receipt.date) continue

    const matchedTx = (transactions as Transaction[]).find((tx) => {
      if (matchedTransactionIds.has(tx.id)) return false
      if (!tx.debit || !tx.date) return false

      const amountMatch = Math.abs(tx.debit - receipt.amount!) < 0.01
      const daysDiff = Math.abs(differenceInDays(parseISO(tx.date), parseISO(receipt.date!)))
      return amountMatch && daysDiff <= 1
    })

    if (matchedTx) {
      newMatches.push({
        user_id: user.id,
        transaction_id: matchedTx.id,
        receipt_id: receipt.id,
        match_type: 'amount_date_fallback',
      })
      matchedTransactionIds.add(matchedTx.id)
      matchedReceiptIds.add(receipt.id)
    }
  }

  if (newMatches.length > 0) {
    const { error: insertError } = await supabase.from('matches').insert(newMatches)
    if (insertError) {
      errors.push(`Failed to save matches: ${insertError.message}`)
    }
  }

  return { matched: newMatches.length, errors }
}

export async function getMatches(): Promise<MatchWithDetails[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      transaction:transactions(*),
      receipt:receipts(*)
    `)
    .eq('user_id', user.id)
    .order('matched_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch matches: ${error.message}`)

  return (data ?? []) as unknown as MatchWithDetails[]
}

export async function getUnmatchedTransactions(): Promise<Transaction[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: matchedIds } = await supabase
    .from('matches')
    .select('transaction_id')
    .eq('user_id', user.id)

  const matchedTxIds = matchedIds?.map((m) => m.transaction_id) ?? []

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (matchedTxIds.length > 0) {
    query = query.not('id', 'in', `(${matchedTxIds.join(',')})`)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch unmatched transactions: ${error.message}`)

  return (data ?? []) as Transaction[]
}

export async function getUnmatchedReceipts(): Promise<Receipt[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: matchedIds } = await supabase
    .from('matches')
    .select('receipt_id')
    .eq('user_id', user.id)

  const matchedReceiptIds = matchedIds?.map((m) => m.receipt_id) ?? []

  let query = supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'done')
    .order('uploaded_at', { ascending: false })

  if (matchedReceiptIds.length > 0) {
    query = query.not('id', 'in', `(${matchedReceiptIds.join(',')})`)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch unmatched receipts: ${error.message}`)

  return (data ?? []) as Receipt[]
}
