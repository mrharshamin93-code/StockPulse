# StockPulse

Stock Market Portfolio App built with React + Vite and Supabase.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Supabase (PostgreSQL + Auth + Realtime)
- Stock Data: Financial Datasets API

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Stock analysis Edge Function

The Analysis tab invokes the authenticated Supabase Edge Function in
`supabase/functions/stock-analysis`.

Set the model provider secret and deploy the function to your Supabase project:

```bash
supabase secrets set XAI_API_KEY=your_key
supabase functions deploy stock-analysis
```

`XAI_MODEL` is optional and defaults to `grok-4.3`.

### Market data Edge Functions

Set the provider and worker secrets before deploying the market-data
functions:

```bash
supabase secrets set FINANCIAL_DATASETS_API_KEY=your_key
supabase secrets set STOCK_SYNC_SECRET=your_random_secret
supabase secrets set ALERTS_WORKER_SECRET=your_random_secret
supabase secrets set MONTHLY_REPORT_CRON_SECRET=your_random_secret
```

Deploy the functions after updating the secrets:

```bash
supabase functions deploy financial-datasets
supabase functions deploy sync-stock-quotes
supabase functions deploy sync-stock-technicals
supabase functions deploy stock-screener
supabase functions deploy check-price-alerts
supabase functions deploy monthly-report
```

The browser-facing `financial-datasets` function requires a valid Supabase
user session. Scheduled quote, technical, alert, and report workers validate
their dedicated secret headers inside the function.

### Shared market-data cache

Apply database migrations before deploying the market-data functions:

```bash
supabase db push
```

The cache migration creates service-role-only tables and RPCs for shared
responses, atomic refresh leases, stale-data fallback, and monthly provider
usage accounting. Quotes refresh at most once per ticker every five minutes
during regular US market hours and once per hour outside market hours.

The request budget defaults to 100,000 units per month. Non-priority traffic
stops at 85,000 units so the final 15,000 remain available to price alerts.
These optional secrets can change those limits without a code deployment:

```bash
supabase secrets set FINANCIAL_DATASETS_MONTHLY_LIMIT=100000
supabase secrets set FINANCIAL_DATASETS_RESERVED_UNITS=15000
```

Provider calls and cache entries can be monitored in
`provider_api_usage_monthly`, `provider_api_usage_daily`, and
`market_data_cache`. Browser clients cannot read these service-role tables.
