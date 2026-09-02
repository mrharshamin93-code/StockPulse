const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FINANCIAL_DATASETS_API_BASE =
  "https://api.financialdatasets.ai";

const XAI_RESPONSES_URL =
  "https://api.x.ai/v1/responses";

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    company_name: { type: "string" },
    valid: { type: "boolean" },
    pros: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    cons: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    summary: { type: "string" },
  },
  required: [
    "company_name",
    "valid",
    "pros",
    "cons",
    "summary",
  ],
};

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}

function normalizeTicker(
  value: unknown,
) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function normalizeText(
  value: unknown,
) {
  return String(value ?? "")
    .trim();
}

function extractOutputText(
  payload: Record<string, unknown>,
) {
  const output =
    Array.isArray(payload.output)
      ? payload.output
      : [];

  for (const item of output) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    const content =
      Array.isArray(
        (
          item as {
            content?: unknown[];
          }
        ).content,
      )
        ? (
            item as {
              content: unknown[];
            }
          ).content
        : [];

    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (
          part as {
            type?: string;
          }
        ).type === "output_text" &&
        typeof (
          part as {
            text?: unknown;
          }
        ).text === "string"
      ) {
        return (
          part as {
            text: string;
          }
        ).text;
      }
    }
  }

  return "";
}

async function fetchFinancialDatasets(
  path: string,
  ticker: string,
  apiKey: string,
) {
  const url =
    new URL(
      `${FINANCIAL_DATASETS_API_BASE}${path}`,
    );

  url.searchParams.set(
    "ticker",
    ticker,
  );

  const response =
    await fetch(
      url.toString(),
      {
        headers: {
          Accept:
            "application/json",
          "X-API-KEY":
            apiKey,
        },
      },
    );

  const text =
    await response.text();

  let payload:
    unknown = null;

  try {
    payload =
      text
        ? JSON.parse(text)
        : null;
  } catch {
    payload = text;
  }

  return {
    ok:
      response.ok,
    status:
      response.status,
    payload,
  };
}

function compactMetrics(
  payload: unknown,
) {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  const root =
    payload as Record<
      string,
      unknown
    >;

  const snapshot =
    root.snapshot &&
    typeof root.snapshot ===
      "object"
      ? root.snapshot as Record<
          string,
          unknown
        >
      : root;

  const keys = [
    "ticker",
    "currency",
    "market_cap",
    "enterprise_value",
    "price_to_book_ratio",
    "price_to_earnings_ratio",
    "price_to_sales_ratio",
    "enterprise_value_to_ebitda_ratio",
    "enterprise_value_to_revenue_ratio",
    "free_cash_flow_yield",
    "peg_ratio",
    "gross_margin",
    "operating_margin",
    "net_margin",
    "return_on_equity",
    "return_on_assets",
    "return_on_invested_capital",
    "asset_turnover",
    "current_ratio",
    "quick_ratio",
    "cash_ratio",
    "operating_cash_flow_ratio",
    "debt_to_equity",
    "debt_to_assets",
    "interest_coverage",
    "revenue_growth",
    "earnings_growth",
    "book_value_growth",
    "earnings_per_share_growth",
    "free_cash_flow_growth",
    "operating_income_growth",
    "ebitda_growth",
    "payout_ratio",
    "earnings_per_share",
    "book_value_per_share",
    "free_cash_flow_per_share",
  ];

  const compact:
    Record<string, unknown> =
      {};

  for (const key of keys) {
    if (
      snapshot[key] !==
        undefined &&
      snapshot[key] !==
        null
    ) {
      compact[key] =
        snapshot[key];
    }
  }

  return compact;
}

function compactQuote(
  payload: unknown,
) {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  const root =
    payload as Record<
      string,
      unknown
    >;

  const snapshot =
    root.snapshot &&
    typeof root.snapshot ===
      "object"
      ? root.snapshot as Record<
          string,
          unknown
        >
      : root;

  const keys = [
    "ticker",
    "price",
    "close",
    "current_price",
    "day_change",
    "change",
    "change_amount",
    "day_change_percent",
    "change_percent",
    "previous_close",
    "open",
    "high",
    "low",
    "volume",
    "time",
    "time_milliseconds",
    "date",
  ];

  const compact:
    Record<string, unknown> =
      {};

  for (const key of keys) {
    if (
      snapshot[key] !==
        undefined &&
      snapshot[key] !==
        null
    ) {
      compact[key] =
        snapshot[key];
    }
  }

  return compact;
}

