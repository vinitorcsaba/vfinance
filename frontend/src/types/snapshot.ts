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
  name: string;
  shares: number | null;
  price: number | null;
  value: number;
  currency: string;
}

export interface SnapshotRead {
  id: number;
  taken_at: string;
  total_value_ron: number;
  exported_to_sheets: boolean;
  sheets_url: string | null;
  items: SnapshotItemRead[];
}
