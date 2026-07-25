import { supabase } from "@/lib/supabase";

export async function finnhubRequest(
  body,
) {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "finnhub",
      {
        body,
      },
    );

  if (error) {
    console.error(
      "Finnhub Edge Function error:",
      error,
    );

    throw new Error(
      error.message ||
        "Market data request failed.",
    );
  }

  if (
    data?.error
  ) {
    throw new Error(
      data.error,
    );
  }

  return data;
}

export async function getQuote(
  ticker,
) {
  return finnhubRequest({
    action:
      "quote",

    ticker,
  });
}

export async function getQuotes(
  tickers,
) {
  return finnhubRequest({
    action:
      "quotes",

    tickers,
  });
}

export async function getProfile(
  ticker,
) {
  return finnhubRequest({
    action:
      "profile",

    ticker,
  });
}

export async function searchStocks(
  query,
) {
  return finnhubRequest({
    action:
      "search",

    query,
  });
}

export async function getNews(
  ticker,
) {
  return finnhubRequest({
    action:
      "news",

    ticker,
  });
}

export async function getCandles({
  ticker,
  resolution = "D",
  period = "1Y",
}) {
  return finnhubRequest({
    action:
      "candles",

    ticker,

    resolution,

    period,
  });
}

export async function getCandlesRange({
  ticker,
  resolution = "D",
  from,
  to,
  period,
}) {
  return finnhubRequest({
    action:
      "candles_range",

    ticker,

    resolution,

    from,

    to,

    ...(period
      ? {
          period,
        }
      : {}),
  });
}
