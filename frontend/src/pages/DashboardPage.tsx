import { useQuery } from "@tanstack/react-query";
import { RefreshCwIcon, Loader2Icon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPortfolio } from "@/api/portfolio";

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#4f46e5", "#c026d3", "#d97706", "#059669",
];

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString("en", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolio,
    staleTime: 60_000,
  });

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

  const pieData = holdings.map((h) => ({
    name: h.name,
    value: h.value_ron,
  }));

  const hasHoldings = holdings.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Portfolio Dashboard</h2>
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
                  Grand Total (RON)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatNumber(grand_total_ron)} RON</p>
              </CardContent>
            </Card>

            {currency_totals.map((ct) => (
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
                  {ct.currency !== "RON" && (
                    <p className="text-sm text-muted-foreground">
                      = {formatNumber(ct.total_ron)} RON
                      {fx_rates[ct.currency] && (
                        <span className="ml-1">
                          (rate: {fx_rates[ct.currency].toFixed(4)})
                        </span>
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pie chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Allocation (RON equivalent)
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
                      formatter={(value) => `${formatNumber(Number(value))} RON`}
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
                      <TableHead className="text-right">Value (RON)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((h) => (
                      <TableRow key={`${h.type}-${h.id}`}>
                        <TableCell className="font-medium">
                          {h.name}
                          {h.ticker && (
                            <Badge variant="secondary" className="ml-2">
                              {h.ticker}
                            </Badge>
                          )}
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
                          {formatNumber(h.value_ron)} RON
                        </TableCell>
                      </TableRow>
                    ))}
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
