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
  selectedLabels?: string[];
}

/** Pick the correct pre-stored historical currency field from the ROI response. */
function pick(data: ROIResponse, currency: Currency, ron: keyof ROIResponse, eur: keyof ROIResponse, usd: keyof ROIResponse): number | null {
  const val = currency === "EUR" ? data[eur] : currency === "USD" ? data[usd] : data[ron];
  return (val as number | null | undefined) ?? null;
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
  return `${value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function fmtSigned(value: number | null, currency: Currency): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function ROIPanel({ displayCurrency, dateRange, selectedLabels }: ROIPanelProps) {
  const [data, setData] = useState<ROIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    getROI(dateRange, selectedLabels)
      .then((d) => { setData(d); setLoadError(false); })
      .catch(() => { toast.error("Failed to load ROI data"); setLoadError(true); })
      .finally(() => setLoading(false));
  }, [dateRange, selectedLabels]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 border rounded-md">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center py-6 border rounded-md">
        <p className="text-sm text-muted-foreground">Failed to load ROI data.</p>
      </div>
    );
  }

  if (!data || data.snapshot_count < 2) {
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

  const startDisplay  = pick(data, displayCurrency, "start_value_ron",      "start_value_eur",      "start_value_usd");
  const endDisplay    = pick(data, displayCurrency, "end_value_ron",        "end_value_eur",        "end_value_usd");
  const gainDisplay   = pick(data, displayCurrency, "absolute_gain_ron",    "absolute_gain_eur",    "absolute_gain_usd");
  const investedDisplay = pick(data, displayCurrency, "stock_cash_flows_ron", "stock_cash_flows_eur", "stock_cash_flows_usd");

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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
            {fmtSigned(gainDisplay, displayCurrency)}
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

        {/* Net Invested */}
        <div className="bg-muted/40 rounded-md p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Net Invested</p>
          <p className="text-base font-semibold">
            {fmtSigned(investedDisplay, displayCurrency)}
          </p>
        </div>
      </div>
    </div>
  );
}
