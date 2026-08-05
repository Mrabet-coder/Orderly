"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, AtSign, AlertTriangle, Calendar, MessageSquare, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Order } from "@/types/order";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  orderId: string | null;
  actorName: string | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

const ICON_MAP: Record<string, any> = {
  mention: AtSign,
  stock_alert: AlertTriangle,
  scheduled_delivery: Calendar,
  reclamation: MessageSquare,
  stock: AlertTriangle,
  scheduled: Calendar,
};

const COLOR_MAP: Record<string, string> = {
  mention: "text-primary bg-primary-soft",
  stock_alert: "text-status-processing bg-status-processing-bg",
  stock: "text-status-processing bg-status-processing-bg",
  scheduled_delivery: "text-primary bg-primary-soft",
  scheduled: "text-primary bg-primary-soft",
  reclamation: "text-status-cancelled bg-status-cancelled-bg",
};

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dbNotifs, setDbNotifs] = useState<Notification[]>([]);
  const [liveNotifs, setLiveNotifs] = useState<Notification[]>([]);
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());

  // Fetch DB notifications (mentions)
  const fetchDbNotifs = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDbNotifs(Array.isArray(data) ? data : []);
    } catch {
      setDbNotifs([]);
    }
  }, []);

  // Build live notifications (stock, scheduled, reclamations)
  const buildLiveNotifs = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;

      const notifs: Notification[] = [];
      const now = new Date();

      // Stock alerts
      const storesRes = await fetch(`${API}/stores`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stores = await storesRes.json();

      for (const store of (Array.isArray(stores) ? stores : [])) {
        const productsRes = await fetch(`${API}/stores/${store.id}/products`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const products = await productsRes.json();
        for (const p of (Array.isArray(products) ? products : [])) {
          if (p.quantityAvailable <= p.lowStockThreshold) {
            notifs.push({
              id: `stock-${p.id}`,
              type: "stock",
              title: "Stock bas",
              message: `${p.name} — ${p.quantityAvailable} unités restantes`,
              link: "/products",
              orderId: null,
              actorName: null,
              isRead: false,
              createdAt: p.updatedAt,
            });
          }
        }
      }

      // Orders — scheduled + reclamations
      const ordersRes = await fetch(`${API}/orders?pageSize=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ordersData = await ordersRes.json();
      const orders: Order[] = ordersData.orders ?? [];

      for (const order of orders) {
        if (order.scheduledDeliveryDate) {
          const deliveryDate = new Date(order.scheduledDeliveryDate);
          const diffDays = Math.ceil((deliveryDate.getTime() - now.getTime()) / 86400000);
          if (diffDays <= 1 && diffDays >= 0) {
            notifs.push({
              id: `scheduled-${order.id}`,
              type: "scheduled",
              title: "Livraison programmée",
              message: `${order.orderNumber} — ${order.customerName} — ${diffDays === 0 ? "aujourd'hui" : "demain"}`,
              link: "/confirmation",
              orderId: order.id,
              actorName: null,
              isRead: false,
              createdAt: order.scheduledDeliveryDate,
            });
          }
        }

        if ((order.tags ?? []).includes("Réclamation")) {
          try {
            const rec = JSON.parse(order.internalNote ?? "{}").reclamation;
            if (rec && rec.status !== "RESOLU") {
              notifs.push({
                id: `rec-${order.id}`,
                type: "reclamation",
                title: "Réclamation ouverte",
                message: `${order.orderNumber} — ${order.customerName} — ${rec.type ?? ""}`,
                link: "/reclamation",
                orderId: order.id,
                actorName: null,
                isRead: false,
                createdAt: rec.createdAt ?? order.updatedAt,
              });
            }
          } catch {}
        }
      }

      setLiveNotifs(notifs);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchDbNotifs();
    buildLiveNotifs();
    const interval = setInterval(() => {
      fetchDbNotifs();
      buildLiveNotifs();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchDbNotifs, buildLiveNotifs]);

  const all = [...dbNotifs, ...liveNotifs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const unreadCount = all.filter((n) => !n.isRead && !localRead.has(n.id)).length;

  async function markAllRead() {
    setLocalRead(new Set(all.map((n) => n.id)));
    try {
      await fetch(`${API}/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchDbNotifs();
    } catch {}
  }

  async function handleClick(n: Notification) {
    setLocalRead((prev) => new Set([...prev, n.id]));
    setOpen(false);

    // Mark DB notification as read
    if (dbNotifs.some((d) => d.id === n.id)) {
      try {
        await fetch(`${API}/notifications/${n.id}/read`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        fetchDbNotifs();
      } catch {}
    }

    if (n.link) {
      const url = n.orderId ? `${n.link}?order=${n.orderId}` : n.link;
      router.push(url);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-sunken hover:text-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-status-cancelled text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-50 w-80 rounded-xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Tout lire
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-surface-sunken">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {all.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Bell className="h-8 w-8 text-muted-light" />
                  <p className="mt-2 text-xs text-muted">Aucune notification</p>
                </div>
              ) : (
                all.map((n) => {
                  const Icon = ICON_MAP[n.type] ?? Package;
                  const isRead = n.isRead || localRead.has(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-sunken transition-colors",
                        !isRead && "bg-primary-soft/20"
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        COLOR_MAP[n.type] ?? "bg-surface-sunken text-muted"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{n.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted leading-relaxed line-clamp-2">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-light">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!isRead && (
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}