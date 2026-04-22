import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon, Loader2Icon, ListIcon, XIcon, FilterIcon, BookmarkIcon, Trash2Icon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { LabelBadges } from "@/components/LabelAssignPopover";
import { getPortfolio } from "@/api/portfolio";
import { getSavedFilters, createSavedFilter, deleteSavedFilter } from "@/api/label-filters";
import type { HoldingDetail } from "@/types/portfolio";
import type { SavedLabelFilter } from "@/types/label-filter";

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#4f46e5", "#c026d3", "#d97706", "#059669",
];

const CURRENCY_COLORS: Record<string, string> = {
  RON: "#2563eb",
  EUR: "#16a34a",
  USD: "#ea580c",
  GBP: "#7c3aed",
  CHF: "#dc2626",
  HUF: "#d97706",
};
const CURRENCY_FALLBACK_COLOR = "#6b7280";

type ChartMode = "holding" | "currency" | "label";

const STORAGE_KEY_CURRENCY = "vfinance-display-currency";
const STORAGE_KEY_GROUP = "vfinance-group-by-currency";
const STORAGE_KEY_LABEL_FILTER = "vfinance-label-filter-mode";

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString("en", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function convertFromRon(valueRon: number, targetCurrency: string, fxRates: Record<string, number>): number {
  if (targetCurrency === "RON") return valueRon;
  const rate = fxRates[targetCurrency];
  if (!rate) return valueRon;
  return valueRon / rate;
}

export function DashboardPage() {
  const [displayCurrency, setDisplayCurrency] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_CURRENCY) || "RON"
  );
  const [groupByCurrency, setGroupByCurrency] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY_GROUP) === "true"
  );
  const [chartMode, setChartMode] = useState<ChartMode>("holding");
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [labelFilterMode, setLabelFilterMode] = useState<"AND" | "OR">(
    () => (localStorage.getItem(STORAGE_KEY_LABEL_FILTER) as "AND" | "OR") || "AND"
  );
  const [saveFilterName, setSaveFilterName] = useState("");
  const [savePopoverOpen, setSavePopoverOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolio,
    staleTime: 60_000,
  });

  const { data: savedFilters = [] } = useQuery({
    queryKey: ["saved-label-filters"],
    queryFn: getSavedFilters,
  });

  const createFilterMutation = useMutation({
    mutationFn: createSavedFilter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-label-filters"] });
      setSaveFilterName("");
      setSavePopoverOpen(false);
    },
  });

  const deleteFilterMutation = useMutation({
    mutationFn: deleteSavedFilter,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-label-filters"] }),
  });

  const holdings = useMemo(() => data?.holdings ?? [], [data]);
  const fxRates = useMemo(() => data?.fx_rates ?? {}, [data]);
  const dc = displayCurrency;

  // Extract unique labels from all holdings
  const allLabels = useMemo(() => {
    const map = new Map<number, { id: number; name: string; color: string | null }>();
    for (const h of holdings) {
      for (const l of h.labels ?? []) {
        if (!map.has(l.id)) map.set(l.id, l);
      }
    }
    return Array.from(map.values());
  }, [holdings]);

  // Filter holdings by selected labels
  const filteredHoldings = useMemo(() => {
    if (selectedLabels.length === 0) return holdings;
    if (labelFilterMode === "OR") {
      return holdings.filter((h) =>
        selectedLabels.some((id) => (h.labels ?? []).some((l) => l.id === id))
      );
    }
    return holdings.filter((h) =>
      selectedLabels.every((id) => (h.labels ?? []).some((l) => l.id === id))
    );
  }, [holdings, selectedLabels, labelFilterMode]);

  // Pie data depends on chart mode
  const { pieData, pieColors } = useMemo(() => {
    if (chartMode === "label") {
      const byLabel = new Map<number, { name: string; color: string | null; valueRon: number }>();
      let unlabeledValueRon = 0;

      // When label filter is active, only show selected labels
      const labelsToShow = selectedLabels.length > 0
        ? new Set(selectedLabels)
        : null;

      for (const h of filteredHoldings) {
        if (!h.labels || h.labels.length === 0) {
          unlabeledValueRon += h.value_ron;
        } else {
          // Filter labels to only those we want to show
          const relevantLabels = labelsToShow
            ? h.labels.filter(l => labelsToShow.has(l.id))
            : h.labels;

          if (relevantLabels.length === 0) {
            // If filtering and this holding has no relevant labels, skip it
            if (labelsToShow) continue;
            unlabeledValueRon += h.value_ron;
          } else {
            // Split value proportionally among relevant labels
            const valuePerLabel = h.value_ron / relevantLabels.length;
            for (const label of relevantLabels) {
              const existing = byLabel.get(label.id);
              if (existing) {
                existing.valueRon += valuePerLabel;
              } else {
                byLabel.set(label.id, {
                  name: label.name,
                  color: label.color,
                  valueRon: valuePerLabel,
                });
              }
            }
          }
        }
      }

      const entries = Array.from(byLabel.values()).map((labelData) => ({
        name: labelData.name,
        value: convertFromRon(labelData.valueRon, dc, fxRates),
        color: labelData.color,
      }));

      if (unlabeledValueRon > 0) {
        entries.push({
          name: "Unlabeled",
          value: convertFromRon(unlabeledValueRon, dc, fxRates),
          color: null,
        });
      }

      const colors = entries.map((e) => e.color ?? CURRENCY_FALLBACK_COLOR);
      return { pieData: entries, pieColors: colors };
    }
    if (chartMode === "currency") {
      const byCurrency = new Map<string, number>();
      for (const h of filteredHoldings) {
        byCurrency.set(h.currency, (byCurrency.get(h.currency) ?? 0) + h.value_ron);
      }
      const entries = Array.from(byCurrency.entries()).map(([currency, valueRon]) => ({
        name: currency,
        value: convertFromRon(valueRon, dc, fxRates),
      }));
      const colors = entries.map((d) => CURRENCY_COLORS[d.name] ?? CURRENCY_FALLBACK_COLOR);
      return { pieData: entries, pieColors: colors };
    }
    const entries = filteredHoldings.map((h) => ({
      name: h.ticker ?? h.name,
      value: convertFromRon(h.value_ron, dc, fxRates),
    }));
    const colors = entries.map((_, i) => COLORS[i % COLORS.length]);
    return { pieData: entries, pieColors: colors };
  }, [filteredHoldings, chartMode, dc, fxRates, selectedLabels]);

  const pieTotal = useMemo(
    () => pieData.reduce((sum, d) => sum + d.value, 0),
    [pieData]
  );

  function handleCurrencyChange(val: string) {
    setDisplayCurrency(val);
    localStorage.setItem(STORAGE_KEY_CURRENCY, val);
  }

  function toggleGroup() {
    setGroupByCurrency((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY_GROUP, String(next));
      return next;
    });
  }

  function toggleLabelFilterMode() {
    setLabelFilterMode((prev) => {
      const next = prev === "AND" ? "OR" : "AND";
      localStorage.setItem(STORAGE_KEY_LABEL_FILTER, next);
      return next;
    });
  }

  function toggleLabel(id: number) {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function applyFilter(filter: SavedLabelFilter) {
    setSelectedLabels(filter.label_ids);
    setLabelFilterMode(filter.filter_mode);
    setChartMode(filter.chart_mode);
    localStorage.setItem(STORAGE_KEY_LABEL_FILTER, filter.filter_mode);
    setSavePopoverOpen(false);
  }

  function handleSaveFilter() {
    if (!saveFilterName.trim()) return;
    createFilterMutation.mutate({
      name: saveFilterName.trim(),
      label_ids: selectedLabels,
      filter_mode: labelFilterMode,
      chart_mode: chartMode,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load portfolio: {error instanceof Error ? error.message : "Unknown error"}
        <Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { currency_totals, grand_total_ron, fx_rates } = data;

  const currencyOptions = Object.keys(fx_rates).sort();
  const grandTotalDisplay = convertFromRon(grand_total_ron, dc, fx_rates);

  const hasHoldings = holdings.length > 0;

  // Group holdings by native currency for the group-by view
  const groupedHoldings: Map<string, HoldingDetail[]> = new Map();
  if (groupByCurrency) {
    for (const h of filteredHoldings) {
      const group = groupedHoldings.get(h.currency) || [];
      group.push(h);
      groupedHoldings.set(h.currency, group);
    }
  }

  function renderHoldingRow(h: HoldingDetail) {
    const displayValue = convertFromRon(h.value_ron, dc, fx_rates);
    return (
      <TableRow key={`${h.type}-${h.id}`}>
        <TableCell className="w-[90px]">
          {h.ticker && (
            <Badge variant="secondary">{h.ticker}</Badge>
          )}
        </TableCell>
        <TableCell className="font-medium">{h.name}</TableCell>
        <TableCell>
          <LabelBadges labels={h.labels ?? []} />
        </TableCell>
        <TableCell className="text-right">
          {h.shares != null ? formatNumber(h.shares) : "—"}
        </TableCell>
        <TableCell className="text-right">
          {h.price != null
            ? `${formatNumber(h.price)} ${h.currency}`
            : "—"}
        </TableCell>
        <TableCell className="text-right">
          {formatNumber(h.value)} {h.currency}
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatNumber(displayValue)} {dc}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with currency selector and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
          <Select value={displayCurrency} onValueChange={handleCurrencyChange}>
            <SelectTrigger size="sm" className="w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencyOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={groupByCurrency ? "default" : "outline"}
            size="sm"
            onClick={toggleGroup}
            title="Group by currency"
          >
            <ListIcon className="size-4" />
            <span className="hidden sm:inline">Group</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCwIcon className={isFetching ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {!hasHoldings ? (
        <p className="text-sm text-muted-foreground py-4">
          No holdings yet. Add some on the Holdings tab to see your portfolio.
        </p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-2 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            {/* Grand total — highlighted */}
            <Card className="border-primary/25 bg-gradient-to-br from-primary/8 to-primary/4">
              <CardHeader className="pb-0.5 px-3 pt-3 sm:px-5 sm:pt-5 sm:pb-1.5">
                <CardTitle className="text-[10px] leading-tight sm:text-xs font-semibold text-primary/70 uppercase tracking-wider">
                  Portfolio Total ({dc})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 sm:px-5 sm:pb-5">
                <p className="text-xl leading-tight sm:text-3xl font-bold text-primary">
                  {formatNumber(grandTotalDisplay)}{" "}
                  <span className="text-base sm:text-lg font-semibold opacity-75">{dc}</span>
                </p>
              </CardContent>
            </Card>

            {currency_totals.map((ct) => {
              const ctDisplay = convertFromRon(ct.total_ron, dc, fx_rates);
              const accentColor = CURRENCY_COLORS[ct.currency] ?? CURRENCY_FALLBACK_COLOR;

              // Calculate the conversion rate from ct.currency to dc
              let conversionRate: number | null = null;
              if (ct.currency !== dc) {
                if (ct.currency === "RON") {
                  conversionRate = 1 / fx_rates[dc];
                } else if (dc === "RON") {
                  conversionRate = fx_rates[ct.currency];
                } else {
                  conversionRate = fx_rates[ct.currency] / fx_rates[dc];
                }
              }

              return (
                <Card
                  key={ct.currency}
                  className="overflow-hidden"
                  style={{ borderLeftColor: accentColor, borderLeftWidth: "3px" }}
                >
                  <CardHeader className="pb-0.5 px-3 pt-3 sm:px-5 sm:pt-5 sm:pb-1.5">
                    <CardTitle className="text-[10px] leading-tight sm:text-xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
                      {ct.currency} Holdings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 sm:px-5 sm:pb-5">
                    <p className="text-base leading-tight sm:text-xl font-bold">
                      {formatNumber(ct.total)}{" "}
                      <span className="text-sm font-medium text-muted-foreground">{ct.currency}</span>
                    </p>
                    {ct.currency !== dc && conversionRate && (
                      <p className="text-[9px] leading-tight sm:text-xs text-muted-foreground mt-0.5">
                        ≈ {formatNumber(ctDisplay)} {dc}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pie chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Allocation
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">({dc} equivalent)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Chart controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border">
                  <button
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      chartMode === "holding"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setChartMode("holding")}
                  >
                    By Holding
                  </button>
                  <button
                    className={`px-3 py-1 text-xs font-medium border-l transition-colors ${
                      chartMode === "currency"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setChartMode("currency")}
                  >
                    By Currency
                  </button>
                  <button
                    className={`px-3 py-1 text-xs font-medium border-l transition-colors ${
                      chartMode === "label"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setChartMode("label")}
                  >
                    By Label
                  </button>
                </div>
                {allLabels.length > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground ml-1">Filter:</span>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium hover:bg-muted transition-colors"
                      onClick={toggleLabelFilterMode}
                      title={`Switch to ${labelFilterMode === "AND" ? "OR" : "AND"} mode`}
                    >
                      <FilterIcon className="size-3" />
                      {labelFilterMode}
                    </button>
                    {allLabels.map((l) => {
                      const isSelected = selectedLabels.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all ${
                            isSelected
                              ? "opacity-100 ring-1 ring-offset-1 scale-105"
                              : selectedLabels.length > 0
                                ? "opacity-30 saturate-0"
                                : "opacity-100"
                          }`}
                          style={
                            l.color
                              ? {
                                  backgroundColor: l.color + "20",
                                  borderColor: l.color,
                                  color: l.color,
                                  ...(isSelected ? { "--tw-ring-color": l.color } as React.CSSProperties : {}),
                                }
                              : {}
                          }
                          onClick={() => toggleLabel(l.id)}
                        >
                          {l.color && (
                            <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                          )}
                          {l.name}
                        </button>
                      );
                    })}
                    {selectedLabels.length > 0 && (
                      <button
                        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedLabels([])}
                      >
                        <XIcon className="size-3" />
                        Clear
                      </button>
                    )}
                    <Popover open={savePopoverOpen} onOpenChange={setSavePopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium hover:bg-muted transition-colors"
                          title="Saved filters"
                        >
                          <BookmarkIcon className="size-3" />
                          {savedFilters.length > 0 && (
                            <span className="text-muted-foreground">{savedFilters.length}</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3" align="start">
                        <p className="text-xs font-semibold mb-2">Saved filters</p>
                        {savedFilters.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No saved filters yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {savedFilters.map((f) => (
                              <div key={f.id} className="flex items-center gap-1.5 group">
                                <button
                                  className="flex-1 text-left text-xs truncate hover:text-primary py-0.5"
                                  onClick={() => applyFilter(f)}
                                >
                                  {f.name}
                                </button>
                                <span className="shrink-0 text-[10px] text-muted-foreground border rounded px-1">
                                  {f.chart_mode === "holding" ? "Holding" : f.chart_mode === "currency" ? "Currency" : "Label"}
                                </span>
                                <span className="shrink-0 text-[10px] font-mono text-muted-foreground border rounded px-1">
                                  {f.filter_mode}
                                </span>
                                <button
                                  className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                  onClick={() => deleteFilterMutation.mutate(f.id)}
                                  title="Delete saved filter"
                                >
                                  <Trash2Icon className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <>
                          <div className="border-t my-2" />
                          <p className="text-xs font-semibold mb-1.5">Save current selection</p>
                            <div className="flex gap-1.5">
                              <Input
                                className="h-7 text-xs"
                                placeholder="Filter name..."
                                value={saveFilterName}
                                onChange={(e) => setSaveFilterName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveFilter()}
                              />
                              <Button
                                size="sm"
                                className="h-7 text-xs px-2 shrink-0"
                                disabled={!saveFilterName.trim() || createFilterMutation.isPending}
                                onClick={handleSaveFilter}
                              >
                                Save
                              </Button>
                            </div>
                          </>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
              <div className="h-[300px] sm:h-[400px] lg:h-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                      label={false}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={pieColors[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const { name, value } = payload[0].payload as { name: string; value: number };
                        const pct = pieTotal > 0 ? ((value / pieTotal) * 100).toFixed(1) : "0.0";
                        return (
                          <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs">
                            <p className="font-semibold mb-1">{name}</p>
                            <p className="text-foreground">{formatNumber(value)} {dc}</p>
                            <p className="text-muted-foreground">{pct}%</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {selectedLabels.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Showing: {formatNumber(pieTotal)} {dc} ({filteredHoldings.length} holding{filteredHoldings.length !== 1 ? "s" : ""})
                </p>
              )}
              {/* Color-coded legend with percentages */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: pieColors[i] }}
                    />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {formatNumber(d.value)} {dc} ({pieTotal > 0 ? ((d.value / pieTotal) * 100).toFixed(1) : "0.0"}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Holdings table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Holdings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop: Table */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Ticker</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Labels</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Value ({dc})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupByCurrency ? (
                      Array.from(groupedHoldings.entries()).map(([currency, items]) => {
                        const subtotalRon = items.reduce((sum, h) => sum + h.value_ron, 0);
                        const subtotalDisplay = convertFromRon(subtotalRon, dc, fx_rates);
                        return (
                          <Fragment key={`group-${currency}`}>
                            <TableRow className="bg-muted/50">
                              <TableCell colSpan={6} className="font-semibold text-xs uppercase tracking-wide">
                                {currency}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-xs">
                                {formatNumber(subtotalDisplay)} {dc}
                              </TableCell>
                            </TableRow>
                            {items.map(renderHoldingRow)}
                          </Fragment>
                        );
                      })
                    ) : (
                      filteredHoldings.map(renderHoldingRow)
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: Card layout */}
              <div className="md:hidden p-4 space-y-3">
                {groupByCurrency ? (
                  Array.from(groupedHoldings.entries()).map(([currency, items]) => {
                    const subtotalRon = items.reduce((sum, h) => sum + h.value_ron, 0);
                    const subtotalDisplay = convertFromRon(subtotalRon, dc, fx_rates);
                    return (
                      <div key={`group-${currency}`} className="space-y-2">
                        {/* Currency group header */}
                        <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                          <span className="text-xs font-semibold uppercase tracking-wide">
                            {currency}
                          </span>
                          <span className="text-xs font-semibold">
                            {formatNumber(subtotalDisplay)} {dc}
                          </span>
                        </div>
                        {/* Holdings in this currency */}
                        {items.map((h) => {
                          const displayValue = convertFromRon(h.value_ron, dc, fx_rates);
                          return (
                            <div key={`${h.type}-${h.id}`} className="border rounded-md p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{h.name}</div>
                                  {h.ticker && (
                                    <Badge variant="secondary" className="mt-1 text-xs">
                                      {h.ticker}
                                    </Badge>
                                  )}
                                  <LabelBadges labels={h.labels ?? []} />
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-sm font-semibold">
                                    {formatNumber(displayValue)} {dc}
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                                {h.shares != null && (
                                  <div>
                                    <span className="text-muted-foreground">Shares:</span>{" "}
                                    <span className="font-medium">{formatNumber(h.shares)}</span>
                                  </div>
                                )}
                                {h.price != null && (
                                  <div className="text-right">
                                    <span className="text-muted-foreground">Price:</span>{" "}
                                    <span className="font-medium">{formatNumber(h.price)} {h.currency}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                ) : (
                  filteredHoldings.map((h) => {
                    const displayValue = convertFromRon(h.value_ron, dc, fx_rates);
                    return (
                      <div key={`${h.type}-${h.id}`} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{h.name}</div>
                            {h.ticker && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {h.ticker}
                              </Badge>
                            )}
                            <LabelBadges labels={h.labels ?? []} />
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold">
                              {formatNumber(displayValue)} {dc}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                          {h.shares != null && (
                            <div>
                              <span className="text-muted-foreground">Shares:</span>{" "}
                              <span className="font-medium">{formatNumber(h.shares)}</span>
                            </div>
                          )}
                          {h.price != null && (
                            <div className="text-right">
                              <span className="text-muted-foreground">Price:</span>{" "}
                              <span className="font-medium">{formatNumber(h.price)} {h.currency}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
