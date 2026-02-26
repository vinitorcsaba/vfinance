export interface LabelInSnapshot {
  name: string;
  color: string | null;
}

export interface SnapshotSummary {
  id: number;
  taken_at: string;
  total_value_ron: number;
  total_value_eur: number;
  total_value_usd: number;
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
  total_value_eur: number;
  total_value_usd: number;
  exported_to_sheets: boolean;
  sheets_url: string | null;
  items: SnapshotItemRead[];
}

export interface ROIResponse {
  period_start: string | null;
  period_end: string | null;
  start_value_ron: number | null;
  start_value_eur: number | null;
  start_value_usd: number | null;
  end_value_ron: number | null;
  end_value_eur: number | null;
  end_value_usd: number | null;
  net_cash_flows_ron: number | null;
  net_cash_flows_eur: number | null;
  net_cash_flows_usd: number | null;
  stock_cash_flows_ron: number | null;
  stock_cash_flows_eur: number | null;
  stock_cash_flows_usd: number | null;
  absolute_gain_ron: number | null;
  absolute_gain_eur: number | null;
  absolute_gain_usd: number | null;
  roi_percent: number | null;
  snapshot_count: number;
  range: string;
}

export interface ChartDataPoint {
  date: string;
  total_ron: number;
  total_eur: number;
  total_usd: number;
  roi_percent: number | null;
}

export interface ChartDataResponse {
  points: ChartDataPoint[];
  labels_applied: string[];
}
