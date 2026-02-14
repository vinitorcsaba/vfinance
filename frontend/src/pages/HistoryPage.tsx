import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CameraIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PortfolioChart } from "@/components/PortfolioChart";
import { listSnapshots, getSnapshot, createSnapshot } from "@/api/snapshots";
import type { SnapshotSummary, SnapshotRead, LabelInSnapshot } from "@/types/snapshot";

type Currency = "RON" | "EUR" | "USD";

export function HistoryPage() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [expandedSnapshots, setExpandedSnapshots] = useState<Map<number, SnapshotRead>>(new Map());
  const [loading, setLoading] = useState(true);
  const [taking, setTaking] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(() => {
    return (localStorage.getItem("displayCurrency") as Currency) || "RON";
  });

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

  useEffect(() => {
    localStorage.setItem("displayCurrency", displayCurrency);
  }, [displayCurrency]);

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

  const toggleExpanded = async (snapshotId: number) => {
    if (expandedSnapshots.has(snapshotId)) {
      // Collapse
      const newMap = new Map(expandedSnapshots);
      newMap.delete(snapshotId);
      setExpandedSnapshots(newMap);
    } else {
      // Expand - fetch details if not already loaded
      setLoadingDetails((prev) => new Set(prev).add(snapshotId));
      try {
        const details = await getSnapshot(snapshotId);
        const newMap = new Map(expandedSnapshots);
        newMap.set(snapshotId, details);
        setExpandedSnapshots(newMap);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to load snapshot details");
      } finally {
        setLoadingDetails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(snapshotId);
          return newSet;
        });
      }
    }
  };

  const getSnapshotTotal = (snapshot: { total_value_ron: number; total_value_eur: number; total_value_usd: number }): number => {
    // Use pre-stored currency values from the snapshot (captured at snapshot time)
    if (displayCurrency === "EUR") return snapshot.total_value_eur;
    if (displayCurrency === "USD") return snapshot.total_value_usd;
    return snapshot.total_value_ron;
  };

  const convertValue = (item: { value_ron: number; value_eur: number; value_usd: number }): number => {
    // Use pre-converted values from snapshot items
    if (displayCurrency === "EUR") return item.value_eur;
    if (displayCurrency === "USD") return item.value_usd;
    return item.value_ron;
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
        <h2 className="text-lg font-semibold">Portfolio History</h2>
        <div className="flex items-center gap-3">
          <Select value={displayCurrency} onValueChange={(v: Currency) => setDisplayCurrency(v)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RON">RON</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" disabled={taking} onClick={handleTakeSnapshot}>
            {taking ? (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CameraIcon className="mr-2 h-4 w-4" />
            )}
            Take Snapshot
          </Button>
        </div>
      </div>

      {/* Portfolio Value Chart */}
      <PortfolioChart displayCurrency={displayCurrency} />

      {snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            No snapshots yet. Take your first snapshot to start tracking portfolio value over time.
          </p>
          <Button onClick={handleTakeSnapshot} disabled={taking}>
            {taking ? (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CameraIcon className="mr-2 h-4 w-4" />
            )}
            Take First Snapshot
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total ({displayCurrency})</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((s) => {
                const isExpanded = expandedSnapshots.has(s.id);
                const isLoading = loadingDetails.has(s.id);
                const details = expandedSnapshots.get(s.id);

                return (
                  <>
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpanded(s.id)}
                    >
                      <TableCell>
                        {isLoading ? (
                          <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell>{fmtDate(s.taken_at)}</TableCell>
                      <TableCell className="text-right">
                        {fmt(getSnapshotTotal(s))}
                      </TableCell>
                      <TableCell className="text-right">{s.item_count}</TableCell>
                    </TableRow>

                    {isExpanded && details && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/30 p-0">
                          <div className="px-4 py-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Labels</TableHead>
                                  <TableHead className="text-right">Shares</TableHead>
                                  <TableHead className="text-right">Price</TableHead>
                                  <TableHead className="text-right">Value ({displayCurrency})</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {details.items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{item.name}</span>
                                        {item.ticker && (
                                          <span className="text-xs text-muted-foreground">
                                            {item.ticker}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {item.labels.map((label: LabelInSnapshot) => (
                                          <Badge
                                            key={label.name}
                                            variant="outline"
                                            style={{
                                              borderColor: label.color || undefined,
                                              color: label.color || undefined,
                                            }}
                                            className="text-xs"
                                          >
                                            {label.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {item.shares !== null ? fmt(item.shares) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {item.price !== null
                                        ? `${fmt(item.price)} ${item.currency}`
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {fmt(convertValue(item))}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
