"use client";

import { useState, useEffect, useRef } from "react";
import { RouteGuard } from "@/components/auth/route-guard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QrCode, CheckCircle2, XCircle, Camera } from "lucide-react";
import { OrderStatus, ORDER_STATUS_LABELS } from "@/types/order";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
}

const SCAN_ACTIONS: { status: OrderStatus; label: string; color: string }[] = [
  { status: "EN_PREPARATION", label: "En préparation", color: "bg-status-processing-bg text-status-processing border-status-processing" },
  { status: "A_EXPEDIER", label: "À expédier", color: "bg-status-shipped-bg text-status-shipped" },
  { status: "AU_DEPOT_LIVREUR", label: "Au dépôt livreur", color: "bg-status-shipped-bg text-status-shipped" },
  { status: "EN_COURS_DE_LIVRAISON", label: "En cours de livraison", color: "bg-status-shipped-bg text-status-shipped border-status-shipped" },
  { status: "LIVRE", label: "Livré", color: "bg-status-delivered-bg text-status-delivered border-status-delivered" },
  { status: "PAYE", label: "Payé", color: "bg-status-delivered-bg text-status-delivered border-status-delivered" },
  { status: "RETOUR", label: "Retour", color: "bg-status-refunded-bg text-status-refunded border-status-refunded" },
  { status: "RETOUR_DEPOT", label: "Retour dépôt", color: "bg-status-refunded-bg text-status-refunded border-status-refunded" },
  { status: "RETOUR_RECU", label: "Retour reçu", color: "bg-status-refunded-bg text-status-refunded border-status-refunded" },
];

interface ScanResult {
  orderId: string;
  orderNumber: string;
  storeId: string;
}

function ScannerContent() {
  const [manualInput, setManualInput] = useState("");
  const [scannedOrder, setScannedOrder] = useState<ScanResult | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [resultMessage, setResultMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleScan(rawData: string) {
    try {
      const parsed: ScanResult = JSON.parse(rawData);
      if (!parsed.orderId || !parsed.orderNumber) {
        setResult("error");
        setResultMessage("QR code invalide");
        return;
      }
      setScannedOrder(parsed);

      // Fetch order details
      const res = await fetch(`${API}/orders/${parsed.orderId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setOrderData(data);
      setResult(null);
    } catch {
      setResult("error");
      setResultMessage("QR code invalide — impossible de lire les données");
    }
  }

  function handleManualSubmit() {
    if (!manualInput.trim()) return;
    handleScan(manualInput.trim());
    setManualInput("");
  }

  async function applyStatus() {
    if (!scannedOrder || !selectedStatus) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders/${scannedOrder.orderId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: selectedStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      setResult("success");
      setResultMessage(`Commande ${scannedOrder.orderNumber} mise à jour: ${ORDER_STATUS_LABELS[selectedStatus]}`);
      setScannedOrder(null);
      setOrderData(null);
      setSelectedStatus(null);
      inputRef.current?.focus();
    } catch {
      setResult("error");
      setResultMessage("Erreur lors de la mise à jour du statut");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setScannedOrder(null);
    setOrderData(null);
    setSelectedStatus(null);
    setResult(null);
    setResultMessage("");
    setManualInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-5">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Scanner QR Code</h1>
        </div>
        <a href="/preparation" className="text-xs text-muted hover:text-foreground">
          ← Retour préparation
        </a>
      </header>

      <div className="mx-auto max-w-lg p-6 space-y-6">

        {/* Result banner */}
        {result && (
          <div className={cn(
            "flex items-center gap-3 rounded-lg p-4",
            result === "success" ? "bg-status-delivered-bg" : "bg-status-cancelled-bg"
          )}>
            {result === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-status-delivered" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0 text-status-cancelled" />
            )}
            <p className={cn(
              "text-sm font-medium",
              result === "success" ? "text-status-delivered" : "text-status-cancelled"
            )}>
              {resultMessage}
            </p>
            <button onClick={() => setResult(null)} className="ml-auto text-muted hover:text-foreground">
              ×
            </button>
          </div>
        )}

        {/* Scanner input */}
        {!scannedOrder && (
          <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
                <Camera className="h-10 w-10 text-primary" />
              </div>
              <p className="text-sm font-medium text-center">
                Scannez le QR code du bordereau
              </p>
              <p className="text-xs text-muted text-center">
                Utilisez un scanner USB ou saisissez manuellement les données
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted">
                Données QR (saisie manuelle ou scanner automatique)
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleManualSubmit();
                  }}
                  placeholder='{"orderId":"...","orderNumber":"#27597",...}'
                  className="flex-1 rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <Button size="sm" onClick={handleManualSubmit} disabled={!manualInput.trim()}>
                  Scanner
                </Button>
              </div>
              <p className="text-[11px] text-muted">
                💡 Si vous utilisez un scanner USB, placez le curseur dans ce champ et scannez directement
              </p>
            </div>
          </div>
        )}

        {/* Order found */}
        {scannedOrder && orderData && (
          <div className="space-y-4">
            <div className="rounded-xl border border-status-delivered/30 bg-status-delivered-bg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-status-delivered" />
                <p className="text-sm font-medium text-status-delivered">Commande trouvée</p>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Commande</span>
                  <span className="font-mono font-semibold">{orderData.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Client</span>
                  <span className="font-medium">{orderData.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Téléphone</span>
                  <span className="font-mono text-xs">{orderData.customerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Statut actuel</span>
                  <span className="font-medium">{ORDER_STATUS_LABELS[orderData.orderStatus as OrderStatus] ?? orderData.orderStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total</span>
                  <span className="font-mono font-semibold">{Number(orderData.total).toFixed(3)} {orderData.currency}</span>
                </div>
              </div>
            </div>

            {/* Status selection */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <p className="text-sm font-medium">Choisir le nouveau statut</p>
              <div className="grid grid-cols-2 gap-2">
                {SCAN_ACTIONS.map((action) => (
                  <button
                    key={action.status}
                    onClick={() => setSelectedStatus(action.status)}
                    disabled={action.status === orderData.orderStatus}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2.5 text-xs font-medium transition-colors text-left",
                      action.status === orderData.orderStatus
                        ? "cursor-default opacity-40 border-border text-muted"
                        : selectedStatus === action.status
                        ? action.color + " border-2"
                        : "border-border text-muted hover:border-border-strong hover:text-foreground"
                    )}
                  >
                    {action.label}
                    {action.status === orderData.orderStatus && (
                      <span className="block text-[10px] mt-0.5">statut actuel</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={reset}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedStatus || loading}
                onClick={applyStatus}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {loading ? "Mise à jour..." : "Confirmer"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScannerPage() {
  return (
    <RouteGuard>
      <ScannerContent />
    </RouteGuard>
  );
}