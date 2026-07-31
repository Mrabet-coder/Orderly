"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Order, OrderStatus, FinancialStatus } from "@/types/order";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("orderly_token");
}

interface OrdersContextValue {
  orders: Order[];
  isLoading: boolean;
  setOrderStatus: (orderId: string, status: OrderStatus, extra?: { reason?: string; note?: string }) => void;
  setOrdersStatus: (orderIds: string[], status: OrderStatus) => void;
  refundOrder: (orderId: string, amount: number) => void;
  refresh: () => void;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

function deriveStatuses(newStatus: OrderStatus) {
  switch (newStatus) {
    case "EN_COURS_DE_LIVRAISON":
    case "LIVRE":
    case "PAYE":
      return { fulfillmentStatus: "FULFILLED" as const };
    case "ANNULE":
      return { fulfillmentStatus: "CANCELLED" as const, financialStatus: "VOIDED" as const };
    case "RETOUR":
    case "RETOUR_RECU":
      return { fulfillmentStatus: "RESTOCKED" as const, financialStatus: "REFUNDED" as const };
    case "RETOUR_DEPOT":
      return { fulfillmentStatus: "RESTOCKED" as const };
    default:
      return { fulfillmentStatus: "UNFULFILLED" as const };
      case "A_EXPEDIER":
case "AU_DEPOT_LIVREUR":
  return { fulfillmentStatus: "PARTIAL" as const };
  }
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchOrders() {
    try {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      const res = await fetch(`${API}/orders?pageSize=200`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (e) {
      console.error("fetchOrders error:", e);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      const token = window.localStorage.getItem("orderly_token");
      if (token && orders.length === 0 && !isLoading) {
        fetchOrders();
      }
    }, 1000);

    fetchOrders();
    window.addEventListener('orderly:login', fetchOrders);

    return () => {
      clearInterval(interval);
      window.removeEventListener('orderly:login', fetchOrders);
    };
  }, []);

  function setOrderStatus(
    orderId: string,
    status: OrderStatus,
    extra?: { reason?: string; note?: string },
  ) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          orderStatus: status,
          ...deriveStatuses(status),
          ...(extra?.reason && { cancellationReason: extra.reason }),
          ...(extra?.note && { cancellationNote: extra.note }),
        };
      })
    );
    const token = getToken();
    if (token) {
      fetch(`${API}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, ...extra }),
      }).catch(console.error);
    }
  }

  function setOrdersStatus(orderIds: string[], status: OrderStatus) {
    const idSet = new Set(orderIds);
    setOrders((prev) =>
      prev.map((o) => {
        if (!idSet.has(o.id)) return o;
        return { ...o, orderStatus: status, ...deriveStatuses(status) };
      })
    );
    const token = getToken();
    if (token) {
      fetch(`${API}/orders/bulk/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderIds, status }),
      }).catch(console.error);
    }
  }

  function refundOrder(orderId: string, amount: number) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const totalRefunded = Math.min(o.total, o.totalRefunded + amount);
        const financialStatus: FinancialStatus =
          totalRefunded >= o.total ? "REFUNDED" : "PARTIALLY_REFUNDED";
        return { ...o, totalRefunded, financialStatus };
      })
    );
    const token = getToken();
    if (token) {
      fetch(`${API}/orders/${orderId}/refund`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
      }).catch(console.error);
    }
  }

  return (
    <OrdersContext.Provider
      value={{ orders, isLoading, setOrderStatus, setOrdersStatus, refundOrder, refresh: fetchOrders }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}