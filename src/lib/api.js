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
