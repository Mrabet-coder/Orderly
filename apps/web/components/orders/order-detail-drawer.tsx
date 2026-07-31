"use client";

import { Order, OrderStatus, CallAttempt } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OrderStatusBadge,
  FinancialStatusBadge,
  FulfillmentStatusBadge,
} from "@/components/orders/status-badge";
import { OrderActionsMenu } from "@/components/orders/order-actions-menu";
import { X, Mail, Phone, Truck, Package, Plus, PhoneCall } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
}

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const CANCELLATION_REASONS = [
  "Client injoignable",
  "Client a refuse",
  "Mauvaise adresse",
  "Commande en double",
  "Rupture de stock",
  "Probleme de prix",
  "Changement d'avis",
  "Autre",
];

const CALL_RESULTS = [
  { value: "ANSWERED_CONFIRMED", label: "Answered — Confirmed" },
  { value: "ANSWERED_REFUSED", label: "Answered — Refused" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "BUSY", label: "Busy" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
];

const RESULT_COLORS: Record<string, string> = {
  ANSWERED_CONFIRMED: "text-status-delivered",
  ANSWERED_REFUSED: "text-status-cancelled",
  NO_ANSWER: "text-status-processing",
  BUSY: "text-status-processing",
  WRONG_NUMBER: "text-status-cancelled",
};

const RESULT_LABELS: Record<string, string> = {
  ANSWERED_CONFIRMED: "Confirme",
  ANSWERED_REFUSED: "Refuse",
  NO_ANSWER: "Pas de reponse",
  BUSY: "Occupe",
  WRONG_NUMBER: "Mauvais numero",
};

function CancellationModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (reason: string, note: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Raison d'annulation</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-sunken">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-2 gap-2">
            {CANCELLATION_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors",
                  reason === r
                    ? "border-status-cancelled bg-status-cancelled-bg text-status-cancelled"
                    : "border-border text-muted hover:border-border-strong hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Note (optionnel)</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Details supplementaires..."
            />
          </div>
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Retour</Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!reason}
            onClick={() => onConfirm(reason, note)}
          >
            Confirmer l'annulation
          </Button>
        </div>
      </div>
    </div>
  );
}

