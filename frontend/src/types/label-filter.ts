export type SavedLabelFilter = {
  id: number;
  name: string;
  label_ids: number[];
  filter_mode: "AND" | "OR";
  chart_mode: "holding" | "currency" | "label";
  created_at: string;
};
