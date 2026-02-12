import { useEffect, useState } from "react";
import { CheckIcon, SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { assignAllocations, getGroupMembers } from "@/api/allocation-groups";
import { getPortfolio } from "@/api/portfolio";
import type { AllocationMember } from "@/types/allocation-groups";

interface Holding {
  id: number;
  type: "stock" | "manual";
  name: string;
  ticker: string | null;
}

interface AllocationGroupDialogProps {
  groupId: number;
  groupName: string;
  onUpdate?: () => void;
}

export function AllocationGroupDialog({
  groupId,
  groupName,
  onUpdate,
}: AllocationGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selected, setSelected] = useState<Map<string, number>>(new Map()); // key: "type-id", value: target_percentage
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, groupId]);

  async function loadData() {
    try {
      // Fetch all holdings
      const portfolio = await getPortfolio();
      const allHoldings: Holding[] = portfolio.holdings.map((h: any) => ({
        id: h.id,
        type: h.type,
        name: h.name,
        ticker: h.ticker,
      }));
      setHoldings(allHoldings);

      // Fetch current members
      const members = await getGroupMembers(groupId);
      const selectedMap = new Map<string, number>();
      members.forEach((m) => {
        const key = `${m.holding_type}-${m.holding_id}`;
        selectedMap.set(key, m.target_percentage);
      });
      setSelected(selectedMap);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  function toggleHolding(holding: Holding) {
    const key = `${holding.type}-${holding.id}`;
    const newSelected = new Map(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      // Default to equal distribution
      const count = newSelected.size + 1;
      const defaultPct = Math.round((100 / count) * 10) / 10;
      newSelected.set(key, defaultPct);
      // Redistribute existing
      newSelected.forEach((_, k) => {
        newSelected.set(k, defaultPct);
      });
    }
    setSelected(newSelected);
  }

  function updatePercentage(key: string, value: string) {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 100) return;
    const newSelected = new Map(selected);
    newSelected.set(key, num);
    setSelected(newSelected);
  }

  function validatePercentageSum(): { valid: boolean; total: number } {
    const total = Array.from(selected.values()).reduce((sum, pct) => sum + pct, 0);
    const valid = total >= 99.9 && total <= 100.1;
    return { valid, total };
  }

  async function handleSave() {
    const { valid } = validatePercentageSum();
    if (!valid) {
      setError("Target percentages must sum to 100%");
      return;
    }

    const members: AllocationMember[] = Array.from(selected.entries()).map(
      ([key, target_percentage]) => {
        const [holding_type, holding_id] = key.split("-");
        return {
          holding_type: holding_type as "stock" | "manual",
          holding_id: parseInt(holding_id),
          target_percentage,
        };
      }
    );

    setSaving(true);
    try {
      await assignAllocations(groupId, { members });
      setError("");
      setOpen(false);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save allocations");
    } finally {
      setSaving(false);
    }
  }

  const { valid, total } = validatePercentageSum();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <SettingsIcon className="size-3" /> Manage Holdings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Holdings - {groupName}</DialogTitle>
          <DialogDescription>
            Select holdings and set target percentage allocations. Must sum to 100%.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center text-xs font-medium text-muted-foreground pb-2 border-b">
            <div className="w-8"></div>
            <div>Holding</div>
            <div className="w-24 text-right">Target %</div>
          </div>

          {holdings.map((holding) => {
            const key = `${holding.type}-${holding.id}`;
            const isSelected = selected.has(key);
            const percentage = selected.get(key) ?? 0;

            return (
              <div
                key={key}
                className="grid grid-cols-[auto_1fr_auto] gap-2 items-center py-1"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleHolding(holding)}
                />
                <div className="text-sm">
                  {holding.name}
                  {holding.ticker && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({holding.ticker})
                    </span>
                  )}
                </div>
                {isSelected ? (
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={percentage}
                    onChange={(e) => updatePercentage(key, e.target.value)}
                    className="w-24 h-7 text-sm text-right"
                  />
                ) : (
                  <div className="w-24"></div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div
            className={`text-sm font-medium ${
              valid ? "text-green-600" : "text-destructive"
            }`}
          >
            Total: {total.toFixed(1)}%
            {!valid && selected.size > 0 && " (must be 100%)"}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!valid || selected.size === 0 || saving}>
            {saving ? "Saving..." : "Save"}
            {valid && <CheckIcon className="size-3 ml-1" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
