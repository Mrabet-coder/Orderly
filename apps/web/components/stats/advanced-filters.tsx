"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Order } from "@/types/order";
import { DEFAULT_TAGS, getTagColor } from "@/components/orders/tag-picker";

export interface AdvancedFilterState {
  tags: string[];
  deliveryCompany: string;
  product: string;
  priceMin: string;
  priceMax: string;
}

export const EMPTY_FILTERS: AdvancedFilterState = {
  tags: [],
  deliveryCompany: "all",
  product: "all",
  priceMin: "",
  priceMax: "",
};

export function applyAdvancedFilters(order: Order, f: AdvancedFilterState): boolean {
  if (f.tags.length > 0) {
    const orderTags = order.tags ?? [];
    if (!f.tags.every((t) => orderTags.includes(t))) return false;
  }
  if (f.deliveryCompany !== "all" && order.deliveryCompany !== f.deliveryCompany) return false;
  if (f.product !== "all" && !order.lineItems?.some((li) => li.title === f.product)) return false;

  const total = Number(order.total);
  if (f.priceMin && total < parseFloat(f.priceMin)) return false;
  if (f.priceMax && total > parseFloat(f.priceMax)) return false;

  return true;
}

export function countActiveFilters(f: AdvancedFilterState): number {
  return (
    f.tags.length +
    (f.deliveryCompany !== "all" ? 1 : 0) +
    (f.product !== "all" ? 1 : 0) +
    (f.priceMin ? 1 : 0) +
    (f.priceMax ? 1 : 0)
  );
}

export function AdvancedFilters({
  filters,
  onChange,
  orders,
}: {
  filters: AdvancedFilterState;
  onChange: (f: AdvancedFilterState) => void;
  orders: Order[];
}) {
  const [open, setOpen] = useState(false);

  const activeCount = countActiveFilters(filters);

  const deliveryCompanies = Array.from(
    new Set(orders.map((o) => o.deliveryCompany).filter(Boolean))
  ) as string[];

  const productNames = Array.from(
    new Set(orders.flatMap((o) => o.lineItems?.map((li) => li.title) ?? []))
  ).slice(0, 60);

  const allTags = Array.from(
    new Set([
      ...DEFAULT_TAGS.map((t) => t.label),
      ...orders.flatMap((o) => o.tags ?? []),
    ])
  );

  function toggleTag(tag: string) {
    onChange({
      ...filters,
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
          activeCount > 0
            ? "border-primary/40 bg-primary-soft text-primary"
            : "border-border text-muted hover:border-border-strong hover:text-foreground"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filtres
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[380px] rounded-xl border border-border bg-surface p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Filtres avancés</p>
              {activeCount > 0 && (
                <button
                  onClick={() => onChange(EMPTY_FILTERS)}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-status-cancelled"
                >
                  <X className="h-3 w-3" />
                  Tout effacer
                </button>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium border-2 transition-all",
                      getTagColor(t),
                      filters.tags.includes(t)
                        ? "border-current opacity-100"
                        : "border-transparent opacity-45 hover:opacity-75"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted">Société de livraison</label>
              <select
                value={filters.deliveryCompany}
                onChange={(e) => onChange({ ...filters, deliveryCompany: e.target.value })}
                className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="all">Tous les livreurs</option>
                {deliveryCompanies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted">Produit</label>
              <select
                value={filters.product}
                onChange={(e) => onChange({ ...filters, product: e.target.value })}
                className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="all">Tous les produits</option>
                {productNames.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Price range */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted">Fourchette de prix (TND)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={filters.priceMin}
                  onChange={(e) => onChange({ ...filters, priceMin: e.target.value })}
                  placeholder="Min"
                  className="h-8 text-xs"
                />
                <span className="text-muted text-xs">—</span>
                <Input
                  type="number"
                  value={filters.priceMax}
                  onChange={(e) => onChange({ ...filters, priceMax: e.target.value })}
                  placeholder="Max"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: AdvancedFilterState;
  onChange: (f: AdvancedFilterState) => void;
}) {
  const chips: { label: string; onRemove: () => void }[] = [];

  filters.tags.forEach((t) => {
    chips.push({
      label: t,
      onRemove: () => onChange({ ...filters, tags: filters.tags.filter((x) => x !== t) }),
    });
  });

  if (filters.deliveryCompany !== "all") {
    chips.push({
      label: `Livreur : ${filters.deliveryCompany}`,
      onRemove: () => onChange({ ...filters, deliveryCompany: "all" }),
    });
  }

  if (filters.product !== "all") {
    chips.push({
      label: `Produit : ${filters.product}`,
      onRemove: () => onChange({ ...filters, product: "all" }),
    });
  }

  if (filters.priceMin) {
    chips.push({
      label: `Min : ${filters.priceMin} TND`,
      onRemove: () => onChange({ ...filters, priceMin: "" }),
    });
  }

  if (filters.priceMax) {
    chips.push({
      label: `Max : ${filters.priceMax} TND`,
      onRemove: () => onChange({ ...filters, priceMax: "" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-muted"
        >
          {c.label}
          <button onClick={c.onRemove} className="hover:text-status-cancelled">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}