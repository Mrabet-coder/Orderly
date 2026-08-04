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
  CheckCircle2, X, Printer, Archive, Plus, Truck,
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

async function apiChangeStatus(orderId: string, status: OrderStatus) {
  await fetch(`${API}/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}

const PAGE_SIZE = 25;

const PREP_STATUS_KEYS: OrderStatus[] = [
  "CONFIRME", "ECHANGE", "EN_PREPARATION", "IMPRIME", "EMBALLE", "A_EXPEDIER",
];

const STATUS_STYLE: Record<string, string> = {
  CONFIRME: "bg-status-new-bg text-status-new",
  ECHANGE: "bg-purple-50 text-purple-600",
  EN_PREPARATION: "bg-status-processing-bg text-status-processing",
  IMPRIME: "bg-status-shipped-bg text-status-shipped",
  EMBALLE: "bg-status-shipped-bg text-status-shipped",
  A_EXPEDIER: "bg-status-shipped-bg text-status-shipped",
};

const STATUS_LABEL: Record<string, string> = {
  CONFIRME: "Confirmé",
  ECHANGE: "Échange",
  EN_PREPARATION: "En préparation",
  IMPRIME: "Imprimé",
  EMBALLE: "Emballé",
  A_EXPEDIER: "À expédier",
};

function CreateOrderModal({
  storeId,
  onClose,
  onCreated,
}: {
  storeId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [products, setProducts] = useState([{ title: "", quantity: 1, price: 0 }]);
  const [loading, setLoading] = useState(false);

  const total = products.reduce((s, p) => s + p.price * p.quantity, 0);

  function updateProduct(idx: number, field: string, value: any) {
    setProducts((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function addProduct() {
    setProducts((prev) => [...prev, { title: "", quantity: 1, price: 0 }]);
  }

  function removeProduct(idx: number) {
    setProducts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function create() {
    setLoading(true);
    try {
      await fetch(`${API}/orders/manual`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeId,
          customerName: name,
          customerPhone: phone,
          shippingAddress: { city, address1: address },
          currency: "TND",
          subtotal: total,
          total,
          source: "manual",
          lineItems: products.filter((p) => p.title.trim()),
        }),
      });
      onCreated();
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
          <h2 className="text-sm font-semibold">Créer une commande</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-sunken">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Nom client</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Téléphone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+216 XX XXX XXX" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Ville</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Tunis" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Adresse</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rue..." />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted">Produits</label>
              <button onClick={addProduct} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Plus className="h-3 w-3" /> Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {products.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <Input
                    value={p.title}
                    onChange={(e) => updateProduct(idx, "title", e.target.value)}
                    placeholder="Nom produit"
                    className="flex-1 h-8 text-xs"
                  />
                  <Input
                    type="number"
                    value={p.quantity}
                    onChange={(e) => updateProduct(idx, "quantity", parseInt(e.target.value) || 1)}
                    min={1}
                    className="w-16 h-8 text-xs"
                  />
                  <Input
                    type="number"
                    value={p.price}
                    onChange={(e) => updateProduct(idx, "price", parseFloat(e.target.value) || 0)}
                    min={0}
                    step="0.001"
                    className="w-24 h-8 text-xs"
                  />
                  {products.length > 1 && (
                    <button onClick={() => removeProduct(idx)} className="text-muted hover:text-status-cancelled">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center rounded-lg bg-surface-sunken px-3 py-2">
            <span className="text-xs font-medium text-muted">Total</span>
            <span className="font-mono text-sm font-bold">{total.toFixed(3)} TND</span>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button
            className="flex-1"
            disabled={loading || !name.trim() || !phone.trim() || !products.some((p) => p.title.trim())}
            onClick={create}
          >
            <Plus className="h-3.5 w-3.5" />
            {loading ? "Création..." : "Créer la commande"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreparationContent() {
  const { canAccessStore } = useAuth();
  const { stores } = useStores();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [showCreate, setShowCreate] = useState(false);

  const accessibleStores = stores.filter((s) => canAccessStore(s.id));
  const activeStore = accessibleStores[0];

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
      setOrders(all.filter((o) => PREP_STATUS_KEYS.includes(o.orderStatus)));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Direct status change — no popup
  async function changeStatus(orderId: string, status: OrderStatus) {
    setOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, orderStatus: status } : o)
    );
    await apiChangeStatus(orderId, status);
    // Remove from list if archived
    if (status === "ARCHIVE" || status === "AU_DEPOT_LIVREUR") {
      setOrders((prev) => prev.filter((o) => o.id !== orderId || PREP_STATUS_KEYS.includes(status)));
      fetchOrders();
    }
  }

  // Print → auto IMPRIME
  async function handlePrint(order: Order) {
    openBordereau(order.id);
    if (order.orderStatus === "EN_PREPARATION" || order.orderStatus === "CONFIRME" || order.orderStatus === "ECHANGE") {
      await changeStatus(order.id, "IMPRIME");
    }
  }

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

  // Bulk print → all become IMPRIME
  async function printBulk() {
    const ids = Array.from(selectedIds);
    ids.forEach((id, i) => {
      setTimeout(() => openBordereau(id), i * 300);
    });
    for (const id of ids) {
      const order = orders.find((o) => o.id === id);
      if (order && ["EN_PREPARATION", "CONFIRME", "ECHANGE"].includes(order.orderStatus)) {
        await apiChangeStatus(id, "IMPRIME");
      }
    }
    fetchOrders();
    setSelectedIds(new Set());
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

  const counts: Record<string, number> = {};
  orders.forEach((o) => {
    counts[o.orderStatus] = (counts[o.orderStatus] ?? 0) + 1;
  });

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
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Créer commande
            </Button>
            <p className="text-xs text-muted">{orders.length} commandes</p>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 border-b border-border bg-surface p-4">
          <div className="rounded-lg bg-status-new-bg px-3 py-2.5">
            <p className="text-[11px] font-medium text-status-new">À préparer</p>
            <p className="mt-0.5 text-xl font-bold text-status-new">{(counts["CONFIRME"] ?? 0) + (counts["ECHANGE"] ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-status-processing-bg px-3 py-2.5">
            <p className="text-[11px] font-medium text-status-processing">En préparation</p>
            <p className="mt-0.5 text-xl font-bold text-status-processing">{counts["EN_PREPARATION"] ?? 0}</p>
          </div>
          <div className="rounded-lg bg-status-shipped-bg px-3 py-2.5">
            <p className="text-[11px] font-medium text-status-shipped">Imprimés</p>
            <p className="mt-0.5 text-xl font-bold text-status-shipped">{counts["IMPRIME"] ?? 0}</p>
          </div>
          <div className="rounded-lg bg-status-shipped-bg px-3 py-2.5">
            <p className="text-[11px] font-medium text-status-shipped">Emballés</p>
            <p className="mt-0.5 text-xl font-bold text-status-shipped">{counts["EMBALLE"] ?? 0}</p>
          </div>
          <div className="rounded-lg bg-status-shipped-bg px-3 py-2.5">
            <p className="text-[11px] font-medium text-status-shipped">À expédier</p>
            <p className="mt-0.5 text-xl font-bold text-status-shipped">{counts["A_EXPEDIER"] ?? 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-3 overflow-x-auto">
          <div className="relative w-64 shrink-0">
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
              { key: "CONFIRME", label: "Confirmés", count: counts["CONFIRME"] ?? 0 },
              { key: "ECHANGE", label: "Échanges", count: counts["ECHANGE"] ?? 0 },
              { key: "EN_PREPARATION", label: "En préparation", count: counts["EN_PREPARATION"] ?? 0 },
              { key: "IMPRIME", label: "Imprimés", count: counts["IMPRIME"] ?? 0 },
              { key: "EMBALLE", label: "Emballés", count: counts["EMBALLE"] ?? 0 },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setFilter(tab.key as any); setPage(1); }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
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
                  <th className="px-4 py-2.5">Livreur</th>
                  <th className="px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      "border-b border-border transition-colors hover:bg-surface-sunken",
                      selectedIds.has(order.id) && "bg-primary-soft/30",
                      order.orderStatus === "ECHANGE" && "bg-purple-50/30"
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
                      <p className="font-medium truncate max-w-[130px]">{order.customerName ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{order.customerPhone ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {order.lineItems?.map((li) => (
                        <div key={li.id} className="truncate max-w-[180px]">
                          {li.title} × {li.quantity}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-medium">
                      {formatMoney(order.total, order.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {order.deliveryCompany ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "rounded px-2 py-1 text-xs font-medium whitespace-nowrap",
                        STATUS_STYLE[order.orderStatus] ?? "bg-surface-sunken text-muted"
                      )}>
                        {STATUS_LABEL[order.orderStatus] ?? order.orderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* CONFIRME / ECHANGE → Préparer (direct, no popup) */}
                        {(order.orderStatus === "CONFIRME" || order.orderStatus === "ECHANGE") && (
                          <Button size="sm" onClick={() => changeStatus(order.id, "EN_PREPARATION")}>
                            <Package className="h-3.5 w-3.5" />
                            Préparer
                          </Button>
                        )}

                        {/* EN_PREPARATION → Imprimer (auto IMPRIME) */}
                        {order.orderStatus === "EN_PREPARATION" && (
                          <Button size="sm" onClick={() => handlePrint(order)}>
                            <Printer className="h-3.5 w-3.5" />
                            Imprimer
                          </Button>
                        )}

                        {/* IMPRIME → Emballé OU direct Au dépôt */}
                        {order.orderStatus === "IMPRIME" && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => changeStatus(order.id, "EMBALLE")}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Emballé
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => changeStatus(order.id, "AU_DEPOT_LIVREUR")}>
                              <Truck className="h-3.5 w-3.5" />
                              Au dépôt
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openBordereau(order.id)}>
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}

                        {/* EMBALLE → Au dépôt livreur */}
                        {order.orderStatus === "EMBALLE" && (
                          <Button size="sm" variant="secondary" onClick={() => changeStatus(order.id, "AU_DEPOT_LIVREUR")}>
                            <Truck className="h-3.5 w-3.5" />
                            Au dépôt
                          </Button>
                        )}

                        {/* A_EXPEDIER (legacy) → Au dépôt */}
                        {order.orderStatus === "A_EXPEDIER" && (
                          <Button size="sm" variant="secondary" onClick={() => changeStatus(order.id, "AU_DEPOT_LIVREUR")}>
                            <Truck className="h-3.5 w-3.5" />
                            Au dépôt
                          </Button>
                        )}

                        {/* Archive — always available */}
                        <button
                          onClick={() => changeStatus(order.id, "ARCHIVE")}
                          className="rounded-md p-1.5 text-muted hover:bg-surface-sunken hover:text-foreground"
                          title="Archiver"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
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

      {showCreate && activeStore && (
        <CreateOrderModal
          storeId={activeStore.id}
          onClose={() => setShowCreate(false)}
          onCreated={fetchOrders}
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