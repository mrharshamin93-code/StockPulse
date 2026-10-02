# AGENTS.md

## Project Context

StockPulse is a mobile-first stock tracking application built with Vite + React, Supabase, and Capacitor for iOS. Production market data is provided primarily through Financial Datasets, while AI analysis is served through Supabase Edge Functions.

Keep changes focused, preserve existing behavior unless the task explicitly changes it, and treat the Supabase database/Edge Functions and iOS Capacitor project as production-critical.

## Architecture

- `src/`: React frontend and application data-access code.
- `supabase/functions/`: Supabase Edge Functions.
- `supabase/functions/_shared/`: shared server-side cache, provider, entitlement, and notification helpers.
- `supabase/migrations/`: database schema, RLS, cron, and operational migrations.
- `ios/`: Capacitor iOS project.
- `codemagic.yaml`: simulator/TestFlight CI configuration.
- `vite.config.js`: Vite configuration.

## Data and Security Rules

- Never expose Supabase service-role keys or provider secrets to the client.
- User-owned tables must be protected by RLS and scoped with `(select auth.uid())`.
- Authorization fields such as `role`, `grandfathered_free`, `access_tier`, and subscription verification fields are server-managed.
- Premium/costly Edge Functions must enforce StockPulse entitlement server-side.
- Reuse the shared Financial Datasets cache/budget layer rather than calling the provider directly.
- Prefer stored `stock_daily_prices` and `stock_intraday_snapshots` before making provider requests.
- Internal cron/worker RPCs must not be executable by anon or normal authenticated clients.

## Development Workflow

Before finishing code changes, run:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

For iOS changes, also run `npm run build:ios` and verify Capacitor sync succeeds.

Do not introduce Base44 dependencies or workflows; Base44 code under `archive/` is legacy only.
