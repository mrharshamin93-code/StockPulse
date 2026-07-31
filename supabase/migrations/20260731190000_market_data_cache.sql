create table if not exists public.market_data_cache (
  cache_key text primary key,
  data_type text not null,
  ticker text,
  parameters jsonb not null default '{}'::jsonb,
  payload jsonb,
  fetched_at timestamptz,
  expires_at timestamptz,
  stale_until timestamptz,
  refresh_locked_until timestamptz,
  provider_error text,
  retry_after timestamptz,
  provider_request_units integer not null default 0,
  refresh_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_data_cache_key_length check (length(cache_key) between 1 and 500),
  constraint market_data_cache_request_units_nonnegative check (provider_request_units >= 0)
);

create index if not exists market_data_cache_type_ticker_idx
  on public.market_data_cache (data_type, ticker);

create index if not exists market_data_cache_expiration_idx
  on public.market_data_cache (expires_at);

create index if not exists market_data_cache_updated_idx
  on public.market_data_cache (updated_at desc);

alter table public.market_data_cache enable row level security;

create table if not exists public.provider_api_usage_monthly (
  month_start date not null,
  provider text not null,
  request_units bigint not null default 0,
  request_count bigint not null default 0,
  success_count bigint not null default 0,
  failure_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (month_start, provider),
  constraint provider_api_usage_monthly_nonnegative check (
    request_units >= 0 and
    request_count >= 0 and
    success_count >= 0 and
    failure_count >= 0
  )
);

alter table public.provider_api_usage_monthly enable row level security;

create table if not exists public.provider_api_usage_daily (
  usage_date date not null,
  provider text not null,
  endpoint text not null,
  request_units bigint not null default 0,
  request_count bigint not null default 0,
  success_count bigint not null default 0,
  failure_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (usage_date, provider, endpoint),
  constraint provider_api_usage_daily_nonnegative check (
    request_units >= 0 and
    request_count >= 0 and
    success_count >= 0 and
    failure_count >= 0
  )
);

alter table public.provider_api_usage_daily enable row level security;

