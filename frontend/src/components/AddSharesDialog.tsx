import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StockHolding } from "@/types/holdings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock: StockHolding | null;
  onSubmit: (shares: number) => Promise<void>;
}

export function AddSharesDialog({ open, onOpenChange, stock, onSubmit }: Props) {
  const [shares, setShares] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setShares("");
      setError("");
    }
  }, [open]);

  const sharesToAdd = Number(shares) || 0;
  const newTotal = (stock?.shares ?? 0) + sharesToAdd;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sharesToAdd <= 0) return;

    setSubmitting(true);
    setError("");
    try {
      await onSubmit(sharesToAdd);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add shares");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Shares — {stock?.display_name ?? stock?.ticker}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Current shares: <span className="font-medium text-foreground">{stock?.shares}</span>
          </p>

          <div className="grid gap-2">
            <Label htmlFor="add-shares">Shares to add</Label>
            <Input
              id="add-shares"
              type="number"
              step="any"
              min="0.0001"
              placeholder="Number of shares"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              autoFocus
            />
          </div>

          {sharesToAdd > 0 && (
            <p className="text-sm text-muted-foreground">
              New total: <span className="font-medium text-foreground">{newTotal}</span>
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={sharesToAdd <= 0 || submitting}>
              {submitting && <Loader2Icon className="animate-spin" />}
              Add Shares
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
