"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
}

export interface AppUserLite {
  id: string;
  name: string;
  email: string;
}

export function NewChannelModal({
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
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
              <p className="text-xs font-medium">Canal prive</p>
              <p className="text-[11px] text-muted">Seuls les membres invites peuvent voir ce canal</p>
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
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" disabled={loading || !name.trim()} onClick={save}>
            {loading ? "Creation..." : "Creer"}
          </Button>
        </div>
      </div>
    </div>
  );
}