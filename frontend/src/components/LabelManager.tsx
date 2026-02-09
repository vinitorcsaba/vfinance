import { useRef, useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon, CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getLabels, createLabel, updateLabel, deleteLabel } from "@/api/labels";
import type { Label } from "@/types/labels";

const PRESET_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#4f46e5", "#d97706", "#059669", "#dc2626",
  "#8b5cf6", "#f43f5e", "#14b8a6", "#f97316", "#818cf8", "#84cc16",
];

export function LabelManager() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [error, setError] = useState("");
  const fetched = useRef(false);

  async function fetchLabels() {
    try {
      setLabels(await getLabels());
    } catch {
      /* ignore */
    }
  }

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !fetched.current) {
      fetched.current = true;
      fetchLabels();
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createLabel({ name: newName.trim(), color: newColor });
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
      setError("");
      await fetchLabels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create label");
    }
  }

  async function handleUpdate(id: number) {
    try {
      await updateLabel(id, { name: editName.trim() || undefined, color: editColor || undefined });
      setEditingId(null);
      setError("");
      await fetchLabels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update label");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteLabel(id);
      setError("");
      await fetchLabels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete label");
    }
  }

  return (
    <section className="space-y-3">
      <button
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={handleExpand}
      >
        <span className="text-xs">{expanded ? "▾" : "▸"}</span>
        Labels ({labels.length})
      </button>

      {expanded && (
        <div className="space-y-3 pl-4 border-l-2 border-muted">
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Create form */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="New label name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-sm w-40"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="grid grid-cols-8 gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className="size-5 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: c === newColor ? "white" : "transparent",
                    boxShadow: c === newColor ? `0 0 0 2px ${c}` : "none",
                  }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={handleCreate}>
              <PlusIcon className="size-3" /> Add
            </Button>
          </div>

          {/* Label list */}
          <div className="flex flex-wrap gap-2">
            {labels.map((label) =>
              editingId === label.id ? (
                <div key={label.id} className="flex items-center gap-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-xs w-28"
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate(label.id)}
                  />
                  <div className="grid grid-cols-8 gap-0.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        className="size-4 rounded-full border"
                        style={{
                          backgroundColor: c,
                          borderColor: c === editColor ? "white" : "transparent",
                          boxShadow: c === editColor ? `0 0 0 1px ${c}` : "none",
                        }}
                        onClick={() => setEditColor(c)}
                      />
                    ))}
                  </div>
                  <Button size="icon-xs" variant="ghost" onClick={() => handleUpdate(label.id)}>
                    <CheckIcon className="size-3" />
                  </Button>
                  <Button size="icon-xs" variant="ghost" onClick={() => setEditingId(null)}>
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ) : (
                <Badge
                  key={label.id}
                  variant="secondary"
                  className="gap-1 pr-1"
                  style={label.color ? { backgroundColor: label.color + "20", borderColor: label.color, color: label.color } : {}}
                >
                  {label.color && (
                    <span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
                  )}
                  {label.name}
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="size-4 ml-0.5"
                    onClick={() => {
                      setEditingId(label.id);
                      setEditName(label.name);
                      setEditColor(label.color || PRESET_COLORS[0]);
                    }}
                  >
                    <PencilIcon className="size-2.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="size-4"
                    onClick={() => handleDelete(label.id)}
                  >
                    <Trash2Icon className="size-2.5 text-destructive" />
                  </Button>
                </Badge>
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}
