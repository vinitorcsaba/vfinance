export interface Label {
  id: number;
  name: string;
  color: string | null;
  created_at: string;
}

export interface LabelCreate {
  name: string;
  color?: string | null;
}

export interface LabelUpdate {
  name?: string;
  color?: string | null;
}
