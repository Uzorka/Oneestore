"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useCart } from "@/components/CartProvider";
import { FishMark, tintFor } from "@/components/FishMark";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { cartWeightG, isEmpty, priceCart } from "@/lib/cart";
import { ZONES, deliveryFeeKobo, findZone, toFreeDeliveryKobo } from "@/lib/delivery";
import { formatNaira, formatWeight } from "@/lib/money";
import { priceDrift, priceLine } from "@/lib/pricing";
import { productMap } from "@/lib/seed";

/**
 * The basket.
 *
 * Every figure on this screen comes from the pricing engine — nothing is
 * recomputed here. Where the market has moved under a line, the change is
 * shown and has to be accepted; it is never applied quietly.
 */
export function BasketClient() {
  const { state, dispatch, ready, remainingG } = useCart();
  const catalog = useMemo(() => productMap(), []);

  const totals = useMemo(() => priceCart(state, catalog), [state, catalog]);
  const zone = state.zoneId === null ? undefined : findZone(state.zoneId);
  const deliveryKobo = zone === undefined ? 0 : deliveryFeeKobo(zone, totals.goodsKobo);
  const toFreeKobo = toFreeDeliveryKobo(totals.goodsKobo);
  const totalKobo = totals.subtotalKobo + deliveryKobo;

  if (!ready) {
    return (
      <div className="flex flex-col gap-3">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </div>
    );
  }

  if (isEmpty(state)) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h2l2.2 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L21 9H7" />
            <circle cx="10.5" cy="20" r="1.3" />
            <circle cx="18" cy="20" r="1.3" />
          </svg>
        }
        title="Your basket is empty"
        body="Fresh seafood is waiting."
        actionLabel="Browse Seafood"
        actionHref="/shop"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[12.5px] text-ink-muted">
          {state.lines.length} {state.lines.length === 1 ? "item" : "items"} ·{" "}
          {formatWeight(cartWeightG(state))}
        </span>
        <button
          type="button"
          onClick={() => dispatch({ type: "clear" })}
          className="flex min-h-11 items-center px-1 text-[12.5px] font-bold text-ink-muted"
        >
          Empty basket
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {state.lines.map((line) => {
          const product = catalog.get(line.productId);
          if (product === undefined) return null;

          const prep = product.preps.find((p) => p.id === line.prepId);
          const priced = priceLine(product, line.prepId, line.weightG);
          const drift = priceDrift(line, product);
          const { tint, stroke } = tintFor(product.slug);
          const headroomG = remainingG(product.id, line.id);

          return (
            <div
              key={line.id}
              className="flex flex-col gap-3 rounded-[15px] border border-line bg-paper p-3"
            >
              {/*
                The whole top row is the link, so the tap target is the card
                header rather than eighteen pixels of product name.
              */}
              <Link href={`/product/${product.slug}`} className="flex gap-3">
                <FishMark tint={tint} stroke={stroke} className="size-16 shrink-0 rounded-xl" label={false} />

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 text-sm leading-tight font-bold">{product.name}</span>
                    <span className="shrink-0 text-sm font-bold">{formatNaira(priced.totalKobo)}</span>
                  </span>

                  <span className="text-[11.5px] text-ink-muted">
                    {prep?.name} · {formatNaira(priced.unitPricePerKgKobo)}/kg
                  </span>

                  {prep !== undefined && prep.yieldBps < 10000 && (
                    <span className="text-[11px] text-ink-faint">
                      ≈ {formatWeight(priced.preparedWeightG)} after preparation
                    </span>
                  )}
                </span>
              </Link>

              {drift.changed && (
                <div className="flex flex-col gap-2 rounded-xl bg-tint-amber px-3 py-2.5">
                  <span className="text-[11.5px] leading-snug text-amber">
                    This morning&rsquo;s price is{" "}
                    <strong className="font-bold">{formatNaira(drift.toKobo)}/kg</strong>, not{" "}
                    {formatNaira(drift.fromKobo)}/kg.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "acceptPrice", id: line.id })}
                      className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-abyss text-[12.5px] font-bold text-white"
                    >
                      Use today&rsquo;s price
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "remove", id: line.id })}
                      className="flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-[12.5px] font-bold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1 rounded-full border border-line p-0.5">
                  <button
                    type="button"
                    aria-label={`Less ${product.name}`}
                    onClick={() =>
                      dispatch({ type: "setWeight", id: line.id, weightG: line.weightG - product.stepG })
                    }
                    className="flex size-11 items-center justify-center rounded-full"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M5 12h14" />
                    </svg>
                  </button>

                  <span className="min-w-14 text-center text-[12.5px] font-bold" aria-live="polite">
                    {formatWeight(line.weightG)}
                  </span>

                  <button
                    type="button"
                    disabled={headroomG <= line.weightG}
                    aria-label={`More ${product.name}`}
                    onClick={() =>
                      dispatch({ type: "setWeight", id: line.id, weightG: line.weightG + product.stepG })
                    }
                    className="flex size-11 items-center justify-center rounded-full bg-lagoon text-white disabled:opacity-40"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>

                <span className="flex-1" />

                {headroomG <= line.weightG && <Badge tone="low">All of it</Badge>}

                <button
                  type="button"
                  aria-label={`Remove ${product.name}`}
                  onClick={() => dispatch({ type: "remove", id: line.id })}
                  className="flex size-11 items-center justify-center rounded-full text-ink-faint"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[13px] font-bold">Where are we delivering?</h2>
        <div className="flex flex-col gap-2">
          {ZONES.map((z) => {
            const on = z.id === state.zoneId;
            return (
              <button
                key={z.id}
                type="button"
                aria-pressed={on}
                onClick={() => dispatch({ type: "setZone", zoneId: z.id })}
                className={`flex min-h-14 items-center gap-3 rounded-[13px] px-3.5 py-3 text-left ${
                  on ? "border-[1.5px] border-lagoon bg-tint-mint" : "border border-line bg-paper"
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-bold">{z.name}</span>
                  <span className="truncate text-[11px] text-ink-muted">{z.areas.join(", ")}</span>
                </span>
                <span className="shrink-0 text-[12.5px] font-bold">
                  {totals.goodsKobo >= 0 && deliveryFeeKobo(z, totals.goodsKobo) === 0
                    ? "Free"
                    : formatNaira(z.feeKobo)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-paper p-4">
        <Row label={`Seafood (${formatWeight(totals.totalWeightG)})`} value={formatNaira(totals.goodsKobo)} />
        {totals.prepKobo > 0 && (
          <Row label="Cleaning & cutting" value={formatNaira(totals.prepKobo)} />
        )}
        <Row
          label={zone === undefined ? "Delivery" : `Delivery — ${zone.name}`}
          value={
            zone === undefined
              ? "Pick a zone"
              : deliveryKobo === 0
                ? "Free"
                : formatNaira(deliveryKobo)
          }
        />

        {toFreeKobo > 0 && (
          <div className="flex flex-col gap-1.5 rounded-xl bg-tint-mint px-3 py-2.5">
            <span className="text-[11.5px] leading-snug text-reef">
              Add <strong className="font-bold">{formatNaira(toFreeKobo)}</strong> more and delivery is
              free.
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#C9DFD5]">
              <div
                className="h-1.5 rounded-full bg-reef transition-[width] duration-[var(--m-standard)] ease-[var(--ease-standard)]"
                style={{ width: `${Math.min(100, Math.round((totals.goodsKobo / (totals.goodsKobo + toFreeKobo)) * 100))}%` }}
              />
            </div>
          </div>
        )}

        <div className="h-px bg-rule" />

        <div className="flex items-baseline gap-2">
          <span className="flex-1 text-sm font-bold">Total</span>
          <span className="font-display text-[23px] font-semibold" aria-live="polite">
            {formatNaira(totalKobo)}
          </span>
        </div>

        <span className="text-[11px] leading-snug text-ink-muted">
          Final amount follows the real packed weight — any difference goes to your wallet.
        </span>
      </section>

      <div className="glass-light fixed inset-x-0 bottom-0 z-30 flex flex-col gap-1.5 border-x-0 border-b-0 px-4 pt-3 pb-[104px]">
        <ButtonLink href="/checkout" size="lg" fullWidth>
          Checkout — {formatNaira(totalKobo)}
        </ButtonLink>
        <span className="text-center text-[10.5px] text-ink-muted">
          Verify, choose an address and a slot — payment arrives next.
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex-1 text-[13px] text-ink-soft">{label}</span>
      <span className="text-[13.5px] font-semibold">{value}</span>
    </div>
  );
}
