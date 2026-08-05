"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  X, Plus, Trash2, ArrowRightLeft, PackageOpen,
  PackageCheck, AlertTriangle, Truck,
} from "lucide-react";
import { Order } from "@/types/order";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
}

const DELIVERY_COMPANIES = ["Cosmos", "Aramex", "Tunisie Express", "Autre"];

const EXCHANGE_REASONS = [
  "Mauvaise taille",
  "Mauvaise couleur",
  "Produit défectueux",
  "Mauvais produit envoyé",
  "Client a changé d'avis",
  "Autre",
];

interface ExchangeItem {
  title: string;
  sku: string;
  variantTitle: string;
  quantity: number;
  price?: number;
}

export function ExchangeModal({
  order,
  onClose,
  onCreated,
}: {
  order: Order;
  onClose: () => void;
  onCreated: (exchangeOrderNumber: string) => void;
}) {
  const [itemsToRecover, setItemsToRecover] = useState<ExchangeItem[]>(
    order.lineItems.map((li) => ({
      title: li.title,
      sku: li.sku ?? "",
      variantTitle: li.variantTitle ?? "",
      quantity: li.quantity,
    }))
  );

  const [itemsToSend, setItemsToSend] = useState<ExchangeItem[]>(
    order.lineItems.map((li) => ({
      title: li.title,
      sku: li.sku ?? "",
      variantTitle: li.variantTitle ?? "",
      quantity: li.quantity,
      price: 0,
    }))
  );

  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [priceDifference, setPriceDifference] = useState(0);
  const [deliveryCompany, setDeliveryCompany] = useState(order.deliveryCompany ?? "");
  const [loading, setLoading] = useState(false);

  function updateRecover(idx: number, field: string, value: any) {
    setItemsToRecover((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function updateSend(idx: number, field: string, value: any) {
    setItemsToSend((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function addSendItem() {
    setItemsToSend((prev) => [...prev, { title: "", sku: "", variantTitle: "", quantity: 1, price: 0 }]);
  }

  function removeSendItem(idx: number) {
    setItemsToSend((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRecoverItem() {
    setItemsToRecover((prev) => [...prev, { title: "", sku: "", variantTitle: "", quantity: 1 }]);
  }

  function removeRecoverItem(idx: number) {
    setItemsToRecover((prev) => prev.filter((_, i) => i !== idx));
  }

  const finalReason = reason === "Autre" ? customReason : reason;

  async function create() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders/${order.id}/exchange`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemsToRecover: itemsToRecover.filter((i) => i.title.trim()),
          itemsToSend: itemsToSend.filter((i) => i.title.trim()),
          priceDifference,
          reason: finalReason,
          deliveryCompany,
        }),
      });
      const data = await res.json();
      onCreated(data.orderNumber);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const canCreate =
    finalReason.trim() &&
    deliveryCompany &&
    itemsToRecover.some((i) => i.title.trim()) &&
    itemsToSend.some((i) => i.title.trim());

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/30 backdrop-blur-[2px]">
      <div className="w-full max-w-4xl rounded-xl border border-border bg-surface shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
              <ArrowRightLeft className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Créer un échange</h2>
              <p className="text-xs text-muted">
                Commande d'origine : <span className="font-mono">{order.orderNumber}</span> · {order.customerName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-sunken">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Two columns */}
          <div className="grid grid-cols-2 divide-x divide-border">

            {/* LEFT — À récupérer */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageOpen className="h-4 w-4 text-status-refunded" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-status-refunded">
                    À récupérer chez le client
                  </p>
                </div>
                <button onClick={addRecoverItem} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Plus className="h-3 w-3" /> Ajouter
                </button>
              </div>

              <p className="text-[11px] text-muted">
                Le livreur récupère ces produits. Ils retourneront en stock automatiquement.
              </p>

              <div className="space-y-2">
                {itemsToRecover.map((it, idx) => (
                  <div key={idx} className="rounded-lg border border-status-refunded/30 bg-status-refunded-bg/20 p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={it.title}
                        onChange={(e) => updateRecover(idx, "title", e.target.value)}
                        placeholder="Nom produit"
                        className="flex-1 h-7 text-xs"
                      />
                      <button onClick={() => removeRecoverItem(idx)} className="text-muted hover:text-status-cancelled">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted">SKU</label>
                        <Input
                          value={it.sku}
                          onChange={(e) => updateRecover(idx, "sku", e.target.value)}
                          placeholder="SKU"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted">Variante</label>
                        <Input
                          value={it.variantTitle}
                          onChange={(e) => updateRecover(idx, "variantTitle", e.target.value)}
                          placeholder="Taille..."
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted">Qté</label>
                        <Input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => updateRecover(idx, "quantity", parseInt(e.target.value) || 1)}
                          min={1}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — À envoyer */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-status-delivered" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-status-delivered">
                    À envoyer au client
                  </p>
                </div>
                <button onClick={addSendItem} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Plus className="h-3 w-3" /> Ajouter
                </button>
              </div>

              <p className="text-[11px] text-muted">
                Le produit de remplacement. Prix à 0 sauf différence à payer.
              </p>

              <div className="space-y-2">
                {itemsToSend.map((it, idx) => (
                  <div key={idx} className="rounded-lg border border-status-delivered/30 bg-status-delivered-bg/20 p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={it.title}
                        onChange={(e) => updateSend(idx, "title", e.target.value)}
                        placeholder="Nom produit"
                        className="flex-1 h-7 text-xs"
                      />
                      <button onClick={() => removeSendItem(idx)} className="text-muted hover:text-status-cancelled">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted">SKU</label>
                        <Input
                          value={it.sku}
                          onChange={(e) => updateSend(idx, "sku", e.target.value)}
                          placeholder="SKU"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted">Variante</label>
                        <Input
                          value={it.variantTitle}
                          onChange={(e) => updateSend(idx, "variantTitle", e.target.value)}
                          placeholder="Taille..."
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted">Qté</label>
                        <Input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => updateSend(idx, "quantity", parseInt(e.target.value) || 1)}
                          min={1}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom section */}
          <div className="border-t border-border p-5 space-y-4">
            {/* Reason */}
            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Raison de l'échange</label>
              <div className="flex flex-wrap gap-1.5">
                {EXCHANGE_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                      reason === r
                        ? "border-purple-500 bg-purple-50 text-purple-600"
                        : "border-border text-muted hover:border-border-strong"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {reason === "Autre" && (
                <Input
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Précisez la raison..."
                  className="mt-2"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Delivery */}
              <div>
                <label className="mb-2 block text-xs font-medium text-muted">Société de livraison</label>
                <div className="grid grid-cols-2 gap-2">
                  {DELIVERY_COMPANIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setDeliveryCompany(c)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-colors",
                        deliveryCompany === c
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border text-muted hover:border-border-strong"
                      )}
                    >
                      <Truck className="h-3 w-3 shrink-0" />
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price difference */}
              <div>
                <label className="mb-2 block text-xs font-medium text-muted">
                  Différence à encaisser (optionnel)
                </label>
                <Input
                  type="number"
                  value={priceDifference}
                  onChange={(e) => setPriceDifference(parseFloat(e.target.value) || 0)}
                  min={0}
                  step="0.001"
                  placeholder="0.000"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Si le nouveau produit est plus cher. Sinon laisser à 0.
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border-2 border-purple-200 bg-purple-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                <div className="text-xs text-purple-900 space-y-1">
                  <p className="font-semibold">Ce qui va se passer :</p>
                  <p>
                    • Une nouvelle commande <span className="font-mono font-semibold">#E-{order.orderNumber.replace("#", "")}</span> sera créée
                  </p>
                  <p>• Montant à encaisser : <span className="font-mono font-semibold">{priceDifference.toFixed(3)} TND</span></p>
                  <p>• Le bordereau indiquera au livreur les produits à récupérer</p>
                  <p>• Les produits récupérés retourneront en stock à la livraison</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button
            className="flex-1 bg-purple-600 hover:bg-purple-700"
            disabled={loading || !canCreate}
            onClick={create}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {loading ? "Création..." : "Créer l'échange"}
          </Button>
        </div>
      </div>
    </div>
  );
}