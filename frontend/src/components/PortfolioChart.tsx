import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getChartData } from "@/api/snapshots";
import { getLabels } from "@/api/labels";
import { getPortfolio } from "@/api/portfolio";
import type { ChartDataPoint } from "@/types/snapshot";
import type { Label } from "@/types/labels";

type Currency = "RON" | "EUR" | "USD";
type DateRange = "3m" | "6m" | "1y" | "all";

interface PortfolioChartProps {
  displayCurrency: Currency;
}

export function PortfolioChart({ displayCurrency }: PortfolioChartProps) {
  const { data: portfolio } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolio,
  });

  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all labels for filter
    getLabels()
      .then(setAllLabels)
      .catch(() => toast.error("Failed to load labels"));
  }, []);

  useEffect(() => {
    // Fetch chart data
    setLoading(true);
    getChartData({ labels: selectedLabels, range: dateRange })
      .then((response) => setChartData(response.points))
      .catch(() => toast.error("Failed to load chart data"))
      .finally(() => setLoading(false));
  }, [selectedLabels, dateRange]);

  const convertFromRon = (valueRon: number): number => {
    if (displayCurrency === "RON") return valueRon;
    const fxRates = portfolio?.fx_rates || { eur_ron: 1, usd_ron: 1 };
    if (displayCurrency === "EUR") return valueRon / fxRates.eur_ron;
    if (displayCurrency === "USD") return valueRon / fxRates.usd_ron;
    return valueRon;
  };

  const chartDataInDisplayCurrency = chartData.map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    }),
    value: convertFromRon(point.total_ron),
  }));

  const toggleLabel = (labelName: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelName)
        ? prev.filter((l) => l !== labelName)
        : [...prev, labelName]
    );
  };

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
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["3m", "6m", "1y", "all"] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange(range)}
            >
              {range.toUpperCase()}
            </Button>
          ))}
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
                  backgroundColor: isSelected && label.color ? `${label.color}10` : undefined,
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
      <div className="border rounded-md p-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartDataInDisplayCurrency}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: "12px" }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: "12px" }}
              tickFormatter={(value) =>
                value.toLocaleString("en", { maximumFractionDigits: 0 })
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number | undefined) => {
                if (value === undefined) return ["—", "Value"];
                return [
                  `${value.toLocaleString("en", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ${displayCurrency}`,
                  "Value",
                ];
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
