"use client";

import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { RouteGuard } from "@/components/auth/route-guard";
import { useStores } from "@/lib/stores-context";
import { useOrders } from "@/lib/orders-context";
import { useAuth } from "@/lib/auth-context";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Package, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, XCircle, ArrowRight, Store as StoreIcon,
} from "lucide-react";
import { OrderStatus } from "@/types/order";

const STATUS_ORDER: OrderStatus[] = [
  "NOUVEAU", "CONFIRMATION_EN_COURS", "CONFIRME", "EN_PREPARATION",
  "A_EXPEDIER", "AU_DEPOT_LIVREUR", "EN_COURS_DE_LIVRAISON", "LIVRE", "PAYE", "RETOUR",
  "RETOUR_DEPOT", "RETOUR_RECU", "ANNULE", "A_VERIFIER",
];

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-1.5 text-2xl font-bold">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
        <div className={cn("rounded-lg p-2.5", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function StatusBar({ status, count, total }: { status: OrderStatus; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const COLOR: Partial<Record<OrderStatus, string>> = {
    NOUVEAU: "bg-status-new",
    CONFIRMATION_EN_COURS: "bg-status-processing",
    CONFIRME: "bg-status-new",
    EN_PREPARATION: "bg-status-processing",
    A_EXPEDIER: "bg-status-shipped",
    EN_COURS_DE_LIVRAISON: "bg-status-shipped",
    LIVRE: "bg-status-delivered",
    PAYE: "bg-status-delivered",
    RETOUR: "bg-status-refunded",
    RETOUR_DEPOT: "bg-status-refunded",
    RETOUR_RECU: "bg-status-refunded",
    ANNULE: "bg-status-cancelled",
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0"><OrderStatusBadge status={status} /></div>
      <div className="flex-1">
        <div className="h-2 w-full rounded-full bg-surface-sunken">
          <div className={cn("h-2 rounded-full transition-all", COLOR[status] ?? "bg-muted")} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="w-8 text-right text-xs font-medium text-muted">{count}</span>
    </div>
  );
}

function OverviewContent() {
  const { orders } = useOrders();
  const { canAccessStore } = useAuth();
  const { stores } = useStores();
  const router = useRouter();
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  const accessibleStores = stores.filter((s) => canAccessStore(s.id));

  useEffect(() => {
    if (stores.length > 0 && selectedStoreIds.length === 0) {
      setSelectedStoreIds(stores.map((s) => s.id));
    }
  }, [stores]);

  const visibleOrders = useMemo(
    () => orders.filter((o) => selectedStoreIds.includes(o.storeId)),
    [orders, selectedStoreIds]
  );

  const totalRevenue = visibleOrders
    .filter((o) => o.financialStatus === "PAID" || o.financialStatus === "PARTIALLY_REFUNDED")
    .reduce((s, o) => s + o.total - o.totalRefunded, 0);

  const totalRefunded = visibleOrders.reduce((s, o) => s + o.totalRefunded, 0);

  const statusCounts = useMemo(() => {
    const map: Partial<Record<OrderStatus, number>> = {};
    for (const o of visibleOrders) {
      map[o.orderStatus] = (map[o.orderStatus] ?? 0) + 1;
    }
    return map;
  }, [visibleOrders]);

  const recentOrders = useMemo(
    () => [...visibleOrders]
      .sort((a, b) => new Date(b.sourceCreatedAt).getTime() - new Date(a.sourceCreatedAt).getTime())
      .slice(0, 8),
    [visibleOrders]
  );

  const needsAttention = visibleOrders.filter(
    (o) => o.orderStatus === "RETOUR" || o.orderStatus === "RETOUR_DEPOT" || o.financialStatus === "PARTIALLY_REFUNDED"
  ).length;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        stores={accessibleStores}
        selectedStoreIds={selectedStoreIds}
        onChangeSelectedStores={setSelectedStoreIds}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-surface px-5">
          <h1 className="text-base font-semibold">Vue d'ensemble</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total commandes"
              value={visibleOrders.length.toLocaleString()}
              sub="tous les magasins"
              icon={Package}
              color="bg-primary-soft text-primary"
            />
            <StatCard
              label="Chiffre d'affaires"
              value={totalRevenue.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              sub="payé, moins remboursements"
              icon={TrendingUp}
              color="bg-status-delivered-bg text-status-delivered"
            />
            <StatCard
              label="Livrés"
              value={(statusCounts["LIVRE"] ?? 0) + (statusCounts["PAYE"] ?? 0)}
              sub={`${visibleOrders.length > 0 ? Math.round((((statusCounts["LIVRE"] ?? 0) + (statusCounts["PAYE"] ?? 0)) / visibleOrders.length) * 100) : 0}% du total`}
              icon={CheckCircle2}
              color="bg-status-delivered-bg text-status-delivered"
            />
            <StatCard
              label="Attention requise"
              value={needsAttention}
              sub="retours, remboursements partiels"
              icon={AlertTriangle}
              color="bg-status-processing-bg text-status-processing"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Commandes par statut</h2>
                <button onClick={() => router.push("/confirmation")} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Voir tout <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2.5">
                {STATUS_ORDER.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => (
                  <StatusBar key={s} status={s} count={statusCounts[s] ?? 0} total={visibleOrders.length} />
                ))}
                {visibleOrders.length === 0 && <p className="text-xs text-muted">Aucune commande.</p>}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Commandes par magasin</h2>
                <button onClick={() => router.push("/stores")} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Voir tout <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-3">
                {accessibleStores.filter((s) => selectedStoreIds.includes(s.id)).map((store) => {
                  const count = visibleOrders.filter((o) => o.storeId === store.id).length;
                  const pct = visibleOrders.length > 0 ? (count / visibleOrders.length) * 100 : 0;
                  return (
                    <div key={store.id} className="flex items-center gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-sunken">
                        <StoreIcon className="h-3.5 w-3.5 text-muted" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="truncate text-xs font-medium">{store.name}</span>
                          <span className="ml-2 shrink-0 text-xs text-muted">{count}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-sunken">
                          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Commandes récentes</h2>
              <button onClick={() => router.push("/confirmation")} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Voir tout <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <div key={order.id} onClick={() => router.push("/confirmation")} className="flex cursor-pointer items-center justify-between px-5 py-3 hover:bg-surface-sunken transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">{order.orderNumber}</span>
                    <span className="text-xs text-muted">{order.customerName}</span>
                    <span className="hidden text-xs text-muted-light sm:inline">{order.storeName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={order.orderStatus} />
                    <span className="font-mono text-sm font-medium">{order.total} {order.currency}</span>
                  </div>
                </div>
              ))}
              {recentOrders.length === 0 && (
                <div className="px-5 py-8 text-center text-xs text-muted">Aucune commande.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4 text-center">
              <Clock className="mx-auto h-5 w-5 text-status-processing" />
              <p className="mt-2 text-xl font-bold">{(statusCounts["NOUVEAU"] ?? 0) + (statusCounts["CONFIRMATION_EN_COURS"] ?? 0)}</p>
              <p className="text-xs text-muted">En attente de confirmation</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4 text-center">
              <XCircle className="mx-auto h-5 w-5 text-status-cancelled" />
              <p className="mt-2 text-xl font-bold">{statusCounts["ANNULE"] ?? 0}</p>
              <p className="text-xs text-muted">Annulées</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4 text-center">
              <TrendingUp className="mx-auto h-5 w-5 text-status-refunded" />
              <p className="mt-2 text-xl font-bold">{totalRefunded.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-muted">Total remboursé</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <RouteGuard>
      <OverviewContent />
    </RouteGuard>
  );
}