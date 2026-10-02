export const LONG_PRESS_MS = 600;
export const TOOLTIP_VISIBLE_MS = 5000;

export const UNSUPPORTED_METRIC_KEYS = new Set([
  "forwardPe",
  "pcf",
  "debtEbitda",
  "dividendGrowth",
]);

export const UNSUPPORTED_FILTER_KEYS = new Set([
  "minForwardPe",
  "maxForwardPe",
  "minPcf",
  "maxPcf",
  "minDebtEbitda",
  "maxDebtEbitda",
  "minDividendGrowth",
  "maxDividendGrowth",
]);

export const SECTORS = [
  "Technology",
  "Healthcare",
  "Finance",
  "Energy",
  "Consumer Cyclical",
  "Industrials",
  "Real Estate",
  "Utilities",
  "Materials",
  "Communication Services",
];

export const POPULAR_SCREENS = [
  {
    label: "Large Cap Tech",
    filters: { sectors: ["Technology"], minMarketCapB: 10 },
  },
  {
    label: "High Dividend",
    filters: { minDividendYield: 3 },
  },
  {
    label: "Oversold (RSI < 30)",
    filters: { maxRsi: 30 },
  },
  {
    label: "Strong Momentum",
    filters: {
      minReturn1Month: 5,
      minReturn3Month: 10,
      minRsi: 55,
      maxRsi: 75,
      maxBullishMaCrossoverDays: 20,
      requirePriceAboveSma20: true,
      requireSma20AboveSma50: true,
    },
  },
  {
    label: "Penny Stocks",
    filters: { maxPrice: 5 },
  },
];

