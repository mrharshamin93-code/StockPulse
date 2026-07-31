import type {
  SupabaseClient,
} from "npm:@supabase/supabase-js@2";

import {
  getCachedMarketData,
  quoteFreshMs,
} from "./market-data-cache.ts";

type FakeRow = {
  cache_key: string;
  payload: unknown;
  fetched_at: string | null;
  expires_at: string | null;
  stale_until: string | null;
  retry_after: string | null;
  provider_error: string | null;
};

type FakeState = {
  row: FakeRow | null;
  locked: boolean;
  allowRequest: boolean;
  reservations: number;
  completions: number;
  retrySeconds: number | null;
};

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

function fakeClient(
  state: FakeState,
): SupabaseClient {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: state.row,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },

    async rpc(
      name: string,
      parameters: Record<string, unknown>,
    ) {
      if (name === "claim_market_data_refresh") {
        if (state.locked) return { data: false, error: null };
        state.locked = true;
        state.row ??= {
          cache_key: String(parameters.p_cache_key),
          payload: null,
          fetched_at: null,
          expires_at: null,
          stale_until: null,
          retry_after: null,
          provider_error: null,
        };
        return { data: true, error: null };
      }

      if (name === "reserve_provider_request") {
        state.reservations += 1;
        return {
          data: state.allowRequest,
          error: null,
        };
      }

      if (name === "complete_market_data_refresh") {
        state.completions += 1;
        state.locked = false;
        const now = Date.now();
        state.row = {
          cache_key: String(parameters.p_cache_key),
          payload: parameters.p_payload,
          fetched_at: new Date(now).toISOString(),
          expires_at: new Date(
            now + Number(parameters.p_fresh_seconds) * 1000,
          ).toISOString(),
          stale_until: new Date(
            now + Number(parameters.p_stale_seconds) * 1000,
          ).toISOString(),
          retry_after: null,
          provider_error: null,
        };
        return { data: null, error: null };
      }

      if (name === "fail_market_data_refresh") {
        state.locked = false;
        state.retrySeconds = Number(parameters.p_retry_seconds);
        if (state.row) {
          state.row.provider_error = String(parameters.p_error);
          state.row.retry_after = new Date(
            Date.now() + state.retrySeconds * 1000,
          ).toISOString();
        }
        return { data: null, error: null };
      }

      if (name === "record_provider_request_result") {
        return { data: null, error: null };
      }

      throw new Error(`Unexpected RPC: ${name}`);
    },
  } as unknown as SupabaseClient;
}

function newState(
  row: FakeRow | null = null,
): FakeState {
  return {
    row,
    locked: false,
    allowRequest: true,
    reservations: 0,
    completions: 0,
    retrySeconds: null,
  };
}

function cacheOptions(
  client: SupabaseClient,
  fetcher: () => Promise<{ price: number }>,
) {
  return {
    client,
    key: "quote:AAPL",
    dataType: "quote",
    ticker: "AAPL",
    freshMs: 5 * 60 * 1000,
    staleMs: 24 * 60 * 60 * 1000,
    endpoint: "/prices/snapshot",
    fetcher,
  };
}

Deno.test("quote freshness is five minutes during regular market hours", () => {
  const marketHours = new Date("2026-07-31T14:00:00.000Z");
  const afterHours = new Date("2026-07-31T22:00:00.000Z");
  const weekend = new Date("2026-08-01T14:00:00.000Z");

  assert(quoteFreshMs(marketHours) === 300_000, "market-hours TTL must be five minutes");
  assert(quoteFreshMs(afterHours) === 3_600_000, "after-hours TTL must be one hour");
  assert(quoteFreshMs(weekend) === 3_600_000, "weekend TTL must be one hour");
});

Deno.test("fresh shared cache entries do not reserve provider requests", async () => {
  const now = Date.now();
  const state = newState({
    cache_key: "quote:AAPL",
    payload: { price: 200 },
    fetched_at: new Date(now - 10_000).toISOString(),
    expires_at: new Date(now + 60_000).toISOString(),
    stale_until: new Date(now + 3_600_000).toISOString(),
    retry_after: null,
    provider_error: null,
  });
  let fetches = 0;
  const result = await getCachedMarketData(
    cacheOptions(fakeClient(state), async () => {
      fetches += 1;
      return { price: 201 };
    }),
  );

  assert(result.cache.status === "hit", "fresh result must be a cache hit");
  assert(result.data.price === 200, "fresh cached payload must be returned");
  assert(fetches === 0, "provider must not be called for a fresh hit");
  assert(state.reservations === 0, "quota must not be reserved for a fresh hit");
});

Deno.test("concurrent cache misses produce one provider request", async () => {
  const state = newState();
  const client = fakeClient(state);
  let fetches = 0;
  const fetcher = async () => {
    fetches += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return { price: 202 };
  };

  const [first, second] = await Promise.all([
    getCachedMarketData(cacheOptions(client, fetcher)),
    getCachedMarketData(cacheOptions(client, fetcher)),
  ]);

  assert(fetches === 1, "concurrent misses must be deduplicated");
  assert(state.reservations === 1, "only one provider request may reserve quota");
  assert(state.completions === 1, "only one refresh may complete");
  assert(first.data.price === 202 && second.data.price === 202, "both callers must receive data");
});

Deno.test("quota protection serves stale data without calling the provider", async () => {
  const now = Date.now();
  const state = newState({
    cache_key: "quote:AAPL",
    payload: { price: 199 },
    fetched_at: new Date(now - 600_000).toISOString(),
    expires_at: new Date(now - 300_000).toISOString(),
    stale_until: new Date(now + 3_600_000).toISOString(),
    retry_after: null,
    provider_error: null,
  });
  state.allowRequest = false;
  let fetches = 0;

  const result = await getCachedMarketData(
    cacheOptions(fakeClient(state), async () => {
      fetches += 1;
      return { price: 203 };
    }),
  );

  assert(result.cache.status === "stale-quota", "quota fallback must be identified");
  assert(result.data.price === 199, "stale data must be preserved");
  assert(fetches === 0, "provider must not be called after the quota gate closes");
});

Deno.test("provider payment errors use a one-hour retry backoff", async () => {
  const now = Date.now();
  const state = newState({
    cache_key: "quote:AAPL",
    payload: { price: 199 },
    fetched_at: new Date(now - 600_000).toISOString(),
    expires_at: new Date(now - 300_000).toISOString(),
    stale_until: new Date(now + 3_600_000).toISOString(),
    retry_after: null,
    provider_error: null,
  });

  const result = await getCachedMarketData(
    cacheOptions(fakeClient(state), async () => {
      throw Object.assign(
        new Error("Financial Datasets requires API credits."),
        { status: 402 },
      );
    }),
  );

  assert(result.cache.status === "stale-error", "stale data must survive provider errors");
  assert(state.retrySeconds === 3_600, "payment errors must back off for one hour");
});
