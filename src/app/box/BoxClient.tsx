"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCart } from "@/components/CartProvider";
import { FishMark, tintFor } from "@/components/FishMark";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { WeightStepper } from "@/components/ui/WeightStepper";
import { formatNaira, formatPerKg, formatWeight } from "@/lib/money";
import { BOX_TIERS, normalizeWeight, priceBox, priceLine } from "@/lib/pricing";
import { products as catalogProducts, productMap } from "@/lib/seed";
import type { CartLine, Grams, Product } from "@/lib/types";

/**
 * Build Your Box.
 *
 * A box is not a different kind of order — it is a fast way to fill a basket,
 * and the discount it earns is the same volume discount any basket of that
 * weight earns (`priceBasket`). That is deliberate: a rate promised here that
 * disappeared at the basket would be a lie, and this screen would be the thing
 * that told it.
 *
 * Everything goes in at each product's baseline preparation. Preparation is
 * chosen per item afterwards, because cutting is irreversible and a customer
 * filling a box quickly is not being asked to decide it six times.
 */

const TOP_TIER_G: Grams = BOX_TIERS[0]?.minG ?? 5000;

/** The baseline, no-surcharge preparation. Not every product has "whole". */
function defaultPrepId(product: Product): string {
  return product.preps[0]?.id ?? "whole";
}

