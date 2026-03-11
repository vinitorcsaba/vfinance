import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, PencilIcon, PlusIcon, TagIcon, Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLabels, createLabel, updateLabel, deleteLabel } from "@/api/labels";
import type { Label } from "@/types/labels";

const PRESET_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#4f46e5", "#d97706", "#059669", "#dc2626",
  "#8b5cf6", "#f43f5e", "#14b8a6", "#f97316", "#818cf8", "#84cc16",
];

const DEV_MOCK_LABELS: Label[] = [
  { id: 1,  name: "Tech",          color: "#2563eb" },
  { id: 2,  name: "Finance",       color: "#16a34a" },
  { id: 3,  name: "Energy",        color: "#ea580c" },
  { id: 4,  name: "Healthcare",    color: "#db2777" },
  { id: 5,  name: "Real Estate",   color: "#7c3aed" },
  { id: 6,  name: "Consumer",      color: "#0891b2" },
  { id: 7,  name: "Dividend",      color: "#d97706" },
  { id: 8,  name: "Growth",        color: "#059669" },
  { id: 9,  name: "ETF",           color: "#4f46e5" },
  { id: 10, name: "Crypto",        color: "#f43f5e" },
  { id: 11, name: "Long-term",     color: "#14b8a6" },
  { id: 12, name: "Speculative",   color: "#dc2626" },
  { id: 13, name: "BET Index",     color: "#818cf8" },
  { id: 14, name: "International", color: "#84cc16" },
  { id: 15, name: "Watchlist",     color: "#f97316" },
];

function ColorPicker({
  value,
  onChange,
  size = "md",
}: {
  value: string;
  onChange: (c: string) => void;
  size?: "sm" | "md";
}) {
  const dot = size === "sm" ? "size-4" : "size-5";
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          className={`${dot} rounded-full transition-all hover:scale-110 focus:outline-none`}
          style={{
            backgroundColor: c,
            boxShadow: c === value ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
          }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

export function LabelManager() {
  const isDev = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";
  const [labels, setLabels] = useState<Label[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [error, setError] = useState("");
  const fetched = useRef(false);

  async function fetchLabels() {
    try {
      const result = await getLabels();
      setLabels(result);
    } catch {
      if (isDev) setLabels(DEV_MOCK_LABELS);
    }
  }

  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true;
      fetchLabels();
    }
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createLabel({ name: newName.trim(), color: newColor });
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
      setCreating(false);
      setError("");
      await fetchLabels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create label");
    }
  }

  async function handleUpdate(id: number) {
    try {
      await updateLabel(id, {
        name: editName.trim() || undefined,
        color: editColor || undefined,
      });
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

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
  }

  function startEdit(label: Label) {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color || PRESET_COLORS[0]);
    setCreating(false);
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* ── Collapsible header ───────────────────────────────────────── */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <TagIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Labels</span>
          {labels.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5">
              {labels.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t">
          {/* ── Create form ──────────────────────────────────────────── */}
          {creating ? (
            <div className="px-4 py-3 bg-muted/20 border-b space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className="size-3 rounded-full shrink-0 ring-1 ring-border"
                  style={{ backgroundColor: newColor }}
                />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  New label
                </span>
              </div>
              <Input
                placeholder="Label name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-8 text-sm"
                autoFocus
              />
              <ColorPicker value={newColor} onChange={setNewColor} />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
                  <CheckIcon className="size-3" />
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => { setCreating(false); setError(""); }}
                >
                  <XIcon className="size-3" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2 border-b">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={startCreate}
              >
                <PlusIcon className="size-3" />
                New label
              </Button>
            </div>
          )}

          {/* ── Label grid ───────────────────────────────────────────── */}
          {labels.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No labels yet — create one to get started.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className={`group flex items-center gap-2.5 px-3 py-2 bg-card hover:bg-muted/30 transition-colors ${
                      editingId === label.id ? "bg-muted/40 ring-1 ring-inset ring-primary/40" : ""
                    }`}
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: label.color ?? "#6b7280" }}
                    />
                    <span
                      className="text-xs font-medium flex-1 truncate"
                      style={label.color ? { color: label.color } : {}}
                    >
                      {label.name}
                    </span>
                    <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(label)}
                        title="Edit label"
                      >
                        <PencilIcon className="size-3" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="size-5 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(label.id)}
                        title="Delete label"
                      >
                        <Trash2Icon className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Inline edit form (below grid) ────────────────────── */}
              {editingId !== null && (
                <div className="px-4 py-3 bg-muted/20 border-t space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 rounded-full shrink-0 ring-1 ring-border"
                      style={{ backgroundColor: editColor }}
                    />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Edit "{labels.find((l) => l.id === editingId)?.name}"
                    </span>
                  </div>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(editingId);
                      if (e.key === "Escape") { setEditingId(null); setError(""); }
                    }}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} size="sm" />
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdate(editingId)}>
                      <CheckIcon className="size-3" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => { setEditingId(null); setError(""); }}
                    >
                      <XIcon className="size-3" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
