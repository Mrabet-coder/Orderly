"use client";

import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { OrderFilterBar, OrderFilterState } from "@/components/orders/order-filter-bar";
import { OrderTable } from "@/components/orders/order-table";
import { BulkActionsBar } from "@/components/orders/bulk-actions-bar";
import { OrderDetailDrawer } from "@/components/orders/order-detail-drawer";
import { RouteGuard } from "@/components/auth/route-guard";
import { useStores } from "@/lib/stores-context";
import { useOrders } from "@/lib/orders-context";
import { useAuth } from "@/lib/auth-context";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;

function OrdersPageContent() {
  const { orders, setOrderStatus, setOrdersStatus, refundOrder, refresh } = useOrders();
  const { canAccessStore } = useAuth();
  const { stores: allStores } = useStores();

  const accessibleStores = allStores.filter((s) => canAccessStore(s.id));
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  useEffect(() => {
    if (allStores.length > 0 && selectedStoreIds.length === 0) {
      setSelectedStoreIds(allStores.map((s) => s.id));
    }
  }, [allStores]);

  const [filters, setFilters] = useState<OrderFilterState>({
    search: "",
    orderStatus: [],
    financialStatus: [],
    fulfillmentStatus: [],
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(1);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (!selectedStoreIds.includes(o.storeId)) return false;
        if (filters.orderStatus.length && !filters.orderStatus.includes(o.orderStatus)) return false;
        if (filters.financialStatus.length && !filters.financialStatus.includes(o.financialStatus)) return false;
        if (filters.fulfillmentStatus.length && !filters.fulfillmentStatus.includes(o.fulfillmentStatus)) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const haystack = `${o.orderNumber} ${o.customerName ?? ""} ${o.customerEmail ?? ""}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.sourceCreatedAt).getTime() - new Date(a.sourceCreatedAt).getTime());
  }, [orders, selectedStoreIds, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pageOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const liveActiveOrder = activeOrder ? orders.find((o) => o.id === activeOrder.id) ?? null : null;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allOnPageSelected = pageOrders.every((o) => prev.has(o.id));
      const next = new Set(prev);
      if (allOnPageSelected) pageOrders.forEach((o) => next.delete(o.id));
      else pageOrders.forEach((o) => next.add(o.id));
      return next;
    });
  }

  function handleBulkStatus(status: Parameters<typeof setOrdersStatus>[1]) {
    setOrdersStatus(Array.from(selectedIds), status);
    setSelectedIds(new Set());
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        stores={accessibleStores}
        selectedStoreIds={selectedStoreIds}
        onChangeSelectedStores={(ids) => {
          setSelectedStoreIds(ids);
          setPage(1);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
          <h1 className="text-base font-semibold">Orders</h1>
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            Create order
          </Button>
        </header>

        <OrderFilterBar
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            setPage(1);
          }}
          resultCount={filteredOrders.length}
        />

        <BulkActionsBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onFulfill={() => handleBulkStatus("A_EXPEDIER")}
onCancel={() => handleBulkStatus("ANNULE")}
        />

        <OrderTable
          orders={pageOrders}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onRowClick={setActiveOrder}
          onChangeStatus={setOrderStatus}
        />

        <footer className="flex shrink-0 items-center justify-between border-t border-border bg-surface px-5 py-2.5">
          <p className="text-xs text-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredOrders.length)} of{" "}
            {filteredOrders.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-xs text-muted">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </footer>
      </div>

      <OrderDetailDrawer
  order={liveActiveOrder}
  onClose={() => setActiveOrder(null)}
  onChangeStatus={setOrderStatus}
  onRefund={refundOrder}
  onRefreshOrders={refresh}
/>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RouteGuard>
      <OrdersPageContent />
    </RouteGuard>
  );
}