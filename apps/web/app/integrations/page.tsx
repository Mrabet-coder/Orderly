"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { RouteGuard } from "@/components/auth/route-guard";
import { useStores } from "@/lib/stores-context";
import { MOCK_INTEGRATIONS, MOCK_DELIVERY_INTEGRATIONS } from "@/lib/mock-integrations";
import { StoreIntegration, IntegrationStatus, IntegrationType } from "@/types/order";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  Globe,
  Truck,
  X,
} from "lucide-react";

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  CONNECTED: "text-status-delivered bg-status-delivered-bg",
  DISCONNECTED: "text-status-onhold bg-status-onhold-bg",
  ERROR: "text-status-cancelled bg-status-cancelled-bg",
};

const STATUS_ICONS: Record<IntegrationStatus, React.ElementType> = {
  CONNECTED: CheckCircle2,
  DISCONNECTED: XCircle,
  ERROR: AlertCircle,
};

const TYPE_ICONS: Partial<Record<IntegrationType, React.ElementType>> = {
  SHOPIFY: ShoppingBag,
  GENERIC_API: Globe,
  GOOGLE_SHEETS: Globe,
  CUSTOM: Globe,
  MARKETPLACE: Globe,
  DELIVERY: Truck,
};

const TYPE_LABELS: Partial<Record<IntegrationType, string>> = {
  SHOPIFY: "Shopify",
  GENERIC_API: "Custom API",
  GOOGLE_SHEETS: "Google Sheets",
  CUSTOM: "Custom",
  MARKETPLACE: "Marketplace",
  DELIVERY: "Livraison",
};

function timeSince(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ConnectModal({
  type,
  onClose,
  onConnect,
}: {
  type: IntegrationType;
  storeId: string;
  onClose: () => void;
  onConnect: (config: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const fields: { key: string; label: string; placeholder: string; type?: string }[] =
    type === "SHOPIFY"
      ? [
          { key: "shopDomain", label: "Shop domain", placeholder: "your-store.myshopify.com" },
          { key: "accessToken", label: "Access token", placeholder: "shpat_...", type: "password" },
        ]
      : type === "GENERIC_API"
      ? [
          { key: "endpointUrl", label: "Endpoint URL", placeholder: "https://api.yourstore.com/orders" },
          { key: "apiKey", label: "API key", placeholder: "sk_...", type: "password" },
        ]
      : [
          { key: "sheetUrl", label: "Google Sheet URL", placeholder: "https://docs.google.com/spreadsheets/d/..." },
          { key: "tab", label: "Sheet tab name", placeholder: "Orders" },
        ];

  const Icon = TYPE_ICONS[type] ?? Globe;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold">Connect {TYPE_LABELS[type] ?? type}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-sunken">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-xs font-medium text-muted">{f.label}</label>
              <Input
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onConnect(values);
              onClose();
            }}
          >
            Connect
          </Button>
        </div>
      </div>
    </div>
  );
}

interface StoreSectionProps {
  storeId: string;
  storeName: string;
  integrations: StoreIntegration[];
  onToggle: (id: string) => void;
  onSync: (id: string) => void;
  onAdd: (storeId: string, type: IntegrationType) => void;
}

