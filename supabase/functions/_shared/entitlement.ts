import { createClient } from "npm:@supabase/supabase-js@2.110.7";

export type StockPulseAccessDecision =
  | { ok: true; internal: boolean; userId: string | null }
  | { ok: false; status: number; error: string };

export async function requireStockPulseAccess(
  request: Request,
): Promise<StockPulseAccessDecision> {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: 503, error: "Service unavailable." };
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (token === serviceKey) {
    return { ok: true, internal: true, userId: null };
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: "Invalid or expired session." };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("grandfathered_free,access_tier,subscription_expires_at")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("StockPulse access lookup failed:", profileError.message);
    return { ok: false, status: 503, error: "Unable to verify StockPulse access." };
  }

  const subscriptionExpiresAt = Date.parse(
    String(profile?.subscription_expires_at || ""),
  );
  const subscriptionActive =
    profile?.access_tier === "pro" &&
    Number.isFinite(subscriptionExpiresAt) &&
    subscriptionExpiresAt > Date.now();

  if (profile?.grandfathered_free === true || subscriptionActive) {
    return { ok: true, internal: false, userId: userData.user.id };
  }

  return {
    ok: false,
    status: 403,
    error: "StockPulse Pro subscription required.",
  };
}
