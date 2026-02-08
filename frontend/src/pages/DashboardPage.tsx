import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCwIcon, Loader2Icon, ListIcon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
import { LabelBadges } from "@/components/LabelAssignPopover";
import { getPortfolio } from "@/api/portfolio";
import type { HoldingDetail } from "@/types/portfolio";

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#4f46e5", "#c026d3", "#d97706", "#059669",
];

const STORAGE_KEY_CURRENCY = "vfinance-display-currency";
const STORAGE_KEY_GROUP = "vfinance-group-by-currency";

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

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolio,
    staleTime: 60_000,
  });

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

  const { holdings, currency_totals, grand_total_ron, fx_rates } = data;

  const currencyOptions = Object.keys(fx_rates).sort();
  const dc = displayCurrency;
  const grandTotalDisplay = convertFromRon(grand_total_ron, dc, fx_rates);

  const pieData = holdings.map((h) => ({
    name: h.name,
    value: convertFromRon(h.value_ron, dc, fx_rates),
  }));

  const hasHoldings = holdings.length > 0;

  // Group holdings by native currency for the group-by view
  const groupedHoldings: Map<string, HoldingDetail[]> = new Map();
  if (groupByCurrency) {
    for (const h of holdings) {
      const group = groupedHoldings.get(h.currency) || [];
      group.push(h);
      groupedHoldings.set(h.currency, group);
    }
  }

  function renderHoldingRow(h: HoldingDetail) {
    const displayValue = convertFromRon(h.value_ron, dc, fx_rates);
    return (
      <TableRow key={`${h.type}-${h.id}`}>
        <TableCell className="font-medium">
          {h.name}
          {h.ticker && (
            <Badge variant="secondary" className="ml-2">
              {h.ticker}
            </Badge>
          )}
          <LabelBadges labels={h.labels ?? []} />
        </TableCell>
        <TableCell>
          <Badge variant="outline">{h.type}</Badge>
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
          <h2 className="text-lg font-semibold">Portfolio Dashboard</h2>
          <Select value={displayCurrency} onValueChange={handleCurrencyChange}>
            <SelectTrigger size="sm" className="w-[90px]">
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
            Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCwIcon className={isFetching ? "animate-spin" : ""} />
            Refresh
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Grand Total ({dc})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatNumber(grandTotalDisplay)} {dc}</p>
              </CardContent>
            </Card>

            {currency_totals.map((ct) => {
              const ctDisplay = convertFromRon(ct.total_ron, dc, fx_rates);
              return (
                <Card key={ct.currency}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {ct.currency} Total
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-semibold">
                      {formatNumber(ct.total)} {ct.currency}
                    </p>
                    {ct.currency !== dc && (
                      <p className="text-sm text-muted-foreground">
                        = {formatNumber(ctDisplay)} {dc}
                        {fx_rates[ct.currency] && (
                          <span className="ml-1">
                            (rate: {fx_rates[ct.currency].toFixed(4)})
                          </span>
                        )}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pie chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Allocation ({dc} equivalent)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ""} (${((percent ?? 0) * 100).toFixed(1)}%)`
                      }
                      labelLine
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `${formatNumber(Number(value))} ${dc}`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Holdings table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Holdings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
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
                              <TableCell colSpan={5} className="font-semibold text-xs uppercase tracking-wide">
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
                      holdings.map(renderHoldingRow)
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
