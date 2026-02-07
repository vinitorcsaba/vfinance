import type { PortfolioResponse } from "@/types/portfolio";

export async function getPortfolio(): Promise<PortfolioResponse> {
  const res = await fetch("/api/v1/portfolio");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}
