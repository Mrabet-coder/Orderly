"use client";

import { useState, useRef, useEffect } from "react";
import { OrderStatus, ORDER_STATUS_LABELS } from "@/types/order";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS: { status: OrderStatus; label: string; color?: string }[] = [
  { status: "CONFIRMATION_EN_COURS", label: "Confirmation en cours" },
  { status: "CONFIRME", label: "Confirmé" },
  { status: "EN_PREPARATION", label: "En préparation" },
  { status: "A_EXPEDIER", label: "À expédier" },
  { status: "AU_DEPOT_LIVREUR", label: "Au dépôt livreur" },
  { status: "EN_COURS_DE_LIVRAISON", label: "En cours de livraison" },
  { status: "LIVRE", label: "Livré" },
  { status: "PAYE", label: "Payé" },
  { status: "RETOUR", label: "Retour" },
  { status: "RETOUR_DEPOT", label: "Retour dépôt" },
  { status: "RETOUR_RECU", label: "Retour reçu" },
  { status: "A_VERIFIER", label: "À vérifier", color: "text-status-cancelled" },
  { status: "ANNULE", label: "Annulé", color: "text-status-cancelled" },
];

export function OrderActionsMenu({
  currentStatus,
  onChangeStatus,
}: {
  currentStatus: OrderStatus;
  onChangeStatus: (status: OrderStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-md p-1.5 text-muted hover:bg-surface-sunken hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-[calc(100%+4px)] z-30 w-52 rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.status}
              disabled={action.status === currentStatus}
              onClick={() => {
                onChangeStatus(action.status);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-surface-sunken",
                action.status === currentStatus
                  ? "cursor-default text-muted-light"
                  : action.color ?? "text-foreground"
              )}
            >
              {action.label}
              {action.status === currentStatus && (
                <span className="ml-auto text-[10px]">current</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}