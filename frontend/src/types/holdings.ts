export type Currency = "RON" | "EUR" | "USD";

export interface StockHolding {
  id: number;
  ticker: string;
  shares: number;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockHoldingCreate {
  ticker: string;
  shares: number;
  display_name?: string | null;
}

export interface StockHoldingUpdate {
  ticker?: string;
  shares?: number;
  display_name?: string | null;
}

export interface ManualHolding {
  id: number;
  name: string;
  value: number;
  currency: Currency;
  created_at: string;
  updated_at: string;
}

export interface ManualHoldingCreate {
  name: string;
  value: number;
  currency: Currency;
}

export interface ManualHoldingUpdate {
  name?: string;
  value?: number;
  currency?: Currency;
}

export interface PriceLookupResponse {
  ticker: string;
  price: number;
  currency: string;
  name: string | null;
}
