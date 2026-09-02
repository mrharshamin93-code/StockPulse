create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text not null default '',
  type text not null check (type in ('buy', 'sell')),
  quantity numeric not null check (quantity > 0),
  price numeric not null check (price >= 0),
  total numeric not null check (total >= 0),
  created_at timestamptz not null default now()
);

alter table public.stock_transactions
  add column if not exists company_name text not null default '',
  add column if not exists total numeric,
  add column if not exists created_at timestamptz not null default now();

update public.stock_transactions
set total = quantity * price
where total is null;

alter table public.stock_transactions
  alter column total set not null;

create index if not exists stock_transactions_user_created_at_idx
  on public.stock_transactions (user_id, created_at desc);

alter table public.stock_transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stock_transactions'
      and policyname = 'Users can read their stock transactions'
  ) then
    create policy "Users can read their stock transactions"
      on public.stock_transactions for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stock_transactions'
      and policyname = 'Users can insert their stock transactions'
  ) then
    create policy "Users can insert their stock transactions"
      on public.stock_transactions for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stock_transactions'
      and policyname = 'Users can update their stock transactions'
  ) then
    create policy "Users can update their stock transactions"
      on public.stock_transactions for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stock_transactions'
      and policyname = 'Users can delete their stock transactions'
  ) then
    create policy "Users can delete their stock transactions"
      on public.stock_transactions for delete
      using (auth.uid() = user_id);
  end if;
end
$$;
