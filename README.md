# Ledger — AI-Powered Bookkeeping App

Ledger automates bookkeeping by parsing bank statements and receipts using Claude AI, then matching transactions to receipts via UTR numbers or amount/date fallback.

## Features

- Upload bank statements (PDF) — Claude extracts all transactions automatically
- Upload receipts (PDF/image) — Claude extracts merchant, amount, date, and UTR
- Auto-match transactions to receipts via UTR exact match or amount+date fallback
- Per-user data isolation via Supabase RLS
- Dashboard with match statistics

## Tech Stack

- **Framework:** Next.js 14 (App Router, Server Actions)
- **Database & Auth:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Anthropic Claude API (document + image parsing)
- **UI:** Tailwind CSS + shadcn/ui

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key

### 1. Clone and install

```bash
git clone <repo-url>
cd bookkeeping-app
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Set up the database

Run the full schema against your Supabase project (SQL Editor or via MCP):

```bash
# paste contents of supabase/schema.sql into Supabase SQL Editor
```

This creates tables (`profiles`, `bank_statements`, `transactions`, `receipts`, `matches`), RLS policies, storage buckets (`statements`, `receipts`), and an auto-profile trigger on signup.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

```
profiles          — linked to auth.users, auto-created on signup
bank_statements   — uploaded PDF metadata + processing status
transactions      — rows extracted from bank statements
receipts          — uploaded receipts with extracted fields
matches           — transaction ↔ receipt links with match type
```

## API Routes

| Route                    | Method | Description                                                 |
| ------------------------ | ------ | ----------------------------------------------------------- |
| `/api/process-statement` | POST   | Download PDF from storage, extract transactions via Claude  |
| `/api/process-receipt`   | POST   | Download file from storage, extract receipt data via Claude |
| `/api/run-matching`      | POST   | Match unmatched transactions to unmatched receipts          |

## Matching Logic

1. **UTR exact match** — if both transaction and receipt share the same UTR, they are linked as `utr_exact`
2. **Amount + date fallback** — if amounts match and dates are within 1 day, linked as `amount_date_fallback`

## Project Structure

```
app/
  (auth)/login         — login page
  (auth)/signup        — signup page
  (dashboard)/
    dashboard          — stats overview
    bank-statements    — upload and view statements
    receipts           — upload and view receipts
    match-transactions — view matched pairs
    settings           — user settings
  api/
    process-statement  — Claude PDF parsing for bank statements
    process-receipt    — Claude parsing for receipts
    run-matching       — matching engine
actions/               — Next.js Server Actions (DB queries)
lib/
  supabase/            — Supabase client (browser + server)
  types.ts             — shared TypeScript types
supabase/
  schema.sql           — full DB schema with RLS and triggers
```

## Notes

- Email confirmation is enabled by default. After signup, confirm your email before logging in. To disable during development: Supabase Dashboard → Authentication → Email → turn off "Enable email confirmations".
- Storage buckets use per-user folder isolation (`{user_id}/filename`).
- Claude model used: `claude-opus-4-5`.
