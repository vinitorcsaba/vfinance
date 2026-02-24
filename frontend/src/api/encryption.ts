const BASE = "/api/v1/encryption";

export type EncryptionStatus = {
  encrypted: boolean;
  unlocked: boolean;
};

async function handleResponse(res: Response): Promise<unknown> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw Object.assign(new Error(body?.detail ?? "Request failed"), { status: res.status });
  }
  return res.json();
}

export async function getEncryptionStatus(): Promise<EncryptionStatus> {
  const res = await fetch(`${BASE}/status`, { credentials: "include" });
  return handleResponse(res) as Promise<EncryptionStatus>;
}

export async function setupEncryption(password: string): Promise<void> {
  const res = await fetch(`${BASE}/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  await handleResponse(res);
}

export async function unlockDatabase(password: string): Promise<void> {
  const res = await fetch(`${BASE}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  await handleResponse(res);
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  const res = await fetch(`${BASE}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ current_password, new_password }),
  });
  await handleResponse(res);
}

export async function disableEncryption(password: string): Promise<void> {
  const res = await fetch(`${BASE}/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  await handleResponse(res);
}

export async function resetEncryptedDb(): Promise<void> {
  const res = await fetch(`${BASE}/reset`, {
    method: "POST",
    credentials: "include",
  });
  await handleResponse(res);
}
