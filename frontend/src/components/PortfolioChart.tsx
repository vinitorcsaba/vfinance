import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getChartData } from "@/api/snapshots";
import { getBenchmarkData } from "@/api/prices";
import { getLabels } from "@/api/labels";
import type { ChartDataPoint } from "@/types/snapshot";
import type { BenchmarkPoint } from "@/api/prices";
import type { Label } from "@/types/labels";

type Currency = "RON" | "EUR" | "USD";
export type DateRange = "3m" | "6m" | "1y" | "all";

interface PortfolioChartProps {
  displayCurrency: Currency;
  dateRange: DateRange;
  onDateRangeChange: (r: DateRange) => void;
  selectedLabels?: string[];
  onSelectedLabelsChange?: (l: string[]) => void;
}

/** Find the benchmark price for a given snapshot date by picking the closest available date. */
function findClosestPrice(
  targetDate: string,
  benchmarkPoints: BenchmarkPoint[]
): number | null {
  if (benchmarkPoints.length === 0) return null;
  const target = new Date(targetDate).getTime();
  let closest = benchmarkPoints[0];
  let minDiff = Math.abs(new Date(closest.date).getTime() - target);
  for (const pt of benchmarkPoints) {
    const diff = Math.abs(new Date(pt.date).getTime() - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = pt;
    }
  }
  // Only accept if within 10 days of the snapshot date
  return minDiff <= 10 * 24 * 60 * 60 * 1000 ? closest.price : null;
}

