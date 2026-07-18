import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This is a service-role operation — no user auth needed
    const serviceBase44 = base44.asServiceRole;

    // Fetch all watchlist items and stocks across all users
    const [watchlistItems, stocks] = await Promise.all([
      serviceBase44.entities.WatchlistItem.list(),
      serviceBase44.entities.Stock.list(),
    ]);

    // Collect unique tickers
    const tickerSet = new Set([
      ...watchlistItems.map((i) => i.ticker.toUpperCase()),
      ...stocks.map((s) => s.ticker.toUpperCase()),
    ]);
    const tickers = Array.from(tickerSet);

    if (!tickers.length) {
      return Response.json({ updated: 0 });
    }

    // Fetch quotes from Finnhub in batches of 30
    const BATCH_SIZE = 30;
    const quoteMap = {};
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const url = `https://finnhub.io/api/v1/quotes?symbols=${batch.join(',')}&token=${Deno.env.get('FINNHUB_API_KEY')}`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          // Finnhub bulk quotes endpoint returns { ticker: { c, d, dp, pc } }
          if (data && typeof data === 'object') {
            for (const [ticker, q] of Object.entries(data)) {
              if (q && q.c) quoteMap[ticker.toUpperCase()] = q;
            }
          }
        }
      } catch {}
    }

    // If bulk endpoint returned nothing, fall back to individual quote calls
    if (Object.keys(quoteMap).length === 0) {
      for (const ticker of tickers) {
        try {
          const res = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${Deno.env.get('FINNHUB_API_KEY')}`
          );
          if (res.ok) {
            const q = await res.json();
            if (q && q.c) quoteMap[ticker] = q;
          }
        } catch {}
      }
    }

    const now = new Date().toISOString();

    // Update WatchlistItem records
    const watchlistUpdates = watchlistItems
      .filter((item) => quoteMap[item.ticker.toUpperCase()])
      .map((item) => {
        const q = quoteMap[item.ticker.toUpperCase()];
        return {
          id: item.id,
          cached_price: q.c,
          cached_change_pct: q.dp,
          cached_change: q.d,
          cache_updated_at: now,
        };
      });

    // Update Stock records
    const stockUpdates = stocks
      .filter((s) => quoteMap[s.ticker.toUpperCase()])
      .map((s) => {
        const q = quoteMap[s.ticker.toUpperCase()];
        return {
          id: s.id,
          cached_price: q.c,
          cached_change_pct: q.dp,
          cached_change: q.d,
          cache_updated_at: now,
        };
      });

    if (watchlistUpdates.length) {
      await serviceBase44.entities.WatchlistItem.bulkUpdate(watchlistUpdates);
    }
    if (stockUpdates.length) {
      await serviceBase44.entities.Stock.bulkUpdate(stockUpdates);
    }

    return Response.json({
      updated: watchlistUpdates.length + stockUpdates.length,
      tickers: tickers.length,
      quotes: Object.keys(quoteMap).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});