Deno.serve(
  async (request) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          error:
            "Method not allowed",
        },
        405,
      );
    }

    const authorization =
      request.headers.get(
        "Authorization",
      );

    if (
      !authorization
        ?.startsWith(
          "Bearer ",
        )
    ) {
      return jsonResponse(
        {
          error:
            "Authentication required",
        },
        401,
      );
    }

    const xaiApiKey =
      Deno.env.get(
        "XAI_API_KEY",
      );

    const financialDatasetsApiKey =
      Deno.env.get(
        "FINANCIAL_DATASETS_API_KEY",
      );

    if (!xaiApiKey) {
      return jsonResponse(
        {
          error:
            "The stock analysis model is not configured",
        },
        503,
      );
    }

    if (
      !financialDatasetsApiKey
    ) {
      return jsonResponse(
        {
          error:
            "Financial Datasets is not configured",
        },
        503,
      );
    }

    try {
      const body =
        await request
          .json()
          .catch(
            () => ({}),
          );

      const ticker =
        normalizeTicker(
          body?.ticker,
        );

      const requestedCompanyName =
        normalizeText(
          body?.company_name,
        ) ||
        ticker;

      if (
        !/^[A-Z][A-Z0-9.-]{0,9}$/.test(
          ticker,
        )
      ) {
        return jsonResponse(
          {
            error:
              "Invalid ticker",
          },
          400,
        );
      }

      /*
       * Financial Datasets is the authoritative source for
       * numeric stock data in the analysis. We intentionally
       * do not fetch cached StockPulse news here; Grok may use
       * its own web search for recent qualitative developments.
       */
      const [
        metricsResult,
        quoteResult,
      ] =
        await Promise.all([
          fetchFinancialDatasets(
            "/financial-metrics/snapshot",
            ticker,
            financialDatasetsApiKey,
          ),
          fetchFinancialDatasets(
            "/prices/snapshot",
            ticker,
            financialDatasetsApiKey,
          ),
        ]);

      const metrics =
        metricsResult.ok
          ? compactMetrics(
              metricsResult.payload,
            )
          : null;

      const quote =
        quoteResult.ok
          ? compactQuote(
              quoteResult.payload,
            )
          : null;

      const providerRecognized =
        Boolean(
          metrics ||
          quote,
        );

      if (
        !providerRecognized &&
        metricsResult.status ===
          404 &&
        quoteResult.status ===
          404
      ) {
        return jsonResponse({
          company_name:
            requestedCompanyName,
          valid: false,
          pros: [],
          cons: [],
          summary: "",
        });
      }

      if (
        !providerRecognized
      ) {
        console.error(
          "Financial Datasets analysis grounding failed",
          {
            ticker,
            metricsStatus:
              metricsResult.status,
            quoteStatus:
              quoteResult.status,
          },
        );

        return jsonResponse(
          {
            error:
              "Verified financial data is temporarily unavailable",
          },
          502,
        );
      }

      const grounding = {
        ticker,
        company_name:
          requestedCompanyName,
        quote,
        financial_metrics:
          metrics,
      };

      const response =
        await fetch(
          XAI_RESPONSES_URL,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${xaiApiKey}`,
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                model:
                  Deno.env.get(
                    "XAI_MODEL",
                  ) ||
                  "grok-4.6",
                reasoning: {
                  effort:
                    "none",
                },
                store: false,
                max_output_tokens:
                  1800,
                max_turns: 3,
                tools: [
                  {
                    type:
                      "web_search",
                  },
                ],
                input: [
                  {
                    role:
                      "system",
                    content:
                      "You are a cautious equity research assistant for StockPulse. " +
                      "Financial Datasets is the authoritative source for all numeric " +
                      "market and financial figures supplied in the prompt. Do not " +
                      "replace those supplied figures with numbers found on the web. " +
                      "Use web search for recent company developments, earnings context, " +
                      "business developments, risks, and news that help interpret the " +
                      "verified data. Prefer primary company releases, SEC materials, " +
                      "and reputable financial reporting. Clearly describe uncertainty, " +
                      "never promise returns, and do not give personalized financial advice.",
                  },
                  {
                    role:
                      "user",
                    content:
                      `Analyze ${requestedCompanyName} (${ticker}).\n\n` +
                      "VERIFIED FINANCIAL DATA FROM FINANCIAL DATASETS:\n" +
                      `${JSON.stringify(grounding)}\n\n` +
                      "Use the supplied Financial Datasets figures for every numeric " +
                      "valuation, profitability, growth, balance-sheet, cash-flow, and " +
                      "price claim. You may independently search the web for recent news " +
                      "and qualitative developments; do not rely on StockPulse's cached news. " +
                      "Return 4-6 concise bullish arguments, 4-6 concise bearish risks, a " +
                      "2-3 sentence balanced summary, the recognized company name, and " +
                      "whether this appears to be a valid publicly traded stock. When a " +
                      "specific numeric fact is not present in the supplied data, do not invent it.",
                  },
                ],
                text: {
                  format: {
                    type:
                      "json_schema",
                    name:
                      "stock_analysis",
                    strict: true,
                    schema:
                      analysisSchema,
                  },
                },
              }),
          },
        );

      const payload =
        await response.json();

      if (!response.ok) {
        console.error(
          "xAI response error",
          response.status,
          payload?.error,
        );

        return jsonResponse(
          {
            error:
              "Unable to generate stock analysis",
          },
          502,
        );
      }

      const outputText =
        extractOutputText(
          payload,
        );

      if (!outputText) {
        return jsonResponse(
          {
            error:
              "The analysis model returned no result",
          },
          502,
        );
      }

      const parsed =
        JSON.parse(
          outputText,
        );

      return jsonResponse(
        parsed,
      );
    } catch (error) {
      console.error(
        "stock-analysis error",
        error,
      );

      return jsonResponse(
        {
          error:
            "Unable to generate stock analysis",
        },
        500,
      );
    }
  },
);