export function BoxClient() {
  const { dispatch, remainingG, ready } = useCart();
  const catalog = useMemo(() => productMap(), []);
  const toast = useToast();
  const router = useRouter();

  const [picked, setPicked] = useState<Readonly<Record<string, Grams>>>({});

  const shelf = useMemo(
    () => catalogProducts.filter((p) => p.availability !== "hidden" && p.stockG > 0),
    [],
  );

  const lines: CartLine[] = useMemo(
    () =>
      Object.entries(picked)
        .filter(([, g]) => g > 0)
        .map(([productId, weightG]) => {
          const product = catalog.get(productId) as Product;
          return {
            productId,
            prepId: defaultPrepId(product),
            weightG,
            unitPricePerKgKoboSnapshot: product.pricePerKgKobo,
          };
        }),
    [picked, catalog],
  );

  const box = useMemo(() => priceBox(lines, catalog), [lines, catalog]);
  const count = lines.length;

  /**
   * Step a product up or down. Weight is snapped and clamped by the engine,
   * against what is left after the basket's own claim on the same stock — two
   * screens cannot sell the same fish between them.
   */
  function bump(product: Product, direction: 1 | -1) {
    setPicked((prev) => {
      const current = prev[product.id] ?? 0;

      // The first plus opens at the minimum order, not at one step: a step is
      // often smaller than the minimum, and stepping to a weight the shop
      // cannot sell would drop the item straight back out again.
      const target =
        current === 0 && direction === 1
          ? product.minOrderG
          : current + direction * product.stepG;

      // Below the product's minimum the item comes out of the box. The engine
      // would clamp such a weight back up to the minimum, so a minus that held
      // still at the floor would read as a broken button.
      if (target < product.minOrderG) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }

      const headroomG = ready ? remainingG(product.id) : product.stockG;
      if (headroomG < product.minOrderG) return prev;

      const capped = Math.min(target, headroomG);
      const weightG = normalizeWeight({ ...product, stockG: headroomG }, capped);
      if (weightG <= 0) return prev;

      return { ...prev, [product.id]: weightG };
    });
  }

  function addBoxToBasket() {
    for (const line of lines) {
      dispatch({
        type: "add",
        productId: line.productId,
        prepId: line.prepId,
        weightG: line.weightG,
      });
    }

    toast.show({
      title: `Box added — ${formatWeight(box.totalWeightG)}`,
      detail:
        box.discountKobo > 0
          ? `${box.discountBps / 100}% off, ${formatNaira(box.discountKobo)} saved.`
          : "Choose preparation for each item in the basket.",
      href: "/basket",
      actionLabel: "View basket",
    });

    setPicked({});
    router.push("/basket");
  }

  const fillPct = Math.min(100, Math.round((box.totalWeightG / TOP_TIER_G) * 100));

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-7">
        <BoxStatus box={box} count={count} fillPct={fillPct} className="lg:hidden" />

        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">What you&rsquo;ve picked</h2>

          {count === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-card border border-dashed border-line bg-paper px-5 py-9 text-center">
              <span className="text-sm font-bold">The box is empty</span>
              <span className="max-w-xs text-[12px] leading-snug text-ink-muted">
                Tap a plus below to drop the first thing in.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {lines.map((line) => {
                const product = catalog.get(line.productId) as Product;
                const { tint, stroke } = tintFor(product.slug);

                return (
                  <div
                    key={line.productId}
                    className="flex flex-col gap-3 rounded-[15px] border border-line bg-paper p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                      <FishMark tint={tint} stroke={stroke} className="size-14 shrink-0 rounded-xl" label={false} />

                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-bold">{product.name}</span>
                        <span className="text-[11.5px] text-ink-muted">
                          {formatPerKg(product.pricePerKgKobo)}
                        </span>
                      </span>

                      <span className="shrink-0 text-sm font-bold sm:hidden">
                        {formatNaira(priceLine(product, line.prepId, line.weightG).totalKobo)}
                      </span>
                    </div>

                    <WeightStepper
                      product={product}
                      weightG={line.weightG}
                      onStep={bump}
                      decrementLabel={`Less ${product.name}, or take it out of the box`}
                    />

                    <span className="hidden w-20 shrink-0 text-right text-sm font-bold sm:block">
                      {formatNaira(priceLine(product, line.prepId, line.weightG).totalKobo)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">Drop something in</h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-3">
            {shelf.map((product) => {
              const { tint, stroke } = tintFor(product.slug);
              const inBox = picked[product.id] ?? 0;
              const headroomG = ready ? remainingG(product.id) : product.stockG;
              const soldOut = headroomG < product.minOrderG;

              return (
                <div
                  key={product.id}
                  className={`flex flex-col gap-2.5 rounded-[15px] border bg-paper p-3 ${
                    inBox > 0 ? "border-[1.5px] border-lagoon" : "border-line"
                  }`}
                >
                  <FishMark tint={tint} stroke={stroke} className="h-20 w-full rounded-xl" label={false} />

                  <span className="flex flex-col gap-0.5">
                    <span className="truncate text-[13px] font-bold">{product.name}</span>
                    <span className="text-[11px] text-ink-muted">{formatPerKg(product.pricePerKgKobo)}</span>
                  </span>

                  {soldOut ? (
                    <span className="flex min-h-11 items-center text-[11.5px] font-semibold text-ink-faint">
                      All of it is spoken for
                    </span>
                  ) : (
                    /*
                      Adding only. A two-button stepper cannot fit a 163px card
                      on a 375px screen without falling under 44px, so weight is
                      adjusted in the picked list above, where there is room.
                    */
                    <button
                      type="button"
                      onClick={() => bump(product, 1)}
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-control text-[12.5px] font-bold transition-colors duration-[var(--m-fast)] ${
                        inBox > 0
                          ? "bg-tint-mint text-lagoon hover:bg-[#C9E8DC]"
                          : "bg-sand hover:bg-line"
                      }`}
                    >
                      <PlusIcon />
                      {inBox > 0 ? `${formatWeight(inBox)} in box` : `Add ${formatWeight(product.minOrderG)}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11.5px] leading-snug text-ink-muted">
            You choose preparation for each item at the next step — nothing is cut until you say how.
          </p>
        </section>
      </div>

      {/* From lg the box rides alongside, in view while the shelf is browsed. */}
      <aside className="hidden lg:sticky lg:top-[112px] lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:gap-4">
        <BoxStatus box={box} count={count} fillPct={fillPct} />

        <Button size="lg" fullWidth disabled={count === 0} onClick={addBoxToBasket}>
          {count === 0 ? "Add Box to Basket" : `Add Box — ${formatNaira(box.netKobo)}`}
        </Button>

        {count > 0 && (
          <button
            type="button"
            onClick={() => setPicked({})}
            className="min-h-11 text-[12.5px] font-bold text-ink-muted"
          >
            Start over
          </button>
        )}
      </aside>

      {/* On a phone the box total is far above the shelf, so it floats. */}
      <div className="glass-light fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-x-0 border-b-0 px-4 pt-3 pb-[104px] md:pb-4 lg:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="text-[11px] text-ink-muted">
            {formatWeight(box.totalWeightG)} · {count} {count === 1 ? "item" : "items"}
          </span>
          <span className="font-display text-[19px] leading-tight font-semibold">
            {formatNaira(box.netKobo)}
          </span>
        </span>

        <span className="flex-1" />

        <Button size="lg" disabled={count === 0} onClick={addBoxToBasket}>
          Add Box to Basket
        </Button>
      </div>
    </div>
  );
}

function BoxStatus({
  box,
  count,
  fillPct,
  className = "",
}: {
  box: ReturnType<typeof priceBox>;
  count: number;
  fillPct: number;
  className?: string;
}) {
  return (
    <section className={`flex flex-col gap-3 rounded-card bg-abyss p-4 md:p-5 ${className}`}>
      <div className="flex items-baseline gap-2">
        <span className="flex-1 text-[12px] font-semibold text-[#A8C4C0]">In the box</span>
        <span className="text-[12px] text-[#A8C4C0]">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[30px] leading-none font-semibold text-white">
          {formatWeight(box.totalWeightG)}
        </span>
        <span className="flex-1" />
        <span className="flex flex-col items-end">
          {box.discountKobo > 0 && (
            <span className="text-[11.5px] text-[#A8C4C0] line-through">{formatNaira(box.grossKobo)}</span>
          )}
          <span className="font-display text-[23px] leading-tight font-semibold text-white" aria-live="polite">
            {formatNaira(box.netKobo)}
          </span>
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-1.5 rounded-full bg-[#7FD3C4] transition-[width] duration-[var(--m-standard)] ease-[var(--ease-standard)]"
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <p className="text-[11.5px] leading-snug text-[#A8C4C0]">
        <TierMessage box={box} />
      </p>
    </section>
  );
}

function TierMessage({ box }: { box: ReturnType<typeof priceBox> }) {
  if (box.gToNextTierG !== null && box.nextTierDiscountBps !== null) {
    return (
      <>
        {box.discountBps > 0 && (
          <strong className="font-bold text-[#7FD3C4]">{box.discountBps / 100}% off so far. </strong>
        )}
        Add <strong className="font-bold text-white">{formatWeight(box.gToNextTierG)}</strong> more and the
        whole box drops <strong className="font-bold text-white">{box.nextTierDiscountBps / 100}%</strong>.
      </>
    );
  }

  return (
    <>
      <strong className="font-bold text-[#7FD3C4]">{box.discountBps / 100}% off the whole box</strong> —
      that is the best rate, and you have it.
    </>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
