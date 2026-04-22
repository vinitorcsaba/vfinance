export type SavedLabelFilter = {
  id: number;
  name: string;
  label_ids: number[];
  filter_mode: "AND" | "OR";
  created_at: string;
};
