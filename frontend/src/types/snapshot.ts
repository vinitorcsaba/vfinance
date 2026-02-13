export interface LabelInSnapshot {
  name: string;
  color: string | null;
}

export interface SnapshotSummary {
  id: number;
  taken_at: string;
  total_value_ron: number;
  exported_to_sheets: boolean;
  sheets_url: string | null;
  item_count: number;
}

export interface SnapshotItemRead {
  id: number;
  holding_type: string;
  ticker: string | null;
  name: string;
  labels: LabelInSnapshot[];
  shares: number | null;
  price: number | null;
  value: number;
  currency: string;
  value_ron: number;
  value_eur: number;
  value_usd: number;
}

export interface SnapshotRead {
  id: number;
  taken_at: string;
  total_value_ron: number;
  exported_to_sheets: boolean;
  sheets_url: string | null;
  items: SnapshotItemRead[];
}

export interface ChartDataPoint {
  date: string;
  total_ron: number;
  total_eur: number;
  total_usd: number;
}

export interface ChartDataResponse {
  points: ChartDataPoint[];
  labels_applied: string[];
}
