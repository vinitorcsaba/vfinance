import type { SavedLabelFilter } from "@/types/label-filter";

const BASE = "/api/v1/label-filters";

export async function getSavedFilters(): Promise<SavedLabelFilter[]> {
  const res = await fetch(BASE, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch saved filters");
  return res.json();
}

export async function createSavedFilter(data: {
  name: string;
  label_ids: number[];
  filter_mode: "AND" | "OR";
}): Promise<SavedLabelFilter> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Failed to save filter");
  }
  return res.json();
}

export async function deleteSavedFilter(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete saved filter");
}
