type ApnsConfiguration = {
  teamId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
};

export type ApnsDevice = {
  id: string;
  token: string;
  environment: "sandbox" | "production" | string;
};

export type ApnsMessage = {
  title: string;
  body: string;
  route: string;
  ticker: string;
  alertId: string;
};

export type ApnsResult = {
  device: ApnsDevice;
  ok: boolean;
  status: number;
  reason: string | null;
  shouldInvalidate: boolean;
};

let cachedProviderToken: { value: string; createdAt: number } | null = null;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToBytes(pem: string): Uint8Array {
  const normalized = pem.replaceAll("\\n", "\n");
  const body = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function configuration(): ApnsConfiguration | null {
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");
  if (!teamId || !keyId || !privateKey) return null;

  return {
    teamId,
    keyId,
    privateKey,
    bundleId: Deno.env.get("APNS_BUNDLE_ID") || "com.harshamin.stockpulse",
  };
}

async function providerToken(config: ApnsConfiguration): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedProviderToken && now - cachedProviderToken.createdAt < 3000) {
    return cachedProviderToken.value;
  }

  const header = encodeJson({ alg: "ES256", kid: config.keyId });
  const claims = encodeJson({ iss: config.teamId, iat: now });
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(config.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  const value = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  cachedProviderToken = { value, createdAt: now };
  return value;
}

export function isApnsConfigured(): boolean {
  return configuration() !== null;
}

export async function sendApnsNotification(
  device: ApnsDevice,
  message: ApnsMessage,
): Promise<ApnsResult> {
  const config = configuration();
  if (!config) {
    return { device, ok: false, status: 0, reason: "APNs is not configured", shouldInvalidate: false };
  }

  const host = device.environment === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
  const response = await fetch(`${host}/3/device/${encodeURIComponent(device.token)}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await providerToken(config)}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: message.title, body: message.body },
        sound: "default",
        "thread-id": message.ticker,
      },
      route: message.route,
      ticker: message.ticker,
      type: "price_alert",
      alert_id: message.alertId,
    }),
  });

  let reason: string | null = null;
  if (!response.ok) {
    try {
      reason = String((await response.json())?.reason || `APNs HTTP ${response.status}`);
    } catch {
      reason = `APNs HTTP ${response.status}`;
    }
  }

  return {
    device,
    ok: response.ok,
    status: response.status,
    reason,
    shouldInvalidate: response.status === 410 || reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic",
  };
}