create or replace function public.claim_market_data_refresh(
  p_cache_key text,
  p_data_type text,
  p_ticker text,
  p_parameters jsonb,
  p_lease_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  insert into public.market_data_cache (
    cache_key,
    data_type,
    ticker,
    parameters,
    refresh_locked_until,
    updated_at
  )
  values (
    p_cache_key,
    p_data_type,
    nullif(upper(trim(coalesce(p_ticker, ''))), ''),
    coalesce(p_parameters, '{}'::jsonb),
    now() + make_interval(secs => greatest(5, least(p_lease_seconds, 120))),
    now()
  )
  on conflict (cache_key) do update
  set
    data_type = excluded.data_type,
    ticker = excluded.ticker,
    parameters = excluded.parameters,
    refresh_locked_until = excluded.refresh_locked_until,
    updated_at = now()
  where
    market_data_cache.refresh_locked_until is null or
    market_data_cache.refresh_locked_until <= now();

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.complete_market_data_refresh(
  p_cache_key text,
  p_payload jsonb,
  p_fresh_seconds integer,
  p_stale_seconds integer,
  p_request_units integer default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.market_data_cache
  set
    payload = p_payload,
    fetched_at = now(),
    expires_at = now() + make_interval(secs => greatest(1, p_fresh_seconds)),
    stale_until = now() + make_interval(
      secs => greatest(greatest(1, p_fresh_seconds), p_stale_seconds)
    ),
    refresh_locked_until = null,
    provider_error = null,
    retry_after = null,
    provider_request_units = greatest(0, p_request_units),
    refresh_count = refresh_count + 1,
    updated_at = now()
  where cache_key = p_cache_key;
end;
$$;

create or replace function public.fail_market_data_refresh(
  p_cache_key text,
  p_error text,
  p_retry_seconds integer default 60
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.market_data_cache
  set
    refresh_locked_until = null,
    provider_error = left(coalesce(p_error, 'Provider request failed.'), 1000),
    retry_after = now() + make_interval(secs => greatest(5, least(p_retry_seconds, 3600))),
    updated_at = now()
  where cache_key = p_cache_key;
end;
$$;

create or replace function public.reserve_provider_request(
  p_provider text,
  p_request_units integer default 1,
  p_monthly_limit integer default 100000,
  p_reserved_units integer default 15000,
  p_priority boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
  effective_limit integer;
begin
  effective_limit := greatest(
    0,
    p_monthly_limit - case when p_priority then 0 else greatest(0, p_reserved_units) end
  );

  if greatest(1, p_request_units) > effective_limit then
    return false;
  end if;

  insert into public.provider_api_usage_monthly (
    month_start,
    provider,
    request_units,
    request_count,
    updated_at
  )
  values (
    date_trunc('month', now())::date,
    lower(trim(p_provider)),
    greatest(1, p_request_units),
    1,
    now()
  )
  on conflict (month_start, provider) do update
  set
    request_units = provider_api_usage_monthly.request_units + greatest(1, p_request_units),
    request_count = provider_api_usage_monthly.request_count + 1,
    updated_at = now()
  where
    provider_api_usage_monthly.request_units + greatest(1, p_request_units)
      <= effective_limit
  returning true into allowed;

  return coalesce(allowed, false);
end;
$$;

create or replace function public.record_provider_request_result(
  p_provider text,
  p_endpoint text,
  p_request_units integer,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.provider_api_usage_monthly
  set
    success_count = success_count + case when p_success then 1 else 0 end,
    failure_count = failure_count + case when p_success then 0 else 1 end,
    updated_at = now()
  where
    month_start = date_trunc('month', now())::date and
    provider = lower(trim(p_provider));

  insert into public.provider_api_usage_daily (
    usage_date,
    provider,
    endpoint,
    request_units,
    request_count,
    success_count,
    failure_count,
    updated_at
  )
  values (
    current_date,
    lower(trim(p_provider)),
    p_endpoint,
    greatest(1, p_request_units),
    1,
    case when p_success then 1 else 0 end,
    case when p_success then 0 else 1 end,
    now()
  )
  on conflict (usage_date, provider, endpoint) do update
  set
    request_units = provider_api_usage_daily.request_units + greatest(1, p_request_units),
    request_count = provider_api_usage_daily.request_count + 1,
    success_count = provider_api_usage_daily.success_count + case when p_success then 1 else 0 end,
    failure_count = provider_api_usage_daily.failure_count + case when p_success then 0 else 1 end,
    updated_at = now();
end;
$$;

revoke all on public.market_data_cache from anon, authenticated;
revoke all on public.provider_api_usage_monthly from anon, authenticated;
revoke all on public.provider_api_usage_daily from anon, authenticated;

revoke all on function public.claim_market_data_refresh(text, text, text, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.complete_market_data_refresh(text, jsonb, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.fail_market_data_refresh(text, text, integer)
  from public, anon, authenticated;
revoke all on function public.reserve_provider_request(text, integer, integer, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.record_provider_request_result(text, text, integer, boolean)
  from public, anon, authenticated;

grant select, insert, update, delete on public.market_data_cache to service_role;
grant select, insert, update on public.provider_api_usage_monthly to service_role;
grant select, insert, update on public.provider_api_usage_daily to service_role;

grant execute on function public.claim_market_data_refresh(text, text, text, jsonb, integer)
  to service_role;
grant execute on function public.complete_market_data_refresh(text, jsonb, integer, integer, integer)
  to service_role;
grant execute on function public.fail_market_data_refresh(text, text, integer)
  to service_role;
grant execute on function public.reserve_provider_request(text, integer, integer, integer, boolean)
  to service_role;
grant execute on function public.record_provider_request_result(text, text, integer, boolean)
  to service_role;