export const METRIC_GROUPS = [
  {
    group: "Valuation",
    metrics: [
      { key: "pe", label: "P/E Ratio", desc: "Share price divided by trailing twelve-month earnings per share. It shows how much investors are paying for each dollar of reported earnings. The ratio is not meaningful when earnings are zero or negative.", unit: "x", minKey: "minPe", maxKey: "maxPe", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 25" },
      { key: "peg", label: "PEG Ratio", desc: "The price-to-earnings ratio divided by the expected earnings growth rate. It relates a company’s valuation to its projected growth, though results depend heavily on the growth estimate used.", unit: "x", minKey: "minPeg", maxKey: "maxPeg", minPlaceholder: "e.g. 0", maxPlaceholder: "e.g. 1" },
      { key: "pb", label: "P/B Ratio", desc: "Market price per share divided by book value per share. It compares a company’s market valuation with the accounting value of its net assets.", unit: "x", minKey: "minPb", maxKey: "maxPb", minPlaceholder: "e.g. 0.5", maxPlaceholder: "e.g. 5" },
      { key: "ps", label: "P/S Ratio", desc: "Market capitalization divided by annual revenue, or equivalently share price divided by revenue per share. It measures how much investors are paying for each dollar of sales.", unit: "x", minKey: "minPs", maxKey: "maxPs", minPlaceholder: "e.g. 0.5", maxPlaceholder: "e.g. 10" },
      { key: "evEbitda", label: "EV/EBITDA", desc: "Enterprise value divided by earnings before interest, taxes, depreciation and amortization. It compares operating earnings with the total value of the business, including debt and excluding cash.", unit: "x", minKey: "minEvEbitda", maxKey: "maxEvEbitda", minPlaceholder: "e.g. 3", maxPlaceholder: "e.g. 20" },
      { key: "pfcf", label: "P/Free Cash Flow", desc: "Market capitalization divided by free cash flow, or share price divided by free cash flow per share. Free cash flow is generally operating cash flow minus capital expenditures.", unit: "x", minKey: "minPfcf", maxKey: "maxPfcf", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 40" },
    ],
  },
  {
    group: "Profitability",
    metrics: [
      { key: "grossMargin", label: "Gross Margin", desc: "Gross profit divided by revenue. It measures the percentage of revenue remaining after direct costs associated with producing goods or delivering services.", unit: "%", minKey: "minGrossMargin", maxKey: "maxGrossMargin", minPlaceholder: "e.g. 20", maxPlaceholder: "e.g. 80" },
      { key: "operatingMargin", label: "Operating Margin", desc: "Operating income divided by revenue. It measures profitability after direct costs and operating expenses, but before interest and taxes.", unit: "%", minKey: "minOperatingMargin", maxKey: "maxOperatingMargin", minPlaceholder: "e.g. 10", maxPlaceholder: "e.g. 40" },
      { key: "netMargin", label: "Net Profit Margin", desc: "Net income divided by revenue. It measures the percentage of revenue remaining after all operating expenses, interest, taxes and other costs.", unit: "%", minKey: "minNetMargin", maxKey: "maxNetMargin", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 30" },
      { key: "roe", label: "Return on Equity — ROE", desc: "Net income divided by average shareholders’ equity. It measures the return generated on the capital invested by common shareholders.", unit: "%", minKey: "minRoe", maxKey: "maxRoe", minPlaceholder: "e.g. 10", maxPlaceholder: "e.g. 50" },
      { key: "roa", label: "Return on Assets — ROA", desc: "Net income divided by average total assets. It measures how effectively a company uses its assets to generate profit.", unit: "%", minKey: "minRoa", maxKey: "maxRoa", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 25" },
      { key: "roic", label: "Return on Invested Capital — ROIC", desc: "Net operating profit after tax divided by invested capital. It measures the return earned on the capital used to fund the company’s operations.", unit: "%", minKey: "minRoic", maxKey: "maxRoic", minPlaceholder: "e.g. 8", maxPlaceholder: "e.g. 40" },
    ],
  },
  {
    group: "Growth",
    metrics: [
      { key: "revenueGrowth", label: "Revenue Growth — Year over Year", desc: "The percentage change in revenue compared with the corresponding period one year earlier. It measures the rate at which the company’s sales are expanding or contracting.", unit: "%", minKey: "minRevenueGrowth", maxKey: "maxRevenueGrowth", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 50" },
      { key: "epsGrowth", label: "EPS Growth — Year over Year", desc: "The percentage change in earnings per share compared with the corresponding period one year earlier. It reflects changes in profitability on a per-share basis.", unit: "%", minKey: "minEpsGrowth", maxKey: "maxEpsGrowth", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 50" },
      { key: "ebitdaGrowth", label: "EBITDA Growth", desc: "The percentage change in earnings before interest, taxes, depreciation and amortization compared with the prior comparable period.", unit: "%", minKey: "minEbitdaGrowth", maxKey: "maxEbitdaGrowth", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 50" },
      { key: "fcfGrowth", label: "Free Cash Flow Growth", desc: "The percentage change in free cash flow compared with the prior comparable period. Free cash flow generally equals operating cash flow minus capital expenditures.", unit: "%", minKey: "minFcfGrowth", maxKey: "maxFcfGrowth", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 50" },
      { key: "week52Change", label: "52-Week Price Change", desc: "The percentage change in the stock price over the previous 52 weeks. It measures historical price performance and does not include dividends unless explicitly stated.", unit: "%", minKey: "minWeek52Change", maxKey: "maxWeek52Change", minPlaceholder: "e.g. 10", maxPlaceholder: "e.g. 100" },
    ],
  },
  {
    group: "Technical Momentum",
    metrics: [
      { key: "rsi", label: "RSI — 14 Day", desc: "A 14-session momentum oscillator ranging from zero to 100. Values above 50 indicate positive momentum, while very high values may indicate an extended move.", unit: "", minKey: "minRsi", maxKey: "maxRsi", minPlaceholder: "e.g. 55", maxPlaceholder: "e.g. 75" },
      { key: "return1Week", label: "One-Week Price Return", desc: "The percentage change in closing price over approximately five trading sessions.", unit: "%", minKey: "minReturn1Week", maxKey: "maxReturn1Week", minPlaceholder: "e.g. 2", maxPlaceholder: "e.g. 25" },
      { key: "return1Month", label: "One-Month Price Return", desc: "The percentage change in closing price over approximately 21 trading sessions.", unit: "%", minKey: "minReturn1Month", maxKey: "maxReturn1Month", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 50" },
      { key: "return3Month", label: "Three-Month Price Return", desc: "The percentage change in closing price over approximately 63 trading sessions.", unit: "%", minKey: "minReturn3Month", maxKey: "maxReturn3Month", minPlaceholder: "e.g. 10", maxPlaceholder: "e.g. 100" },
      { key: "bullishMaCrossoverDays", label: "Bullish 20/50 MA Crossover Age", desc: "The number of trading sessions since the 20-day simple moving average most recently crossed above the 50-day simple moving average.", unit: "days", minKey: "minBullishMaCrossoverDays", maxKey: "maxBullishMaCrossoverDays", minPlaceholder: "e.g. 0", maxPlaceholder: "e.g. 20" },
    ],
  },
  {
    group: "Financial Health",
    metrics: [
      { key: "deRatio", label: "Debt-to-Equity Ratio", desc: "Total debt divided by shareholders’ equity. It measures the amount of debt financing used relative to the company’s equity capital.", unit: "x", minKey: "minDe", maxKey: "maxDe", minPlaceholder: "e.g. 0", maxPlaceholder: "e.g. 1.5" },
      { key: "currentRatio", label: "Current Ratio", desc: "Current assets divided by current liabilities. It measures the company’s ability to meet obligations due within approximately one year using short-term assets.", unit: "x", minKey: "minCurrentRatio", maxKey: "maxCurrentRatio", minPlaceholder: "e.g. 1.5", maxPlaceholder: "e.g. 5" },
      { key: "quickRatio", label: "Quick Ratio", desc: "Cash, marketable securities and receivables divided by current liabilities. It measures short-term liquidity while excluding inventory and other less-liquid current assets.", unit: "x", minKey: "minQuickRatio", maxKey: "maxQuickRatio", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 4" },
      { key: "interestCoverage", label: "Interest Coverage Ratio", desc: "Earnings before interest and taxes divided by interest expense. It measures how many times operating earnings cover the company’s interest obligations.", unit: "x", minKey: "minInterestCoverage", maxKey: "maxInterestCoverage", minPlaceholder: "e.g. 3", maxPlaceholder: "e.g. 20" },
    ],
  },
  {
    group: "Efficiency",
    metrics: [
      { key: "assetTurnover", label: "Asset Turnover", desc: "Revenue divided by average total assets. It measures how efficiently a company uses its asset base to generate sales.", unit: "x", minKey: "minAssetTurnover", maxKey: "maxAssetTurnover", minPlaceholder: "e.g. 0.3", maxPlaceholder: "e.g. 2" },
      { key: "inventoryTurnover", label: "Inventory Turnover", desc: "Cost of goods sold divided by average inventory. It estimates how many times inventory is sold or used during a reporting period.", unit: "x", minKey: "minInventoryTurnover", maxKey: "maxInventoryTurnover", minPlaceholder: "e.g. 3", maxPlaceholder: "e.g. 20" },
      { key: "receivablesTurnover", label: "Receivables Turnover", desc: "Net credit sales divided by average accounts receivable. It measures how efficiently a company collects amounts owed by customers.", unit: "x", minKey: "minReceivablesTurnover", maxKey: "maxReceivablesTurnover", minPlaceholder: "e.g. 3", maxPlaceholder: "e.g. 20" },
      { key: "dso", label: "Days Sales Outstanding — DSO", desc: "The average number of days required to collect payment after a credit sale. Lower values generally indicate faster collection, although appropriate levels vary by industry.", unit: "days", minKey: "minDso", maxKey: "maxDso", minPlaceholder: "e.g. 10", maxPlaceholder: "e.g. 60" },
    ],
  },
  {
    group: "Dividends & Returns",
    metrics: [
      { key: "dividendYield", label: "Dividend Yield", desc: "Annual dividends per share divided by the current share price. It represents annual dividend income as a percentage of the stock’s market price.", unit: "%", minKey: "minDividendYield", maxKey: "maxDividendYield", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 8" },
      { key: "payoutRatio", label: "Payout Ratio", desc: "Dividends paid to common shareholders divided by net income available to common shareholders. It measures the percentage of earnings distributed as dividends.", unit: "%", minKey: "minPayoutRatio", maxKey: "maxPayoutRatio", minPlaceholder: "e.g. 0", maxPlaceholder: "e.g. 60" },
    ],
  },
  {
    group: "Per-Share & Size",
    metrics: [
      { key: "marketCapB", label: "Market Capitalization", desc: "Current share price multiplied by the number of shares outstanding. It represents the total market value of the company’s equity.", unit: "B", minKey: "minMarketCapB", maxKey: "maxMarketCapB", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 500" },
      { key: "eps", label: "Earnings per Share — TTM", desc: "Net income available to common shareholders over the trailing twelve months divided by weighted-average diluted shares outstanding.", unit: "$", minKey: "minEps", maxKey: "maxEps", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 20" },
      { key: "bookValuePerShare", label: "Book Value per Share", desc: "Common shareholders’ equity divided by common shares outstanding. It represents the accounting value of net assets attributable to each common share.", unit: "$", minKey: "minBookValue", maxKey: "maxBookValue", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 100" },
      { key: "fcfPerShare", label: "Free Cash Flow per Share", desc: "Free cash flow divided by weighted-average shares outstanding. It measures the amount of free cash flow generated for each share.", unit: "$", minKey: "minFcfPerShare", maxKey: "maxFcfPerShare", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 50" },
    ],
  },
];

export const ALL_METRIC_DEFS = METRIC_GROUPS.flatMap((group) =>
  group.metrics.map((metric) => ({
    ...metric,
    group: group.group,
  })),
);