function CallAttemptsPanel({
  order,
  onUpdate,
  onChangeStatus,
  onShowCancelModal,
}: {
  order: Order;
  onUpdate: () => void;
  onChangeStatus: (orderId: string, status: OrderStatus) => void;
  onShowCancelModal: () => void;
}) {
  const [phone, setPhone] = useState(order.customerPhone ?? "");
  const [result, setResult] = useState("NO_ANSWER");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const attempts: CallAttempt[] = Array.isArray(order.callAttempts) ? order.callAttempts : [];

  async function addAttempt() {
    setLoading(true);
    try {
      const newAttempt = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        phone,
        result,
        note: note || null,
      };
      const updatedAttempts = [...attempts, newAttempt];
      await fetch(`${API}/orders/${order.id}/call-attempts`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ callAttempts: updatedAttempts }),
      });
      setNote("");
      setResult("NO_ANSWER");

      if (result === "ANSWERED_CONFIRMED") {
        onChangeStatus(order.id, "CONFIRME");
      } else if (result === "ANSWERED_REFUSED") {
        onShowCancelModal();
      }

      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted flex items-center gap-1.5">
          <PhoneCall className="h-3.5 w-3.5" />
          Appels de confirmation ({attempts.length})
        </p>
        {attempts.length > 0 && (
          <span className="text-[11px] text-muted">
            {attempts.filter((a) => a.result === "NO_ANSWER" || a.result === "BUSY").length} sans reponse
          </span>
        )}
      </div>

      {attempts.length > 0 && (
        <div className="divide-y divide-border">
          {attempts.map((a, i) => (
            <div key={a.id} className="px-3.5 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">
                  Tentative {i + 1} — {a.phone}
                </span>
                <span className={cn("text-xs font-medium", RESULT_COLORS[a.result] ?? "text-muted")}>
                  {RESULT_LABELS[a.result] ?? a.result}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-light">
                {formatDateTime(a.date)}
                {a.note && ` — ${a.note}`}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2.5 p-3.5">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Numero de telephone</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+216 XX XXX XXX"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Resultat</label>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {CALL_RESULTS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Note (optionnel)</label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: rappeler demain"
            className="h-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={loading || !phone}
          onClick={addAttempt}
        >
          <Plus className="h-3.5 w-3.5" />
          {loading ? "Enregistrement..." : "Logger tentative"}
        </Button>
      </div>
    </div>
  );
}

export function OrderDetailDrawer({
  order,
  onClose,
  onChangeStatus,
  onRefund,
  onRefreshOrders,
}: {
  order: Order | null;
  onClose: () => void;
  onChangeStatus: (orderId: string, status: OrderStatus, extra?: { reason?: string; note?: string }) => void;
  onRefund: (orderId: string, amount: number) => void;
  onRefreshOrders: () => void;
}) {
  const [refundAmount, setRefundAmount] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  if (!order) return null;

  const remainingRefundable = order.total - order.totalRefunded;

  function handleRefund() {
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0 || amount > remainingRefundable) return;
    onRefund(order!.id, amount);
    setRefundAmount("");
  }

  function handleStatusChange(status: OrderStatus) {
    if (status === "ANNULE") {
      setShowCancelModal(true);
    } else {
      onChangeStatus(order!.id, status);
    }
  }

  function handleCancellationConfirm(reason: string, note: string) {
    onChangeStatus(order!.id, "ANNULE", { reason, note });
    setShowCancelModal(false);
  }

  const showCallPanel =
    order.orderStatus === "NOUVEAU" ||
    order.orderStatus === "CONFIRMATION_EN_COURS" ||
    order.orderStatus === "CONFIRME" ||
    (Array.isArray(order.callAttempts) && order.callAttempts.length > 0);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 z-50 flex h-screen w-[500px] flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-mono text-base font-semibold">{order.orderNumber}</h2>
            <p className="text-xs text-muted">{order.storeName}</p>
          </div>
          <div className="flex items-center gap-1">
            <OrderActionsMenu
              currentStatus={order.orderStatus}
              onChangeStatus={handleStatusChange}
            />
            <button onClick={onClose} className="rounded-md p-1.5 hover:bg-surface-sunken">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <OrderStatusBadge status={order.orderStatus} />
            <FinancialStatusBadge status={order.financialStatus} />
            <FulfillmentStatusBadge status={order.fulfillmentStatus} />
          </div>

          {order.orderStatus === "ANNULE" && order.cancellationReason && (
            <div className="mt-3 rounded-lg border border-status-cancelled/30 bg-status-cancelled-bg p-3">
              <p className="text-xs font-medium text-status-cancelled">Raison d'annulation</p>
              <p className="mt-0.5 text-sm font-medium">{order.cancellationReason}</p>
              {order.cancellationNote && (
                <p className="mt-0.5 text-xs text-muted">{order.cancellationNote}</p>
              )}
            </div>
          )}

          {showCallPanel && (
            <CallAttemptsPanel
              order={order}
              onUpdate={onRefreshOrders}
              onChangeStatus={onChangeStatus}
              onShowCancelModal={() => setShowCancelModal(true)}
            />
          )}

          <div className="mt-4 rounded-lg border border-border p-3.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Client</p>
            <p className="mt-1.5 text-sm font-medium">{order.customerName}</p>
            <div className="mt-2 space-y-1.5 text-xs text-muted">
              {order.customerEmail && (
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {order.customerEmail}
                </p>
              )}
              {order.customerPhone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {order.customerPhone}
                </p>
              )}
            </div>
          </div>

          {order.trackingNumber && (
            <div className="mt-3 rounded-lg border border-border p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Expedition</p>
              <p className="mt-1.5 flex items-center gap-1.5 font-mono text-sm">
                <Truck className="h-3.5 w-3.5 text-muted" />
                {order.trackingNumber}
              </p>
              <p className="mt-0.5 text-xs text-muted">via {order.carrier}</p>
            </div>
          )}

          <div className="mt-3 rounded-lg border border-border">
            <p className="border-b border-border px-3.5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted">
              Articles ({order.itemCount})
            </p>
            <div className="divide-y divide-border">
              {order.lineItems.map((li) => (
                <div key={li.id} className="flex items-start gap-3 px-3.5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken">
                    <Package className="h-4 w-4 text-muted-light" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{li.title}</p>
                    <p className="font-mono text-xs text-muted">
                      {li.sku} · Qte {li.quantity}
                      {li.refundedQty > 0 && (
                        <span className="text-status-refunded"> · {li.refundedQty} rembourse</span>
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-sm font-medium">
                    {formatMoney(li.price * li.quantity, order.currency)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-1.5 rounded-lg border border-border p-3.5 text-sm">
            <div className="flex justify-between text-muted">
              <span>Sous-total</span>
              <span className="font-mono">{formatMoney(order.subtotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Livraison</span>
              <span className="font-mono">{formatMoney(order.shippingTotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Taxes</span>
              <span className="font-mono">{formatMoney(order.taxTotal, order.currency)}</span>
            </div>
            {order.totalRefunded > 0 && (
              <div className="flex justify-between text-status-refunded">
                <span>Rembourse</span>
                <span className="font-mono">-{formatMoney(order.totalRefunded, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatMoney(order.total, order.currency)}</span>
            </div>
          </div>

          {remainingRefundable > 0 && (
            <div className="mt-3 rounded-lg border border-border p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Remboursement</p>
              <p className="mt-1 text-xs text-muted">
                Jusqu'a {formatMoney(remainingRefundable, order.currency)} remboursable
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                  max={remainingRefundable}
                  min={0}
                  step="0.01"
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <Button size="sm" variant="secondary" onClick={handleRefund}>
                  Rembourser
                </Button>
              </div>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-muted-light">
            Commande du {formatDateTime(order.sourceCreatedAt)}
          </p>
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <Button variant="secondary" className="flex-1">
            Voir sur {order.storeName.includes("Shopify") ? "Shopify" : "source"}
          </Button>
          <Button className="flex-1" onClick={() => handleStatusChange("A_EXPEDIER")}>
  <Truck className="h-3.5 w-3.5" />
  A expédier
</Button>
        </div>
      </div>

      {showCancelModal && (
        <CancellationModal
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancellationConfirm}
        />
      )}
    </>
  );
}