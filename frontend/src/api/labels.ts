import type { Label, LabelCreate, LabelUpdate } from "@/types/labels";

const BASE = "/api/v1";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function getLabels(): Promise<Label[]> {
  return request(`${BASE}/labels`);
}

export function createLabel(data: LabelCreate): Promise<Label> {
  return request(`${BASE}/labels`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateLabel(id: number, data: LabelUpdate): Promise<Label> {
  return request(`${BASE}/labels/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteLabel(id: number): Promise<void> {
  return request(`${BASE}/labels/${id}`, { method: "DELETE" });
}

export function assignStockLabels(stockId: number, labelIds: number[]): Promise<Label[]> {
  return request(`${BASE}/holdings/stocks/${stockId}/labels`, {
    method: "POST",
    body: JSON.stringify({ label_ids: labelIds }),
  });
}

export function assignManualLabels(holdingId: number, labelIds: number[]): Promise<Label[]> {
  return request(`${BASE}/holdings/manual/${holdingId}/labels`, {
    method: "POST",
    body: JSON.stringify({ label_ids: labelIds }),
  });
}
