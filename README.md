# StockPulse

Stock Market Portfolio App built with React + Vite and Supabase.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Supabase (PostgreSQL + Auth + Realtime)
- Stock Data: Finnhub API

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
supabase secrets set OPENAI_API_KEY=your_key
supabase functions deploy stock-analysis
```

`OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.
