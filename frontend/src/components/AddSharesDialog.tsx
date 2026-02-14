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
import { Textarea } from "@/components/ui/textarea";
import type { StockHolding } from "@/types/holdings";

export interface AddSharesFormData {
  shares: number;
  date: string;
  price_per_share: number;
  notes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock: StockHolding | null;
  onSubmit: (data: AddSharesFormData) => Promise<void>;
  currentPrice?: number;
}

export function AddSharesDialog({ open, onOpenChange, stock, onSubmit, currentPrice }: Props) {
  const [shares, setShares] = useState("");
  const [date, setDate] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setShares("");
      setDate(new Date().toISOString().split("T")[0]); // Today's date in YYYY-MM-DD
      setPricePerShare(currentPrice?.toString() || "");
      setNotes("");
      setError("");
    }
  }, [open, currentPrice]);

  const sharesToAdd = Number(shares) || 0;
  const newTotal = (stock?.shares ?? 0) + sharesToAdd;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sharesToAdd === 0 || !date || Number(pricePerShare) <= 0) return;

    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        shares: sharesToAdd,
        date,
        price_per_share: Number(pricePerShare),
        notes: notes.trim() || undefined,
      });
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
            <Label htmlFor="add-shares">Shares to add (negative to sell)</Label>
            <Input
              id="add-shares"
              type="number"
              step="any"
              placeholder="Number of shares (use negative for selling)"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="transaction-date">Date</Label>
            <Input
              id="transaction-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="price-per-share">Price per share</Label>
            <Input
              id="price-per-share"
              type="number"
              step="any"
              min="0.0001"
              placeholder="Price per share"
              value={pricePerShare}
              onChange={(e) => setPricePerShare(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this transaction"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {sharesToAdd !== 0 && (
            <p className="text-sm text-muted-foreground">
              New total: <span className="font-medium text-foreground">{newTotal}</span>
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={sharesToAdd === 0 || !date || Number(pricePerShare) <= 0 || submitting}
            >
              {submitting && <Loader2Icon className="animate-spin" />}
              {sharesToAdd < 0 ? "Remove Shares" : "Add Shares"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
