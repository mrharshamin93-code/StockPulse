import { supabase } from "@/lib/supabase";

export async function financialDatasetsRequest(body) {
  const { data, error } = await supabase.functions.invoke(
    "financial-datasets",
    { body },
  );

  if (error) {
    console.error(
      "Financial Datasets Edge Function error:",
      error,
    );

    throw new Error(
      error.message ||
        "Market data request failed.",
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function getQuote(ticker) {
  return financialDatasetsRequest({
    action: "quote",
    ticker,
  });
}

export async function getQuotes(tickers) {
  return financialDatasetsRequest({
    action: "quotes",
    tickers,
  });
}

export async function getProfile(ticker) {
  return financialDatasetsRequest({
    action: "profile",
    ticker,
  });
}

export async function getNews(ticker) {
  return financialDatasetsRequest({
    action: "news",
    ticker,
  });
}

export async function getCandles({
  ticker,
  resolution = "D",
  period = "1Y",
}) {
  return financialDatasetsRequest({
    action: "candles",
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
  return financialDatasetsRequest({
    action: "candles_range",
    ticker,
    resolution,
    from,
    to,
    ...(period ? { period } : {}),
  });
}

export async function getMetrics(ticker) {
  return financialDatasetsRequest({
    action: "metrics",
    ticker,
  });
}
