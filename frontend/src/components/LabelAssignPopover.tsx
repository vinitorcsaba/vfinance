import { useCallback, useRef, useState } from "react";
import { TagIcon, CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        <Button variant="ghost" size="icon-xs" title="Assign labels">
          <TagIcon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-medium text-muted-foreground mb-2">Assign labels</p>
        {allLabels.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No labels created yet.</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {allLabels.map((label) => (
              <button
                key={label.id}
                className="flex items-center gap-2 w-full rounded px-2 py-1 text-sm hover:bg-accent transition-colors"
                onClick={() => toggle(label.id)}
              >
                <span
                  className="flex items-center justify-center size-4 rounded border"
                  style={selectedIds.has(label.id) ? {
                    backgroundColor: label.color || "#2563eb",
                    borderColor: label.color || "#2563eb",
                  } : {}}
                >
                  {selectedIds.has(label.id) && (
                    <CheckIcon className="size-3 text-white" />
                  )}
                </span>
                {label.color && (
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                )}
                {label.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-2 pt-2 border-t">
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LabelBadges({ labels }: { labels: { id: number; name: string; color: string | null }[] }) {
  if (labels.length === 0) return null;
  return (
    <span className="inline-flex gap-1 ml-2">
      {labels.map((l) => (
        <Badge
          key={l.id}
          variant="secondary"
          className="text-[10px] px-1.5 py-0"
          style={l.color ? { backgroundColor: l.color + "20", borderColor: l.color, color: l.color } : {}}
        >
          {l.color && <span className="size-1.5 rounded-full mr-0.5" style={{ backgroundColor: l.color }} />}
          {l.name}
        </Badge>
      ))}
    </span>
  );
}
