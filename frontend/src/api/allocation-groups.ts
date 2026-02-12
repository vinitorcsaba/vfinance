import type {
  AllocationGroup,
  AllocationGroupAnalysis,
  AllocationGroupCreate,
  AllocationGroupUpdate,
  AllocationMemberRead,
  AssignAllocations,
} from "@/types/allocation-groups";

const BASE = "/api/v1/allocation-groups";

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
  // 204 No Content has no body to parse
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export function getAllocationGroups(): Promise<AllocationGroup[]> {
  return request(`${BASE}`);
}

export function createAllocationGroup(
  data: AllocationGroupCreate
): Promise<AllocationGroup> {
  return request(`${BASE}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAllocationGroup(
  id: number,
  data: AllocationGroupUpdate
): Promise<AllocationGroup> {
  return request(`${BASE}/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteAllocationGroup(id: number): Promise<void> {
  return request(`${BASE}/${id}`, { method: "DELETE" });
}

export function assignAllocations(
  groupId: number,
  data: AssignAllocations
): Promise<void> {
  return request(`${BASE}/${groupId}/assign`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getGroupMembers(
  groupId: number
): Promise<AllocationMemberRead[]> {
  return request(`${BASE}/${groupId}/members`);
}

export function getGroupAnalysis(
  groupId: number,
  displayCurrency = "RON"
): Promise<AllocationGroupAnalysis> {
  const params = new URLSearchParams({ display_currency: displayCurrency });
  return request(`${BASE}/${groupId}/analysis?${params}`);
}
