"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { RouteGuard } from "@/components/auth/route-guard";
import { useStores } from "@/lib/stores-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Search, Send, ShoppingBag, X, Check,
  Sparkles, Edit2, Package, Phone, MapPin, User,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
}

function PlatformBadge({ platform }: { platform: string }) {
  const config: Record<string, { label: string; bg: string }> = {
    whatsapp: { label: "W", bg: "bg-green-500" },
    messenger: { label: "M", bg: "bg-blue-500" },
    instagram: { label: "I", bg: "bg-gradient-to-br from-purple-500 to-pink-500" },
  };
  const c = config[platform] ?? { label: "?", bg: "bg-gray-400" };
  return (
    <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shrink-0 text-white", c.bg)}>
      {c.label}
    </span>
  );
}

interface Message {
  id: string;
  from: "customer" | "agent";
  text: string;
  time: string;
}

interface DetectedOrder {
  customerName?: string;
  customerPhone?: string;
  city?: string;
  address?: string;
  products?: { title: string; quantity: number; price?: number }[];
  confidence: number;
  orderId?: string;
  orderNumber?: string;
  status: "detected" | "created" | "error";
}

interface Conversation {
  id: string;
  platform: "whatsapp" | "messenger" | "instagram";
  customerName: string;
  customerPhone?: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  messages: Message[];
  detectedOrder?: DetectedOrder;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    platform: "whatsapp",
    customerName: "Sana Ben Ali",
    customerPhone: "+216 55 123 456",
    lastMessage: "Bonjour je veux commander le masque collagène",
    lastTime: "10:23",
    unread: 2,
    messages: [
      { id: "m1", from: "customer", text: "Bonjour", time: "10:20" },
      { id: "m2", from: "customer", text: "Je veux commander 2 masques collagène svp", time: "10:21" },
      { id: "m3", from: "agent", text: "Bonjour! Bien sûr, quel est votre adresse de livraison?", time: "10:22" },
      { id: "m4", from: "customer", text: "Sana Ben Ali, La Marsa rue de la plage 12, tel: 55123456", time: "10:23" },
    ],
  },
  {
    id: "2",
    platform: "messenger",
    customerName: "Ahmed Mrabt",
    lastMessage: "C'est quoi le prix du sérum?",
    lastTime: "09:45",
    unread: 1,
    messages: [
      { id: "m1", from: "customer", text: "Bonjour, c'est quoi le prix du sérum teinté cerise?", time: "09:45" },
      { id: "m2", from: "agent", text: "40 TND la pièce!", time: "09:46" },
      { id: "m3", from: "customer", text: "Ok je prends 1. Ahmed Mrabt, Tunis centre, 98765432", time: "09:47" },
    ],
  },
  {
    id: "3",
    platform: "instagram",
    customerName: "Mariem Haddad",
    lastMessage: "Super! Je vais commander alors",
    lastTime: "09:12",
    unread: 0,
    messages: [
      { id: "m1", from: "customer", text: "Salam, est-ce que vous livrez à Sfax?", time: "09:10" },
      { id: "m2", from: "agent", text: "Oui bien sûr! On livre partout en Tunisie 🇹🇳", time: "09:11" },
      { id: "m3", from: "customer", text: "Super! Je vais commander alors", time: "09:12" },
    ],
  },
];

