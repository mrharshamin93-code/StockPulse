import { supabase } from "@/lib/supabase";

export async function recordStockTransaction({
  userId,
  ticker,
  companyName = "",
  type,
  quantity,
  price,
}) {
  const normalizedTicker = String(ticker || "").trim().toUpperCase();
  const normalizedQuantity = Number(quantity);
  const normalizedPrice = Number(price);

  if (
    !userId ||
    !normalizedTicker ||
    !["buy", "sell"].includes(type) ||
    !Number.isFinite(normalizedQuantity) ||
    normalizedQuantity <= 0 ||
    !Number.isFinite(normalizedPrice) ||
    normalizedPrice < 0
  ) {
    throw new Error("Invalid stock transaction");
  }

  const { error } = await supabase.from("stock_transactions").insert({
    user_id: userId,
    ticker: normalizedTicker,
    company_name: String(companyName || "").trim(),
    type,
    quantity: normalizedQuantity,
    price: normalizedPrice,
    total: normalizedQuantity * normalizedPrice,
  });

  if (error) {
    throw error;
  }
}
