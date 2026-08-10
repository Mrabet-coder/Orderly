"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { RouteGuard } from "@/components/auth/route-guard";
import { useStores } from "@/lib/stores-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Hash, Send, Plus, X, Users, MessageSquare,
  Sparkles, Package, Search,
} from "lucide-react";
import { MentionInput, MentionText } from "@/components/ui/mention-input";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isPrivate: boolean;
  memberCount: number;
  members: { id: string; name: string; email: string }[];
  lastMessage: { text: string; author: string; createdAt: string } | null;
  unread: number;
}

interface Message {
  id: string;
  text: string;
  orderRef: string | null;
  createdAt: string;
  userId: string;
  userName: string;
  isMine: boolean;
}

interface AppUserLite {
  id: string;
  name: string;
  email: string;
}

function NewChannelModal({
  users,
  onClose,
  onCreated,
}: {
  users: AppUserLite[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggleMember(id: string) {
    setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function save() {
    setLoading(true);
    try {
      await fetch(`${API}/chat/channels`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isPrivate, memberIds }),
      });
      onCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Nouveau canal</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-sunken">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Nom du canal</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Urgences" autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionnel" />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <div>
              <p className="text-xs font-medium">Canal privé</p>
              <p className="text-[11px] text-muted">Seuls les membres invités peuvent voir ce canal</p>
            </div>
          </label>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Membres</label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => toggleMember(u.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    memberIds.includes(u.id) ? "bg-primary-soft" : "hover:bg-surface-sunken"
                  )}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs">{u.name}</span>
                  {memberIds.includes(u.id) && <span className="ml-auto text-[10px] text-primary">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" disabled={loading || !name.trim()} onClick={save}>
            {loading ? "Création..." : "Créer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatContent() {
  const searchParams = useSearchParams();
  const { user, canAccessStore } = useAuth();
  const { stores } = useStores();
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<AppUserLite[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [search, setSearch] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const accessibleStores = stores.filter((s) => canAccessStore(s.id));

  useEffect(() => {
    if (stores.length > 0 && selectedStoreIds.length === 0) {
      setSelectedStoreIds(stores.map((s) => s.id));
    }
  }, [stores]);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch(`${API}/chat/channels`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setChannels(list);
      if (!active && list.length > 0) {
        const fromUrl = searchParams.get("channel");
        setActive(list.find((c: Channel) => c.id === fromUrl) ?? list[0]);
      }
    } catch {
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [active, searchParams]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/users`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data.filter((u: any) => u.id !== user?.id) : []);
    } catch {
      setUsers([]);
    }
  }, [user?.id]);

  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`${API}/chat/channels/${channelId}/messages`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (active) fetchMessages(active.id);
  }, [active, fetchMessages]);

  // Poll for new messages
  useEffect(() => {
    const i = setInterval(() => {
      if (active) fetchMessages(active.id);
      fetchChannels();
    }, 8000);
    return () => clearInterval(i);
  }, [active, fetchMessages, fetchChannels]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!text.trim() || !active) return;
    const body = text.trim();
    setText("");
    try {
      const res = await fetch(`${API}/chat/channels/${active.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      fetchChannels();
    } catch {}
  }

  async function seedChannels() {
    await fetch(`${API}/chat/channels/seed`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    fetchChannels();
  }

  async function openDm(otherId: string) {
    const res = await fetch(`${API}/chat/dm/${otherId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const ch = await res.json();
    await fetchChannels();
    setActive({ ...ch, unread: 0, memberCount: 2, members: [], lastMessage: null });
  }

  const channelList = channels.filter((c) => c.type === "CHANNEL");
  const dmList = channels.filter((c) => c.type === "DM");

  const filteredMessages = search
    ? messages.filter((m) => m.text.toLowerCase().includes(search.toLowerCase()))
    : messages;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        stores={accessibleStores}
        selectedStoreIds={selectedStoreIds}
        onChangeSelectedStores={setSelectedStoreIds}
      />

      <div className="flex min-w-0 flex-1">
        {/* Channel list */}
        <div className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h1 className="text-sm font-semibold">Chat équipe</h1>
            <button
              onClick={() => setShowNewChannel(true)}
              className="rounded-md p-1 text-muted hover:bg-surface-sunken hover:text-foreground"
              title="Nouveau canal"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {channelList.length === 0 && dmList.length === 0 && !loading && (
              <div className="p-3 text-center">
                <p className="text-xs text-muted">Aucun canal</p>
                <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={seedChannels}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Créer les canaux
                </Button>
              </div>
            )}

            {channelList.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Canaux
                </p>
                {channelList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActive(c)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                      active?.id === c.id ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-sunken"
                    )}
                  >
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.name}</span>
                    {c.unread > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-status-cancelled px-1 text-[9px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {dmList.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Messages directs
                </p>
                {dmList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActive(c)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                      active?.id === c.id ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-sunken"
                    )}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.name}</span>
                    {c.unread > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-status-cancelled px-1 text-[9px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {users.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Équipe
                </p>
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openDm(u.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted transition-colors hover:bg-surface-sunken"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[9px] font-bold">
                      {u.name[0]?.toUpperCase()}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs">{u.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {active ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
              <div className="flex items-center gap-2">
                {active.type === "CHANNEL" ? (
                  <Hash className="h-4 w-4 text-muted" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    {active.name[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">{active.name}</p>
                  {active.description && (
                    <p className="text-[11px] text-muted">{active.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-48">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-light" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                {active.type === "CHANNEL" && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Users className="h-3.5 w-3.5" />
                    {active.memberCount}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <MessageSquare className="h-8 w-8 text-muted-light" />
                  <p className="mt-2 text-sm text-muted">
                    {search ? "Aucun résultat" : "Démarrez la conversation"}
                  </p>
                </div>
              ) : (
                filteredMessages.map((m, i) => {
                  const prev = filteredMessages[i - 1];
                  const grouped = prev && prev.userId === m.userId &&
                    new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 300000;

                  return (
                    <div key={m.id} className={cn("flex gap-3", grouped && "mt-0.5")}>
                      {!grouped ? (
                        <div className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                          m.isMine ? "bg-primary" : "bg-muted"
                        )}>
                          {m.userName[0]?.toUpperCase()}
                        </div>
                      ) : (
                        <div className="w-8 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        {!grouped && (
                          <div className="flex items-baseline gap-2">
                            <p className="text-xs font-semibold">{m.userName}</p>
                            <p className="text-[10px] text-muted-light">{timeAgo(m.createdAt)}</p>
                          </div>
                        )}
                        <p className="text-sm leading-relaxed">
                          <MentionText text={m.text} />
                        </p>
                        {m.orderRef && (
                          
                            href={`/confirmation?search=${encodeURIComponent(m.orderRef)}`}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-sunken px-2 py-1 text-[11px] font-medium hover:border-primary hover:text-primary"
                          >
                            <Package className="h-3 w-3" />
                            {m.orderRef}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            <div className="border-t border-border bg-surface p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <MentionInput
                    value={text}
                    onChange={setText}
                    placeholder={`Message dans ${active.name}... (@ pour mentionner, #12345 pour partager une commande)`}
                  />
                </div>
                <Button size="sm" disabled={!text.trim()} onClick={send}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted">Sélectionnez un canal</p>
          </div>
        )}
      </div>

      {showNewChannel && (
        <NewChannelModal
          users={users}
          onClose={() => setShowNewChannel(false)}
          onCreated={fetchChannels}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <RouteGuard>
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><p className="text-sm text-muted">Chargement...</p></div>}>
        <ChatContent />
      </Suspense>
    </RouteGuard>
  );
}