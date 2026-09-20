"use client";

import { useState } from "react";

import { Artwork } from "@/components/Artwork";
import { useCatalog } from "@/components/CatalogProvider";
import { Button } from "@/components/ui/Button";
import { formatNaira, formatWeight, naira } from "@/lib/money";
import { changeCount, pendingChanges } from "@/lib/catalog";
import { artKindFor, productPhoto } from "@/lib/seed";
import type { Product } from "@/lib/types";

import { Stat } from "../AdminShell";

/**
 * The morning board.
 *
 * Edits stage into a draft and go live in one deliberate act, because a
 * morning's pricing is a single piece of judgement: you do not want half of it
 * on the storefront while someone is still deciding about the prawns.
 *
 * Prices are typed in naira and stock in kilograms, because that is what the
 * shop says out loud. They are converted at the edge and held as integer kobo
 * and grams everywhere behind it.
 */
export function PricingClient() {
  const { draft, state, ready, edit, publishDraft, discard } = useCatalog();

  const pending = pendingChanges(state);
  const count = changeCount(state);

  const live = draft.filter((p) => p.availability !== "hidden");
  const totalStockG = live.reduce((sum, p) => sum + p.stockG, 0);
  const lowStock = live.filter((p) => p.stockG > 0 && p.stockG <= 6000);
  const soldOut = draft.filter((p) => p.availability !== "hidden" && p.stockG <= 0);

  if (!ready) {
    return <p className="text-[13px] text-ink-muted">Reading the board…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="On the board" value={String(live.length)} note="kinds listed today" />
        <Stat label="Stock" value={formatWeight(totalStockG)} note="across everything live" />
        <Stat
          label="Running low"
          value={String(lowStock.length)}
          note={lowStock.length === 0 ? "nothing under 6 kg" : lowStock.map((p) => p.name).join(", ")}
          tone={lowStock.length > 0 ? "warn" : "default"}
        />
        <Stat
          label="Sold out"
          value={String(soldOut.length)}
          note={soldOut.length === 0 ? "none" : soldOut.map((p) => p.name).join(", ")}
          tone={soldOut.length > 0 ? "warn" : "default"}
        />
      </div>

      {count > 0 && (
        <section className="animate-rise flex flex-col gap-3 rounded-card border-[1.5px] border-lagoon bg-tint-teal p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[14px] font-bold text-lagoon">
              {count} {count === 1 ? "product" : "products"} changed, not yet live
            </h2>
            <span className="text-[11.5px] text-lagoon">
              Customers still see the published board.
            </span>
          </div>

          <ul className="flex flex-col gap-1.5">
            {pending.map((c) => (
              <li key={`${c.productId}:${c.field}`} className="text-[12px] text-lagoon">
                <strong className="font-bold">{c.productName}</strong>{" "}
                {c.field === "pricePerKgKobo"
                  ? `${formatNaira(c.from as number)} → ${formatNaira(c.to as number)} per kg`
                  : c.field === "stockG"
                    ? `${formatWeight(c.from as number)} → ${formatWeight(c.to as number)} in stock`
                    : `${String(c.from)} → ${String(c.to)}`}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 pt-0.5 sm:flex-row">
            <Button onClick={publishDraft} className="sm:w-auto">
              Publish to storefront
            </Button>
            <Button variant="secondary" onClick={discard} className="sm:w-auto">
              Discard changes
            </Button>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2.5">
        {draft.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            changed={state.draft[product.id] !== undefined}
            onEdit={edit}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One product.
 *
 * A card, not a table row: this is read on a phone at the jetty, and a table
 * at 375px is either a horizontal scroll or six pixels of type.
 */
function ProductRow({
  product,
  changed,
  onEdit,
}: {
  product: Product;
  changed: boolean;
  onEdit: (productId: string, edit: { pricePerKgKobo?: number; stockG?: number; availability?: Product["availability"] }) => void;
}) {
  const hidden = product.availability === "hidden";

  return (
    <div
      className={`flex flex-col gap-3 rounded-card border bg-paper p-3.5 sm:flex-row sm:items-center sm:gap-4 ${
        changed ? "border-[1.5px] border-lagoon" : "border-line"
      } ${hidden ? "opacity-60" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3 sm:w-52 sm:shrink-0">
        <Artwork
          kind={artKindFor(product)}
          src={productPhoto(product)}
          alt={product.name}
          seed={product.slug}
          className="size-12 shrink-0 rounded-xl"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13.5px] font-bold">{product.name}</span>
          <span className="truncate text-[11px] text-ink-muted">{product.localNames.join(", ")}</span>
        </span>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-[470px]">
        <NumberField
          label="Price per kg"
          prefix="₦"
          value={product.pricePerKgKobo / 100}
          step={50}
          onCommit={(v) => onEdit(product.id, { pricePerKgKobo: naira(Math.max(1, Math.round(v))) })}
        />
        <NumberField
          label="Stock"
          suffix="kg"
          value={product.stockG / 1000}
          step={0.5}
          decimals={1}
          onCommit={(v) => onEdit(product.id, { stockG: Math.max(0, Math.round(v * 1000)) })}
        />
      </div>

      <div className="flex shrink-0 gap-2 sm:w-32 sm:flex-col">
        <button
          type="button"
          aria-pressed={!hidden}
          onClick={() => onEdit(product.id, { availability: hidden ? "today" : "hidden" })}
          className={`flex min-h-11 flex-1 items-center justify-center rounded-control px-3 text-[12px] font-bold transition-colors duration-[var(--m-fast)] ${
            hidden ? "border border-line bg-paper text-ink-muted" : "bg-tint-mint text-reef"
          }`}
        >
          {hidden ? "Hidden" : "On the board"}
        </button>
      </div>
    </div>
  );
}

/**
 * A number field with real buttons either side.
 *
 * Steppers rather than a bare input because this is used one-handed on a
 * phone: raising every price by ₦50 is a tap, not a keyboard summoning.
 * Typing still works for a jump.
 */
function NumberField({
  label,
  value,
  step,
  decimals = 0,
  prefix,
  suffix,
  onCommit,
}: {
  label: string;
  value: number;
  step: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value.toFixed(decimals);

  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    setText(null);
    if (Number.isFinite(parsed)) onCommit(parsed);
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">
        {label}
      </span>

      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`${label} down`}
          onClick={() => onCommit(Math.max(0, value - step))}
          className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-sand transition-colors hover:bg-line"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <path d="M5 12h14" />
          </svg>
        </button>

        <span className="flex h-11 min-w-0 flex-1 items-center gap-0.5 rounded-control border border-line bg-white px-2">
          {prefix !== undefined && <span className="shrink-0 text-[12px] text-ink-muted">{prefix}</span>}
          <input
            type="text"
            inputMode="decimal"
            value={shown}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="w-full min-w-0 bg-transparent text-[14px] font-bold tabular-nums outline-none"
          />
          {suffix !== undefined && <span className="shrink-0 text-[12px] text-ink-muted">{suffix}</span>}
        </span>

        <button
          type="button"
          aria-label={`${label} up`}
          onClick={() => onCommit(value + step)}
          className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-sand transition-colors hover:bg-line"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </span>
    </label>
  );
}
