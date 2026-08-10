"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { RouteGuard } from "@/components/auth/route-guard";
import { useStores } from "@/lib/stores-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hash, Send, Users, Search } from "lucide-react";
import { MentionInput } from "@/components/ui/mention-input";
import { NewChannelModal, type AppUserLite } from "@/components/chat/new-channel-modal";
import { ChannelSidebar, type Channel } from "@/components/chat/channel-sidebar";
import { MessageList, type Message } from "@/components/chat/message-list";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewChannel, setShowNewChannel] = useState(false);

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
      const list: Channel[] = Array.isArray(data) ? data : [];
      setChannels(list);
      setActive((prev) => {
        if (prev) return list.find((c) => c.id === prev.id) ?? prev;
        if (list.length === 0) return null;
        const fromUrl = searchParams.get("channel");
        return list.find((c) => c.id === fromUrl) ?? list[0];
      });
    } catch {
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

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
  }, [fetchChannels, fetchUsers]);

  useEffect(() => {
    if (active) fetchMessages(active.id);
  }, [active?.id, fetchMessages]);

  useEffect(() => {
    const i = setInterval(() => {
      if (active) fetchMessages(active.id);
      fetchChannels();
    }, 8000);
    return () => clearInterval(i);
  }, [active?.id, fetchMessages, fetchChannels]);

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
    setActive({
      id: ch.id,
      name: ch.name,
      description: ch.description ?? null,
      type: "DM",
      isPrivate: true,
      memberCount: 2,
      members: [],
      lastMessage: null,
      unread: 0,
    });
  }

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
        <ChannelSidebar
          channels={channels}
          users={users}
          activeId={active?.id}
          loading={loading}
          onSelect={setActive}
          onNewChannel={() => setShowNewChannel(true)}
          onSeed={seedChannels}
          onOpenDm={openDm}
        />

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

            <MessageList
              messages={filteredMessages}
              emptyLabel={search ? "Aucun resultat" : "Demarrez la conversation"}
            />

            <div className="border-t border-border bg-surface p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <MentionInput
                    value={text}
                    onChange={setText}
                    placeholder="Ecrire un message... (@ pour mentionner, #12345 pour partager une commande)"
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
            <p className="text-sm text-muted">Selectionnez un canal</p>
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
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <p className="text-sm text-muted">Chargement...</p>
          </div>
        }
      >
        <ChatContent />
      </Suspense>
    </RouteGuard>
  );
}