const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  required: ["company_name", "valid", "pros", "cons", "summary"],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractOutputText(payload: Record<string, unknown>) {
  const output = Array.isArray(payload.output) ? payload.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;

    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];

    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "output_text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }

  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const apiKey = Deno.env.get("XAI_API_KEY");

  if (!apiKey) {
    return jsonResponse(
      { error: "The stock analysis model is not configured" },
      503,
    );
  }

  try {
    const body = await request.json();
    const ticker = String(body?.ticker || "").trim().toUpperCase();
    const companyName = String(body?.company_name || ticker).trim();

    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) {
      return jsonResponse({ error: "Invalid ticker" }, 400);
    }

    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("XAI_MODEL") || "grok-4.3",
        reasoning: { effort: "none" },
        store: false,
        max_output_tokens: 1800,
        input: [
          {
            role: "system",
            content:
              "You are a cautious equity research assistant. Use specific, " +
              "verifiable business and market facts when possible. Clearly " +
              "describe uncertainty, never promise returns, and do not give " +
              "personalized financial advice.",
          },
          {
            role: "user",
            content:
              `Analyze ${companyName} (${ticker}). Return 4-6 concise bullish ` +
              "arguments, 4-6 concise bearish risks, a 2-3 sentence balanced " +
              "summary, the recognized company name, and whether the ticker " +
              "appears to be a valid publicly traded stock.",
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "stock_analysis",
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      console.error("xAI response error", response.status, payload?.error);
      return jsonResponse({ error: "Unable to generate stock analysis" }, 502);
    }

    const outputText = extractOutputText(payload);

    if (!outputText) {
      return jsonResponse({ error: "The analysis model returned no result" }, 502);
    }

    return jsonResponse(JSON.parse(outputText));
  } catch (error) {
    console.error("stock-analysis error", error);
    return jsonResponse({ error: "Unable to generate stock analysis" }, 500);
  }
});
