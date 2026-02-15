import { useState } from "react";
import { Trash2Icon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { deleteTransaction } from "@/api/transactions";
import type { TransactionRead } from "@/types/transaction";

interface Props {
  transactions: TransactionRead[];
  onTransactionDeleted: () => void;
}

export function TransactionHistory({ transactions, onTransactionDeleted }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<TransactionRead | null>(null);
  const [deleting, setDeleting] = useState(false);

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
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>{fmtDate(tx.date)}</TableCell>
              <TableCell className="text-right">{fmt(tx.shares)}</TableCell>
              <TableCell className="text-right">{fmt(tx.price_per_share)}</TableCell>
              <TableCell className="text-right">{fmt(tx.shares * tx.price_per_share)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{tx.notes || "—"}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setDeleteTarget(tx)}
                  title="Delete transaction"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-2">
        {transactions.map((tx) => (
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
        ))}
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
