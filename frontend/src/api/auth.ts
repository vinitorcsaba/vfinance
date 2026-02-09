import type { User } from "@/types/auth";

const BASE = "/api/v1/auth";

export async function googleLogin(token: string): Promise<User> {
  const res = await fetch(`${BASE}/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Login failed");
  }
  return res.json();
}

export async function getMe(): Promise<User> {
  const res = await fetch(`${BASE}/me`, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Not authenticated");
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function connectSheets(code: string): Promise<User> {
  const res = await fetch(`${BASE}/connect-sheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Failed to connect Google Sheets");
  }
  return res.json();
}

export async function disconnectSheets(): Promise<User> {
  const res = await fetch(`${BASE}/disconnect-sheets`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Failed to disconnect Google Sheets");
  }
  return res.json();
}
