import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { Buffer } from "node:buffer";
import {
  Environment,
  SignedDataVerifier,
} from "npm:@apple/app-store-server-library@3.1.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUNDLE_ID = "com.harshamin.stockpulse";
const APP_APPLE_ID = 6808373094;
const PRODUCT_ID = "com.harshamin.stockpulse.pro.monthly";
const ROOT_CERT_URLS = [
  "https://www.apple.com/appleca/AppleIncRootCertificate.cer",
  "https://www.apple.com/certificateauthority/AppleRootCA-G2.cer",
  "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer",
];

let rootsPromise: Promise<Buffer[]> | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function appleRoots(): Promise<Buffer[]> {
  if (!rootsPromise) {
    rootsPromise = Promise.all(
      ROOT_CERT_URLS.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load Apple root certificate: ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
      }),
    ).catch((error) => {
      rootsPromise = null;
      throw error;
    });
  }
  return rootsPromise;
}

async function verifiedTransaction(jws: string) {
  const roots = await appleRoots();
  const production = new SignedDataVerifier(
    roots,
    false,
    Environment.PRODUCTION,
    BUNDLE_ID,
    APP_APPLE_ID,
  );

  try {
    return {
      environment: "Production",
      payload: await production.verifyAndDecodeTransaction(jws),
    };
  } catch (productionError) {
    if (Deno.env.get("ALLOW_APP_STORE_SANDBOX") !== "true") {
      throw productionError;
    }

    const sandbox = new SignedDataVerifier(
      roots,
      false,
      Environment.SANDBOX,
      BUNDLE_ID,
    );

    return {
      environment: "Sandbox",
      payload: await sandbox.verifyAndDecodeTransaction(jws),
    };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("Authorization") || "";

  if (!supabaseUrl || !serviceKey) return json({ error: "Service unavailable." }, 503);
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Authentication required." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jwt = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: "Invalid or expired session." }, 401);

  const body = await request.json().catch(() => ({}));
  const jwsRepresentation = String(body?.jwsRepresentation || "").trim();

  if (!jwsRepresentation || jwsRepresentation.split(".").length !== 3) {
    return json({ error: "A valid StoreKit transaction is required." }, 400);
  }

  try {
    const verified = await verifiedTransaction(jwsRepresentation);
    const tx: any = verified.payload;

    if (String(tx?.productId || "") !== PRODUCT_ID) {
      return json({ error: "Unexpected subscription product." }, 400);
    }

    const expiresMs = Number(tx?.expiresDate ?? tx?.expirationDate ?? 0);
    const revocationMs = Number(tx?.revocationDate ?? 0);
    const active =
      Number.isFinite(expiresMs) &&
      expiresMs > Date.now() &&
      (!Number.isFinite(revocationMs) || revocationMs <= 0);

    const expiresAt = Number.isFinite(expiresMs) && expiresMs > 0
      ? new Date(expiresMs).toISOString()
      : null;

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        access_tier: active ? "pro" : "free",
        subscription_product_id: PRODUCT_ID,
        subscription_original_transaction_id:
          String(tx?.originalTransactionId || tx?.transactionId || "") || null,
        subscription_expires_at: expiresAt,
        subscription_environment: verified.environment,
        subscription_verified_at: now,
      })
      .eq("id", userData.user.id);

    if (updateError) throw updateError;

    return json({
      active,
      accessTier: active ? "pro" : "free",
      productId: PRODUCT_ID,
      expiresAt,
      environment: verified.environment,
    });
  } catch (error) {
    console.error("Subscription verification failed:", error);
    return json({ error: "The App Store subscription could not be verified." }, 403);
  }
});
