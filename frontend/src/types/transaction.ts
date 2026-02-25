export interface TransactionCreate {
  date: string; // ISO date string (YYYY-MM-DD)
  shares: number;
  price_per_share: number;
  notes?: string;
}

export interface TransactionUpdate {
  date?: string; // ISO date string (YYYY-MM-DD)
  price_per_share?: number;
  notes?: string;
}

export interface TransactionRead {
  id: number;
  holding_id: number;
  date: string; // ISO date string (YYYY-MM-DD)
  shares: number;
  price_per_share: number;
  notes: string | null;
  value_ron?: number | null;
  value_eur?: number | null;
  value_usd?: number | null;
}
