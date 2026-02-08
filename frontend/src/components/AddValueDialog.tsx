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
import type { ManualHolding } from "@/types/holdings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: ManualHolding | null;
  onSubmit: (value: number) => Promise<void>;
}

export function AddValueDialog({ open, onOpenChange, holding, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValue("");
      setError("");
    }
  }, [open]);

  const valueToAdd = Number(value) || 0;
  const newTotal = (holding?.value ?? 0) + valueToAdd;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (valueToAdd <= 0) return;

    setSubmitting(true);
    setError("");
    try {
      await onSubmit(valueToAdd);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add value");
    } finally {
      setSubmitting(false);
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Value — {holding?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Current value:{" "}
            <span className="font-medium text-foreground">
              {holding ? fmt(holding.value) : "0.00"} {holding?.currency}
            </span>
          </p>

          <div className="grid gap-2">
            <Label htmlFor="add-value">Value to add ({holding?.currency})</Label>
            <Input
              id="add-value"
              type="number"
              step="any"
              min="0.01"
              placeholder="Amount"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>

          {valueToAdd > 0 && (
            <p className="text-sm text-muted-foreground">
              New total:{" "}
              <span className="font-medium text-foreground">
                {fmt(newTotal)} {holding?.currency}
              </span>
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={valueToAdd <= 0 || submitting}>
              {submitting && <Loader2Icon className="animate-spin" />}
              Add Value
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
