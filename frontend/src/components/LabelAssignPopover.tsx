import { useCallback, useRef, useState } from "react";
import { CheckIcon, TagIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getLabels, assignStockLabels, assignManualLabels } from "@/api/labels";
import type { Label } from "@/types/labels";

interface LabelAssignPopoverProps {
  holdingType: "stock" | "manual";
  holdingId: number;
  currentLabels: Label[];
  onAssigned: () => void;
}

export function LabelAssignPopover({
  holdingType,
  holdingId,
  currentLabels,
  onAssigned,
}: LabelAssignPopoverProps) {
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const prevOpen = useRef(false);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen && !prevOpen.current) {
        getLabels().then(setAllLabels).catch(() => {});
        setSelectedIds(new Set(currentLabels.map((l) => l.id)));
      }
      prevOpen.current = isOpen;
      setOpen(isOpen);
    },
    [currentLabels],
  );

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const ids = Array.from(selectedIds);
    if (holdingType === "stock") {
      await assignStockLabels(holdingId, ids);
    } else {
      await assignManualLabels(holdingId, ids);
    }
    setOpen(false);
    prevOpen.current = false;
    onAssigned();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-6 text-muted-foreground hover:text-foreground"
          title="Assign labels"
        >
          <TagIcon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="end">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b">
          <TagIcon className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Assign labels</span>
        </div>

        {/* Label list */}
        {allLabels.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">
            No labels created yet.
          </p>
        ) : (
          <ul className="py-1 max-h-52 overflow-y-auto">
            {allLabels.map((label) => {
              const checked = selectedIds.has(label.id);
              return (
                <li key={label.id}>
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                    onClick={() => toggle(label.id)}
                  >
                    {/* Checkbox */}
                    <span
                      className="flex items-center justify-center size-4 rounded border-2 shrink-0 transition-colors"
                      style={
                        checked
                          ? {
                              backgroundColor: label.color ?? "#2563eb",
                              borderColor: label.color ?? "#2563eb",
                            }
                          : { borderColor: "#d1d5db" }
                      }
                    >
                      {checked && <CheckIcon className="size-2.5 text-white stroke-[3]" />}
                    </span>
                    {/* Color dot */}
                    {label.color && (
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                    )}
                    {/* Name */}
                    <span className="truncate">{label.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 px-3 py-2 border-t bg-muted/20">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LabelBadges({
  labels,
}: {
  labels: { id: number; name: string; color: string | null }[];
}) {
  if (labels.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {labels.map((l) => (
        <span
          key={l.id}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none"
          style={
            l.color
              ? {
                  backgroundColor: l.color + "18",
                  borderColor: l.color + "60",
                  color: l.color,
                }
              : {
                  backgroundColor: "hsl(var(--muted))",
                  borderColor: "hsl(var(--border))",
                }
          }
        >
          {l.color && (
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: l.color }}
            />
          )}
          {l.name}
        </span>
      ))}
    </span>
  );
}
