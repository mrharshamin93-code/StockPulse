-- Critical security hardening for StockPulse user data and entitlements.

drop policy if exists "Anyone can view stocks" on public.stocks;

revoke all privileges on table public.stocks from anon, authenticated;
grant select, insert, update, delete on table public.stocks to authenticated;

alter table public.profiles
  add column if not exists subscription_product_id text,
  add column if not exists subscription_original_transaction_id text,
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists subscription_environment text,
  add column if not exists subscription_verified_at timestamptz;

revoke all privileges on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

grant insert (
  id, email, full_name, monthly_report_opt_in, report_timezone,
  report_currency, theme, currency, watchlist_sort
) on table public.profiles to authenticated;

grant update (
  email, full_name, monthly_report_opt_in, report_timezone,
  report_currency, theme, currency, watchlist_sort
) on table public.profiles to authenticated;

drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);
