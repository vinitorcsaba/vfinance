import type { Label } from "./labels";

export type Currency = "RON" | "EUR" | "USD";

export interface StockHolding {
  id: number;
  ticker: string;
  shares: number;
  currency: string | null;
  display_name: string | null;
  labels: Label[];
  created_at: string;
  updated_at: string;
}

export interface StockHoldingCreate {
  ticker: string;
  shares: number;
  currency?: Currency | null;
  display_name?: string | null;
}

export interface StockHoldingUpdate {
  ticker?: string;
  shares?: number;
  currency?: Currency | null;
  display_name?: string | null;
}

export interface StockAddShares {
  shares: number;
}

export interface ManualAddValue {
  value: number;
}

export interface ManualHolding {
  id: number;
  name: string;
  value: number;
  currency: Currency;
  labels: Label[];
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
