"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Hash, Plus, Sparkles } from "lucide-react";
import type { AppUserLite } from "./new-channel-modal";

export interface Channel {
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

export function ChannelSidebar({
  channels,
  users,
  activeId,
  loading,
  onSelect,
  onNewChannel,
  onSeed,
  onOpenDm,
}: {
  channels: Channel[];
  users: AppUserLite[];
  activeId?: string;
  loading: boolean;
  onSelect: (c: Channel) => void;
  onNewChannel: () => void;
  onSeed: () => void;
  onOpenDm: (userId: string) => void;
}) {
  const channelList = channels.filter((c) => c.type === "CHANNEL");
  const dmList = channels.filter((c) => c.type === "DM");

  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold">Chat equipe</h1>
        <button
          onClick={onNewChannel}
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
            <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={onSeed}>
              <Sparkles className="h-3.5 w-3.5" />
              Creer les canaux
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
                onClick={() => onSelect(c)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                  activeId === c.id ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-sunken"
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
                onClick={() => onSelect(c)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                  activeId === c.id ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-sunken"
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
              Equipe
            </p>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => onOpenDm(u.id)}
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
  );
}