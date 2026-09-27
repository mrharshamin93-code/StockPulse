import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";

export const STOCKPULSE_PRO_MONTHLY = "com.harshamin.stockpulse.pro.monthly";

export function isNativeIOS() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function getMonthlyProduct() {
  if (!isNativeIOS()) return null;
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [STOCKPULSE_PRO_MONTHLY],
    productType: PURCHASE_TYPE.SUBS,
  });
  return products?.find((product) => product.identifier === STOCKPULSE_PRO_MONTHLY) || products?.[0] || null;
}

export async function hasActiveStockPulseSubscription() {
  if (!isNativeIOS()) return false;
  const { purchases = [] } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
    onlyCurrentEntitlements: true,
  });
  return purchases.some((purchase) =>
    purchase.productIdentifier === STOCKPULSE_PRO_MONTHLY &&
    (purchase.isActive === true || (purchase.expirationDate && new Date(purchase.expirationDate) > new Date()))
  );
}

export async function purchaseStockPulsePro() {
  if (!isNativeIOS()) throw new Error("Subscriptions are available in the iOS app.");
  return NativePurchases.purchaseProduct({
    productIdentifier: STOCKPULSE_PRO_MONTHLY,
    productType: PURCHASE_TYPE.SUBS,
    quantity: 1,
  });
}

export async function restoreStockPulsePurchases() {
  if (!isNativeIOS()) return false;
  await NativePurchases.restorePurchases();
  return hasActiveStockPulseSubscription();
}
