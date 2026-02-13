import type { SnapshotRead, SnapshotSummary } from "@/types/snapshot";

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

export function createSnapshot(): Promise<SnapshotRead> {
  return request(`${BASE}/snapshots`, { method: "POST" });
}

export function exportSnapshot(id: number): Promise<{ sheets_url: string }> {
  return request(`${BASE}/snapshots/${id}/export`, { method: "POST" });
}

export function deleteSnapshot(id: number): Promise<void> {
  return request(`${BASE}/snapshots/${id}`, { method: "DELETE" });
}
