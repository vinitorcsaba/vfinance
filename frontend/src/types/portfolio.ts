export interface HoldingDetail {
  id: number;
  type: "stock" | "manual";
  name: string;
  ticker: string | null;
  shares: number | null;
  price: number | null;
  value: number;
  currency: string;
  value_ron: number;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
  total_ron: number;
}

export interface PortfolioResponse {
  holdings: HoldingDetail[];
  currency_totals: CurrencyTotal[];
  grand_total_ron: number;
  fx_rates: Record<string, number>;
}
