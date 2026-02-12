export interface AllocationGroup {
  id: number;
  name: string;
  color: string | null;
  created_at: string;
}

export interface AllocationGroupCreate {
  name: string;
  color: string | null;
}

export interface AllocationGroupUpdate {
  name?: string;
  color?: string | null;
}

export interface AllocationMember {
  holding_type: "stock" | "manual";
  holding_id: number;
  target_percentage: number;
}

export interface AssignAllocations {
  members: AllocationMember[];
}

export interface AllocationMemberRead {
  holding_type: "stock" | "manual";
  holding_id: number;
  holding_name: string;
  target_percentage: number;
}

export interface AllocationMemberAnalysis {
  holding_type: "stock" | "manual";
  holding_id: number;
  name: string;
  ticker: string | null;
  currency: string;
  current_value: number;
  current_percentage: number;
  target_percentage: number;
  target_value: number;
  difference: number;
}

export interface AllocationGroupAnalysis {
  group_id: number;
  group_name: string;
  group_color: string | null;
  total_value_ron: number;
  total_value_display: number;
  display_currency: string;
  members: AllocationMemberAnalysis[];
  fx_rates: Record<string, number>;
}
