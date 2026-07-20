const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const nullableNumber = {
  type: ["number", "null"],
};

const stockProperties = {
  ticker: {
    type: "string",
  },
  name: {
    type: "string",
  },
  exchange: {
    type: "string",
  },
  sector: {
    type: ["string", "null"],
  },

  price: nullableNumber,
  changePercent: nullableNumber,
  week52Change: nullableNumber,

  pe: nullableNumber,
  forwardPe: nullableNumber,
  peg: nullableNumber,
  pb: nullableNumber,
  ps: nullableNumber,
  evEbitda: nullableNumber,
  pcf: nullableNumber,
  pfcf: nullableNumber,

  grossMargin: nullableNumber,
  operatingMargin: nullableNumber,
  netMargin: nullableNumber,
  roe: nullableNumber,
  roa: nullableNumber,
  roic: nullableNumber,

  revenueGrowth: nullableNumber,
  epsGrowth: nullableNumber,
  ebitdaGrowth: nullableNumber,
  fcfGrowth: nullableNumber,

  deRatio: nullableNumber,
  currentRatio: nullableNumber,
  quickRatio: nullableNumber,
  interestCoverage: nullableNumber,
  debtEbitda: nullableNumber,

  assetTurnover: nullableNumber,
  inventoryTurnover: nullableNumber,
  receivablesTurnover: nullableNumber,
  dso: nullableNumber,

  dividendYield: nullableNumber,
  payoutRatio: nullableNumber,
  dividendGrowth: nullableNumber,

  marketCapB: nullableNumber,
  eps: nullableNumber,
  bookValuePerShare: nullableNumber,
  fcfPerShare: nullableNumber,
};

const screenerSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    stocks: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: stockProperties,
        required: Object.keys(stockProperties),
      },
    },
  },
  required: ["stocks"],
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
        "Content-Type": "application/json",
      },
    },
  );
}

function extractOutputText(
  payload: Record<string, unknown>,
) {
  if (
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output)
    ? payload.output
    : [];

  for (const item of output) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    const contentValue = (
      item as {
        content?: unknown;
      }
    ).content;

    const content = Array.isArray(contentValue)
      ? contentValue
      : [];

    for (const part of content) {
      if (
        !part ||
        typeof part !== "object"
      ) {
        continue;
      }

      const typedPart = part as {
        type?: string;
        text?: unknown;
      };

      if (
        typedPart.type === "output_text" &&
        typeof typedPart.text === "string"
      ) {
        return typedPart.text;
      }
    }
  }

  return "";
}

function sanitizeFilters(
  value: unknown,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result: Record<
    string,
    string | number
  > = {};

  for (
    const [key, rawValue] of Object.entries(value)
  ) {
    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();

      if (trimmed) {
        result[key] = trimmed.slice(0, 100);
      }

      continue;
    }

    if (
      typeof rawValue === "number" &&
      Number.isFinite(rawValue)
    ) {
      result[key] = rawValue;
    }
  }

  return result;
}

function normalizeStock(
  stock: Record<string, unknown>,
) {
  return {
    ...stock,

    ticker: String(
      stock.ticker || "",
    )
      .trim()
      .toUpperCase(),

    name: String(
      stock.name || "",
    ).trim(),

    exchange: String(
      stock.exchange || "",
    )
      .trim()
      .toUpperCase(),

    sector:
      stock.sector === null
        ? null
        : String(
            stock.sector || "",
          ).trim(),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed",
      },
      405,
    );
  }

  const authorization =
    request.headers.get("Authorization");

  if (
    !authorization?.startsWith("Bearer ")
  ) {
    return jsonResponse(
      {
        error: "Authentication required",
      },
      401,
    );
  }

  const apiKey =
    Deno.env.get("XAI_API_KEY");

  if (!apiKey) {
    return jsonResponse(
      {
        error:
          "The stock screener model is not configured",
      },
      503,
    );
  }

  try {
    const requestBody =
      await request.json();

    const filters =
      sanitizeFilters(
        requestBody?.filters,
      );

    const filtersText =
      Object.keys(filters).length > 0
        ? JSON.stringify(
            filters,
            null,
            2,
          )
        : "No filters were selected.";

    const response = await fetch(
      "https://api.x.ai/v1/responses",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model:
            Deno.env.get("XAI_MODEL") ||
            "grok-4.3",

          reasoning: {
            effort: "none",
          },

          store: false,

          max_output_tokens: 10000,

          input: [
            {
              role: "system",

              content:
                "You are a careful fundamental stock screener. " +
                "Return only real, currently publicly traded US-listed common stocks. " +
                "Do not invent ticker symbols or companies. " +
                "Apply the user's numerical minimum and maximum filters as closely as possible. " +
                "Financial figures may be approximate because this response is model-generated. " +
                "Use null when a metric cannot be determined. " +
                "All percentages must be returned as percentage numbers, not decimal fractions. " +
                "Market capitalization must be returned in billions of US dollars.",
            },
            {
              role: "user",

              content:
                "Return up to 12 real US-listed stocks matching these filters:\n\n" +
                filtersText +
                "\n\nReturn every required field for every stock. " +
                "Use NASDAQ, NYSE, or AMEX for exchange. " +
                "Do not include ETFs, funds, preferred shares, warrants, OTC securities, " +
                "cryptocurrencies, private companies, or duplicate tickers.",
            },
          ],

          text: {
            format: {
              type: "json_schema",
              name: "stock_screener_results",
              strict: true,
              schema: screenerSchema,
            },
          },
        }),
      },
    );

    const payload =
      await response.json();

    if (!response.ok) {
      console.error(
        "xAI stock screener response error:",
        response.status,
        payload?.error,
      );

      return jsonResponse(
        {
          error:
            "Unable to generate stock screener results",
        },
        502,
      );
    }

    const outputText =
      extractOutputText(payload);

    if (!outputText) {
      return jsonResponse(
        {
          error:
            "The stock screener model returned no results",
        },
        502,
      );
    }

    const parsed =
      JSON.parse(outputText);

    const rawStocks =
      Array.isArray(parsed?.stocks)
        ? parsed.stocks
        : [];

    const seenTickers =
      new Set<string>();

    const stocks = rawStocks
      .filter(
        (stock: unknown) =>
          stock &&
          typeof stock === "object",
      )
      .map(
        (
          stock: Record<string, unknown>,
        ) => normalizeStock(stock),
      )
      .filter(
        (
          stock: {
            ticker: string;
          },
        ) => {
          if (
            !/^[A-Z][A-Z0-9.-]{0,9}$/.test(
              stock.ticker,
            )
          ) {
            return false;
          }

          if (
            seenTickers.has(stock.ticker)
          ) {
            return false;
          }

          seenTickers.add(stock.ticker);

          return true;
        },
      )
      .slice(0, 12);

    return jsonResponse({
      stocks,
    });
  } catch (error) {
    console.error(
      "stock-screener error:",
      error,
    );

    return jsonResponse(
      {
        error:
          "Unable to generate stock screener results",
      },
      500,
    );
  }
});
