const BASE = "/api/v1";

export interface PriceLookupResponse {
  ticker: string;
  price: number;
  currency: string;
  name: string | null;
}

export async function lookupStockPrice(ticker: string): Promise<PriceLookupResponse> {
  const res = await fetch(`${BASE}/prices/lookup?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to lookup stock price");
  }
  return res.json();
}
