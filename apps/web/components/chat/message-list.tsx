"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { MessageSquare, Package } from "lucide-react";
import { MentionText } from "@/components/ui/mention-input";

export interface Message {
  id: string;
  text: string;
  orderRef: string | null;
  createdAt: string;
  userId: string;
  userName: string;
  isMine: boolean;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageList({
  messages,
  emptyLabel,
}: {
  messages: Message[];
  emptyLabel: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <MessageSquare className="h-8 w-8 text-muted-light" />
        <p className="mt-2 text-sm text-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-3">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const grouped =
          prev &&
          prev.userId === m.userId &&
          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 300000;

        return (
          <div key={m.id} className={cn("flex gap-3", grouped && "mt-0.5")}>
            {!grouped ? (
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                  m.isMine ? "bg-primary" : "bg-muted"
                )}
              >
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
              {m.orderRef ? (
                
                href={"/confirmation?search=" + encodeURIComponent(m.orderRef)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-sunken px-2 py-1 text-[11px] font-medium hover:border-primary hover:text-primary"
              >
                <Package className="h-3 w-3" />
                {m.orderRef}
              </a>
            ) : null}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}