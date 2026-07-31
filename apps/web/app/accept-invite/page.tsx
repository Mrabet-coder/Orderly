"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleAccept() {
    if (!password || password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Erreur");
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e: any) {
      setError(e.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <X className="mx-auto h-12 w-12 text-status-cancelled" />
        <p className="mt-4 text-sm font-medium">Lien d'invitation invalide</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <Check className="mx-auto h-12 w-12 text-status-delivered" />
        <p className="mt-4 text-sm font-medium text-status-delivered">Compte créé avec succès!</p>
        <p className="mt-1 text-xs text-muted">Redirection vers la connexion...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white">
          O
        </div>
        <h1 className="mt-4 text-xl font-bold">Créer votre compte</h1>
        <p className="mt-1 text-sm text-muted">Vous avez été invité à rejoindre Orderly</p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Votre nom</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom complet" autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Mot de passe</label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Confirmer le mot de passe</label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" type="password" />
        </div>

        {error && (
          <p className="rounded-md bg-status-cancelled-bg px-3 py-2 text-xs font-medium text-status-cancelled">
            {error}
          </p>
        )}

        <Button className="w-full" disabled={loading || !password || !confirm} onClick={handleAccept}>
          {loading ? "Création..." : "Créer mon compte"}
        </Button>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={<p className="text-sm text-muted">Chargement...</p>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}