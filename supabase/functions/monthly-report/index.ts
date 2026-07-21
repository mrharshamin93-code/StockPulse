import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

type DeliveryKind = "scheduled" | "manual";
type DeliveryStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "skipped";

type MonthlyReportDelivery = {
  id: string;
  user_id: string;
  report_month: string;
  delivery_kind: DeliveryKind;
  status: DeliveryStatus;
  recipient_email: string;
  report_currency: string;
  report_timezone: string;
  scheduled_for: string;
  attempt_count: number;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type StockRow = {
  id: string;
  ticker: string;
  company_name: string | null;
  quantity: number | string | null;
  purchase_price: number | string | null;
  current_price: number | string | null;
};

type TransactionRow = {
  id: string;
  ticker: string;
  company_name: string | null;
  type: "buy" | "sell" | string;
  quantity: number | string | null;
  price: number | string | null;
  total: number | string | null;
  created_at: string;
};

type QuoteResult = {
  ticker: string;
  currentPrice: number | null;
  source: "finnhub" | "stored" | "unavailable";
};

type HoldingSummary = {
  ticker: string;
  companyName: string;
  quantity: number;
  averageCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  costBasis: number;
  gainLoss: number | null;
  gainLossPercent: number | null;
  allocationPercent: number | null;
  priceSource: QuoteResult["source"];
};

type TransactionSummary = {
  id: string;
  date: string;
  type: "buy" | "sell";
  ticker: string;
  companyName: string;
  quantity: number;
  price: number;
  total: number;
};

type ReportSummary = {
  reportLabel: string;
  generatedAt: Date;
  currency: string;
  timezone: string;
  totalMarketValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number | null;
  pricedHoldings: number;
  missingPriceHoldings: number;
  buysTotal: number;
  sellsTotal: number;
  netCapitalActivity: number;
  transactionCount: number;
  mostActiveTicker: string | null;
};

type ReportData = {
  delivery: MonthlyReportDelivery;
  profile: ProfileRow;
  holdings: HoldingSummary[];
  transactions: TransactionSummary[];
  summary: ReportSummary;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FINNHUB_API_KEY =
  Deno.env.get("FINNHUB_API_KEY") || "";
const MONTHLY_REPORT_CRON_SECRET =
  Deno.env.get("MONTHLY_REPORT_CRON_SECRET") || "";

const MAX_WORKER_ATTEMPTS = 4;
const SCHEDULED_DAILY_LIMIT = 250;
const REPORT_BUCKET = "monthly-reports";
const MAX_STORED_REPORTS_PER_USER = 3;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COLORS = {
  ink: rgb(0.07, 0.08, 0.11),
  muted: rgb(0.42, 0.45, 0.53),
  line: rgb(0.89, 0.9, 0.93),
  soft: rgb(0.97, 0.975, 0.985),
  white: rgb(1, 1, 1),
  accent: rgb(0.18, 0.2, 0.25),
  green: rgb(0.04, 0.62, 0.42),
  greenSoft: rgb(0.9, 0.98, 0.95),
  red: rgb(0.86, 0.2, 0.24),
  redSoft: rgb(1, 0.93, 0.94),
  blue: rgb(0.22, 0.42, 0.85),
};

function jsonResponse(
  payload: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function requireEnvironment(): void {
  const missing = [
    ["SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_ANON_KEY", SUPABASE_ANON_KEY],
    ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(
      `Missing Edge Function secrets: ${missing.join(", ")}`,
    );
  }
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeTicker(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeCurrency(value: unknown): string {
  const normalized = String(value || "USD")
    .trim()
    .toUpperCase();

  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatNumber(value: number, maxFractionDigits = 4): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function startOfPreviousMonthUtc(now = new Date()): string {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - 1,
      1,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

function getReportMonthBounds(reportMonth: string): {
  start: Date;
  endExclusive: Date;
  label: string;
} {
  const start = new Date(`${reportMonth}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid report month: ${reportMonth}`);
  }

  const endExclusive = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      1,
    ),
  );

  const label = start.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });

  return { start, endExclusive, label };
}

function createServiceClient(): SupabaseClient {
  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function createUserClient(authorization: string): SupabaseClient {
  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function fetchAllTransactions(
  service: SupabaseClient,
  userId: string,
  startIso: string,
  endIso: string,
): Promise<TransactionRow[]> {
  const pageSize = 1000;
  const rows: TransactionRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await service
      .from("stock_transactions")
      .select(
        "id,ticker,company_name,type,quantity,price,total,created_at",
      )
      .eq("user_id", userId)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const page = (data || []) as TransactionRow[];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function fetchFinnhubQuote(
  ticker: string,
  storedPrice: number | null,
): Promise<QuoteResult> {
  if (!FINNHUB_API_KEY) {
    return {
      ticker,
      currentPrice: storedPrice,
      source: storedPrice === null ? "unavailable" : "stored",
    };
  }

  try {
    const url = new URL("https://finnhub.io/api/v1/quote");
    url.searchParams.set("symbol", ticker);
    url.searchParams.set("token", FINNHUB_API_KEY);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Finnhub returned ${response.status}`);
    }

    const payload = await response.json();
    const currentPrice = positiveNumberOrNull(payload?.c);

    if (currentPrice !== null) {
      return {
        ticker,
        currentPrice,
        source: "finnhub",
      };
    }
  } catch (error) {
    console.warn(`Quote fetch failed for ${ticker}:`, error);
  }

  return {
    ticker,
    currentPrice: storedPrice,
    source: storedPrice === null ? "unavailable" : "stored",
  };
}

async function fetchQuotesInBatches(
  stocks: StockRow[],
): Promise<Map<string, QuoteResult>> {
  const result = new Map<string, QuoteResult>();
  const batchSize = 5;

  for (let index = 0; index < stocks.length; index += batchSize) {
    const batch = stocks.slice(index, index + batchSize);

    const quotes = await Promise.all(
      batch.map((stock) => {
        const ticker = normalizeTicker(stock.ticker);
        const storedPrice = positiveNumberOrNull(stock.current_price);
        return fetchFinnhubQuote(ticker, storedPrice);
      }),
    );

    for (const quote of quotes) {
      result.set(quote.ticker, quote);
    }
  }

  return result;
}

function buildHoldingSummaries(
  stocks: StockRow[],
  quotes: Map<string, QuoteResult>,
): HoldingSummary[] {
  const holdings = stocks
    .map((stock): HoldingSummary | null => {
      const ticker = normalizeTicker(stock.ticker);
      const quantity = numberOrZero(stock.quantity);
      const averageCost = numberOrZero(stock.purchase_price);

      if (!ticker || quantity <= 0 || averageCost < 0) {
        return null;
      }

      const quote = quotes.get(ticker) || {
        ticker,
        currentPrice: positiveNumberOrNull(stock.current_price),
        source: positiveNumberOrNull(stock.current_price)
          ? "stored"
          : "unavailable",
      };

      const marketValue =
        quote.currentPrice === null
          ? null
          : quote.currentPrice * quantity;
      const costBasis = averageCost * quantity;
      const gainLoss =
        marketValue === null ? null : marketValue - costBasis;
      const gainLossPercent =
        gainLoss === null || costBasis <= 0
          ? null
          : (gainLoss / costBasis) * 100;

      return {
        ticker,
        companyName:
          String(stock.company_name || ticker).trim() || ticker,
        quantity,
        averageCost,
        currentPrice: quote.currentPrice,
        marketValue,
        costBasis,
        gainLoss,
        gainLossPercent,
        allocationPercent: null,
        priceSource: quote.source,
      };
    })
    .filter((holding): holding is HoldingSummary => holding !== null);

  const totalMarketValue = holdings.reduce(
    (sum, holding) => sum + (holding.marketValue || 0),
    0,
  );

  return holdings
    .map((holding) => ({
      ...holding,
      allocationPercent:
        holding.marketValue !== null && totalMarketValue > 0
          ? (holding.marketValue / totalMarketValue) * 100
          : null,
    }))
    .sort(
      (a, b) =>
        (b.marketValue || 0) - (a.marketValue || 0),
    );
}

function buildTransactionSummaries(
  transactions: TransactionRow[],
): TransactionSummary[] {
  return transactions
    .map((transaction): TransactionSummary | null => {
      const ticker = normalizeTicker(transaction.ticker);
      const type = String(transaction.type || "").toLowerCase();
      const quantity = numberOrZero(transaction.quantity);
      const price = numberOrZero(transaction.price);
      const suppliedTotal = numberOrZero(transaction.total);

      if (
        !ticker ||
        (type !== "buy" && type !== "sell") ||
        quantity <= 0 ||
        price < 0
      ) {
        return null;
      }

      return {
        id: transaction.id,
        date: transaction.created_at,
        type,
        ticker,
        companyName:
          String(transaction.company_name || ticker).trim() || ticker,
        quantity,
        price,
        total: suppliedTotal > 0 ? suppliedTotal : quantity * price,
      };
    })
    .filter((transaction): transaction is TransactionSummary =>
      transaction !== null
    )
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
}

function buildReportSummary(
  holdings: HoldingSummary[],
  transactions: TransactionSummary[],
  reportLabel: string,
  currency: string,
  timezone: string,
): ReportSummary {
  const totalMarketValue = holdings.reduce(
    (sum, holding) => sum + (holding.marketValue || 0),
    0,
  );
  const totalCostBasis = holdings.reduce(
    (sum, holding) => sum + holding.costBasis,
    0,
  );
  const totalGainLoss = totalMarketValue - totalCostBasis;
  const totalGainLossPercent =
    totalCostBasis > 0
      ? (totalGainLoss / totalCostBasis) * 100
      : null;

  const buysTotal = transactions
    .filter((transaction) => transaction.type === "buy")
    .reduce((sum, transaction) => sum + transaction.total, 0);
  const sellsTotal = transactions
    .filter((transaction) => transaction.type === "sell")
    .reduce((sum, transaction) => sum + transaction.total, 0);

  const activityByTicker = new Map<string, number>();
  for (const transaction of transactions) {
    activityByTicker.set(
      transaction.ticker,
      (activityByTicker.get(transaction.ticker) || 0) + 1,
    );
  }

  const mostActiveTicker =
    [...activityByTicker.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
    null;

  return {
    reportLabel,
    generatedAt: new Date(),
    currency,
    timezone,
    totalMarketValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPercent,
    pricedHoldings: holdings.filter(
      (holding) => holding.currentPrice !== null,
    ).length,
    missingPriceHoldings: holdings.filter(
      (holding) => holding.currentPrice === null,
    ).length,
    buysTotal,
    sellsTotal,
    netCapitalActivity: buysTotal - sellsTotal,
    transactionCount: transactions.length,
    mostActiveTicker,
  };
}

async function loadReportData(
  service: SupabaseClient,
  delivery: MonthlyReportDelivery,
): Promise<ReportData> {
  const { start, endExclusive, label } = getReportMonthBounds(
    delivery.report_month,
  );

  const [profileResult, stocksResult, transactions] = await Promise.all([
    service
      .from("profiles")
      .select("id,email,full_name")
      .eq("id", delivery.user_id)
      .single(),
    service
      .from("stocks")
      .select(
        "id,ticker,company_name,quantity,purchase_price,current_price",
      )
      .eq("user_id", delivery.user_id)
      .order("ticker", { ascending: true }),
    fetchAllTransactions(
      service,
      delivery.user_id,
      start.toISOString(),
      endExclusive.toISOString(),
    ),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (stocksResult.error) {
    throw stocksResult.error;
  }

  const profile = profileResult.data as ProfileRow;
  const stocks = (stocksResult.data || []) as StockRow[];
  const quotes = await fetchQuotesInBatches(stocks);
  const holdings = buildHoldingSummaries(stocks, quotes);
  const transactionSummaries = buildTransactionSummaries(transactions);
  const currency = normalizeCurrency(delivery.report_currency);
  const timezone = delivery.report_timezone || "UTC";
  const summary = buildReportSummary(
    holdings,
    transactionSummaries,
    label,
    currency,
    timezone,
  );

  return {
    delivery,
    profile,
    holdings,
    transactions: transactionSummaries,
    summary,
  };
}

function splitText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function drawTextRight(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  size: number,
  font: PDFFont,
  color = COLORS.ink,
): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: xRight - width,
    y,
    size,
    font,
    color,
  });
}

function drawCard(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: COLORS.white,
    borderColor: COLORS.line,
    borderWidth: 1,
  });
}

function drawSectionTitle(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  bold: PDFFont,
): void {
  page.drawText(text.toUpperCase(), {
    x,
    y,
    size: 10,
    font: bold,
    color: COLORS.muted,
    characterSpacing: 0.8,
  });
}

function drawHeader(
  page: PDFPage,
  data: ReportData,
  bold: PDFFont,
  regular: PDFFont,
): void {
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 0,
    y: height - 112,
    width,
    height: 112,
    color: COLORS.ink,
  });

  page.drawRectangle({
    x: 0,
    y: height - 112,
    width: 6,
    height: 112,
    color: COLORS.blue,
  });

  page.drawCircle({
    x: 52,
    y: height - 54,
    size: 22,
    color: COLORS.white,
  });

  page.drawText("SP", {
    x: 39,
    y: height - 61,
    size: 16,
    font: bold,
    color: COLORS.ink,
  });

  page.drawText("StockPulse", {
    x: 86,
    y: height - 45,
    size: 23,
    font: bold,
    color: COLORS.white,
  });

  page.drawText("Portfolio Performance Report", {
    x: 86,
    y: height - 65,
    size: 11,
    font: regular,
    color: rgb(0.72, 0.75, 0.82),
  });

  page.drawText(data.summary.reportLabel, {
    x: 86,
    y: height - 83,
    size: 10,
    font: regular,
    color: rgb(0.72, 0.75, 0.82),
  });

  const userName = data.profile.full_name || "Investor";
  drawTextRight(
    page,
    userName,
    width - 34,
    height - 45,
    10,
    bold,
    COLORS.white,
  );
  drawTextRight(
    page,
    data.delivery.recipient_email,
    width - 34,
    height - 63,
    8.5,
    regular,
    rgb(0.72, 0.75, 0.82),
  );
  drawTextRight(
    page,
    `Generated ${data.summary.generatedAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })}`,
    width - 34,
    height - 80,
    8.5,
    regular,
    rgb(0.72, 0.75, 0.82),
  );
}

function drawSummaryPage(
  page: PDFPage,
  data: ReportData,
  bold: PDFFont,
  regular: PDFFont,
): void {
  const { width, height } = page.getSize();
  const margin = 32;

  drawHeader(page, data, bold, regular);

  let y = height - 142;
  drawSectionTitle(page, "Portfolio overview", margin, y, bold);
  y -= 82;

  const gap = 10;
  const cardWidth = (width - margin * 2 - gap * 2) / 3;
  const cards = [
    {
      label: "Portfolio value",
      value: formatMoney(
        data.summary.totalMarketValue,
        data.summary.currency,
      ),
      sub: `${data.summary.pricedHoldings} priced holding${
        data.summary.pricedHoldings === 1 ? "" : "s"
      }`,
      color: COLORS.blue,
    },
    {
      label: "Entered cost basis",
      value: formatMoney(
        data.summary.totalCostBasis,
        data.summary.currency,
      ),
      sub: "Based on user-entered purchase prices",
      color: COLORS.muted,
    },
    {
      label: "Unrealized P&L",
      value: `${data.summary.totalGainLoss >= 0 ? "+" : ""}${formatMoney(
        data.summary.totalGainLoss,
        data.summary.currency,
      )}`,
      sub: formatPercent(data.summary.totalGainLossPercent),
      color:
        data.summary.totalGainLoss >= 0 ? COLORS.green : COLORS.red,
    },
  ];

  cards.forEach((card, index) => {
    const x = margin + index * (cardWidth + gap);
    drawCard(page, x, y, cardWidth, 72);
    page.drawRectangle({
      x,
      y: y + 68,
      width: cardWidth,
      height: 4,
      color: card.color,
    });
    page.drawText(card.label.toUpperCase(), {
      x: x + 12,
      y: y + 49,
      size: 7.5,
      font: bold,
      color: COLORS.muted,
      characterSpacing: 0.4,
    });
    const valueSize =
      bold.widthOfTextAtSize(card.value, 14) > cardWidth - 24 ? 11 : 14;
    page.drawText(card.value, {
      x: x + 12,
      y: y + 28,
      size: valueSize,
      font: bold,
      color: COLORS.ink,
    });
    const subLines = splitText(card.sub, regular, 7.5, cardWidth - 24);
    page.drawText(subLines[0], {
      x: x + 12,
      y: y + 12,
      size: 7.5,
      font: regular,
      color: card.color,
    });
  });

  y -= 34;
  drawSectionTitle(page, "Monthly activity", margin, y, bold);
  y -= 72;

  const activityCards = [
    {
      label: "Purchases",
      value: formatMoney(data.summary.buysTotal, data.summary.currency),
      color: COLORS.green,
    },
    {
      label: "Sales",
      value: formatMoney(data.summary.sellsTotal, data.summary.currency),
      color: COLORS.red,
    },
    {
      label: "Net capital activity",
      value: `${data.summary.netCapitalActivity >= 0 ? "+" : ""}${formatMoney(
        data.summary.netCapitalActivity,
        data.summary.currency,
      )}`,
      color:
        data.summary.netCapitalActivity >= 0 ? COLORS.green : COLORS.red,
    },
    {
      label: "Transactions",
      value: String(data.summary.transactionCount),
      color: COLORS.blue,
    },
  ];

  const activityWidth = (width - margin * 2 - gap * 3) / 4;
  activityCards.forEach((card, index) => {
    const x = margin + index * (activityWidth + gap);
    drawCard(page, x, y, activityWidth, 58);
    page.drawText(card.label.toUpperCase(), {
      x: x + 10,
      y: y + 38,
      size: 6.8,
      font: bold,
      color: COLORS.muted,
      characterSpacing: 0.25,
    });
    const size =
      bold.widthOfTextAtSize(card.value, 11) > activityWidth - 20 ? 8.5 : 11;
    page.drawText(card.value, {
      x: x + 10,
      y: y + 17,
      size,
      font: bold,
      color: card.color,
    });
  });

  y -= 36;
  drawSectionTitle(page, "Portfolio allocation", margin, y, bold);
  y -= 18;

  const allocationHoldings = data.holdings
    .filter((holding) => holding.allocationPercent !== null)
    .slice(0, 7);

  if (!allocationHoldings.length) {
    page.drawText("Allocation unavailable because no holdings have a valid price.", {
      x: margin,
      y: y - 18,
      size: 9,
      font: regular,
      color: COLORS.muted,
    });
    y -= 48;
  } else {
    for (const holding of allocationHoldings) {
      page.drawText(holding.ticker, {
        x: margin,
        y,
        size: 9,
        font: bold,
        color: COLORS.ink,
      });

      const barX = margin + 58;
      const barWidth = width - margin * 2 - 118;
      page.drawRectangle({
        x: barX,
        y: y - 2,
        width: barWidth,
        height: 8,
        color: COLORS.soft,
      });
      page.drawRectangle({
        x: barX,
        y: y - 2,
        width:
          barWidth * Math.min(1, (holding.allocationPercent || 0) / 100),
        height: 8,
        color: COLORS.blue,
      });
      drawTextRight(
        page,
        `${(holding.allocationPercent || 0).toFixed(1)}%`,
        width - margin,
        y,
        8.5,
        bold,
        COLORS.ink,
      );
      y -= 22;
    }
  }

  y -= 8;
  drawSectionTitle(page, "Top performers", margin, y, bold);
  y -= 18;

  const performers = data.holdings
    .filter((holding) => holding.gainLoss !== null)
    .sort((a, b) => (b.gainLoss || 0) - (a.gainLoss || 0));

  const top = performers.slice(0, 3);
  const bottom = performers.slice(-3).reverse();
  const columnWidth = (width - margin * 2 - 16) / 2;

  const drawPerformerColumn = (
    title: string,
    rows: HoldingSummary[],
    x: number,
    positive: boolean,
  ) => {
    drawCard(page, x, y - 82, columnWidth, 96);
    page.drawText(title, {
      x: x + 12,
      y: y - 2,
      size: 9,
      font: bold,
      color: positive ? COLORS.green : COLORS.red,
    });

    rows.forEach((holding, index) => {
      const rowY = y - 25 - index * 20;
      page.drawText(holding.ticker, {
        x: x + 12,
        y: rowY,
        size: 8.5,
        font: bold,
        color: COLORS.ink,
      });
      drawTextRight(
        page,
        formatPercent(holding.gainLossPercent),
        x + columnWidth - 12,
        rowY,
        8.5,
        bold,
        (holding.gainLoss || 0) >= 0 ? COLORS.green : COLORS.red,
      );
    });
  };

  drawPerformerColumn("Largest gains", top, margin, true);
  drawPerformerColumn(
    "Largest declines",
    bottom,
    margin + columnWidth + 16,
    false,
  );

  const noteY = 42;
  page.drawText(
    "Performance uses live or recently stored market prices and the purchase prices entered by the user.",
    {
      x: margin,
      y: noteY,
      size: 7.5,
      font: regular,
      color: COLORS.muted,
    },
  );

  if (data.summary.missingPriceHoldings > 0) {
    page.drawText(
      `${data.summary.missingPriceHoldings} holding(s) were excluded from market-value totals because a valid price was unavailable.`,
      {
        x: margin,
        y: noteY - 12,
        size: 7.5,
        font: regular,
        color: COLORS.red,
      },
    );
  }
}

function drawHoldingsPages(
  pdf: PDFDocument,
  data: ReportData,
  bold: PDFFont,
  regular: PDFFont,
): void {
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 30;
  const columns = [
    { label: "Ticker", x: 38, width: 48 },
    { label: "Company", x: 88, width: 116 },
    { label: "Shares", x: 208, width: 50 },
    { label: "Avg cost", x: 262, width: 64 },
    { label: "Price", x: 330, width: 58 },
    { label: "Value", x: 392, width: 74 },
    { label: "P&L", x: 470, width: 94 },
  ];

  let page: PDFPage;
  let y: number;

  const startPage = () => {
    page = pdf.addPage(pageSize);
    const { height } = page.getSize();

    page.drawText("Current Holdings", {
      x: margin,
      y: height - 50,
      size: 20,
      font: bold,
      color: COLORS.ink,
    });
    page.drawText(
      `${data.summary.reportLabel} report · ${data.holdings.length} holding${
        data.holdings.length === 1 ? "" : "s"
      }`,
      {
        x: margin,
        y: height - 70,
        size: 9,
        font: regular,
        color: COLORS.muted,
      },
    );

    y = height - 104;
    page.drawRectangle({
      x: margin,
      y,
      width: page.getWidth() - margin * 2,
      height: 24,
      color: COLORS.ink,
    });

    for (const column of columns) {
      page.drawText(column.label, {
        x: column.x,
        y: y + 8,
        size: 7.5,
        font: bold,
        color: COLORS.white,
      });
    }

    y -= 29;
  };

  startPage();

  if (!data.holdings.length) {
    page!.drawText("No current holdings were found for this account.", {
      x: margin,
      y,
      size: 10,
      font: regular,
      color: COLORS.muted,
    });
    return;
  }

  data.holdings.forEach((holding, index) => {
    if (y < 66) {
      startPage();
    }

    if (index % 2 === 0) {
      page!.drawRectangle({
        x: margin,
        y: y - 8,
        width: page!.getWidth() - margin * 2,
        height: 31,
        color: COLORS.soft,
      });
    }

    const company =
      holding.companyName.length > 20
        ? `${holding.companyName.slice(0, 19)}…`
        : holding.companyName;

    const values = [
      holding.ticker,
      company,
      formatNumber(holding.quantity),
      formatMoney(holding.averageCost, data.summary.currency),
      holding.currentPrice === null
        ? "—"
        : formatMoney(holding.currentPrice, data.summary.currency),
      holding.marketValue === null
        ? "—"
        : formatMoney(holding.marketValue, data.summary.currency),
      holding.gainLoss === null
        ? "—"
        : `${holding.gainLoss >= 0 ? "+" : ""}${formatMoney(
            holding.gainLoss,
            data.summary.currency,
          )}`,
    ];

    values.forEach((value, columnIndex) => {
      const column = columns[columnIndex];
      const isTicker = columnIndex === 0;
      const isPnl = columnIndex === 6;
      let size = isTicker ? 8.5 : 7.6;
      while (
        size > 6.2 &&
        (isTicker ? bold : regular).widthOfTextAtSize(value, size) >
          column.width
      ) {
        size -= 0.2;
      }

      page!.drawText(value, {
        x: column.x,
        y: y + 2,
        size,
        font: isTicker || isPnl ? bold : regular,
        color: isPnl
          ? (holding.gainLoss || 0) >= 0
            ? COLORS.green
            : COLORS.red
          : COLORS.ink,
      });
    });

    if (holding.gainLossPercent !== null) {
      page!.drawText(formatPercent(holding.gainLossPercent), {
        x: columns[6].x,
        y: y - 8,
        size: 6.8,
        font: regular,
        color:
          holding.gainLossPercent >= 0 ? COLORS.green : COLORS.red,
      });
    }

    page!.drawLine({
      start: { x: margin, y: y - 10 },
      end: { x: page!.getWidth() - margin, y: y - 10 },
      thickness: 0.5,
      color: COLORS.line,
    });

    y -= 31;
  });
}

function drawTransactionPages(
  pdf: PDFDocument,
  data: ReportData,
  bold: PDFFont,
  regular: PDFFont,
): void {
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 32;
  let page: PDFPage;
  let y: number;

  const startPage = () => {
    page = pdf.addPage(pageSize);
    const { height } = page.getSize();

    page.drawText("Transaction History", {
      x: margin,
      y: height - 50,
      size: 20,
      font: bold,
      color: COLORS.ink,
    });
    page.drawText(
      `${data.summary.reportLabel} · ${data.transactions.length} transaction${
        data.transactions.length === 1 ? "" : "s"
      }`,
      {
        x: margin,
        y: height - 70,
        size: 9,
        font: regular,
        color: COLORS.muted,
      },
    );

    y = height - 104;
  };

  startPage();

  if (!data.transactions.length) {
    page!.drawText("No buy or sell transactions were recorded this month.", {
      x: margin,
      y,
      size: 10,
      font: regular,
      color: COLORS.muted,
    });
    return;
  }

  for (const transaction of data.transactions) {
    if (y < 74) {
      startPage();
    }

    const isBuy = transaction.type === "buy";
    const color = isBuy ? COLORS.green : COLORS.red;
    const soft = isBuy ? COLORS.greenSoft : COLORS.redSoft;

    drawCard(page!, margin + 18, y - 28, page!.getWidth() - 82, 44);
    page!.drawRectangle({
      x: margin + 18,
      y: y - 28,
      width: 4,
      height: 44,
      color,
    });
    page!.drawCircle({
      x: margin,
      y: y - 6,
      size: 5,
      color,
    });
    page!.drawLine({
      start: { x: margin, y: y + 18 },
      end: { x: margin, y: y - 34 },
      thickness: 1,
      color: COLORS.line,
    });

    page!.drawRectangle({
      x: margin + 30,
      y: y - 12,
      width: 30,
      height: 16,
      color: soft,
    });
    page!.drawText(isBuy ? "BUY" : "SELL", {
      x: margin + (isBuy ? 36 : 33),
      y: y - 7,
      size: 7,
      font: bold,
      color,
    });

    page!.drawText(transaction.ticker, {
      x: margin + 70,
      y: y - 3,
      size: 10,
      font: bold,
      color: COLORS.ink,
    });
    page!.drawText(
      `${formatNumber(transaction.quantity)} shares @ ${formatMoney(
        transaction.price,
        data.summary.currency,
      )}`,
      {
        x: margin + 70,
        y: y - 17,
        size: 8,
        font: regular,
        color: COLORS.muted,
      },
    );

    drawTextRight(
      page!,
      formatMoney(transaction.total, data.summary.currency),
      page!.getWidth() - margin - 10,
      y - 3,
      9,
      bold,
      COLORS.ink,
    );
    drawTextRight(
      page!,
      new Date(transaction.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
      page!.getWidth() - margin - 10,
      y - 17,
      7.5,
      regular,
      COLORS.muted,
    );

    y -= 56;
  }
}

async function generatePdf(data: ReportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];

  const summaryPage = pdf.addPage(pageSize);
  drawSummaryPage(summaryPage, data, bold, regular);
  drawHoldingsPages(pdf, data, bold, regular);
  drawTransactionPages(pdf, data, bold, regular);

  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const { width } = page.getSize();
    page.drawLine({
      start: { x: 30, y: 27 },
      end: { x: width - 30, y: 27 },
      thickness: 0.5,
      color: COLORS.line,
    });
    page.drawText(
      "StockPulse · Market prices may be delayed · Not financial advice",
      {
        x: 30,
        y: 14,
        size: 6.8,
        font: regular,
        color: COLORS.muted,
      },
    );
    drawTextRight(
      page,
      `Page ${index + 1} of ${pages.length}`,
      width - 30,
      14,
      6.8,
      regular,
      COLORS.muted,
    );
  });

  pdf.setTitle(`StockPulse ${data.summary.reportLabel} Portfolio Report`);
  pdf.setAuthor("StockPulse");
  pdf.setSubject("Portfolio performance and transaction report");
  pdf.setCreator("StockPulse Monthly Report Edge Function");

  return pdf.save({
    useObjectStreams: true,
  });
}

function getReportFileName(reportMonth: string): string {
  return `StockPulse-${reportMonth.slice(0, 7)}-Portfolio-Report.pdf`;
}

function getReportStoragePath(
  delivery: MonthlyReportDelivery,
): string {
  return `${delivery.user_id}/${delivery.report_month}/${delivery.id}.pdf`;
}

async function uploadReportPdf(
  service: SupabaseClient,
  delivery: MonthlyReportDelivery,
  pdfBytes: Uint8Array,
): Promise<{ storagePath: string; fileName: string }> {
  const storagePath = getReportStoragePath(delivery);
  const fileName = getReportFileName(delivery.report_month);

  const { error } = await service.storage
    .from(REPORT_BUCKET)
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return {
    storagePath,
    fileName,
  };
}

async function cleanupOldReports(
  service: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await service
    .from("monthly_report_deliveries")
    .select("id,storage_path,generated_at,created_at")
    .eq("user_id", userId)
    .eq("status", "ready")
    .not("storage_path", "is", null)
    .order("generated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Unable to load old report records:", error);
    return;
  }

  const oldReports = (data || []).slice(MAX_STORED_REPORTS_PER_USER);

  if (!oldReports.length) {
    return;
  }

  const paths = oldReports
    .map((report) => String(report.storage_path || ""))
    .filter(Boolean);

  if (paths.length) {
    const { error: storageError } = await service.storage
      .from(REPORT_BUCKET)
      .remove(paths);

    if (storageError) {
      console.warn("Unable to delete old report files:", storageError);
      return;
    }
  }

  const ids = oldReports.map((report) => report.id);
  const { error: deleteError } = await service
    .from("monthly_report_deliveries")
    .delete()
    .in("id", ids);

  if (deleteError) {
    console.warn("Unable to delete old report records:", deleteError);
  }
}

async function markDeliveryFailed(
  service: SupabaseClient,
  delivery: MonthlyReportDelivery,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message : "Unknown report generation error";
  const delayMinutes = Math.min(
    360,
    Math.max(15, Math.pow(Math.max(1, delivery.attempt_count), 2) * 15),
  );
  const nextAttempt = new Date(Date.now() + delayMinutes * 60_000);

  const { error: updateError } = await service
    .from("monthly_report_deliveries")
    .update({
      status: "failed",
      error_message: message.slice(0, 1500),
      failed_at: new Date().toISOString(),
      scheduled_for: nextAttempt.toISOString(),
      processing_started_at: null,
    })
    .eq("id", delivery.id);

  if (updateError) {
    console.error("Unable to mark delivery as failed:", updateError);
  }
}

async function processDelivery(
  service: SupabaseClient,
  delivery: MonthlyReportDelivery,
): Promise<{
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
}> {
  try {
    const data = await loadReportData(service, delivery);
    const pdfBytes = await generatePdf(data);
    const { storagePath, fileName } = await uploadReportPdf(
      service,
      delivery,
      pdfBytes,
    );
    const generatedAt = new Date().toISOString();

    const { error: deliveryError } = await service
      .from("monthly_report_deliveries")
      .update({
        status: "ready",
        storage_path: storagePath,
        file_name: fileName,
        file_size_bytes: pdfBytes.length,
        portfolio_value: data.summary.totalMarketValue,
        cost_basis: data.summary.totalCostBasis,
        gain_loss: data.summary.totalGainLoss,
        gain_loss_percent: data.summary.totalGainLossPercent,
        generated_at: generatedAt,
        error_message: null,
        failed_at: null,
        processing_started_at: null,
        metadata: {
          holdings_count: data.holdings.length,
          transactions_count: data.transactions.length,
          portfolio_value: data.summary.totalMarketValue,
          cost_basis: data.summary.totalCostBasis,
          gain_loss: data.summary.totalGainLoss,
          gain_loss_percent: data.summary.totalGainLossPercent,
          currency: data.summary.currency,
          pdf_bytes: pdfBytes.length,
          price_sources: {
            finnhub: data.holdings.filter(
              (holding) => holding.priceSource === "finnhub",
            ).length,
            stored: data.holdings.filter(
              (holding) => holding.priceSource === "stored",
            ).length,
            unavailable: data.holdings.filter(
              (holding) => holding.priceSource === "unavailable",
            ).length,
          },
        },
      })
      .eq("id", delivery.id);

    if (deliveryError) {
      await service.storage.from(REPORT_BUCKET).remove([storagePath]);
      throw deliveryError;
    }

    if (delivery.delivery_kind === "scheduled") {
      const { error: profileUpdateError } = await service
        .from("profiles")
        .update({
          monthly_report_last_generated_at: generatedAt,
        })
        .eq("id", delivery.user_id);

      if (profileUpdateError) {
        console.warn(
          "Report generated, but profile timestamp update failed:",
          profileUpdateError,
        );
      }
    }

    await cleanupOldReports(service, delivery.user_id);

    return {
      storagePath,
      fileName,
      fileSizeBytes: pdfBytes.length,
    };
  } catch (error) {
    await markDeliveryFailed(service, delivery, error);
    throw error;
  }
}

async function getDeliveryById(
  service: SupabaseClient,
  deliveryId: string,
): Promise<MonthlyReportDelivery> {
  const { data, error } = await service
    .from("monthly_report_deliveries")
    .select(
      "id,user_id,report_month,delivery_kind,status,recipient_email,report_currency,report_timezone,scheduled_for,attempt_count",
    )
    .eq("id", deliveryId)
    .single();

  if (error) {
    throw error;
  }

  return data as MonthlyReportDelivery;
}

async function handleManualRequest(
  req: Request,
  body: Record<string, unknown>,
  service: SupabaseClient,
): Promise<Response> {
  const authorization = req.headers.get("Authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const userClient = createUserClient(authorization);
  const { data: userData, error: userError } =
    await userClient.auth.getUser();

  if (userError || !userData.user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401);
  }

  const currency = normalizeCurrency(body.currency);
  const timezone = String(body.timezone || "UTC").trim() || "UTC";

  const { data: deliveryId, error: requestError } = await userClient.rpc(
    "request_monthly_report_now",
    {
      p_currency: currency,
      p_timezone: timezone,
    },
  );

  if (requestError) {
    return jsonResponse({ error: requestError.message }, 400);
  }

  const delivery = await getDeliveryById(service, String(deliveryId));

  if (delivery.user_id !== userData.user.id) {
    return jsonResponse({ error: "Report request ownership mismatch" }, 403);
  }

  const processingDelivery = {
    ...delivery,
    status: "processing" as const,
    attempt_count: Math.max(1, delivery.attempt_count + 1),
  };

  const { error: processingError } = await service
    .from("monthly_report_deliveries")
    .update({
      status: "processing",
      attempt_count: processingDelivery.attempt_count,
      processing_started_at: new Date().toISOString(),
      error_message: null,
      failed_at: null,
    })
    .eq("id", delivery.id)
    .eq("status", "pending");

  if (processingError) {
    throw processingError;
  }

  const result = await processDelivery(service, processingDelivery);

  return jsonResponse({
    ok: true,
    deliveryId: delivery.id,
    reportMonth: delivery.report_month,
    storagePath: result.storagePath,
    fileName: result.fileName,
    fileSizeBytes: result.fileSizeBytes,
  });
}

async function handleDeleteReport(
  req: Request,
  body: Record<string, unknown>,
  service: SupabaseClient,
): Promise<Response> {
  const authorization = req.headers.get("Authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const userClient = createUserClient(authorization);
  const { data: userData, error: userError } =
    await userClient.auth.getUser();

  if (userError || !userData.user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401);
  }

  const reportId = String(body.reportId || "").trim();

  if (!reportId) {
    return jsonResponse({ error: "Missing reportId" }, 400);
  }

  const { data: report, error: reportError } = await service
    .from("monthly_report_deliveries")
    .select("id,user_id,storage_path")
    .eq("id", reportId)
    .eq("user_id", userData.user.id)
    .single();

  if (reportError || !report) {
    return jsonResponse({ error: "Report not found" }, 404);
  }

  if (report.storage_path) {
    const { error: storageError } = await service.storage
      .from(REPORT_BUCKET)
      .remove([String(report.storage_path)]);

    if (storageError) {
      throw storageError;
    }
  }

  const { error: deleteError } = await service
    .from("monthly_report_deliveries")
    .delete()
    .eq("id", report.id)
    .eq("user_id", userData.user.id);

  if (deleteError) {
    throw deleteError;
  }

  return jsonResponse({
    ok: true,
    reportId,
  });
}

function hasValidCronSecret(req: Request): boolean {
  if (!MONTHLY_REPORT_CRON_SECRET) {
    return false;
  }

  const supplied = req.headers.get("x-cron-secret") || "";
  return supplied === MONTHLY_REPORT_CRON_SECRET;
}

async function handleWorker(
  req: Request,
  service: SupabaseClient,
): Promise<Response> {
  if (!hasValidCronSecret(req)) {
    return jsonResponse({ error: "Invalid worker secret" }, 401);
  }

  const reportMonth = startOfPreviousMonthUtc();
  const { data: queued, error: queueError } = await service.rpc(
    "queue_scheduled_monthly_reports",
    {
      p_report_month: reportMonth,
      p_daily_limit: SCHEDULED_DAILY_LIMIT,
    },
  );

  if (queueError) {
    throw queueError;
  }

  const { data: claimedData, error: claimError } = await service.rpc(
    "claim_next_monthly_report_delivery",
    {
      p_max_attempts: MAX_WORKER_ATTEMPTS,
    },
  );

  if (claimError) {
    throw claimError;
  }

  const claimed = Array.isArray(claimedData)
    ? claimedData[0]
    : claimedData;

  if (!claimed?.id) {
    return jsonResponse({
      ok: true,
      queued: numberOrZero(queued),
      processed: false,
      message: "No due monthly report deliveries",
    });
  }

  const delivery = claimed as MonthlyReportDelivery;
  const result = await processDelivery(service, delivery);

  return jsonResponse({
    ok: true,
    queued: numberOrZero(queued),
    processed: true,
    deliveryId: delivery.id,
    storagePath: result.storagePath,
    fileName: result.fileName,
  });
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: CORS_HEADERS,
      });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
      requireEnvironment();
      const body = (await req.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const action = String(body.action || "request").toLowerCase();
      const service = createServiceClient();

      if (action === "request") {
        return await handleManualRequest(req, body, service);
      }

      if (action === "worker") {
        return await handleWorker(req, service);
      }

      if (action === "delete") {
        return await handleDeleteReport(req, body, service);
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    } catch (error) {
      console.error("Monthly report function failed:", error);
      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "Monthly report function failed",
        },
        500,
      );
    }
  },
};
