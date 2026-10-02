import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "npm:reflect-metadata";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import {
  BasicConstraintsExtension,
  X509Certificate,
} from "npm:@peculiar/x509@2.1.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUNDLE_ID = "com.harshamin.stockpulse";
const PRODUCT_ID = "com.harshamin.stockpulse.pro.monthly";

const APPLE_TRANSACTION_OID = "1.2.840.113635.100.6.11.1";
const APPLE_INTERMEDIATE_OID = "1.2.840.113635.100.6.2.1";

const ROOT_CERT_URLS = [
  "https://www.apple.com/appleca/AppleIncRootCertificate.cer",
  "https://www.apple.com/certificateauthority/AppleRootCA-G2.cer",
  "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer",
];

let rootsPromise: Promise<X509Certificate[]> | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function base64UrlBytes(value: string): Uint8Array {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJsonPart(value: string): Record<string, any> {
  return JSON.parse(
    new TextDecoder().decode(base64UrlBytes(value)),
  );
}

function validAt(cert: X509Certificate, date: Date): boolean {
  const time = date.getTime();
  return (
    Number.isFinite(time) &&
    cert.notBefore.getTime() <= time &&
    cert.notAfter.getTime() >= time
  );
}

async function trustedRoots(): Promise<X509Certificate[]> {
  if (!rootsPromise) {
    rootsPromise = Promise.all(
      ROOT_CERT_URLS.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Unable to load Apple root certificate: ${response.status}`,
          );
        }
        return new X509Certificate(
          new Uint8Array(await response.arrayBuffer()),
        );
      }),
    ).catch((error) => {
      rootsPromise = null;
      throw error;
    });
  }

  return rootsPromise;
}

async function verifyAppleTransactionJws(
  jws: string,
): Promise<Record<string, any>> {
  const parts = jws.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid StoreKit JWS.");
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJsonPart(headerPart);
  const payload = decodeJsonPart(payloadPart);

  if (header?.alg !== "ES256") {
    throw new Error("Unexpected StoreKit signing algorithm.");
  }

  const chain = Array.isArray(header?.x5c) ? header.x5c : [];
  if (chain.length !== 3) {
    throw new Error("Invalid Apple certificate chain.");
  }

  const leaf = new X509Certificate(String(chain[0]));
  const intermediate = new X509Certificate(String(chain[1]));

  const signedDateMs = Number(payload?.signedDate || 0);
  const effectiveDate =
    Number.isFinite(signedDateMs) && signedDateMs > 0
      ? new Date(signedDateMs)
      : new Date();

  if (!validAt(leaf, effectiveDate) || !validAt(intermediate, effectiveDate)) {
    throw new Error("Apple signing certificate is outside its validity period.");
  }

  const leafAppleExtension = leaf.getExtension(APPLE_TRANSACTION_OID);
  const intermediateAppleExtension =
    intermediate.getExtension(APPLE_INTERMEDIATE_OID);
  const basicConstraints =
    intermediate.getExtension(BasicConstraintsExtension);

  if (
    !leafAppleExtension ||
    !intermediateAppleExtension ||
    !basicConstraints?.ca
  ) {
    throw new Error("Invalid Apple signing certificate extensions.");
  }

  const roots = await trustedRoots();
  let trustedRoot: X509Certificate | null = null;

  for (const root of roots) {
    if (!validAt(root, effectiveDate)) continue;

    const verified = await intermediate.verify({
      publicKey: root.publicKey,
    });

    if (verified) {
      trustedRoot = root;
      break;
    }
  }

  if (!trustedRoot) {
    throw new Error("Apple intermediate certificate is not trusted.");
  }

  const leafVerified = await leaf.verify({
    publicKey: intermediate.publicKey,
  });

  if (!leafVerified) {
    throw new Error("Apple transaction certificate signature is invalid.");
  }

  const publicKey = await leaf.publicKey.export(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    ["verify"],
  );

  const signingInput = new TextEncoder().encode(
    `${headerPart}.${payloadPart}`,
  );
  const signature = base64UrlBytes(signaturePart);

  const signatureValid = await crypto.subtle.verify(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    publicKey,
    signature,
    signingInput,
  );

  if (!signatureValid) {
    throw new Error("StoreKit JWS signature is invalid.");
  }

  if (String(payload?.bundleId || "") !== BUNDLE_ID) {
    throw new Error("Unexpected StoreKit bundle identifier.");
  }

  const environment = String(payload?.environment || "");
  if (environment !== "Production" && environment !== "Sandbox") {
    throw new Error("Unexpected StoreKit environment.");
  }

  return payload;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("Authorization") || "";

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Service unavailable." }, 503);
  }

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Authentication required." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const jwt = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } =
    await admin.auth.getUser(jwt);

  if (userError || !userData.user) {
    return json({ error: "Invalid or expired session." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const jwsRepresentation = String(
    body?.jwsRepresentation || "",
  ).trim();

  if (
    !jwsRepresentation ||
    jwsRepresentation.split(".").length !== 3
  ) {
    return json(
      { error: "A valid StoreKit transaction is required." },
      400,
    );
  }

  try {
    const tx = await verifyAppleTransactionJws(jwsRepresentation);

    if (String(tx?.productId || "") !== PRODUCT_ID) {
      return json({ error: "Unexpected subscription product." }, 400);
    }

    const expiresMs = Number(tx?.expiresDate ?? 0);
    const revocationMs = Number(tx?.revocationDate ?? 0);

    const active =
      Number.isFinite(expiresMs) &&
      expiresMs > Date.now() &&
      (!Number.isFinite(revocationMs) || revocationMs <= 0);

    const expiresAt =
      Number.isFinite(expiresMs) && expiresMs > 0
        ? new Date(expiresMs).toISOString()
        : null;

    const now = new Date().toISOString();
    const environment = String(tx?.environment || "");

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        access_tier: active ? "pro" : "free",
        subscription_product_id: PRODUCT_ID,
        subscription_original_transaction_id:
          String(
            tx?.originalTransactionId ||
              tx?.transactionId ||
              "",
          ) || null,
        subscription_expires_at: expiresAt,
        subscription_environment: environment,
        subscription_verified_at: now,
      })
      .eq("id", userData.user.id);

    if (updateError) throw updateError;

    return json({
      active,
      accessTier: active ? "pro" : "free",
      productId: PRODUCT_ID,
      expiresAt,
      environment,
    });
  } catch (error) {
    console.error(
      "Subscription verification failed:",
      error instanceof Error ? error.message : String(error),
    );

    return json(
      { error: "The App Store subscription could not be verified." },
      403,
    );
  }
});
