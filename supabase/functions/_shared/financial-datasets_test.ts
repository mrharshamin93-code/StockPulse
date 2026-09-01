import {
  fetchFinancialDatasetsQuote,
} from "./financial-datasets.ts";

function assertEquals(
  actual: unknown,
  expected: unknown,
  message: string,
) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${expected}, received ${actual}`,
    );
  }
}

Deno.test(
  "quote uses previous close when snapshot price is absent",
  async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            snapshot: {
              ticker: "AMC",
              previous_close: 1.42,
              time: "2026-09-01T20:00:00Z",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );

    try {
      const quote =
        await fetchFinancialDatasetsQuote(
          "amc",
          "test-key",
        );

      assertEquals(
        quote.ticker,
        "AMC",
        "ticker should be normalized",
      );

      assertEquals(
        quote.price,
        1.42,
        "previous close should populate price",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
