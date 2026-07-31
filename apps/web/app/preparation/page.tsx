"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { RouteGuard } from "@/components/auth/route-guard";
import { useStores } from "@/lib/stores-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Search, ChevronLeft, ChevronRight, Package,
  CheckCircle2, Clock, X, Printer,
} from "lucide-react";
import { Order, OrderStatus } from "@/types/order";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
}

function openBordereau(orderId: string) {
  window.open(`${API}/orders/${orderId}/bordereau`, "_blank");
}

function PrepareModal({
  order,
  onClose,
  onDone,
}: {
  order: Order;
  onClose: () => void;
  onDone: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const allChecked = order.lineItems.every((li) => checked[li.id]);

  async function handleReady() {
    setLoading(true);
    try {
      await fetch(`${API}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "A_EXPEDIER" }),
      });
      onDone();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Préparer — {order.orderNumber}</h2>
            <p className="text-xs text-muted">{order.customerName} · {order.customerPhone}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-sunken">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Client info */}
          <div className="rounded-lg border border-border p-3.5 space-y-1.5 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Client</p>
            <p className="font-medium">{order.customerName}</p>
            <p className="text-muted font-mono text-xs">{order.customerPhone}</p>
            {order.shippingAddress && (
              <p className="text-xs text-muted">
                {(order.shippingAddress as any).address1}, {(order.shippingAddress as any).city}
              </p>
            )}
          </div>

          {/* Items checklist */}
          <div className="rounded-lg border border-border divide-y divide-border">
            <div className="px-3.5 py-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Articles à préparer ({order.lineItems.length})
              </p>
            </div>
            {order.lineItems.map((li) => (
              <div
                key={li.id}
                onClick={() => setChecked((prev) => ({ ...prev, [li.id]: !prev[li.id] }))}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-colors",
                  checked[li.id] ? "bg-status-delivered-bg/30" : "hover:bg-surface-sunken"
                )}
              >
                <div className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                  checked[li.id]
                    ? "border-status-delivered bg-status-delivered"
                    : "border-border"
                )}>
                  {checked[li.id] && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-medium transition-colors",
                    checked[li.id] && "line-through text-muted"
                  )}>
                    {li.title}
                    {li.variantTitle && (
                      <span className="ml-1 text-xs text-muted">— {li.variantTitle}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted font-mono">
                    {li.sku} · Qté {li.quantity}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-medium">
                  {formatMoney(li.price * li.quantity, order.currency)}
                </p>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="rounded-lg border border-border px-3.5 py-3 flex justify-between text-sm font-semibold">
            <span>Montant à encaisser</span>
            <span className="font-mono text-status-delivered">
              {formatMoney(order.total, order.currency)}
            </span>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Note préparateur (optionnel)</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Remarques sur la préparation..."
            />
          </div>

          {!allChecked && (
            <p className="text-xs text-status-processing text-center">
              ⚠️ Cochez tous les articles avant de valider
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button
            variant="secondary"
            onClick={() => openBordereau(order.id)}
          >
            <Printer className="h-3.5 w-3.5" />
            Bordereau
          </Button>
          <Button
            className="flex-1"
            disabled={!allChecked || loading}
            onClick={handleReady}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {loading ? "Validation..." : "Valider → À expédier"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 25;

function PreparationContent() {
  const { canAccessStore } = useAuth();
  const { stores } = useStores();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [prepareOrder, setPrepareOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "CONFIRME" | "EN_PREPARATION" | "A_EXPEDIER">("all");
  const [bulkLoading, setBulkLoading] = useState(false);

  const accessibleStores = stores.filter((s) => canAccessStore(s.id));

  useEffect(() => {
    if (stores.length > 0 && selectedStoreIds.length === 0) {
      setSelectedStoreIds(stores.map((s) => s.id));
    }
  }, [stores]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/orders?pageSize=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const all: Order[] = data.orders ?? [];
      setOrders(all.filter((o) =>
        ["CONFIRME", "EN_PREPARATION", "A_EXPEDIER"].includes(o.orderStatus)
      ));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pageIds = pageOrders.map((o) => o.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function printBulk() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      setTimeout(() => openBordereau(id), 300);
    });
  }

  const filtered = orders.filter((o) => {
    if (!selectedStoreIds.includes(o.storeId)) return false;
    if (filter !== "all" && o.orderStatus !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${o.orderNumber} ${o.customerName ?? ""} ${o.customerPhone ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageOrders = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const confirmeCount = orders.filter((o) => o.orderStatus === "CONFIRME").length;
  const prepCount = orders.filter((o) => o.orderStatus === "EN_PREPARATION").length;
  const aExpedierCount = orders.filter((o) => o.orderStatus === "A_EXPEDIER").length;

  const STATUS_STYLE: Record<string, string> = {
    CONFIRME: "bg-status-new-bg text-status-new",
    EN_PREPARATION: "bg-status-processing-bg text-status-processing",
    A_EXPEDIER: "bg-status-shipped-bg text-status-shipped",
  };

  const STATUS_LABEL: Record<string, string> = {
    CONFIRME: "Confirmé",
    EN_PREPARATION: "En préparation",
    A_EXPEDIER: "À expédier",
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        stores={accessibleStores}
        selectedStoreIds={selectedStoreIds}
        onChangeSelectedStores={setSelectedStoreIds}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
          <h1 className="text-base font-semibold">Préparation</h1>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button size="sm" variant="secondary" onClick={printBulk}>
                <Printer className="h-3.5 w-3.5" />
                Imprimer {selectedIds.size} bordereau{selectedIds.size > 1 ? "x" : ""}
              </Button>
            )}
            <p className="text-xs text-muted">{orders.length} commandes</p>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 border-b border-border bg-surface p-4">
          <div className="rounded-lg bg-status-new-bg px-4 py-3">
            <p className="text-xs font-medium text-status-new">À préparer</p>
            <p className="mt-1 text-2xl font-bold text-status-new">{confirmeCount}</p>
          </div>
          <div className="rounded-lg bg-status-processing-bg px-4 py-3">
            <p className="text-xs font-medium text-status-processing">En préparation</p>
            <p className="mt-1 text-2xl font-bold text-status-processing">{prepCount}</p>
          </div>
          <div className="rounded-lg bg-status-shipped-bg px-4 py-3">
            <p className="text-xs font-medium text-status-shipped">À expédier</p>
            <p className="mt-1 text-2xl font-bold text-status-shipped">{aExpedierCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-3">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-light" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher..."
              className="pl-8"
            />
          </div>
          <div className="flex gap-1">
            {[
              { key: "all", label: "Tous", count: orders.length },
              { key: "CONFIRME", label: "À préparer", count: confirmeCount },
              { key: "EN_PREPARATION", label: "En cours", count: prepCount },
              { key: "A_EXPEDIER", label: "À expédier", count: aExpedierCount },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setFilter(tab.key as any); setPage(1); }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === tab.key ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-sunken"
                )}
              >
                {tab.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  filter === tab.key ? "bg-primary text-white" : "bg-surface-sunken"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-muted">Chargement...</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border text-left text-xs font-medium text-muted">
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={pageOrders.length > 0 && pageOrders.every((o) => selectedIds.has(o.id))}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-border-strong accent-primary"
                    />
                  </th>
                  <th className="px-4 py-2.5">Commande</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Client</th>
                  <th className="px-4 py-2.5">Téléphone</th>
                  <th className="px-4 py-2.5">Articles</th>
                  <th className="px-4 py-2.5">Montant</th>
                  <th className="px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      "border-b border-border transition-colors hover:bg-surface-sunken",
                      selectedIds.has(order.id) && "bg-primary-soft/30"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleSelect(order.id)}
                        className="h-3.5 w-3.5 rounded border-border-strong accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[13px] font-semibold">{order.orderNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {formatDate(order.sourceCreatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[150px]">{order.customerName ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{order.customerPhone ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {order.lineItems?.map((li) => (
                        <div key={li.id} className="truncate max-w-[200px]">
                          {li.title} × {li.quantity}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-medium">
                      {formatMoney(order.total, order.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "rounded px-2 py-1 text-xs font-medium",
                        STATUS_STYLE[order.orderStatus] ?? "bg-surface-sunken text-muted"
                      )}>
                        {STATUS_LABEL[order.orderStatus] ?? order.orderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {order.orderStatus === "CONFIRME" && (
                          <Button size="sm" onClick={() => setPrepareOrder(order)}>
                            <Package className="h-3.5 w-3.5" />
                            Préparer
                          </Button>
                        )}
                        {order.orderStatus === "EN_PREPARATION" && (
                          <Button size="sm" variant="secondary" onClick={() => setPrepareOrder(order)}>
                            <Clock className="h-3.5 w-3.5" />
                            Continuer
                          </Button>
                        )}
                        {order.orderStatus === "A_EXPEDIER" && (
                          <>
                            <span className="text-xs text-status-shipped font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Prêt
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openBordereau(order.id)}
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Bordereau
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && pageOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <Package className="h-8 w-8 text-muted-light" />
              <p className="mt-2 text-sm font-medium">Aucune commande à préparer</p>
              <p className="mt-1 text-xs text-muted">Les commandes confirmées apparaîtront ici.</p>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-border bg-surface px-5 py-2.5">
          <p className="text-xs text-muted">
            {filtered.length} commandes
            {selectedIds.size > 0 && ` · ${selectedIds.size} sélectionnée${selectedIds.size > 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-xs text-muted">Page {page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </footer>
      </div>

      {prepareOrder && (
        <PrepareModal
          order={prepareOrder}
          onClose={() => setPrepareOrder(null)}
          onDone={() => {
            fetchOrders();
            setPrepareOrder(null);
          }}
        />
      )}
    </div>
  );
}

export default function PreparationPage() {
  return (
    <RouteGuard>
      <PreparationContent />
    </RouteGuard>
  );
}