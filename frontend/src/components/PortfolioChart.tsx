import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  CartesianGrid,
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

type MergedPoint = { date: string; portfolio: number; benchmark?: number; portfolioValue?: number };

/** Find the benchmark price for a given date by picking the closest available entry within 10 days. */
function findClosestPrice(targetDate: string, points: BenchmarkPoint[]): number | undefined {
  if (points.length === 0) return undefined;
  const target = new Date(targetDate).getTime();
  let closest = points[0];
  let minDiff = Math.abs(new Date(closest.date).getTime() - target);
  for (const pt of points) {
    const diff = Math.abs(new Date(pt.date).getTime() - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = pt;
    }
  }
  return minDiff <= 10 * 24 * 60 * 60 * 1000 ? closest.price : undefined;
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

  // Custom tooltip: track hovered data index + mouse position independently of Recharts payload.
  // Recharts v3 payload delivery is unreliable across browsers — we bypass it entirely.
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const chartContainerRef = useRef<HTMLDivElement>(null);

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

  // Reload benchmark when ticker or date range changes
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
      const res = await fetch(`/api/v1/prices/search?q=${encodeURIComponent(q)}`, {
        credentials: "include",
      });
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

  const hasBenchmark = benchmarkTicker !== null && benchmarkPoints.length > 0;

  // Memoize mergedData so its array reference is stable while the user hovers.
  // If mergedData were a new array on every render, Recharts would reset its internal
  // chart state on every setHoveredIndex call, breaking the cursor and active dot.
  const mergedData = useMemo<MergedPoint[]>(() => {
    const portfolioValues = chartData.map((pt) =>
      displayCurrency === "EUR" ? pt.total_eur : displayCurrency === "USD" ? pt.total_usd : pt.total_ron
    );
    const firstPortfolioValue = portfolioValues[0] ?? 0;
    const firstBenchPrice =
      hasBenchmark && chartData.length > 0
        ? findClosestPrice(chartData[0].date, benchmarkPoints)
        : undefined;

    return chartData.map((point, i) => {
      const dateLabel = new Date(point.date).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });

      if (!hasBenchmark) {
        return { date: dateLabel, portfolio: portfolioValues[i] };
      }

      const portfolioPct =
        point.roi_percent !== null && point.roi_percent !== undefined
          ? point.roi_percent
          : firstPortfolioValue !== 0
          ? parseFloat(((portfolioValues[i] / firstPortfolioValue - 1) * 100).toFixed(2))
          : 0;

      const benchPrice = findClosestPrice(point.date, benchmarkPoints);
      const benchmarkPct =
        benchPrice !== undefined && firstBenchPrice !== undefined && firstBenchPrice !== 0
          ? parseFloat(((benchPrice / firstBenchPrice - 1) * 100).toFixed(2))
          : undefined;

      return { date: dateLabel, portfolio: portfolioPct, benchmark: benchmarkPct, portfolioValue: portfolioValues[i] };
    });
  }, [chartData, displayCurrency, hasBenchmark, benchmarkPoints]);

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

  // The hovered data point — used by our own tooltip div
  const hoveredPoint = hoveredIndex !== null ? mergedData[hoveredIndex] ?? null : null;

  return (
    <div className="space-y-3">
      {/* Row 1: Date range buttons */}
      <div className="flex gap-2 flex-wrap">
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

      {/* Row 2: Benchmark search */}
      <div className="flex items-center gap-2 flex-wrap" ref={searchRef}>
        <span className="text-xs text-muted-foreground whitespace-nowrap">Compare with:</span>
        <div className="relative flex items-center gap-1">
          <Input
            className="h-8 w-44 sm:w-52 text-xs"
            placeholder="Ticker or name (e.g. SPY, ^GSPC)…"
            value={benchmarkQuery}
            onChange={(e) => {
              setBenchmarkQuery(e.target.value);
              if (benchmarkTicker && e.target.value !== benchmarkTicker) {
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
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={clearBenchmark}>
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

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border bg-background shadow-md">
              {suggestions.map((result, i) => (
                <button
                  key={result.ticker}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                    i === highlightIndex ? "bg-muted" : ""
                  }`}
                  onMouseDown={() => selectBenchmark(result.ticker)}
                >
                  <span className="font-mono font-semibold text-xs shrink-0 w-16 truncate">
                    {result.ticker}
                  </span>
                  <span className="truncate text-muted-foreground text-xs">{result.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {benchmarkLoading && (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        )}
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

      {/* Chart */}
      <div className="border rounded-md p-2 sm:p-4">
        {/*
          Wrapper is position:relative so our custom tooltip div can be absolute inside it.
          onMouseMove updates the mouse position ref (no re-render) so the tooltip stays
          positioned correctly when hoveredIndex state changes trigger a re-render.
        */}
        <div
          ref={chartContainerRef}
          className="relative h-[200px] sm:h-[300px]"
          onMouseMove={(e) => {
            const rect = chartContainerRef.current?.getBoundingClientRect();
            if (rect) {
              mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            }
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={mergedData}
              onMouseMove={(state) => {
                const idx = state?.activeTooltipIndex;
                const next = typeof idx === "number" ? idx : null;
                setHoveredIndex((prev) => (prev !== next ? next : prev));
              }}
              onMouseLeave={() => setHoveredIndex(null)}
            >
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
              {/* Keep Tooltip only for the vertical cursor line; content is empty */}
              <Tooltip
                content={() => null}
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
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

          {/* Our own tooltip — positioned by mouse coords, reads mergedData[hoveredIndex] directly */}
          {hoveredPoint && (() => {
            const { x, y } = mousePosRef.current;
            const containerWidth = chartContainerRef.current?.offsetWidth ?? 0;
            // Flip to left side when near right edge
            const left = x + 130 > containerWidth ? x - 140 : x + 12;
            const top = Math.max(0, y - 10);
            return (
              <div
                className="absolute z-50 rounded-md border bg-background p-2 text-xs shadow pointer-events-none"
                style={{ left, top, borderColor: "var(--border)" }}
              >
                <p className="font-medium mb-1">{hoveredPoint.date}</p>
                <p style={{ color: "var(--primary)" }}>
                  My Portfolio:{" "}
                  {hasBenchmark
                    ? `${hoveredPoint.portfolio >= 0 ? "+" : ""}${hoveredPoint.portfolio.toFixed(2)}%`
                    : `${hoveredPoint.portfolio.toLocaleString("en", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} ${displayCurrency}`}
                </p>
                {hasBenchmark && hoveredPoint.portfolioValue !== undefined && (
                  <p className="text-muted-foreground">
                    Value:{" "}
                    {hoveredPoint.portfolioValue.toLocaleString("en", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {displayCurrency}
                  </p>
                )}
                {hasBenchmark && hoveredPoint.benchmark !== undefined && (
                  <p style={{ color: "#f97316" }}>
                    {benchmarkTicker ?? "Benchmark"}:{" "}
                    {`${hoveredPoint.benchmark >= 0 ? "+" : ""}${hoveredPoint.benchmark.toFixed(2)}%`}
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* Legend when benchmark is active */}
        {hasBenchmark && (
          <div className="flex items-center gap-4 mt-2 justify-center text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-4 rounded"
                style={{ height: "2px", backgroundColor: "var(--primary)" }}
              />
              <span>My Portfolio (cash-flow-adjusted ROI%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="16" height="4" aria-hidden>
                <line x1="0" y1="2" x2="16" y2="2" stroke="#f97316" strokeWidth="2" strokeDasharray="5 3" />
              </svg>
              <span>
                {benchmarkTicker}
                {benchmarkCurrency ? ` (${benchmarkCurrency})` : ""} — % change
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
