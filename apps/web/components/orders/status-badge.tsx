import { cn } from "@/lib/utils";
import {
  FinancialStatus,
  FulfillmentStatus,
  OrderStatus,
  ORDER_STATUS_LABELS,
  FINANCIAL_STATUS_LABELS,
  FULFILLMENT_STATUS_LABELS,
} from "@/types/order";

const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  NOUVEAU: "text-status-new bg-status-new-bg",
  CONFIRMATION_EN_COURS: "text-status-processing bg-status-processing-bg",
  CONFIRME: "text-status-new bg-status-new-bg",
  EN_PREPARATION: "text-status-processing bg-status-processing-bg",
  EN_COURS_DE_LIVRAISON: "text-status-shipped bg-status-shipped-bg",
  LIVRE: "text-status-delivered bg-status-delivered-bg",
  PAYE: "text-status-delivered bg-status-delivered-bg",
  RETOUR: "text-status-refunded bg-status-refunded-bg",
  RETOUR_DEPOT: "text-status-refunded bg-status-refunded-bg",
  RETOUR_RECU: "text-status-refunded bg-status-refunded-bg",
  ANNULE: "text-status-cancelled bg-status-cancelled-bg",
  A_VERIFIER: "text-status-cancelled bg-status-cancelled-bg",
  A_EXPEDIER: "text-status-shipped bg-status-shipped-bg",
  AU_DEPOT_LIVREUR: "text-status-shipped bg-status-shipped-bg",
  ECHANGE: "text-purple-600 bg-purple-50",
  IMPRIME: "text-status-shipped bg-status-shipped-bg",
  EMBALLE: "text-status-shipped bg-status-shipped-bg",
  ARCHIVE: "text-muted bg-surface-sunken",
};

const FINANCIAL_STATUS_STYLE: Record<FinancialStatus, string> = {
  PENDING: "text-status-processing bg-status-processing-bg",
  AUTHORIZED: "text-status-new bg-status-new-bg",
  PARTIALLY_PAID: "text-status-processing bg-status-processing-bg",
  PAID: "text-status-delivered bg-status-delivered-bg",
  PARTIALLY_REFUNDED: "text-status-refunded bg-status-refunded-bg",
  REFUNDED: "text-status-refunded bg-status-refunded-bg",
  VOIDED: "text-status-cancelled bg-status-cancelled-bg",
};

const FULFILLMENT_STATUS_STYLE: Record<FulfillmentStatus, string> = {
  UNFULFILLED: "text-status-onhold bg-status-onhold-bg",
  PARTIAL: "text-status-processing bg-status-processing-bg",
  FULFILLED: "text-status-delivered bg-status-delivered-bg",
  RESTOCKED: "text-status-new bg-status-new-bg",
  CANCELLED: "text-status-cancelled bg-status-cancelled-bg",
};

function Dot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", className)} style={{ backgroundColor: "currentColor" }} />;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
        ORDER_STATUS_STYLE[status]
      )}
    >
      <Dot />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function FinancialStatusBadge({ status }: { status: FinancialStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        FINANCIAL_STATUS_STYLE[status]
      )}
    >
      {FINANCIAL_STATUS_LABELS[status]}
    </span>
  );
}

export function FulfillmentStatusBadge({ status }: { status: FulfillmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        FULFILLMENT_STATUS_STYLE[status]
      )}
    >
      {FULFILLMENT_STATUS_LABELS[status]}
    </span>
  );
}
