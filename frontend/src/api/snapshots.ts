import type { ChartDataResponse, ROIResponse, SnapshotRead, SnapshotSummary } from "@/types/snapshot";

const BASE = "/api/v1";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  // Handle 204 No Content (e.g., DELETE responses)
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export function listSnapshots(): Promise<SnapshotSummary[]> {
  return request(`${BASE}/snapshots`);
}

export function getSnapshot(id: number): Promise<SnapshotRead> {
  return request(`${BASE}/snapshots/${id}`);
}

export function createSnapshot(): Promise<SnapshotRead> {
  return request(`${BASE}/snapshots`, { method: "POST" });
}

export function exportSnapshot(id: number): Promise<{ sheets_url: string }> {
  return request(`${BASE}/snapshots/${id}/export`, { method: "POST" });
}

export function deleteSnapshot(id: number): Promise<void> {
  return request(`${BASE}/snapshots/${id}`, { method: "DELETE" });
}

export function getROI(range: "3m" | "6m" | "1y" | "all"): Promise<ROIResponse> {
  return request(`${BASE}/snapshots/roi?range=${range}`);
}

export function getChartData(params: {
  labels?: string[];
  range?: "3m" | "6m" | "1y" | "all";
}): Promise<ChartDataResponse> {
  const searchParams = new URLSearchParams();
  if (params.labels) {
    params.labels.forEach((label) => searchParams.append("labels", label));
  }
  if (params.range) {
    searchParams.append("range", params.range);
  }
  const queryString = searchParams.toString();
  return request(`${BASE}/snapshots/chart-data${queryString ? `?${queryString}` : ""}`);
}
