"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCart } from "@/components/CartProvider";
import { FishMark, tintFor } from "@/components/FishMark";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { WeightStepper } from "@/components/ui/WeightStepper";
import { formatNaira, formatPerKg, formatWeight } from "@/lib/money";
import { mealLines, priceBasket, priceLine } from "@/lib/pricing";
import { productMap } from "@/lib/seed";
import type { Grams, Meal, Product } from "@/lib/types";

/**
 * The meal builder.
 *
 * The recipe is a starting point, not a decision. Serving count rescales it,
 * every quantity can be nudged, and anything optional can be switched off —
 * so what reaches the basket is the customer's, not ours.
 *
 * Adjustments are held separately from the serving count on purpose: changing
 * "how many people" rescales the recipe without silently discarding an edit
 * someone made two taps ago.
 */

const SERVE_OPTIONS = [2, 4, 6, 8] as const;

export function MealClient({ meal }: { meal: Meal }) {
  const { dispatch } = useCart();
  const catalog = useMemo(() => productMap(), []);
  const toast = useToast();
  const router = useRouter();

  const [serves, setServes] = useState<number>(meal.defaultServes);
  const [adjustmentsG, setAdjustmentsG] = useState<Readonly<Record<string, Grams>>>({});
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());

  const lines = useMemo(
    () => mealLines({ meal, serves, productsById: catalog, excluded, adjustmentsG }),
    [meal, serves, catalog, excluded, adjustmentsG],
  );

  const totals = useMemo(() => priceBasket(lines, catalog), [lines, catalog]);

  /**
   * Nudge one ingredient by its own step.
   *
   * Stepping below the product's minimum order takes the ingredient out
   * rather than doing nothing: the engine would clamp such a weight back up,
   * so a minus that silently held still at the floor would look broken.
   */
  function adjust(product: Product, direction: 1 | -1) {
    const current = lines.find((l) => l.productId === product.id)?.weightG ?? 0;

    if (direction === -1 && current - product.stepG < product.minOrderG) {
      setExcluded((prev) => new Set(prev).add(product.id));
      return;
    }

    setAdjustmentsG((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] ?? 0) + direction * product.stepG,
    }));
  }

  function toggle(productId: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function buildMeal() {
    for (const line of lines) {
      dispatch({
        type: "add",
        productId: line.productId,
        prepId: line.prepId,
        weightG: line.weightG,
      });
    }

    toast.show({
      title: `${meal.name} added`,
      detail: `${lines.length} items · ${formatWeight(totals.totalWeightG)}. Choose preparation in the basket.`,
      href: "/basket",
      actionLabel: "View basket",
    });

    router.push("/basket");
  }

  const servesLabel = `Serves ${serves}`;

  return (
    <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-7">
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">How many people?</h2>

          <div role="group" aria-label="Number of servings" className="flex flex-wrap gap-2">
            {SERVE_OPTIONS.map((n) => {
              const on = n === serves;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setServes(n)}
                  className={`flex min-h-11 min-w-[72px] items-center justify-center rounded-control px-4 text-[13px] font-bold transition-colors duration-[var(--m-fast)] ${
                    on
                      ? "border-[1.5px] border-lagoon bg-tint-mint text-lagoon"
                      : "border border-line bg-paper text-ink-soft hover:bg-sand"
                  }`}
                >
                  {n} people
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-end gap-3">
            <h2 className="flex-1 text-[15px] font-bold">What goes in</h2>
            <span className="text-[11.5px] text-ink-muted">Change anything</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {meal.ingredients.map((ingredient) => {
              const product = catalog.get(ingredient.productId);
              if (product === undefined) return null;

              const off = excluded.has(product.id);
              const line = lines.find((l) => l.productId === product.id);
              const { tint, stroke } = tintFor(product.slug);

              const lineTotal =
                  off || line === undefined
                    ? "—"
                    : formatNaira(priceLine(product, line.prepId, line.weightG).totalKobo);

                return (
                  /*
                    Two rows on a phone, one from `sm`. The stepper needs about
                    150px it cannot have beside a name at 375px, and stacking it
                    at desktop width would leave a row mostly empty.
                  */
                  <div
                    key={product.id}
                    className={`flex flex-col gap-3 rounded-[15px] border border-line bg-paper p-3 sm:flex-row sm:items-center sm:gap-4 ${
                      off ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                      <FishMark tint={tint} stroke={stroke} className="size-14 shrink-0 rounded-xl" label={false} />

                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold">{product.name}</span>
                          {ingredient.optional && (
                            <span className="shrink-0 rounded-full bg-sand px-1.5 py-0.5 text-[9.5px] font-bold text-ink-muted">
                              optional
                            </span>
                          )}
                        </span>
                        <span className="text-[11.5px] text-ink-muted">
                          {formatPerKg(product.pricePerKgKobo)}
                        </span>
                      </span>

                      <span className="shrink-0 text-sm font-bold sm:hidden">{lineTotal}</span>
                    </div>

                    <div className="flex items-center gap-2 sm:shrink-0">
                      {off ? (
                        <span className="flex min-h-11 items-center text-[12px] text-ink-muted">
                          Left out
                        </span>
                      ) : (
                        <WeightStepper
                          product={product}
                          weightG={line?.weightG ?? 0}
                          onStep={adjust}
                          decrementLabel={`Less ${product.name}, or take it out`}
                        />
                      )}

                      <span className="flex-1 sm:hidden" />

                      {/*
                        A fixed slot from `sm` whether or not this row has a
                        toggle, so the steppers line up down the column instead
                        of stepping left on the optional rows.
                      */}
                      <span className="flex items-center sm:w-[86px] sm:justify-end">
                        {(ingredient.optional || off) && (
                          <button
                            type="button"
                            onClick={() => toggle(product.id)}
                            className="flex min-h-11 items-center px-1 text-[12px] font-bold whitespace-nowrap text-lagoon"
                          >
                            {off ? "Put it back" : "Leave it out"}
                          </button>
                        )}
                      </span>
                    </div>

                    <span className="hidden w-20 shrink-0 text-right text-sm font-bold sm:block">
                      {lineTotal}
                    </span>
                  </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* From lg the running total sits beside the ingredients. */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-[112px] lg:w-[340px] lg:shrink-0">
        <section className="flex flex-col gap-3 rounded-card border border-line bg-paper p-4">
          <div className="flex items-baseline gap-2">
            <span className="flex-1 text-[12.5px] text-ink-soft">
              {servesLabel} · {lines.length} {lines.length === 1 ? "item" : "items"}
            </span>
            <span className="text-[12.5px] font-semibold">{formatWeight(totals.totalWeightG)}</span>
          </div>

          {totals.discountKobo > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-[13px] text-reef">
                Volume discount ({totals.discountBps / 100}%)
              </span>
              <span className="text-[13.5px] font-semibold text-reef">
                −{formatNaira(totals.discountKobo)}
              </span>
            </div>
          )}

          <div className="h-px bg-rule" />

          <div className="flex items-baseline gap-2">
            <span className="flex-1 text-sm font-bold">Estimated total</span>
            <span className="font-display text-[23px] font-semibold" aria-live="polite">
              {formatNaira(totals.payableKobo)}
            </span>
          </div>

          <p className="text-[11px] leading-snug text-ink-muted">
            You choose preparation for each item in the basket. The final price follows the real packed
            weight.
          </p>

          <div className="hidden pt-1 lg:block">
            <Button size="lg" fullWidth disabled={lines.length === 0} onClick={buildMeal}>
              Build This Meal
            </Button>
          </div>
        </section>

        <p className="rounded-xl bg-tint-clay px-3 py-2.5 text-[11.5px] leading-snug text-clay">
          Okra, palm oil and seasoning are not included — this is the seafood only.
        </p>
      </aside>

      <div className="glass-light fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-x-0 border-b-0 px-4 pt-3 pb-[104px] md:pb-4 lg:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="text-[11px] text-ink-muted">
            {servesLabel} · {formatWeight(totals.totalWeightG)}
          </span>
          <span className="font-display text-[19px] leading-tight font-semibold">
            {formatNaira(totals.payableKobo)}
          </span>
        </span>

        <span className="flex-1" />

        <Button size="lg" disabled={lines.length === 0} onClick={buildMeal}>
          Build This Meal
        </Button>
      </div>
    </div>
  );
}
