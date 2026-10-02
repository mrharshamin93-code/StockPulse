import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const XAI_API_KEY = Deno.env.get("XAI_API_KEY") || "";
const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTicker(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampSeconds(value: unknown): number | null {
  const numeric = finiteNumber(value);

  if (numeric !== null) {
    return numeric > 10_000_000_000
      ? Math.floor(numeric / 1000)
      : Math.floor(numeric);
  }

  const text = normalizeText(value);
  if (!text) return null;

  const parsed = Date.parse(text);
  return Number.isFinite(parsed)
    ? Math.floor(parsed / 1000)
    : null;
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const root = payload as Record<string, unknown>;
  const output = Array.isArray(root.output) ? root.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;
    if (record.type !== "message") continue;

    const content = Array.isArray(record.content)
      ? record.content
      : [];

    for (const block of content) {
      if (!block || typeof block !== "object") continue;

      const contentRecord = block as Record<string, unknown>;
      if (contentRecord.type === "output_text") {
        const text = normalizeText(contentRecord.text);
        if (text) return text;
      }
    }
  }

  return "";
}

function normalizeArticle(ticker: string, item: unknown) {
  const record =
    item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};

  const url = normalizeText(record.url);
  const title = normalizeText(record.title);

  if (!title || !/^https?:\/\//i.test(url)) {
    return null;
  }

  const date = normalizeText(record.date);

  return {
    ticker,
    title,
    headline: title,
    source: normalizeText(record.source),
    date,
    datetime: timestampSeconds(date),
    url,
    summary: normalizeText(record.summary),
    image: "",
  };
}

async function fetchGrokNews(ticker: string, limit: number) {
  if (!XAI_API_KEY) {
    throw new Error("Missing XAI_API_KEY.");
  }

  const boundedLimit = Math.min(Math.max(Math.floor(limit), 1), 10);

  const schema = {
    type: "object",
    properties: {
      articles: {
        type: "array",
        maxItems: boundedLimit,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            source: { type: "string" },
            date: { type: "string" },
            url: { type: "string" },
            summary: { type: "string" },
          },
          required: ["title", "source", "date", "url", "summary"],
          additionalProperties: false,
        },
      },
    },
    required: ["articles"],
    additionalProperties: false,
  };

  const prompt = [
    `Find the latest ${boundedLimit} legitimate news articles specifically about the CURRENT publicly traded company associated with U.S. ticker ${ticker}.`,
    "Use web search and verify that each article is actually about the current company represented by the ticker, not a former security that previously used the same ticker.",
    "Prefer established financial, business, technology, wire-service, newspaper, or company-news sources.",
    "Return only real article URLs discovered through web search. Do not invent URLs, publishers, dates, titles, or summaries.",
    "Use the publication date in YYYY-MM-DD format when available.",
    "Keep each summary to one short sentence.",
    "If fewer qualifying articles exist, return fewer. If none can be verified, return an empty articles array.",
  ].join(" ");

  const response = await fetch(XAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4.6",
      input: [
        {
          role: "user",
          content: prompt,
        },
      ],
      tools: [
        {
          type: "web_search",
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "stock_news_articles",
          schema,
          strict: true,
        },
      },
      max_output_tokens: 1800,
      store: false,
    }),
  });

  const responseText = await response.text();
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object"
        ? normalizeText(
            (payload as Record<string, unknown>).error ??
              (payload as Record<string, unknown>).message,
          )
        : normalizeText(payload);

    throw new Error(
      message || `xAI returned status ${response.status}.`,
    );
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    return {
      ticker,
      articles: [],
      news: [],
      provider: "grok-web-search",
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("xAI returned an unreadable structured news response.");
  }

  const root =
    parsed && typeof parsed === "object"
      ? parsed as Record<string, unknown>
      : {};

  const rawArticles = Array.isArray(root.articles)
    ? root.articles
    : [];

  const seen = new Set<string>();

  const articles = rawArticles
    .map((item) => normalizeArticle(ticker, item))
    .filter((item) => {
      if (!item) return false;

      const key = item.url.toLowerCase();
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .slice(0, boundedLimit);

  return {
    ticker,
    articles,
    news: articles,
    provider: "grok-web-search",
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS_HEADERS,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestBody =
      body && typeof body === "object"
        ? body as Record<string, unknown>
        : {};

    const ticker = normalizeTicker(requestBody.ticker);
    const limit = Math.floor(finiteNumber(requestBody.limit) ?? 10);

    if (!ticker) {
      return jsonResponse({ error: "Ticker is required." }, 400);
    }

    return jsonResponse(
      await fetchGrokNews(ticker, limit),
    );
  } catch (error) {
    console.error("Grok news Edge Function error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Grok news request failed.",
      },
      500,
    );
  }
});
