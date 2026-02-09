import type {
  StockHolding,
  StockHoldingCreate,
  StockHoldingUpdate,
  StockAddShares,
  ManualHolding,
  ManualHoldingCreate,
  ManualHoldingUpdate,
  ManualAddValue,
  PriceLookupResponse,
  StockSearchResult,
} from "@/types/holdings";

const BASE = "/api/v1";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

// --- Stock Holdings ---

export function getStockHoldings(): Promise<StockHolding[]> {
  return request(`${BASE}/holdings/stocks`);
}

export function createStockHolding(data: StockHoldingCreate): Promise<StockHolding> {
  return request(`${BASE}/holdings/stocks`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateStockHolding(id: number, data: StockHoldingUpdate): Promise<StockHolding> {
  return request(`${BASE}/holdings/stocks/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteStockHolding(id: number): Promise<void> {
  return request(`${BASE}/holdings/stocks/${id}`, { method: "DELETE" });
}

export function addStockShares(id: number, data: StockAddShares): Promise<StockHolding> {
  return request(`${BASE}/holdings/stocks/${id}/add-shares`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Manual Holdings ---

export function getManualHoldings(): Promise<ManualHolding[]> {
  return request(`${BASE}/holdings/manual`);
}

export function createManualHolding(data: ManualHoldingCreate): Promise<ManualHolding> {
  return request(`${BASE}/holdings/manual`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateManualHolding(id: number, data: ManualHoldingUpdate): Promise<ManualHolding> {
  return request(`${BASE}/holdings/manual/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteManualHolding(id: number): Promise<void> {
  return request(`${BASE}/holdings/manual/${id}`, { method: "DELETE" });
}

export function addManualValue(id: number, data: ManualAddValue): Promise<ManualHolding> {
  return request(`${BASE}/holdings/manual/${id}/add-value`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Price Lookup ---

export function lookupTicker(ticker: string): Promise<PriceLookupResponse> {
  return request(`${BASE}/prices/lookup?ticker=${encodeURIComponent(ticker)}`);
}

export function searchStocks(query: string): Promise<StockSearchResult[]> {
  return request(`${BASE}/prices/search?q=${encodeURIComponent(query)}`);
}
