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

export interface BenchmarkPoint {
  date: string;
  price: number;
}

export interface BenchmarkResponse {
  ticker: string;
  currency: string | null;
  points: BenchmarkPoint[];
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

export async function getBenchmarkData(
  ticker: string,
  range: "3m" | "6m" | "1y" | "all"
): Promise<BenchmarkResponse> {
  const res = await fetch(
    `${BASE}/prices/benchmark?ticker=${encodeURIComponent(ticker)}&range=${range}`,
    { credentials: "include" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to fetch benchmark data");
  }
  return res.json();
}
