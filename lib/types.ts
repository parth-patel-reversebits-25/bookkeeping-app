export type Profile = {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

export type BankStatementStatus = 'uploading' | 'processing' | 'done' | 'error'

export type BankStatement = {
  id: string
  user_id: string
  filename: string
  file_path: string
  status: BankStatementStatus
  error_message: string | null
  uploaded_at: string
}

export type Transaction = {
  id: string
  statement_id: string
  user_id: string
  date: string
  particulars: string | null
  payment_type: string | null
  utr: string | null
  counterparty: string | null
  debit: number | null
  credit: number | null
  balance: number | null
  created_at: string
}

export type ReceiptStatus = 'uploading' | 'processing' | 'done' | 'error'

export type Receipt = {
  id: string
  user_id: string
  filename: string
  file_path: string
  status: ReceiptStatus
  error_message: string | null
  merchant_name: string | null
  amount: number | null
  date: string | null
  utr: string | null
  uploaded_at: string
}

export type MatchType = 'utr_exact' | 'amount_date_fallback'

export type Match = {
  id: string
  user_id: string
  transaction_id: string
  receipt_id: string
  match_type: MatchType
  matched_at: string
}

export type MatchWithDetails = Match & {
  transaction: Transaction
  receipt: Receipt
}

export type ExtractedTransaction = {
  date: string
  particulars: string
  payment_type: string
  utr: string
  counterparty: string
  debit: number | null
  credit: number | null
  balance: number | null
}

export type ExtractedReceipt = {
  merchant_name: string
  amount: number
  date: string
  utr: string | null
}

export type DashboardStats = {
  totalTransactions: number
  totalReceipts: number
  matched: number
  unmatched: number
}
