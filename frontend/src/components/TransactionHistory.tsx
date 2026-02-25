import { useEffect, useRef, useState } from "react";
import { PencilIcon, Trash2Icon, Loader2Icon, CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteTransaction, updateTransaction } from "@/api/transactions";
import { fetchHistoricalPrice } from "@/api/prices";
import type { TransactionRead } from "@/types/transaction";

interface Props {
  transactions: TransactionRead[];
  ticker: string;
  onTransactionDeleted: () => void;
  onTransactionUpdated: () => void;
}

interface EditState {
  date: string;
  price: string;
  notes: string;
}

export function TransactionHistory({ transactions, ticker, onTransactionDeleted, onTransactionUpdated }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<TransactionRead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ date: "", price: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [fetchingHistorical, setFetchingHistorical] = useState(false);

  // Debounce ref for historical price fetch on date change
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
    };
  }, []);

  function startEdit(tx: TransactionRead) {
    setEditingId(tx.id);
    setEditState({
      date: tx.date,
      price: tx.price_per_share.toString(),
      notes: tx.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleEditDateChange(newDate: string) {
    setEditState((prev) => ({ ...prev, date: newDate }));

    if (!ticker) return;
    if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
    dateDebounceRef.current = setTimeout(async () => {
      setFetchingHistorical(true);
      try {
        const result = await fetchHistoricalPrice(ticker, newDate);
        if (result.price !== null) {
          setEditState((prev) => ({ ...prev, price: result.price!.toString() }));
        }
      } catch {
        // Silently fail — user can type a price manually
      } finally {
        setFetchingHistorical(false);
      }
    }, 500);
  }

  async function handleSaveEdit(tx: TransactionRead) {
    setSaving(true);
    try {
      const patch: { date?: string; price_per_share?: number; notes?: string } = {};
      if (editState.date !== tx.date) patch.date = editState.date;
      if (Number(editState.price) !== tx.price_per_share) patch.price_per_share = Number(editState.price);
      if (editState.notes !== (tx.notes ?? "")) patch.notes = editState.notes || undefined;

      if (Object.keys(patch).length > 0) {
        await updateTransaction(tx.id, patch);
        toast.success("Transaction updated");
        onTransactionUpdated();
      }
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update transaction");
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTransaction(deleteTarget.id);
      toast.success("Transaction deleted");
      onTransactionDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete transaction");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (transactions.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No transactions recorded yet
      </div>
    );
  }

  return (
    <>
      {/* Desktop: Table */}
      <Table className="hidden sm:table">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Price/Share</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const isEditing = editingId === tx.id;

            if (isEditing) {
              return (
                <TableRow key={tx.id} className="bg-muted/40">
                  <TableCell>
                    <Input
                      type="date"
                      value={editState.date}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => handleEditDateChange(e.target.value)}
                      className="h-7 text-xs w-36"
                    />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt(tx.shares)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {fetchingHistorical && <Loader2Icon className="h-3 w-3 animate-spin text-muted-foreground" />}
                      <Input
                        type="number"
                        step="any"
                        min="0.0001"
                        value={editState.price}
                        onChange={(e) => setEditState((prev) => ({ ...prev, price: e.target.value }))}
                        className="h-7 text-xs w-28 text-right"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {Number(editState.price) > 0 ? fmt(tx.shares * Number(editState.price)) : "—"}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      placeholder="Notes"
                      value={editState.notes}
                      onChange={(e) => setEditState((prev) => ({ ...prev, notes: e.target.value }))}
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleSaveEdit(tx)}
                        disabled={saving || !editState.date || Number(editState.price) <= 0}
                        title="Save"
                      >
                        {saving ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon className="h-3.5 w-3.5 text-green-600" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={cancelEdit}
                        disabled={saving}
                        title="Cancel"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }

            return (
              <TableRow key={tx.id}>
                <TableCell>{fmtDate(tx.date)}</TableCell>
                <TableCell className="text-right">{fmt(tx.shares)}</TableCell>
                <TableCell className="text-right">{fmt(tx.price_per_share)}</TableCell>
                <TableCell className="text-right">{fmt(tx.shares * tx.price_per_share)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{tx.notes || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => startEdit(tx)}
                      title="Edit transaction"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteTarget(tx)}
                      title="Delete transaction"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-2">
        {transactions.map((tx) => {
          const isEditing = editingId === tx.id;

          if (isEditing) {
            return (
              <div key={tx.id} className="p-3 rounded-md border bg-muted/40 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground">Date</span>
                    <Input
                      type="date"
                      value={editState.date}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => handleEditDateChange(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      Price/Share
                      {fetchingHistorical && <Loader2Icon className="h-3 w-3 animate-spin" />}
                    </span>
                    <Input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={editState.price}
                      onChange={(e) => setEditState((prev) => ({ ...prev, price: e.target.value }))}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <Input
                  type="text"
                  placeholder="Notes (optional)"
                  value={editState.notes}
                  onChange={(e) => setEditState((prev) => ({ ...prev, notes: e.target.value }))}
                  className="h-7 text-xs"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(tx)}
                    disabled={saving || !editState.date || Number(editState.price) <= 0}
                  >
                    {saving && <Loader2Icon className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div key={tx.id} className="flex items-start justify-between gap-3 p-3 rounded-md border bg-background">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{fmtDate(tx.date)}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmt(tx.shares)} shares
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>{fmt(tx.price_per_share)} per share</div>
                  <div className="font-medium text-foreground">
                    Total: {fmt(tx.shares * tx.price_per_share)}
                  </div>
                  {tx.notes && <div className="italic">"{tx.notes}"</div>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => startEdit(tx)}
                  title="Edit transaction"
                  className="shrink-0"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setDeleteTarget(tx)}
                  title="Delete transaction"
                  className="shrink-0"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction record? This will not affect the
              holding's total shares.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
