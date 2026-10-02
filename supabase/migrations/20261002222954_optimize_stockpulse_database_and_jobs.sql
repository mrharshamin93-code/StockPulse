-- StockPulse performance, storage, RLS, and scheduler optimizations.

create or replace function public.get_stock_sparklines(
  p_tickers text[],
  p_limit integer default 30
)
returns table(ticker text, trading_date date, close numeric)
language sql
security invoker
set search_path = public
as $function$
  with requested as (
    select distinct upper(trim(value)) as ticker
    from unnest(coalesce(p_tickers, array[]::text[])) value
    where nullif(trim(value),'') is not null
    limit 250
  ),
  ranked as (
    select d.ticker,
           d.trading_date,
           d.close,
           row_number() over (
             partition by d.ticker
             order by d.trading_date desc
           ) as rn
    from public.stock_daily_prices d
    join requested r on r.ticker = d.ticker
  )
  select ranked.ticker, ranked.trading_date, ranked.close
  from ranked
  where ranked.rn <= greatest(2, least(coalesce(p_limit,30), 90))
  order by ranked.ticker, ranked.trading_date;
$function$;

revoke execute on function public.get_stock_sparklines(text[], integer)
from public, anon;
grant execute on function public.get_stock_sparklines(text[], integer)
to authenticated;

create or replace function public.cleanup_stock_daily_prices(
  p_keep integer default 90
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_deleted bigint;
  v_keep integer := greatest(70, least(coalesce(p_keep,90), 400));
begin
  with old_rows as (
    select ticker, trading_date
    from (
      select ticker,
             trading_date,
             row_number() over (
               partition by ticker
               order by trading_date desc
             ) as rn
      from public.stock_daily_prices
    ) ranked
    where rn > v_keep
  )
  delete from public.stock_daily_prices d
  using old_rows o
  where d.ticker=o.ticker
    and d.trading_date=o.trading_date;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke execute on function public.cleanup_stock_daily_prices(integer)
from public, anon, authenticated;
grant execute on function public.cleanup_stock_daily_prices(integer)
to service_role;

do $$
begin
  if exists (
    select 1 from cron.job
    where jobname='cleanup-stock-daily-prices-90'
  ) then
    perform cron.unschedule('cleanup-stock-daily-prices-90');
  end if;

  perform cron.schedule(
    'cleanup-stock-daily-prices-90',
    '47 4 * * 0',
    'select public.cleanup_stock_daily_prices(90);'
  );

  if exists (
    select 1 from cron.job
    where jobname='cleanup-intraday-snapshots-7d'
  ) then
    perform cron.unschedule('cleanup-intraday-snapshots-7d');
  end if;

  if exists (
    select 1 from cron.job
    where jobname='stockpulse-check-price-alerts'
  ) then
    perform cron.unschedule('stockpulse-check-price-alerts');
  end if;

  if exists (
    select 1 from cron.job
    where jobname='stockpulse-price-alerts-market-hours'
  ) then
    perform cron.unschedule('stockpulse-price-alerts-market-hours');
  end if;

  if exists (
    select 1 from cron.job
    where jobname='stockpulse-price-alerts-weekends'
  ) then
    perform cron.unschedule('stockpulse-price-alerts-weekends');
  end if;

  perform cron.schedule(
    'stockpulse-price-alerts-market-hours',
    '* 13-21 * * 1-5',
    $cmd$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name='stockpulse_project_url'
          limit 1
        ) || '/functions/v1/check-price-alerts',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-alerts-secret',(
            select decrypted_secret
            from vault.decrypted_secrets
            where name='stockpulse_alerts_worker_secret'
            limit 1
          )
        ),
        body := '{}'::jsonb
      )
      where (now() at time zone 'America/New_York')::time >= time '09:30'
        and (now() at time zone 'America/New_York')::time < time '16:00';
    $cmd$
  );

  perform cron.schedule(
    'stockpulse-price-alerts-weekends',
    '*/30 * * * 0,6',
    $cmd$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name='stockpulse_project_url'
          limit 1
        ) || '/functions/v1/check-price-alerts',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-alerts-secret',(
            select decrypted_secret
            from vault.decrypted_secrets
            where name='stockpulse_alerts_worker_secret'
            limit 1
          )
        ),
        body := '{}'::jsonb
      );
    $cmd$
  );
