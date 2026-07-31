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
  Plug,
  ShoppingBag,
  Globe,
  Sheet,
  Truck,
  ChevronDown,
  ChevronUp,
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
  GOOGLE_SHEETS: Sheet,
  CUSTOM: Globe,
  MARKETPLACE: Globe,
  DELIVERY: Truck,
};
};

const TYPE_LABELS: Record<IntegrationType, string> = {
  SHOPIFY: "Shopify",
  GENERIC_API: "Custom API",
  GOOGLE_SHEETS: "Google Sheets",
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
  storeId,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = TYPE_ICONS[type];
              return <Icon className="h-4 w-4 text-muted" />;
            })()}
            <h2 className="text-sm font-semibold">Connect {TYPE_LABELS[type]}</h2>
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

function IntegrationCard({
  integration,
  onToggle,
  onSync,
}: {
  integration: StoreIntegration;
  onToggle: (id: string) => void;
  onSync: (id: string) => void;
}) {
  const StatusIcon = STATUS_ICONS[integration.status];
  const TypeIcon = TYPE_ICONS[integration.type];

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 hover:border-border-strong transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken">
          <TypeIcon className="h-4 w-4 text-muted" />
        </div>
        <div>
          <p className="text-sm font-medium">{integration.label}</p>
          <p className="text-xs text-muted">
            {integration.status === "CONNECTED"
              ? `Last sync: ${timeSince(integration.lastSyncAt)}`
              : integration.status === "ERROR"
              ? "Sync failed — check credentials"
              : "Not connected"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
            STATUS_STYLES[integration.status]
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {integration.status.charAt(0) + integration.status.slice(1).toLowerCase()}
        </span>

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
}

function StoreSection({
  storeId,
  storeName,
  integrations,
  onToggle,
  onSync,
  onAdd,
}: {
  storeId: string;
  storeName: string;
  integrations: StoreIntegration[];
  onToggle: (id: string) => void;
  onSync: (id: string) => void;
  onAdd: (storeId: string, type: IntegrationType) => void;
}) {
  const [open, setOpen] = useState(true);
  const [addModal, setAddModal] = useState<IntegrationType | null>(null);
  const delivery = MOCK_DELIVERY_INTEGRATIONS.find((d) => d.storeId === storeId);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-surface-sunken transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-sunken">
            <Plug className="h-4 w-4 text-muted" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{storeName}</p>
            <p className="text-xs text-muted">
              {integrations.filter((i) => i.status === "CONNECTED").length} of{" "}
              {integrations.length} connected
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Order source
          </p>
          {integrations.length === 0 && (
            <p className="text-xs text-muted">No integrations yet — add one below.</p>
          )}
          {integrations.map((int) => (
            <IntegrationCard
              key={int.id}
              integration={int}
              onToggle={onToggle}
              onSync={onSync}
            />
          ))}

          <div className="flex gap-2 pt-1">
            {(["SHOPIFY", "GENERIC_API", "GOOGLE_SHEETS"] as IntegrationType[]).map((type) => {
              const Icon = TYPE_ICONS[type];
              const alreadyConnected = integrations.some((i) => i.type === type);
              return (
                <button
                  key={type}
                  disabled={alreadyConnected}
                  onClick={() => setAddModal(type)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    alreadyConnected
                      ? "cursor-default border-border text-muted-light"
                      : "border-border text-muted hover:border-border-strong hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>

          <p className="pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            Delivery / courier
          </p>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken">
                <Truck className="h-4 w-4 text-muted" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {delivery?.provider ?? "No courier connected"}
                </p>
                {delivery?.trackingWebhookUrl && (
                  <p className="font-mono text-[11px] text-muted">
                    {delivery.trackingWebhookUrl}
                  </p>
                )}
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
                delivery?.status === "CONNECTED"
                  ? STATUS_STYLES.CONNECTED
                  : STATUS_STYLES.DISCONNECTED
              )}
            >
              {delivery?.status === "CONNECTED" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {delivery?.status === "CONNECTED" ? "Connected" : "Not connected"}
            </span>
          </div>
        </div>
      )}

      {addModal && (
        <ConnectModal
          type={addModal}
          storeId={storeId}
          onClose={() => setAddModal(null)}
          onConnect={(config) => {
            onAdd(storeId, addModal);
          }}
        />
      )}
    </div>
  );
}

function IntegrationsContent() {
  const { canAccessStore } = useAuth();
  const { stores } = useStores();
  const [integrations, setIntegrations] = useState(MOCK_INTEGRATIONS);
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
        return { ...i, status: newStatus, lastSyncAt: newStatus === "CONNECTED" ? new Date().toISOString() : i.lastSyncAt };
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
      label: TYPE_LABELS[type],
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