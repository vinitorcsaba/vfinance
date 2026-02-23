import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import { getROI } from "@/api/snapshots";
import type { ROIResponse } from "@/types/snapshot";
import type { DateRange } from "@/components/PortfolioChart";

type Currency = "RON" | "EUR" | "USD";

interface ROIPanelProps {
  displayCurrency: Currency;
  dateRange: DateRange;
}

function convertRon(valueRon: number | null, currency: Currency, fxRates: Record<string, number>): number | null {
  if (valueRon === null) return null;
  if (currency === "RON") return valueRon;
  const rate = fxRates[currency];
  if (!rate) return null;
  return valueRon / rate;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtValue(value: number | null, currency: Currency): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function fmtAbsolute(value: number | null, currency: Currency): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function ROIPanel({ displayCurrency, dateRange }: ROIPanelProps) {
  const [data, setData] = useState<ROIResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getROI(dateRange)
      .then(setData)
      .catch(() => toast.error("Failed to load ROI data"))
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 border rounded-md">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.snapshot_count < 2 || data.roi_percent === undefined) {
    return (
      <div className="flex items-center justify-center py-6 border rounded-md">
        <p className="text-sm text-muted-foreground">
          Not enough snapshots to calculate ROI for this period.
        </p>
      </div>
    );
  }

  const roiPct = data.roi_percent;
  const roiColor =
    roiPct === null || roiPct === 0
      ? "text-muted-foreground"
      : roiPct > 0
      ? "text-green-600"
      : "text-red-600";

  const startDisplay = convertRon(data.start_value_ron, displayCurrency, data.fx_rates);
  const endDisplay = convertRon(data.end_value_ron, displayCurrency, data.fx_rates);
  const gainDisplay = convertRon(data.absolute_gain_ron, displayCurrency, data.fx_rates);

  return (
    <div className="border rounded-md p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Return on Investment</span>
        {data.period_start && data.period_end && (
          <>
            <span>•</span>
            <span>
              {fmtDate(data.period_start)} – {fmtDate(data.period_end)}
            </span>
          </>
        )}
        <span>•</span>
        <span>{data.snapshot_count} snapshots</span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* ROI % */}
        <div className="bg-muted/40 rounded-md p-3 space-y-1">
          <p className="text-xs text-muted-foreground">ROI</p>
          <p className={`text-xl font-bold ${roiColor}`}>
            {roiPct === null ? "—" : `${roiPct > 0 ? "+" : ""}${roiPct.toFixed(2)}%`}
          </p>
        </div>

        {/* Absolute Gain */}
        <div className="bg-muted/40 rounded-md p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Absolute Gain</p>
          <p className={`text-base font-semibold ${roiColor}`}>
            {fmtAbsolute(gainDisplay, displayCurrency)}
          </p>
        </div>

        {/* Starting Value */}
        <div className="bg-muted/40 rounded-md p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Starting Value</p>
          <p className="text-base font-semibold">
            {fmtValue(startDisplay, displayCurrency)}
          </p>
        </div>

        {/* End Value */}
        <div className="bg-muted/40 rounded-md p-3 space-y-1">
          <p className="text-xs text-muted-foreground">End Value</p>
          <p className="text-base font-semibold">
            {fmtValue(endDisplay, displayCurrency)}
          </p>
        </div>
      </div>
    </div>
  );
}
