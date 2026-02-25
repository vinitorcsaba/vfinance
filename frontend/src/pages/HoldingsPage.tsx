import { useCallback, useEffect, useMemo, useState } from "react";
import { PencilIcon, PlusCircleIcon, PlusIcon, Trash2Icon, Loader2Icon, XIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";

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
import { StockHoldingDialog } from "@/components/StockHoldingDialog";
import { ManualHoldingDialog } from "@/components/ManualHoldingDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { AddSharesDialog, type AddSharesFormData } from "@/components/AddSharesDialog";
import { AddValueDialog } from "@/components/AddValueDialog";
import { LabelManager } from "@/components/LabelManager";
import { LabelAssignPopover, LabelBadges } from "@/components/LabelAssignPopover";
import { TransactionHistory } from "@/components/TransactionHistory";
import {
  getStockHoldings,
  getManualHoldings,
  createStockHolding,
  updateStockHolding,
  deleteStockHolding,
  createManualHolding,
  updateManualHolding,
  deleteManualHolding,
  addStockShares,
  addManualValue,
} from "@/api/holdings";
import { createTransaction, listTransactions } from "@/api/transactions";
import { lookupStockPrice } from "@/api/prices";
import type { TransactionRead } from "@/types/transaction";
import { getAllocationGroups, getGroupMembers } from "@/api/allocation-groups";
import type { StockHolding, ManualHolding, Currency } from "@/types/holdings";
import type { AllocationGroup } from "@/types/allocation-groups";

export function HoldingsPage() {
  const [stocks, setStocks] = useState<StockHolding[]>([]);
  const [manuals, setManuals] = useState<ManualHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupMap, setGroupMap] = useState<Map<string, AllocationGroup>>(new Map());

  // Dialog state
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<StockHolding | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingManual, setEditingManual] = useState<ManualHolding | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "stock" | "manual";
    id: number;
    name: string;
  } | null>(null);
  const [addSharesTarget, setAddSharesTarget] = useState<StockHolding | null>(null);
  const [addValueTarget, setAddValueTarget] = useState<ManualHolding | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | undefined>();
  const [expandedStocks, setExpandedStocks] = useState<Map<number, TransactionRead[]>>(new Map());
  const [loadingTransactions, setLoadingTransactions] = useState<Set<number>>(new Set());

  // Extract unique labels from all holdings
  const allLabels = useMemo(() => {
    const map = new Map<number, { id: number; name: string; color: string | null }>();
    for (const h of [...stocks, ...manuals]) {
      for (const l of h.labels ?? []) {
        if (!map.has(l.id)) map.set(l.id, l);
      }
    }
    return Array.from(map.values());
  }, [stocks, manuals]);

  // Filter holdings by selected labels (AND logic)
  const filteredStocks = useMemo(() => {
    if (selectedLabels.length === 0) return stocks;
    return stocks.filter((h) =>
      selectedLabels.every((id) => (h.labels ?? []).some((l) => l.id === id))
    );
  }, [stocks, selectedLabels]);

  const filteredManuals = useMemo(() => {
    if (selectedLabels.length === 0) return manuals;
    return manuals.filter((h) =>
      selectedLabels.every((id) => (h.labels ?? []).some((l) => l.id === id))
    );
  }, [manuals, selectedLabels]);

  function toggleLabel(id: number) {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const fetchAll = useCallback(async () => {
    try {
      const [s, m, groups] = await Promise.all([
        getStockHoldings(),
        getManualHoldings(),
        getAllocationGroups(),
      ]);
      setStocks(s);
      setManuals(m);

      // Fetch members for all groups and build map
      const map = new Map<string, AllocationGroup>();
      await Promise.all(
        groups.map(async (group) => {
          const members = await getGroupMembers(group.id);
          members.forEach((member) => {
            const key = `${member.holding_type}-${member.holding_id}`;
            map.set(key, group);
          });
        })
      );
      setGroupMap(map);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load holdings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Stock CRUD
  async function handleStockSubmit(data: {
    ticker: string;
    shares: number;
    currency?: Currency | null;
    display_name?: string;
    transaction_date?: string;
    transaction_price?: number;
  }) {
    if (editingStock) {
      await updateStockHolding(editingStock.id, data);
    } else {
      await createStockHolding(data);
    }
    await fetchAll();
  }

  // Manual CRUD
  async function handleManualSubmit(data: { name: string; value: number; currency: Currency }) {
    if (editingManual) {
      await updateManualHolding(editingManual.id, data);
    } else {
      await createManualHolding(data);
    }
    await fetchAll();
  }

  // Delete
  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "stock") {
      await deleteStockHolding(deleteTarget.id);
    } else {
      await deleteManualHolding(deleteTarget.id);
    }
    setDeleteTarget(null);
    await fetchAll();
  }

  async function handleAddShares(data: AddSharesFormData) {
    if (!addSharesTarget) return;
    const stockId = addSharesTarget.id;
    const wasExpanded = expandedStocks.has(stockId);

    // Update the holding's total shares
    await addStockShares(stockId, { shares: data.shares });
    // Create transaction record
    await createTransaction(stockId, {
      date: data.date,
      shares: data.shares,
      price_per_share: data.price_per_share,
      notes: data.notes,
    });

    // Refresh transactions immediately if this stock's row is currently expanded
    if (wasExpanded) {
      try {
        const transactions = await listTransactions(stockId);
        setExpandedStocks((prev) => {
          const newMap = new Map(prev);
          newMap.set(stockId, transactions);
          return newMap;
        });
      } catch (err) {
        toast.error("Failed to refresh transactions");
      }
    }

    setAddSharesTarget(null);
    await fetchAll();
  }

  async function openAddSharesDialog(stock: StockHolding) {
    setAddSharesTarget(stock);
    setCurrentPrice(undefined);
    // Fetch current price in the background
    try {
      const priceData = await lookupStockPrice(stock.ticker);
      setCurrentPrice(priceData.price);
    } catch {
      // If price fetch fails, user will need to enter manually
      setCurrentPrice(undefined);
    }
  }

  async function toggleStockExpanded(stockId: number) {
    if (expandedStocks.has(stockId)) {
      // Collapse
      const newMap = new Map(expandedStocks);
      newMap.delete(stockId);
      setExpandedStocks(newMap);
    } else {
      // Expand - fetch transactions
      setLoadingTransactions((prev) => new Set(prev).add(stockId));
      try {
        const transactions = await listTransactions(stockId);
        const newMap = new Map(expandedStocks);
        newMap.set(stockId, transactions);
        setExpandedStocks(newMap);
      } catch (err) {
        toast.error("Failed to load transactions");
      } finally {
        setLoadingTransactions((prev) => {
          const newSet = new Set(prev);
          newSet.delete(stockId);
          return newSet;
        });
      }
    }
  }

  async function refreshStockTransactions(stockId: number) {
    try {
      const transactions = await listTransactions(stockId);
      setExpandedStocks((prev) => {
        const newMap = new Map(prev);
        newMap.set(stockId, transactions);
        return newMap;
      });
    } catch {
      toast.error("Failed to refresh transactions");
    }
  }

  async function handleAddValue(value: number) {
    if (!addValueTarget) return;
    await addManualValue(addValueTarget.id, { value });
    setAddValueTarget(null);
    await fetchAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <LabelManager />

      {/* Label filter */}
      {allLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter by label:</span>
          {allLabels.map((l) => {
            const isSelected = selectedLabels.includes(l.id);
            return (
              <button
                key={l.id}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "opacity-100 ring-1 ring-offset-1 scale-105"
                    : selectedLabels.length > 0
                      ? "opacity-30 saturate-0"
                      : "opacity-100"
                }`}
                style={
                  l.color
                    ? {
                        backgroundColor: l.color + "20",
                        borderColor: l.color,
                        color: l.color,
                        ...(isSelected ? { "--tw-ring-color": l.color } as React.CSSProperties : {}),
                      }
                    : {}
                }
                onClick={() => toggleLabel(l.id)}
              >
                {l.color && (
                  <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                )}
                {l.name}
              </button>
            );
          })}
          {selectedLabels.length > 0 && (
            <button
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedLabels([])}
            >
              <XIcon className="size-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Stock Holdings */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Stock Holdings</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingStock(null);
              setStockDialogOpen(true);
            }}
          >
            <PlusIcon /> Add Stock
          </Button>
        </div>

        {filteredStocks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            {stocks.length === 0
              ? "No stock holdings yet. Add one to get started."
              : "No stock holdings match the selected labels."}
          </p>
        ) : (
          <>
            {/* Desktop: Table */}
            <div className="hidden md:block rounded-md border">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Labels</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStocks.map((stock) => {
                  const isExpanded = expandedStocks.has(stock.id);
                  const isLoading = loadingTransactions.has(stock.id);
                  const transactions = expandedStocks.get(stock.id) || [];

                  return (
                    <>
                      <TableRow key={stock.id}>
                        <TableCell>
                          <button
                            className="flex items-center justify-center w-full hover:bg-muted/50 rounded"
                            onClick={() => toggleStockExpanded(stock.id)}
                          >
                            {isLoading ? (
                              <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : isExpanded ? (
                              <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{stock.ticker}</Badge>
                        </TableCell>
                    <TableCell>{stock.display_name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <LabelBadges labels={stock.labels ?? []} />
                        <LabelAssignPopover
                          holdingType="stock"
                          holdingId={stock.id}
                          currentLabels={stock.labels ?? []}
                          onAssigned={fetchAll}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const key = `stock-${stock.id}`;
                        const group = groupMap.get(key);
                        return group ? (
                          <Badge
                            variant="secondary"
                            style={
                              group.color
                                ? {
                                    backgroundColor: group.color + "20",
                                    borderColor: group.color,
                                    color: group.color,
                                  }
                                : {}
                            }
                          >
                            {group.color && (
                              <span
                                className="size-2 rounded-full mr-1"
                                style={{ backgroundColor: group.color }}
                              />
                            )}
                            {group.name}
                          </Badge>
                        ) : (
                          "—"
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {stock.currency ? <Badge variant="outline">{stock.currency}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right">{stock.shares}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openAddSharesDialog(stock)}
                          title="Add shares"
                        >
                          <PlusCircleIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingStock(stock);
                            setStockDialogOpen(true);
                          }}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setDeleteTarget({
                              type: "stock",
                              id: stock.id,
                              name: stock.display_name ?? stock.ticker,
                            })
                          }
                        >
                          <Trash2Icon className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30 p-0">
                        <div className="px-4 py-3">
                          <h4 className="text-sm font-medium mb-3">Transaction History</h4>
                          <TransactionHistory
                            transactions={transactions}
                            ticker={stock.ticker}
                            onTransactionDeleted={() => refreshStockTransactions(stock.id)}
                            onTransactionUpdated={() => refreshStockTransactions(stock.id)}
                          />
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

            {/* Mobile: Card layout */}
            <div className="md:hidden space-y-3">
              {filteredStocks.map((stock) => {
                const isExpanded = expandedStocks.has(stock.id);
                const isLoading = loadingTransactions.has(stock.id);
                const transactions = expandedStocks.get(stock.id) || [];
                const groupKey = `stock-${stock.id}`;
                const group = groupMap.get(groupKey);

                return (
                  <div key={stock.id} className="rounded-lg border p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">{stock.ticker}</Badge>
                          {stock.currency && <Badge variant="outline" className="text-xs">{stock.currency}</Badge>}
                        </div>
                        <p className="text-sm font-medium truncate">{stock.display_name ?? "—"}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openAddSharesDialog(stock)}
                          title="Add shares"
                        >
                          <PlusCircleIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingStock(stock);
                            setStockDialogOpen(true);
                          }}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setDeleteTarget({
                              type: "stock",
                              id: stock.id,
                              name: stock.display_name ?? stock.ticker,
                            })
                          }
                        >
                          <Trash2Icon className="text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Shares:</span>
                        <span className="ml-2 font-medium">{stock.shares}</span>
                      </div>
                      {group && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Group:</span>
                          <Badge
                            variant="secondary"
                            className="text-xs"
                            style={
                              group.color
                                ? {
                                    backgroundColor: group.color + "20",
                                    borderColor: group.color,
                                    color: group.color,
                                  }
                                : {}
                            }
                          >
                            {group.color && (
                              <span
                                className="size-2 rounded-full mr-1"
                                style={{ backgroundColor: group.color }}
                              />
                            )}
                            {group.name}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Labels */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <LabelBadges labels={stock.labels ?? []} />
                      <LabelAssignPopover
                        holdingType="stock"
                        holdingId={stock.id}
                        currentLabels={stock.labels ?? []}
                        onAssigned={fetchAll}
                      />
                    </div>

                    {/* Expand transactions */}
                    <button
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full py-2 border-t -mb-3 -mx-4 px-4"
                      onClick={() => toggleStockExpanded(stock.id)}
                    >
                      {isLoading ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : isExpanded ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                      <span>Transaction History</span>
                    </button>

                    {/* Expanded transaction history */}
                    {isExpanded && (
                      <div className="border-t pt-3 -mx-4 px-4 -mb-3 pb-3 bg-muted/30">
                        <TransactionHistory
                          transactions={transactions}
                          ticker={stock.ticker}
                          onTransactionDeleted={() => refreshStockTransactions(stock.id)}
                          onTransactionUpdated={() => refreshStockTransactions(stock.id)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Manual Holdings */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Manual Holdings</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingManual(null);
              setManualDialogOpen(true);
            }}
          >
            <PlusIcon /> Add Manual
          </Button>
        </div>

        {filteredManuals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            {manuals.length === 0
              ? "No manual holdings yet. Add one to get started."
              : "No manual holdings match the selected labels."}
          </p>
        ) : (
          <>
            {/* Desktop: Table */}
            <div className="hidden md:block rounded-md border">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Labels</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredManuals.map((manual) => (
                  <TableRow key={manual.id}>
                    <TableCell>{manual.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <LabelBadges labels={manual.labels ?? []} />
                        <LabelAssignPopover
                          holdingType="manual"
                          holdingId={manual.id}
                          currentLabels={manual.labels ?? []}
                          onAssigned={fetchAll}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const key = `manual-${manual.id}`;
                        const group = groupMap.get(key);
                        return group ? (
                          <Badge
                            variant="secondary"
                            style={
                              group.color
                                ? {
                                    backgroundColor: group.color + "20",
                                    borderColor: group.color,
                                    color: group.color,
                                  }
                                : {}
                            }
                          >
                            {group.color && (
                              <span
                                className="size-2 rounded-full mr-1"
                                style={{ backgroundColor: group.color }}
                              />
                            )}
                            {group.name}
                          </Badge>
                        ) : (
                          "—"
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      {manual.value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{manual.currency}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setAddValueTarget(manual)}
                          title="Add value"
                        >
                          <PlusCircleIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingManual(manual);
                            setManualDialogOpen(true);
                          }}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setDeleteTarget({
                              type: "manual",
                              id: manual.id,
                              name: manual.name,
                            })
                          }
                        >
                          <Trash2Icon className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

            {/* Mobile: Card layout */}
            <div className="md:hidden space-y-3">
              {filteredManuals.map((manual) => {
                const groupKey = `manual-${manual.id}`;
                const group = groupMap.get(groupKey);

                return (
                  <div key={manual.id} className="rounded-lg border p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-1">{manual.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">
                            {manual.value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <Badge variant="outline">{manual.currency}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setAddValueTarget(manual)}
                          title="Add value"
                        >
                          <PlusCircleIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingManual(manual);
                            setManualDialogOpen(true);
                          }}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setDeleteTarget({
                              type: "manual",
                              id: manual.id,
                              name: manual.name,
                            })
                          }
                        >
                          <Trash2Icon className="text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Group badge */}
                    {group && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Group:</span>
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          style={
                            group.color
                              ? {
                                  backgroundColor: group.color + "20",
                                  borderColor: group.color,
                                  color: group.color,
                                }
                              : {}
                          }
                        >
                          {group.color && (
                            <span
                              className="size-2 rounded-full mr-1"
                              style={{ backgroundColor: group.color }}
                            />
                          )}
                          {group.name}
                        </Badge>
                      </div>
                    )}

                    {/* Labels */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <LabelBadges labels={manual.labels ?? []} />
                      <LabelAssignPopover
                        holdingType="manual"
                        holdingId={manual.id}
                        currentLabels={manual.labels ?? []}
                        onAssigned={fetchAll}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Dialogs */}
      <StockHoldingDialog
        open={stockDialogOpen}
        onOpenChange={setStockDialogOpen}
        onSubmit={handleStockSubmit}
        editing={editingStock}
      />
      <ManualHoldingDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        onSubmit={handleManualSubmit}
        editing={editingManual}
      />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
        name={deleteTarget?.name ?? ""}
      />
      <AddSharesDialog
        open={!!addSharesTarget}
        onOpenChange={(open) => {
          if (!open) setAddSharesTarget(null);
        }}
        stock={addSharesTarget}
        onSubmit={handleAddShares}
        currentPrice={currentPrice}
      />
      <AddValueDialog
        open={!!addValueTarget}
        onOpenChange={(open) => {
          if (!open) setAddValueTarget(null);
        }}
        holding={addValueTarget}
        onSubmit={handleAddValue}
      />
    </div>
  );
}
