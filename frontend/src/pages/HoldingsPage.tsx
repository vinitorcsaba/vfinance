import { useCallback, useEffect, useState } from "react";
import { PencilIcon, PlusCircleIcon, PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";

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
import { AddSharesDialog } from "@/components/AddSharesDialog";
import { AddValueDialog } from "@/components/AddValueDialog";
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
import type { StockHolding, ManualHolding, Currency } from "@/types/holdings";

export function HoldingsPage() {
  const [stocks, setStocks] = useState<StockHolding[]>([]);
  const [manuals, setManuals] = useState<ManualHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const fetchAll = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([getStockHoldings(), getManualHoldings()]);
      setStocks(s);
      setManuals(m);
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
  async function handleStockSubmit(data: { ticker: string; shares: number; currency?: Currency | null; display_name?: string }) {
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

  async function handleAddShares(shares: number) {
    if (!addSharesTarget) return;
    await addStockShares(addSharesTarget.id, { shares });
    setAddSharesTarget(null);
    await fetchAll();
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

        {stocks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No stock holdings yet. Add one to get started.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell>
                      <Badge variant="secondary">{stock.ticker}</Badge>
                    </TableCell>
                    <TableCell>{stock.display_name ?? "—"}</TableCell>
                    <TableCell>
                      {stock.currency ? <Badge variant="outline">{stock.currency}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right">{stock.shares}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setAddSharesTarget(stock)}
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
                ))}
              </TableBody>
            </Table>
          </div>
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

        {manuals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No manual holdings yet. Add one to get started.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manuals.map((manual) => (
                  <TableRow key={manual.id}>
                    <TableCell>{manual.name}</TableCell>
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
