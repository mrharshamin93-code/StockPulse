import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { supabase } from "@/lib/supabase";

export const STOCKPULSE_PRO_MONTHLY = "com.harshamin.stockpulse.pro.monthly";

export function isNativeIOS() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function isStockPulsePurchase(purchase) {
  return (
    purchase?.productIdentifier === STOCKPULSE_PRO_MONTHLY &&
    Boolean(purchase?.jwsRepresentation)
  );
}

async function verifyPurchaseWithServer(purchase) {
  const jwsRepresentation = String(
    purchase?.jwsRepresentation || "",
  ).trim();

  if (!jwsRepresentation) {
    throw new Error(
      "This App Store transaction cannot be securely verified.",
    );
  }

  const { data, error } = await supabase.functions.invoke(
    "sync-subscription-entitlement",
    {
      body: {
        jwsRepresentation,
      },
    },
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data?.active === true;
}

export async function getMonthlyProduct() {
  if (!isNativeIOS()) return null;

  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [STOCKPULSE_PRO_MONTHLY],
    productType: PURCHASE_TYPE.SUBS,
  });

  return (
    products?.find(
      (product) =>
        product.identifier === STOCKPULSE_PRO_MONTHLY,
    ) ||
    products?.[0] ||
    null
  );
}

export async function hasActiveStockPulseSubscription() {
  if (!isNativeIOS()) return false;

  const { purchases = [] } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
    onlyCurrentEntitlements: true,
  });

  const purchase = purchases.find(isStockPulsePurchase);
  if (!purchase) return false;

  return verifyPurchaseWithServer(purchase);
}

export async function purchaseStockPulsePro() {
  if (!isNativeIOS()) {
    throw new Error(
      "Subscriptions are available in the iOS app.",
    );
  }

  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: STOCKPULSE_PRO_MONTHLY,
    productType: PURCHASE_TYPE.SUBS,
    quantity: 1,
  });

  const active = await verifyPurchaseWithServer(transaction);

  if (!active) {
    throw new Error(
      "Your purchase completed, but StockPulse could not verify the subscription. Use Restore Purchases to retry.",
    );
  }

  return transaction;
}

export async function restoreStockPulsePurchases() {
  if (!isNativeIOS()) return false;

  try {
    await NativePurchases.restorePurchases();
  } catch (error) {
    console.warn(
      "App Store restore sync failed; checking current entitlements anyway:",
      error,
    );
  }

  return hasActiveStockPulseSubscription();
}
