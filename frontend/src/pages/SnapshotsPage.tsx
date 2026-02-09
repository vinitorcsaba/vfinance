import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CameraIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listSnapshots, createSnapshot, exportSnapshot } from "@/api/snapshots";
import type { SnapshotSummary } from "@/types/snapshot";

export function SnapshotsPage({
  sheetsConfigured,
}: {
  sheetsConfigured: boolean;
}) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [taking, setTaking] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const fetchSnapshots = useCallback(async () => {
    try {
      setSnapshots(await listSnapshots());
    } catch {
      toast.error("Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleTakeSnapshot = async () => {
    setTaking(true);
    try {
      const snap = await createSnapshot();
      toast.success(`Snapshot #${snap.id} created (${snap.items.length} items)`);
      await fetchSnapshots();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create snapshot");
    } finally {
      setTaking(false);
    }
  };

  const handleExport = async (id: number) => {
    setExportingId(id);
    try {
      const { sheets_url } = await exportSnapshot(id);
      toast.success("Exported to Google Sheets");
      window.open(sheets_url, "_blank");
      await fetchSnapshots();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportingId(null);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Snapshots</h2>
        <Button size="sm" disabled={taking} onClick={handleTakeSnapshot}>
          {taking ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CameraIcon className="mr-2 h-4 w-4" />
          )}
          Take Snapshot
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No snapshots yet. Take one to record a point-in-time view of your
          portfolio.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total (RON)</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Export</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{fmtDate(s.taken_at)}</TableCell>
                  <TableCell className="text-right">{fmt(s.total_value_ron)}</TableCell>
                  <TableCell className="text-right">{s.item_count}</TableCell>
                  <TableCell>
                    {s.exported_to_sheets && s.sheets_url ? (
                      <a
                        href={s.sheets_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                        View Sheet
                      </a>
                    ) : sheetsConfigured ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={exportingId === s.id}
                        onClick={() => handleExport(s.id)}
                      >
                        {exportingId === s.id ? (
                          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
                        )}
                        Export
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not configured
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
