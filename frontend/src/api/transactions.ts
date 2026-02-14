import type { TransactionCreate, TransactionRead } from "@/types/transaction";

const BASE = "/api/v1";

export async function createTransaction(
  holdingId: number,
  data: TransactionCreate
): Promise<TransactionRead> {
  const res = await fetch(`${BASE}/holdings/stocks/${holdingId}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create transaction");
  }
  return res.json();
}

export async function listTransactions(holdingId: number): Promise<TransactionRead[]> {
  const res = await fetch(`${BASE}/holdings/stocks/${holdingId}/transactions`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

export async function deleteTransaction(transactionId: number): Promise<void> {
  const res = await fetch(`${BASE}/holdings/transactions/${transactionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete transaction");
}
