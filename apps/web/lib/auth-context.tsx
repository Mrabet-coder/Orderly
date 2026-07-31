"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppUser } from "@/types/order";
import { apiFetch } from "@/lib/api";

const TOKEN_KEY = "orderly_token";
const USER_KEY = "orderly_user";

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  canAccessStore: (storeId: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = window.localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
    setIsLoading(false);
  }, []);

  async function login(email: string, password: string) {
    try {
      const data = await apiFetch<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const appUser: AppUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        password: "",
        role: data.user.role,
        storeIds: data.user.storeIds ?? [],
        permissions: data.user.permissions ?? [],
        avatarInitials: data.user.name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase(),
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      window.localStorage.setItem(TOKEN_KEY, data.token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(appUser));
      setUser(appUser);
      window.dispatchEvent(new Event('orderly:login'));
      return { ok: true };
    } catch (err: any) {
      let message = "Login failed.";
      try {
        const parsed = JSON.parse(err.message);
        message = parsed.message ?? message;
      } catch {}
      return { ok: false, error: message };
    }
  }

  function logout() {
    setUser(null);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    router.push("/login");
  }

  function canAccessStore(storeId: string) {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    return user.storeIds.includes(storeId);
  }

  function hasPermission(permission: string): boolean {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    return (user.permissions ?? []).includes(permission);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, canAccessStore, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}