export function PortfolioChart({
  displayCurrency,
  dateRange,
  onDateRangeChange,
  selectedLabels: controlledLabels,
  onSelectedLabelsChange,
}: PortfolioChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [internalLabels, setInternalLabels] = useState<string[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  // Benchmark state
  const [benchmarkQuery, setBenchmarkQuery] = useState("");
  const [benchmarkTicker, setBenchmarkTicker] = useState<string | null>(null);
  const [benchmarkCurrency, setBenchmarkCurrency] = useState<string | null>(null);
  const [benchmarkPoints, setBenchmarkPoints] = useState<BenchmarkPoint[]>([]);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ ticker: string; name: string }[]>([]);
  const [searchingBenchmark, setSearchingBenchmark] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledLabels !== undefined;
  const selectedLabels = isControlled ? controlledLabels : internalLabels;
  const setSelectedLabels = isControlled
    ? (v: string[] | ((prev: string[]) => string[])) => {
        const next = typeof v === "function" ? v(controlledLabels) : v;
        onSelectedLabelsChange?.(next);
      }
    : setInternalLabels;

  useEffect(() => {
    getLabels()
      .then(setAllLabels)
      .catch(() => toast.error("Failed to load labels"));
  }, []);

  useEffect(() => {
    setLoading(true);
    getChartData({ labels: selectedLabels, range: dateRange })
      .then((response) => setChartData(response.points))
      .catch(() => toast.error("Failed to load chart data"))
      .finally(() => setLoading(false));
  }, [selectedLabels, dateRange]);

  // Reload benchmark when date range changes
  useEffect(() => {
    if (!benchmarkTicker) return;
    setBenchmarkLoading(true);
    getBenchmarkData(benchmarkTicker, dateRange)
      .then((res) => {
        setBenchmarkPoints(res.points);
        setBenchmarkCurrency(res.currency);
      })
      .catch(() => {
        toast.error(`Failed to load benchmark data for ${benchmarkTicker}`);
        setBenchmarkPoints([]);
      })
      .finally(() => setBenchmarkLoading(false));
  }, [benchmarkTicker, dateRange]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleBenchmarkSearch() {
    const q = benchmarkQuery.trim();
    if (q.length < 2) return;
    setSearchingBenchmark(true);
    setHighlightIndex(-1);
    try {
      const res = await fetch(
        `/api/v1/prices/search?q=${encodeURIComponent(q)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Search failed");
      const results: { ticker: string; name: string }[] = await res.json();
      setSuggestions(results.slice(0, 8));
      setShowSuggestions(true);
    } catch {
      toast.error("Benchmark search failed");
      setSuggestions([]);
    } finally {
      setSearchingBenchmark(false);
    }
  }

  function selectBenchmark(ticker: string) {
    setBenchmarkTicker(ticker);
    setBenchmarkQuery(ticker);
    setShowSuggestions(false);
    setSuggestions([]);
    // Fetch will happen via useEffect
  }

  function clearBenchmark() {
    setBenchmarkTicker(null);
    setBenchmarkQuery("");
    setBenchmarkPoints([]);
    setBenchmarkCurrency(null);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (showSuggestions && highlightIndex >= 0 && suggestions[highlightIndex]) {
        selectBenchmark(suggestions[highlightIndex].ticker);
      } else {
        handleBenchmarkSearch();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  const toggleLabel = (labelName: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelName)
        ? prev.filter((l) => l !== labelName)
        : [...prev, labelName]
    );
  };

  // Build merged chart data
  const hasBenchmark = benchmarkTicker !== null && benchmarkPoints.length > 0;

  const portfolioValues = chartData.map((point) => {
    if (displayCurrency === "EUR") return point.total_eur;
    if (displayCurrency === "USD") return point.total_usd;
    return point.total_ron;
  });

  const firstPortfolioValue = portfolioValues[0] ?? 0;

  // When benchmark is active, normalize both to % change from start
  const mergedData = chartData.map((point, i) => {
    const portfolioValue = portfolioValues[i];
    const dateLabel = new Date(point.date).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });

    if (!hasBenchmark) {
      return { date: dateLabel, portfolio: portfolioValue };
    }

    // Normalize portfolio to % change from first point
    const portfolioPct =
      firstPortfolioValue !== 0
        ? parseFloat(((portfolioValue / firstPortfolioValue - 1) * 100).toFixed(2))
        : 0;

    // Find closest benchmark price for this snapshot date
    const benchPrice = findClosestPrice(point.date, benchmarkPoints);
    const firstBenchPrice = findClosestPrice(chartData[0]?.date ?? point.date, benchmarkPoints);

    let benchmarkPct: number | null = null;
    if (benchPrice !== null && firstBenchPrice !== null && firstBenchPrice !== 0) {
      benchmarkPct = parseFloat(((benchPrice / firstBenchPrice - 1) * 100).toFixed(2));
    }

    return {
      date: dateLabel,
      portfolio: portfolioPct,
      benchmark: benchmarkPct,
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 border rounded-md">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border rounded-md text-center">
        <p className="text-sm text-muted-foreground mb-2">
          No snapshot data available for the selected time range.
        </p>
        <p className="text-xs text-muted-foreground">
          Take snapshots to start tracking portfolio value over time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date range + benchmark search row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(["3m", "6m", "1y", "all"] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => onDateRangeChange(range)}
            >
              {range.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* Benchmark search */}
        <div className="flex items-center gap-2 ml-auto" ref={searchRef}>
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
            Compare with:
          </span>
          <div className="relative">
            <div className="flex items-center gap-1">
              <Input
                className="h-8 w-36 sm:w-44 text-xs"
                placeholder="Ticker or name…"
                value={benchmarkQuery}
                onChange={(e) => {
                  setBenchmarkQuery(e.target.value);
                  if (benchmarkTicker && e.target.value !== benchmarkTicker) {
                    // User is editing — clear current benchmark
                    setBenchmarkTicker(null);
                    setBenchmarkPoints([]);
                  }
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
              />
              {benchmarkTicker ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={clearBenchmark}
                >
                  <XIcon className="size-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  disabled={benchmarkQuery.trim().length < 2 || searchingBenchmark}
                  onClick={handleBenchmarkSearch}
                >
                  {searchingBenchmark ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SearchIcon className="size-3.5" />
                  )}
                </Button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border bg-background shadow-md">
                {suggestions.map((result, i) => (
                  <button
                    key={result.ticker}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                      i === highlightIndex ? "bg-muted" : ""
                    }`}
                    onMouseDown={() => selectBenchmark(result.ticker)}
                  >
                    <span className="font-mono font-semibold text-xs shrink-0">
                      {result.ticker}
                    </span>
                    <span className="truncate text-muted-foreground text-xs">
                      {result.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {benchmarkLoading && (
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Label Filter */}
      {allLabels.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Filter by labels:</span>
          {allLabels.map((label) => {
            const isSelected = selectedLabels.includes(label.name);
            return (
              <Badge
                key={label.name}
                variant="outline"
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? "ring-2 ring-offset-2 scale-105"
                    : "grayscale opacity-60 hover:opacity-100"
                }`}
                style={{
                  borderColor: label.color || undefined,
                  color: isSelected ? label.color || undefined : undefined,
                  backgroundColor:
                    isSelected && label.color ? `${label.color}10` : undefined,
                }}
                onClick={() => toggleLabel(label.name)}
              >
                {label.name}
              </Badge>
            );
          })}
          {selectedLabels.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedLabels([])}>
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Benchmark info badge */}
      {hasBenchmark && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="inline-block w-3 h-0.5 rounded"
            style={{ backgroundColor: "#f97316", height: "2px" }}
          />
          <span>
            {benchmarkTicker}
            {benchmarkCurrency ? ` (${benchmarkCurrency})` : ""} — values normalized to % growth
            from first snapshot date
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="border rounded-md p-2 sm:p-4">
        <div className="h-[200px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                style={{ fontSize: "12px" }}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                style={{ fontSize: "12px" }}
                tickFormatter={(value: number) =>
                  hasBenchmark
                    ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
                    : value.toLocaleString("en", { maximumFractionDigits: 0 })
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name?: string) => {
                  const num = typeof value === "number" ? value : null;
                  if (num === null || num === undefined) return ["—", name];
                  if (hasBenchmark) {
                    const label =
                      name === "portfolio"
                        ? "My Portfolio"
                        : benchmarkTicker ?? "Benchmark";
                    return [
                      `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`,
                      label,
                    ];
                  }
                  return [
                    `${num.toLocaleString("en", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ${displayCurrency}`,
                    "Portfolio",
                  ];
                }}
              />
              {hasBenchmark && (
                <Legend
                  formatter={(value: string) =>
                    value === "portfolio"
                      ? "My Portfolio"
                      : benchmarkTicker ?? "Benchmark"
                  }
                />
              )}
              <Line
                type="monotone"
                dataKey="portfolio"
                name="portfolio"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ fill: "var(--primary)", stroke: "var(--primary)", r: 4 }}
                activeDot={{ r: 6, fill: "var(--primary)" }}
                connectNulls
              />
              {hasBenchmark && (
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name="benchmark"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ fill: "#f97316", stroke: "#f97316", r: 3 }}
                  activeDot={{ r: 5, fill: "#f97316" }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
