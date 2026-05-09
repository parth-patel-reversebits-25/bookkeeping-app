-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  created_at timestamptz default now()
);

-- Bank statements table
create table bank_statements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  filename text not null,
  file_path text not null,
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'done', 'error')),
  error_message text,
  uploaded_at timestamptz default now()
);

-- Transactions table
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  statement_id uuid references bank_statements on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  particulars text,
  payment_type text,
  utr text,
  counterparty text,
  debit numeric(15,2),
  credit numeric(15,2),
  balance numeric(15,2),
  created_at timestamptz default now()
);

-- Receipts table
create table receipts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  filename text not null,
  file_path text not null,
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'done', 'error')),
  error_message text,
  merchant_name text,
  amount numeric(15,2),
  date date,
  utr text,
  uploaded_at timestamptz default now()
);

-- Matches table
create table matches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  transaction_id uuid references transactions on delete cascade not null,
  receipt_id uuid references receipts on delete cascade not null,
  match_type text not null check (match_type in ('utr_exact', 'amount_date_fallback')),
  matched_at timestamptz default now(),
  unique(transaction_id, receipt_id)
);

-- RLS Policies
alter table profiles enable row level security;
alter table bank_statements enable row level security;
alter table transactions enable row level security;
alter table receipts enable row level security;
alter table matches enable row level security;

-- Profiles policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Bank statements policies
create policy "Users can view own statements" on bank_statements for select using (auth.uid() = user_id);
create policy "Users can insert own statements" on bank_statements for insert with check (auth.uid() = user_id);
create policy "Users can update own statements" on bank_statements for update using (auth.uid() = user_id);

-- Transactions policies
create policy "Users can view own transactions" on transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on transactions for insert with check (auth.uid() = user_id);

-- Receipts policies
create policy "Users can view own receipts" on receipts for select using (auth.uid() = user_id);
create policy "Users can insert own receipts" on receipts for insert with check (auth.uid() = user_id);
create policy "Users can update own receipts" on receipts for update using (auth.uid() = user_id);

-- Matches policies
create policy "Users can view own matches" on matches for select using (auth.uid() = user_id);
create policy "Users can insert own matches" on matches for insert with check (auth.uid() = user_id);

-- Storage buckets (run these in Supabase dashboard SQL editor or via the Storage UI)
-- insert into storage.buckets (id, name, public) values ('statements', 'statements', false);
-- insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

-- Storage RLS policies for statements bucket
-- create policy "Users can upload own statements" on storage.objects for insert with check (bucket_id = 'statements' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "Users can read own statements" on storage.objects for select using (bucket_id = 'statements' and auth.uid()::text = (storage.foldername(name))[1]);

-- Storage RLS policies for receipts bucket
-- create policy "Users can upload own receipts" on storage.objects for insert with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "Users can read own receipts" on storage.objects for select using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
