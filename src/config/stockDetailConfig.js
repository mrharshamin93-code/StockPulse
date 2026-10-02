export const PERIODS = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "2Y",
  "5Y",
  "10Y",
  "All",
];

export const PERIOD_CONFIG = {
  "1D": { resolution: "30", daysBack: 7 },
  "1W": { resolution: "D", daysBack: 14 },
  "1M": { resolution: "D", daysBack: 31 },
  "3M": { resolution: "D", daysBack: 93 },
  "6M": { resolution: "D", daysBack: 186 },
  YTD: { resolution: "D", daysBack: null },
  "1Y": { resolution: "D", daysBack: 370 },
  "2Y": { resolution: "W", daysBack: 740 },
  "5Y": { resolution: "W", daysBack: 1840 },
  "10Y": { resolution: "M", daysBack: 3680 },
  All: { resolution: "M", daysBack: null },
};

export const FUNDAMENTAL_METRICS = [
  { label: "Market Cap", keys: ["market_cap", "marketCap"], format: "marketCap" },
  { label: "P/E", keys: ["price_to_earnings_ratio", "pe_ratio", "price_to_earnings", "pe"], format: "number" },
  { label: "EV/EBITDA", keys: ["enterprise_value_to_ebitda_ratio", "ev_to_ebitda", "enterprise_value_ebitda"], format: "number" },
  { label: "Price/Sales", keys: ["price_to_sales_ratio", "price_sales_ratio", "price_to_sales"], format: "number" },
  { label: "PEG", keys: ["peg_ratio", "peg"], format: "number" },
  { label: "EPS", keys: ["earnings_per_share", "eps", "eps_ttm"], format: "currency" },
  { label: "Revenue Growth", keys: ["revenue_growth", "revenue_growth_yoy"], format: "percent" },
  { label: "Net Margin", keys: ["net_margin"], format: "percent" },
  { label: "ROE", keys: ["return_on_equity", "roe"], format: "percent" },
  { label: "Debt/Equity", keys: ["debt_to_equity"], format: "number" },
  { label: "Dividend Yield", keys: ["dividend_yield", "dividend_yield_percentage"], format: "percent" },
];

export const MAX_COMPARISON_TICKERS = 4;
export const COMPARISON_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
];
export const TOOLTIP_HIDE_DELAY = 2500;
export const UNAVAILABLE_VALUE = "—";
