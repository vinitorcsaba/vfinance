import { useState, useEffect } from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getGroupAnalysis } from "@/api/allocation-groups";
import { AllocationGroupDialog } from "@/components/AllocationGroupDialog";
import type { AllocationGroupAnalysis } from "@/types/allocation-groups";

interface AllocationAnalysisCardProps {
  groupId: number;
  groupName: string;
  groupColor: string | null;
  displayCurrency?: string;
  onUpdate?: () => void;
}

export function AllocationAnalysisCard({
  groupId,
  groupName,
  groupColor,
  displayCurrency = "RON",
  onUpdate,
}: AllocationAnalysisCardProps) {
  const [analysis, setAnalysis] = useState<AllocationGroupAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalysis();
  }, [groupId, displayCurrency]);

  async function loadAnalysis() {
    setLoading(true);
    try {
      const data = await getGroupAnalysis(groupId, displayCurrency);
      setAnalysis(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analysis");
    } finally {
      setLoading(false);
    }
  }

  function handleUpdate() {
    loadAnalysis();
    onUpdate?.();
  }

  if (loading) {
    return (
      <div className="border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!analysis) return null;

  const isEmpty = analysis.members.length === 0;

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            style={
              groupColor
                ? {
                    backgroundColor: groupColor + "20",
                    borderColor: groupColor,
                    color: groupColor,
                  }
                : {}
            }
          >
            {groupColor && (
              <span className="size-2 rounded-full mr-1" style={{ backgroundColor: groupColor }} />
            )}
            {groupName}
          </Badge>
          <div className="text-sm font-medium">
            Total: {analysis.total_value_display.toFixed(2)} {analysis.display_currency}
          </div>
        </div>
        <div className="flex gap-2">
          <AllocationGroupDialog
            groupId={groupId}
            groupName={groupName}
            onUpdate={handleUpdate}
          />
          <Button size="sm" variant="ghost" onClick={loadAnalysis}>
            <RefreshCwIcon className="size-3" />
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No holdings assigned to this group. Click "Manage Holdings" to add some.
        </div>
      )}

      {/* Analysis table */}
      {!isEmpty && (
        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_2fr] gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
            <div>Name</div>
            <div className="text-right">Current Value</div>
            <div className="text-right">Current %</div>
            <div className="text-right">Target %</div>
            <div className="text-right">Difference</div>
            <div className="text-right">Suggestion</div>
          </div>

          {/* Data rows */}
          {analysis.members.map((member) => {
            const displayName = member.ticker || member.name;
            const diff = member.difference;
            const diffColor = diff > 0.01 ? "text-green-600" : diff < -0.01 ? "text-red-600" : "text-muted-foreground";
            const suggestion =
              diff > 0.01
                ? `Add ${Math.abs(diff).toFixed(2)} ${member.currency}`
                : diff < -0.01
                ? `Reduce by ${Math.abs(diff).toFixed(2)} ${member.currency}`
                : "On target";

            return (
              <div
                key={`${member.holding_type}-${member.holding_id}`}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_2fr] gap-2 text-sm py-1 hover:bg-muted/50"
              >
                <div className="font-medium">{displayName}</div>
                <div className="text-right">
                  {member.current_value.toFixed(2)} {member.currency}
                </div>
                <div className="text-right">{member.current_percentage.toFixed(1)}%</div>
                <div className="text-right">{member.target_percentage.toFixed(1)}%</div>
                <div className={`text-right font-medium ${diffColor}`}>
                  {diff > 0 ? "+" : ""}
                  {diff.toFixed(2)} {member.currency}
                </div>
                <div className={`text-right ${diffColor}`}>{suggestion}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