function EditOrderModal({
  order,
  storeId,
  onClose,
  onSaved,
}: {
  order: DetectedOrder;
  storeId: string;
  onClose: () => void;
  onSaved: (updated: DetectedOrder) => void;
}) {
  const [name, setName] = useState(order.customerName ?? "");
  const [phone, setPhone] = useState(order.customerPhone ?? "");
  const [city, setCity] = useState(order.city ?? "");
  const [address, setAddress] = useState(order.address ?? "");
  const [products, setProducts] = useState(order.products ?? []);
  const [loading, setLoading] = useState(false);

  function updateProduct(idx: number, field: string, value: any) {
    setProducts((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  async function save() {
    setLoading(true);
    try {
      if (order.orderId) {
        await fetch(`${API}/orders/${order.orderId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerName: name,
            customerPhone: phone,
            shippingAddress: { city, address1: address },
            lineItems: products.map((p) => ({
              title: p.title,
              quantity: p.quantity,
              price: p.price ?? 0,
              sku: null,
            })),
          }),
        });
      }
      onSaved({ ...order, customerName: name, customerPhone: phone, city, address, products });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Modifier la commande {order.orderNumber}</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-sunken">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Nom</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Téléphone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Ville</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Adresse</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Produits</label>
            <div className="space-y-2">
              {products.map((p, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 rounded-lg border border-border p-2">
                  <Input
                    value={p.title}
                    onChange={(e) => updateProduct(idx, "title", e.target.value)}
                    placeholder="Produit"
                    className="col-span-1 h-7 text-xs"
                  />
                  <Input
                    type="number"
                    value={p.quantity}
                    onChange={(e) => updateProduct(idx, "quantity", parseInt(e.target.value) || 1)}
                    placeholder="Qté"
                    className="h-7 text-xs"
                  />
                  <Input
                    type="number"
                    value={p.price ?? ""}
                    onChange={(e) => updateProduct(idx, "price", parseFloat(e.target.value) || 0)}
                    placeholder="Prix"
                    className="h-7 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" disabled={loading} onClick={save}>
            {loading ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderDetectedCard({
  order,
  storeId,
  onEdit,
}: {
  order: DetectedOrder;
  storeId: string;
  onEdit: () => void;
}) {
  return (
    <div className={cn(
      "mx-4 mb-3 rounded-xl border-2 p-4",
      order.status === "created" ? "border-status-delivered bg-status-delivered-bg/30" :
      order.status === "error" ? "border-status-cancelled bg-status-cancelled-bg/30" :
      "border-primary bg-primary-soft/30"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {order.status === "created" ? (
            <CheckCircle className="h-4 w-4 text-status-delivered" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
          <p className="text-xs font-semibold">
            {order.status === "created"
              ? `Commande créée — ${order.orderNumber}`
              : "Commande détectée"}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-sunken hover:text-foreground"
        >
          <Edit2 className="h-3 w-3" />
          Modifier
        </button>
      </div>

      <div className="space-y-1.5 text-xs">
        {order.customerName && (
          <div className="flex items-center gap-2 text-muted">
            <User className="h-3 w-3 shrink-0" />
            <span className="font-medium text-foreground">{order.customerName}</span>
          </div>
        )}
        {order.customerPhone && (
          <div className="flex items-center gap-2 text-muted">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="font-mono">{order.customerPhone}</span>
          </div>
        )}
        {(order.city || order.address) && (
          <div className="flex items-center gap-2 text-muted">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{[order.address, order.city].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {order.products && order.products.length > 0 && (
          <div className="flex items-start gap-2 text-muted">
            <Package className="h-3 w-3 shrink-0 mt-0.5" />
            <div>
              {order.products.map((p, i) => (
                <p key={i} className="font-medium text-foreground">
                  {p.title} × {p.quantity}
                  {p.price ? ` — ${p.price} TND` : ""}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Missing CheckCircle import fix
function CheckCircle({ className }: { className?: string }) {
  return <Check className={className} />;
}

function InboxContent() {
  const { canAccessStore } = useAuth();
  const { stores } = useStores();
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeConv, setActiveConv] = useState<Conversation | null>(MOCK_CONVERSATIONS[0]);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<"all" | "whatsapp" | "messenger" | "instagram">("all");
  const [reply, setReply] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [editOrder, setEditOrder] = useState<{ order: DetectedOrder; convId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const accessibleStores = stores.filter((s) => canAccessStore(s.id));
  const activeStore = accessibleStores[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages]);

  const filtered = conversations.filter((c) => {
    if (platform !== "all" && c.platform !== platform) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.customerName.toLowerCase().includes(q) && !c.lastMessage.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function sendReply() {
    if (!reply.trim() || !activeConv) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      from: "agent",
      text: reply.trim(),
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };
    updateConversation(activeConv.id, {
      messages: [...activeConv.messages, newMsg],
      lastMessage: reply.trim(),
      lastTime: newMsg.time,
    });
    setReply("");
  }

  function updateConversation(id: string, updates: Partial<Conversation>) {
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, ...updates } : c)
    );
    if (activeConv?.id === id) {
      setActiveConv((prev) => prev ? { ...prev, ...updates } : null);
    }
  }

  async function analyzeConversation() {
    if (!activeConv || analyzing) return;
    setAnalyzing(true);
  
    try {
      const conversationText = activeConv.messages
        .map((m) => `${m.from === "customer" ? "Client" : "Agent"}: ${m.text}`)
        .join("\n");
  
      const response = await fetch(`${API}/orders/detect-from-message`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: conversationText }),
      });
  
      const parsed = await response.json();
  
      if (parsed.confidence > 0.3) {
        const detected: DetectedOrder = { ...parsed, status: "detected" };
  
        if (parsed.customerName && parsed.customerPhone && parsed.products?.length > 0 && activeStore) {
          const total = parsed.products.reduce((s: number, p: any) => s + (p.price ?? 0) * p.quantity, 0);
  
          const orderRes = await fetch(`${API}/orders/manual`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${getToken()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              storeId: activeStore.id,
              customerName: parsed.customerName,
              customerPhone: parsed.customerPhone,
              shippingAddress: { city: parsed.city, address1: parsed.address },
              currency: "TND",
              subtotal: total,
              total,
              source: activeConv.platform,
              lineItems: parsed.products.map((p: any) => ({
                title: p.title,
                quantity: p.quantity,
                price: p.price ?? 0,
                sku: null,
              })),
            }),
          });
  
          if (orderRes.ok) {
            const orderData = await orderRes.json();
            detected.status = "created";
            detected.orderId = orderData.id;
            detected.orderNumber = orderData.orderNumber;
          }
        }
  
        updateConversation(activeConv.id, { detectedOrder: detected });
      } else {
        alert("Pas assez d'informations détectées. Ajoutez nom, téléphone et produit dans la conversation.");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la détection.");
    } finally {
      setAnalyzing(false);
    }
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  const PLATFORMS = [
    { key: "all", label: "Tous" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "messenger", label: "Messenger" },
    { key: "instagram", label: "Instagram" },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        stores={accessibleStores}
        selectedStoreIds={selectedStoreIds}
        onChangeSelectedStores={setSelectedStoreIds}
      />

      <div className="flex min-w-0 flex-1">
        {/* Conversation list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-sm font-semibold">Messagerie</h1>
              {totalUnread > 0 && (
                <span className="rounded-full bg-status-cancelled px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-light" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex border-b border-border">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPlatform(p.key as any)}
                className={cn(
                  "flex-1 py-2 text-[11px] font-medium transition-colors",
                  platform === p.key ? "border-b-2 border-primary text-primary" : "text-muted hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-sunken",
                  activeConv?.id === conv.id && "bg-primary-soft/30"
                )}
              >
                <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-sm font-semibold">
                  {conv.customerName[0]}
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <PlatformBadge platform={conv.platform} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold truncate">{conv.customerName}</p>
                    <p className="text-[10px] text-muted shrink-0 ml-1">{conv.lastTime}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted truncate">{conv.lastMessage}</p>
                  {conv.detectedOrder && (
                    <span className={cn(
                      "mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      conv.detectedOrder.status === "created"
                        ? "bg-status-delivered-bg text-status-delivered"
                        : "bg-primary-soft text-primary"
                    )}>
                      <ShoppingBag className="h-2.5 w-2.5" />
                      {conv.detectedOrder.status === "created" ? conv.detectedOrder.orderNumber : "Commande détectée"}
                    </span>
                  )}
                </div>
                {conv.unread > 0 && (
                  <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        {activeConv ? (
          <div className="flex flex-1 flex-col">
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-sm font-semibold">
                  {activeConv.customerName[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{activeConv.customerName}</p>
                    <PlatformBadge platform={activeConv.platform} />
                  </div>
                  {activeConv.customerPhone && (
                    <p className="text-xs text-muted font-mono">{activeConv.customerPhone}</p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={analyzing ? "secondary" : "default"}
                onClick={analyzeConversation}
                disabled={analyzing}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {analyzing ? "Analyse..." : "Détecter commande"}
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {activeConv.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex", msg.from === "agent" ? "justify-end" : "justify-start")}
                >
                  <div className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2.5",
                    msg.from === "agent"
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-surface border border-border rounded-tl-sm"
                  )}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={cn(
                      "mt-1 text-[10px] text-right",
                      msg.from === "agent" ? "text-white/70" : "text-muted"
                    )}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Order detected card */}
            {activeConv.detectedOrder && (
              <OrderDetectedCard
                order={activeConv.detectedOrder}
                storeId={activeStore?.id ?? ""}
                onEdit={() => setEditOrder({ order: activeConv.detectedOrder!, convId: activeConv.id })}
              />
            )}

            {/* Reply box */}
            <div className="border-t border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
                  placeholder="Écrire un message..."
                  className="flex-1"
                />
                <Button size="sm" disabled={!reply.trim()} onClick={sendReply}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                Répondre via <span className="font-medium capitalize">{activeConv.platform}</span> · Entrée pour envoyer
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted">Sélectionnez une conversation</p>
          </div>
        )}
      </div>

      {editOrder && (
        <EditOrderModal
          order={editOrder.order}
          storeId={activeStore?.id ?? ""}
          onClose={() => setEditOrder(null)}
          onSaved={(updated) => {
            updateConversation(editOrder.convId, { detectedOrder: updated });
            setEditOrder(null);
          }}
        />
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <RouteGuard>
      <InboxContent />
    </RouteGuard>
  );
}