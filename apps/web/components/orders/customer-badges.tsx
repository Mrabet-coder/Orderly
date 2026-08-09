"use client";

import { cn } from "@/lib/utils";
import { ShoppingBag, Star, AlertTriangle, Phone, Package } from "lucide-react";

export interface CustomerStats {
  phone: string;
  totalOrders: number;
  confirmationRate: number;
  deliveryRate: number;
  returnRate: number;
  lifetimeValue: number;
  avgBasket: number;
}

export function normalizePhone(phone?: string | null): string {
  return (phone ?? "").replace(/\s|\+216/g, "");
}

function money(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export function CustomerBadges({ stats }: { stats?: CustomerStats }) {
  if (!stats || stats.totalOrders <= 1) return null;

  const isVip = stats.lifetimeValue >= 500;
  const isRisky = stats.returnRate > 40;
  const goodConfirm = stats.confirmationRate >= 70;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {/* Orders count */}
      <span
        title={`${stats.totalOrders} commandes au total`}
        className="flex items-center gap-0.5 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-bold text-muted"
      >
        <ShoppingBag className="h-2.5 w-2.5" />
        {stats.totalOrders}
      </span>

      {/* Confirmation rate */}
      <span
        title={`${stats.confirmationRate}% de confirmation — répond au téléphone`}
        className={cn(
          "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold",
          goodConfirm
            ? "bg-status-delivered-bg text-status-delivered"
            : stats.confirmationRate >= 40
            ? "bg-status-processing-bg text-status-processing"
            : "bg-status-cancelled-bg text-status-cancelled"
        )}
      >
        <Phone className="h-2.5 w-2.5" />
        {stats.confirmationRate}%
      </span>

      {/* Delivery rate */}
      {stats.deliveryRate > 0 && (
        <span
          title={`${stats.deliveryRate}% de livraison réussie`}
          className={cn(
            "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold",
            stats.deliveryRate >= 70
              ? "bg-status-delivered-bg text-status-delivered"
              : stats.deliveryRate >= 40
              ? "bg-status-processing-bg text-status-processing"
              : "bg-status-cancelled-bg text-status-cancelled"
          )}
        >
          <Package className="h-2.5 w-2.5" />
          {stats.deliveryRate}%
        </span>
      )}

      {/* Lifetime value */}
      {stats.lifetimeValue > 0 && (
        <span
          title={`${money(stats.lifetimeValue)} TND encaissés · panier moyen ${money(stats.avgBasket)} TND`}
          className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary"
        >
          {money(stats.lifetimeValue)} TND
        </span>
      )}

      {/* VIP */}
      {isVip && (
        <span
          title="Client VIP — plus de 500 TND"
          className="flex items-center gap-0.5 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700"
        >
          <Star className="h-2.5 w-2.5" />
          VIP
        </span>
      )}

      {/* Risk */}
      {isRisky && (
        <span
          title={`${stats.returnRate}% de retours — client à risque`}
          className="flex items-center gap-0.5 rounded bg-status-cancelled-bg px-1.5 py-0.5 text-[10px] font-bold text-status-cancelled"
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {stats.returnRate}%
        </span>
      )}
    </div>
  );
}