"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AtSign } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken() {
  return window.localStorage.getItem("orderly_token");
}

interface MentionUser {
  id: string;
  name: string;
  email: string;
}

export function MentionInput({
  value,
  onChange,
  placeholder,
  className,
  multiline,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [showList, setShowList] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/users`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  const filtered = users
    .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);

  function handleChange(newValue: string, cursorPos: number) {
    onChange(newValue);

    // Find if we're typing a mention
    const beforeCursor = newValue.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf("@");

    if (atIdx === -1) {
      setShowList(false);
      return;
    }

    const afterAt = beforeCursor.slice(atIdx + 1);
    // Stop if there's a space+space or newline after @
    if (afterAt.includes("\n") || afterAt.split(" ").length > 2) {
      setShowList(false);
      return;
    }

    setQuery(afterAt);
    setMentionStart(atIdx);
    setActiveIdx(0);
    setShowList(true);
  }

  function selectUser(user: MentionUser) {
    if (mentionStart === -1) return;
    const before = value.slice(0, mentionStart);
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const after = value.slice(cursorPos);
    const newValue = `${before}@${user.name} ${after}`;
    onChange(newValue);
    setShowList(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showList || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectUser(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      setShowList(false);
    }
  }

  const baseClass = cn(
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    className
  );

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          ref={inputRef}
          value={value}
          rows={rows}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? 0)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(baseClass, "resize-none")}
        />
      ) : (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? 0)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(baseClass, "h-9")}
        />
      )}

      {showList && filtered.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowList(false)} />
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-64 rounded-lg border border-border bg-surface py-1 shadow-xl">
            <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted">
              Mentionner
            </p>
            {filtered.map((u, i) => (
              <button
                key={u.id}
                onMouseDown={(e) => { e.preventDefault(); selectUser(u); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                  i === activeIdx ? "bg-primary-soft text-primary" : "hover:bg-surface-sunken"
                )}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                  {u.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.name}</p>
                  <p className="truncate text-[10px] text-muted">{u.email}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {value.includes("@") && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted">
          <AtSign className="h-2.5 w-2.5" />
          Tapez @ pour mentionner un collègue
        </p>
      )}
    </div>
  );
}

// Helper to send mentions to backend after saving
export async function processMentions(
  text: string,
  context: { link?: string; orderId?: string; orderNumber?: string }
) {
  if (!text?.includes("@")) return;
  try {
    await fetch(`${API}/notifications/process-mentions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, ...context }),
    });
  } catch (e) {
    console.error(e);
  }
}

// Render text with highlighted mentions
export function MentionText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(@[A-Za-zÀ-ÿ0-9._-]+(?:\s[A-Za-zÀ-ÿ]+)?)/g);
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith("@") ? (
          <span key={i} className="rounded bg-primary-soft px-1 font-medium text-primary">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}