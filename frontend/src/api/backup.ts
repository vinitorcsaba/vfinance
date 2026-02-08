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

export function getBackupStatus(): Promise<{ configured: boolean }> {
  return request(`${BASE}/backup/status`);
}

export function uploadBackup(): Promise<{ message: string; size_bytes: number }> {
  return request(`${BASE}/backup/upload`, { method: "POST" });
}
