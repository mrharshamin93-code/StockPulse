import { Capacitor } from "@capacitor/core";

const PRODUCTION_WEB_ORIGIN =
  "https://stock-pulse-rouge.vercel.app";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function getApiUrl(path) {
  const normalizedPath =
    String(path || "").startsWith("/")
      ? String(path)
      : `/${String(path || "")}`;

  if (isNativeApp()) {
    return `${PRODUCTION_WEB_ORIGIN}${normalizedPath}`;
  }

  return normalizedPath;
}

export function getFinnhubApiUrl(
  searchParams = "",
) {
  const query =
    searchParams instanceof URLSearchParams
      ? searchParams.toString()
      : String(
          searchParams || "",
        ).replace(/^\?/, "");

  const baseUrl =
    getApiUrl(
      "/api/finnhub",
    );

  return query
    ? `${baseUrl}?${query}`
    : baseUrl;
}

/*
 * Existing StockPulse pages were originally
 * written for Vercel and use requests such as:
 *
 *   fetch("/api/finnhub")
 *
 * That works on the website because /api resolves
 * against the Vercel domain.
 *
 * Inside Capacitor, however, the WebView has a
 * local app origin. This bridge rewrites only
 * StockPulse /api requests to the production
 * Vercel backend while leaving every other fetch
 * request untouched.
 */
let nativeFetchBridgeInstalled =
  false;

export function installNativeApiFetchBridge() {
  if (
    !isNativeApp() ||
    nativeFetchBridgeInstalled
  ) {
    return;
  }

  if (
    typeof window === "undefined" ||
    typeof window.fetch !== "function"
  ) {
    return;
  }

  const originalFetch =
    window.fetch.bind(window);

  window.fetch = (
    input,
    init,
  ) => {
    let nextInput =
      input;

    /*
     * fetch("/api/...")
     */
    if (
      typeof input === "string" &&
      input.startsWith("/api/")
    ) {
      nextInput =
        `${PRODUCTION_WEB_ORIGIN}${input}`;
    }

    /*
     * fetch(new URL(...)) or fetch(new Request(...))
     */
    else if (
      input instanceof URL &&
      input.pathname.startsWith(
        "/api/",
      )
    ) {
      nextInput =
        new URL(
          `${input.pathname}${input.search}${input.hash}`,
          PRODUCTION_WEB_ORIGIN,
        );
    }

    else if (
      typeof Request !==
        "undefined" &&
      input instanceof Request
    ) {
      try {
        const requestUrl =
          new URL(input.url);

        const localOrigins =
          new Set([
            "capacitor://localhost",
            "http://localhost",
            "https://localhost",
          ]);

        if (
          requestUrl.pathname.startsWith(
            "/api/",
          ) &&
          localOrigins.has(
            requestUrl.origin,
          )
        ) {
          const rewrittenUrl =
            `${PRODUCTION_WEB_ORIGIN}${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`;

          nextInput =
            new Request(
              rewrittenUrl,
              input,
            );
        }
      } catch {
        /*
         * Leave unknown Request objects unchanged.
         */
      }
    }

    return originalFetch(
      nextInput,
      init,
    );
  };

  nativeFetchBridgeInstalled =
    true;
}
