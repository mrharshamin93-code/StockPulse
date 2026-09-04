const PORTFOLIO_STOCKS_CACHE_PREFIX = "stockpulse:portfolio-stocks:v1:";

export function readCachedPortfolioStocks(userId) {
  if (!userId || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(
      `${PORTFOLIO_STOCKS_CACHE_PREFIX}${userId}`,
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.stocks) ? parsed.stocks : null;
  } catch {
    return null;
  }
}

export function cachePortfolioStocks(userId, stocks) {
  if (!userId || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      `${PORTFOLIO_STOCKS_CACHE_PREFIX}${userId}`,
      JSON.stringify({ stocks, savedAt: Date.now() }),
    );
  } catch {
    // The in-memory page state still works when local storage is unavailable.
  }
}
