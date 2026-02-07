import { useEffect, useState } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";

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
import { lookupTicker } from "@/api/holdings";
import type { StockHolding, PriceLookupResponse } from "@/types/holdings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { ticker: string; shares: number; display_name?: string }) => Promise<void>;
  editing?: StockHolding | null;
}

export function StockHoldingDialog({ open, onOpenChange, onSubmit, editing }: Props) {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tickerInfo, setTickerInfo] = useState<PriceLookupResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [tickerError, setTickerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (editing) {
        setTicker(editing.ticker);
        setShares(String(editing.shares));
        setDisplayName(editing.display_name ?? "");
        setTickerInfo(null);
        setTickerError("");
      } else {
        setTicker("");
        setShares("");
        setDisplayName("");
        setTickerInfo(null);
        setTickerError("");
      }
      setError("");
    }
  }, [open, editing]);

  async function validateTicker() {
    if (!ticker.trim()) return;
    setValidating(true);
    setTickerError("");
    setTickerInfo(null);
    try {
      const result = await lookupTicker(ticker.trim());
      setTickerInfo(result);
      if (result.name && !displayName) {
        setDisplayName(result.name);
      }
    } catch (err) {
      setTickerError(err instanceof Error ? err.message : "Invalid ticker");
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !shares || Number(shares) <= 0) return;

    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        ticker: ticker.trim().toUpperCase(),
        shares: Number(shares),
        display_name: displayName.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const isValid = ticker.trim() && shares && Number(shares) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Stock Holding" : "Add Stock Holding"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ticker">Ticker</Label>
            <div className="flex gap-2">
              <Input
                id="ticker"
                placeholder="e.g. AAPL, TLV.RO"
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value.toUpperCase());
                  setTickerInfo(null);
                  setTickerError("");
                }}
                disabled={!!editing}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={validateTicker}
                disabled={!ticker.trim() || validating}
              >
                {validating ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
              </Button>
            </div>
            {tickerError && <p className="text-sm text-destructive">{tickerError}</p>}
            {tickerInfo && (
              <p className="text-sm text-muted-foreground">
                {tickerInfo.name ?? tickerInfo.ticker} — {tickerInfo.currency} {tickerInfo.price.toFixed(2)}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shares">Shares</Label>
            <Input
              id="shares"
              type="number"
              step="any"
              min="0.0001"
              placeholder="Number of shares"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="display_name">Display Name (optional)</Label>
            <Input
              id="display_name"
              placeholder="e.g. Apple Inc."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || submitting}>
              {submitting && <Loader2Icon className="animate-spin" />}
              {editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
