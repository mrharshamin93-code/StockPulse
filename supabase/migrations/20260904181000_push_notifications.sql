create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios')),
  environment text not null default 'production'
    check (environment in ('sandbox', 'production')),
  app_id text not null default 'com.harshamin.stockpulse',
  enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  last_error text,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_devices_user_enabled_idx
  on public.push_devices (user_id, enabled)
  where enabled = true;

alter table public.push_devices enable row level security;

create policy "Users can view their own push devices"
  on public.push_devices for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can register their own push devices"
  on public.push_devices for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own push devices"
  on public.push_devices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can remove their own push devices"
  on public.push_devices for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.push_devices from anon;
grant select, insert, update, delete on table public.push_devices to authenticated;
grant all on table public.push_devices to service_role;

alter table public.stock_alerts
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_error text;
