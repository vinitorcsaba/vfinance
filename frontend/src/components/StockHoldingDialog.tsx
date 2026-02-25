import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lookupTicker, searchStocks } from "@/api/holdings";
import { fetchHistoricalPrice } from "@/api/prices";
import type { Currency, StockHolding, StockSearchResult, PriceLookupResponse } from "@/types/holdings";

const CURRENCIES: Currency[] = ["RON", "EUR", "USD"];

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function looksLikeTicker(value: string): boolean {
  return /^[A-Z0-9^.]+$/.test(value);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    ticker: string;
    shares: number;
    currency?: Currency | null;
    display_name?: string;
    transaction_date?: string;
    transaction_price?: number;
  }) => Promise<void>;
  editing?: StockHolding | null;
}

export function StockHoldingDialog({ open, onOpenChange, onSubmit, editing }: Props) {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [tickerInfo, setTickerInfo] = useState<PriceLookupResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [tickerError, setTickerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Initial transaction fields (only shown when adding, not editing)
  const [txnDate, setTxnDate] = useState(today());
  const [txnPrice, setTxnPrice] = useState("");
  const [fetchingHistorical, setFetchingHistorical] = useState(false);

  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Debounce timer for historical price fetch on date change
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (editing) {
        setTicker(editing.ticker);
        setShares(String(editing.shares));
        setCurrency((editing.currency as Currency) ?? null);
        setDisplayName(editing.display_name ?? "");
        setTickerInfo(null);
        setTickerError("");
      } else {
        setTicker("");
        setShares("");
        setCurrency(null);
        setDisplayName("");
        setTickerInfo(null);
        setTickerError("");
        setTxnDate(today());
        setTxnPrice("");
      }
      setError("");
      setSearchResults([]);
      setShowResults(false);
      setHighlightIndex(-1);
    }
  }, [open, editing]);

  const doLookup = useCallback(async (tickerValue: string) => {
    setValidating(true);
    setTickerError("");
    setTickerInfo(null);
    try {
      const result = await lookupTicker(tickerValue);
      setTickerInfo(result);
      if (result.currency) {
        setCurrency(result.currency as Currency);
      }
      if (result.name) {
        setDisplayName(result.name);
      }
      // Auto-fill current price into the transaction price field (if not editing)
      if (!editing) {
        setTxnPrice(result.price.toString());
      }
    } catch (err) {
      setTickerError(err instanceof Error ? err.message : "Invalid ticker");
    } finally {
      setValidating(false);
    }
  }, [editing]);

  // When txnDate changes and we have a ticker, debounce-fetch the historical price
  function handleTxnDateChange(newDate: string) {
    setTxnDate(newDate);
    if (!ticker.trim()) return;

    if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
    dateDebounceRef.current = setTimeout(async () => {
      setFetchingHistorical(true);
      try {
        const result = await fetchHistoricalPrice(ticker.trim().toUpperCase(), newDate);
        if (result.price !== null) {
          setTxnPrice(result.price.toString());
        }
      } catch {
        // Silently fail — user can type a price manually
      } finally {
        setFetchingHistorical(false);
      }
    }, 500);
  }

  async function handleSearch() {
    const query = ticker.trim();
    if (!query || query.length < 2) return;

    if (looksLikeTicker(query)) {
      setShowResults(false);
      setSearchResults([]);
      await doLookup(query);
      return;
    }

    setSearching(true);
    setTickerError("");
    setTickerInfo(null);
    try {
      const results = await searchStocks(query);
      setSearchResults(results);
      setShowResults(results.length > 0);
      setHighlightIndex(-1);
    } catch {
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setSearching(false);
    }
  }

  function selectResult(result: StockSearchResult) {
    setTicker(result.ticker);
    setShowResults(false);
    setSearchResults([]);
    setHighlightIndex(-1);
    doLookup(result.ticker);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (showResults && highlightIndex >= 0) {
        e.preventDefault();
        selectResult(searchResults[highlightIndex]);
      } else if (!showResults || highlightIndex < 0) {
        e.preventDefault();
        handleSearch();
      }
      return;
    }

    if (!showResults || searchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowResults(false);
      setHighlightIndex(-1);
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
        currency: currency ?? undefined,
        display_name: displayName.trim() || undefined,
        ...(!editing && {
          transaction_date: txnDate || undefined,
          transaction_price: txnPrice && Number(txnPrice) > 0 ? Number(txnPrice) : undefined,
        }),
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
            <Label htmlFor="ticker">Ticker or Name</Label>
            <div className="relative">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  id="ticker"
                  placeholder='e.g. AAPL, TLV.RO, or "Banca Transilvania"'
                  value={ticker}
                  onChange={(e) => {
                    setTicker(e.target.value);
                    setTickerInfo(null);
                    setTickerError("");
                    setShowResults(false);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={!!editing}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSearch}
                  disabled={!ticker.trim() || ticker.trim().length < 2 || validating || searching || !!editing}
                >
                  {validating || searching ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
                </Button>
              </div>
              {showResults && searchResults.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-md"
                >
                  {searchResults.map((result, i) => (
                    <button
                      key={result.ticker}
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                        i === highlightIndex ? "bg-accent" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectResult(result);
                      }}
                    >
                      <span className="font-medium">{result.name}</span>
                      <span className="text-muted-foreground">
                        {" "}— {result.ticker} ({result.exchange}, {result.type})
                      </span>
                    </button>
                  ))}
                </div>
              )}
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
            <Label htmlFor="currency">Currency</Label>
            <Select
              value={currency ?? ""}
              onValueChange={(v) => setCurrency(v as Currency)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {/* Initial transaction fields — only shown when adding a new holding */}
          {!editing && (
            <div className="grid gap-3 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Initial Transaction</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="txn-date">Purchase Date</Label>
                  <Input
                    id="txn-date"
                    type="date"
                    value={txnDate}
                    max={today()}
                    onChange={(e) => handleTxnDateChange(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="txn-price">
                    Price / Share
                    {fetchingHistorical && (
                      <Loader2Icon className="inline ml-1 h-3 w-3 animate-spin" />
                    )}
                  </Label>
                  <Input
                    id="txn-price"
                    type="number"
                    step="any"
                    min="0.0001"
                    placeholder="Auto from lookup"
                    value={txnPrice}
                    onChange={(e) => setTxnPrice(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Currency values will reflect rates on the chosen date.
              </p>
            </div>
          )}

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
