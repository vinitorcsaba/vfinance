const BASE = "/api/v1";

export interface PriceLookupResponse {
  ticker: string;
  price: number;
  currency: string;
  name: string | null;
}

export interface HistoricalPriceResponse {
  ticker: string;
  date: string;
  price: number | null;
  currency: string | null;
}

export async function lookupStockPrice(ticker: string): Promise<PriceLookupResponse> {
  const res = await fetch(`${BASE}/prices/lookup?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to lookup stock price");
  }
  return res.json();
}

export async function fetchHistoricalPrice(
  ticker: string,
  date: string
): Promise<HistoricalPriceResponse> {
  const res = await fetch(
    `${BASE}/prices/history?ticker=${encodeURIComponent(ticker)}&date=${encodeURIComponent(date)}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to fetch historical price");
  }
  return res.json();
}