function StoreSection({
  storeId,
  storeName,
  integrations,
  onToggle,
  onSync,
  onAdd,
}: StoreSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [connectModal, setConnectModal] = useState<IntegrationType | null>(null);

  const availableTypes: IntegrationType[] = ["SHOPIFY", "GENERIC_API", "GOOGLE_SHEETS"];
  const connectedTypes = integrations.map((i) => i.type);
  const unconnectedTypes = availableTypes.filter((t) => !connectedTypes.includes(t));

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sunken">
            <ShoppingBag className="h-4 w-4 text-muted" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{storeName}</p>
            <p className="text-xs text-muted">
              {integrations.filter((i) => i.status === "CONNECTED").length} / {integrations.length} connected
            </p>
          </div>
        </div>
        {expanded
          ? <X className="h-4 w-4 text-muted" />
          : <ShoppingBag className="h-4 w-4 text-muted" />
        }
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-3">
          {integrations.map((integration) => {
            const StatusIcon = STATUS_ICONS[integration.status];
            const TypeIcon = TYPE_ICONS[integration.type as IntegrationType] ?? Globe;

            return (
              <div key={integration.id} className="flex items-center gap-4 rounded-lg border border-border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-sunken">
                  <TypeIcon className="h-5 w-5 text-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{integration.label}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium", STATUS_STYLES[integration.status])}>
                      <StatusIcon className="h-3 w-3" />
                      {integration.status === "CONNECTED" ? "Connected" : integration.status === "ERROR" ? "Error" : "Disconnected"}
                    </span>
                    {integration.status === "CONNECTED" && (
                      <span className="text-[11px] text-muted">
                        Last sync: {timeSince(integration.lastSyncAt ?? null)}
                      </span>
                    )}
                    {integration.status === "ERROR" && (
                      <span className="text-[11px] text-status-cancelled">
                        Failed — check credentials
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {integration.status === "CONNECTED" && (
                    <button
                      onClick={() => onSync(integration.id)}
                      className="rounded-md p-1.5 text-muted hover:bg-surface-sunken hover:text-foreground"
                      title="Sync now"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Button
                    size="sm"
                    variant={integration.status === "CONNECTED" ? "secondary" : "default"}
                    onClick={() => onToggle(integration.id)}
                  >
                    {integration.status === "CONNECTED" ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              </div>
            );
          })}

          {unconnectedTypes.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs font-medium text-muted">Add integration</p>
              <div className="flex flex-wrap gap-2">
                {unconnectedTypes.map((type) => {
                  const Icon = TYPE_ICONS[type] ?? Globe;
                  const alreadyConnected = connectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      disabled={alreadyConnected}
                      onClick={() => setConnectModal(type)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        alreadyConnected
                          ? "cursor-default border-border text-muted-light"
                          : "border-border text-muted hover:border-border-strong hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {TYPE_LABELS[type] ?? type}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {connectModal && (
        <ConnectModal
          type={connectModal}
          storeId={storeId}
          onClose={() => setConnectModal(null)}
          onConnect={(config) => {
            onAdd(storeId, connectModal);
            setConnectModal(null);
          }}
        />
      )}
    </div>
  );
}

function IntegrationsContent() {
  const { canAccessStore } = useAuth();
  const { stores } = useStores();
  const [integrations, setIntegrations] = useState<StoreIntegration[]>(MOCK_INTEGRATIONS);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  const accessibleStores = stores.filter((s) => canAccessStore(s.id));

  useEffect(() => {
    if (stores.length > 0 && selectedStoreIds.length === 0) {
      setSelectedStoreIds(stores.map((s) => s.id));
    }
  }, [stores]);

  function toggleIntegration(id: string) {
    setIntegrations((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const newStatus: IntegrationStatus =
          i.status === "CONNECTED" ? "DISCONNECTED" : "CONNECTED";
        return {
          ...i,
          status: newStatus,
          lastSyncAt: newStatus === "CONNECTED" ? new Date().toISOString() : i.lastSyncAt,
        };
      })
    );
  }

  function syncIntegration(id: string) {
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, lastSyncAt: new Date().toISOString() } : i
        )
      );
    }, 1200);
  }

  function addIntegration(storeId: string, type: IntegrationType) {
    const newInt: StoreIntegration = {
      id: `int_${Date.now()}`,
      storeId,
      type,
      status: "CONNECTED",
      label: TYPE_LABELS[type] ?? type,
      config: {},
      lastSyncAt: new Date().toISOString(),
    };
    setIntegrations((prev) => [...prev, newInt]);
  }

  const connectedCount = integrations.filter((i) => i.status === "CONNECTED").length;
  const errorCount = integrations.filter((i) => i.status === "ERROR").length;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        stores={accessibleStores}
        selectedStoreIds={selectedStoreIds}
        onChangeSelectedStores={setSelectedStoreIds}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
          <h1 className="text-base font-semibold">Integrations</h1>
        </header>

        <div className="grid grid-cols-3 gap-4 border-b border-border bg-surface p-5">
          <div className="rounded-lg bg-surface-sunken px-4 py-3">
            <p className="text-xs text-muted">Total integrations</p>
            <p className="mt-1 text-2xl font-bold">{integrations.length}</p>
          </div>
          <div className="rounded-lg bg-surface-sunken px-4 py-3">
            <p className="text-xs text-muted">Connected</p>
            <p className="mt-1 text-2xl font-bold text-status-delivered">{connectedCount}</p>
          </div>
          <div className="rounded-lg bg-surface-sunken px-4 py-3">
            <p className="text-xs text-muted">Errors</p>
            <p className="mt-1 text-2xl font-bold text-status-cancelled">{errorCount}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {accessibleStores.map((store) => (
            <StoreSection
              key={store.id}
              storeId={store.id}
              storeName={store.name}
              integrations={integrations.filter((i) => i.storeId === store.id)}
              onToggle={toggleIntegration}
              onSync={syncIntegration}
              onAdd={addIntegration}
            />
          ))}
          {accessibleStores.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-sm font-medium text-muted">No stores found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <RouteGuard>
      <IntegrationsContent />
    </RouteGuard>
  );
}