end $$;

create index if not exists stocks_user_id_idx
  on public.stocks(user_id);

create index if not exists stock_transactions_stock_id_idx
  on public.stock_transactions(stock_id);

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in (
        'watchlist_items',
        'stock_transactions',
        'saved_screens',
        'stock_alerts',
        'watchlists',
        'app_notifications',
        'monthly_report_deliveries',
        'analytics_events'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );
  end loop;
end $$;

create policy "users_select_own_watchlist_items"
on public.watchlist_items
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_watchlist_items"
on public.watchlist_items
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_update_own_watchlist_items"
on public.watchlist_items
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users_delete_own_watchlist_items"
on public.watchlist_items
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "users_select_own_stock_transactions"
on public.stock_transactions
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_stock_transactions"
on public.stock_transactions
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_update_own_stock_transactions"
on public.stock_transactions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users_delete_own_stock_transactions"
on public.stock_transactions
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "users_select_own_saved_screens"
on public.saved_screens
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_saved_screens"
on public.saved_screens
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_update_own_saved_screens"
on public.saved_screens
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users_delete_own_saved_screens"
on public.saved_screens
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "users_select_own_stock_alerts"
on public.stock_alerts
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_stock_alerts"
on public.stock_alerts
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_update_own_stock_alerts"
on public.stock_alerts
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users_delete_own_stock_alerts"
on public.stock_alerts
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "users_select_own_watchlists"
on public.watchlists
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_watchlists"
on public.watchlists
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_update_own_watchlists"
on public.watchlists
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users_delete_own_watchlists"
on public.watchlists
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "users_select_own_app_notifications"
on public.app_notifications
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_update_own_app_notifications"
on public.app_notifications
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users_delete_own_app_notifications"
on public.app_notifications
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "users_select_own_monthly_report_deliveries"
on public.monthly_report_deliveries
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_analytics_events"
on public.analytics_events
for insert to authenticated
with check ((select auth.uid()) = user_id);

revoke execute on function public.assign_default_watchlist()
from public, anon, authenticated;
grant execute on function public.assign_default_watchlist()
to service_role;

revoke execute on function public.capture_quote_intraday_snapshot()
from public, anon, authenticated;
grant execute on function public.capture_quote_intraday_snapshot()
to service_role;

revoke execute on function public.cleanup_old_intraday_snapshots()
from public, anon, authenticated;
grant execute on function public.cleanup_old_intraday_snapshots()
to service_role;

revoke execute on function public.enqueue_watchlist_analysis_refresh()
from public, anon, authenticated;
grant execute on function public.enqueue_watchlist_analysis_refresh()
to service_role;

revoke execute on function public.enqueue_watchlist_news_refresh()
from public, anon, authenticated;
grant execute on function public.enqueue_watchlist_news_refresh()
to service_role;

revoke execute on function public.handle_new_user()
from public, anon, authenticated;
grant execute on function public.handle_new_user()
to service_role;

revoke execute on function public.next_watchlist_analysis_ticker()
from public, anon, authenticated;
grant execute on function public.next_watchlist_analysis_ticker()
to service_role;

revoke execute on function public.next_watchlist_news_ticker()
from public, anon, authenticated;
grant execute on function public.next_watchlist_news_ticker()
to service_role;

revoke execute on function public.record_daily_market_close(date)
from public, anon, authenticated;
grant execute on function public.record_daily_market_close(date)
to service_role;

alter function public.set_stock_screener_dividend_yield()
set search_path = public, pg_temp;
