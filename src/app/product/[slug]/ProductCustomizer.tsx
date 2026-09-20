"use client";

import { useMemo, useState } from "react";

import { useCart } from "@/components/CartProvider";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { PreparationSelector, WeightSelector, WeightStepper } from "@/components/ui/Selectors";
import { formatNaira, formatWeight } from "@/lib/money";
import { approximatePieces, normalizeWeight, priceLine } from "@/lib/pricing";
import type { Grams, Product } from "@/lib/types";

/**
 * The three-step customization: weight, preparation, then anything else.
 *
 * Price and prepared-weight estimate recompute on every change through the
 * same pricing engine the server and the packing screen use — there is no
 * second implementation of the money maths living in the UI.
 */

const QUICK_WEIGHTS: readonly Grams[] = [500, 1000, 2000];

export function ProductCustomizer({ product }: { product: Product }) {
  const { dispatch, remainingG } = useCart();
  const { show } = useToast();

  const [weightG, setWeightG] = useState<Grams>(normalizeWeight(product, 1000));
  const [custom, setCustom] = useState(false);
  const [prepId, setPrepId] = useState<string | null>(null);

  // What is left after whatever the basket already holds of this fish.
  const availableG = remainingG(product.id);
  const maxG = useMemo(
    () => normalizeWeight({ ...product, stockG: availableG }, availableG),
    [product, availableG],
  );
  const soldOut = maxG <= 0;

  // Nothing is priced until a preparation is chosen, so the preview uses the
  // first option while the customer decides.
  const previewPrepId = prepId ?? product.preps[0]?.id ?? "";
  const line = useMemo(
    () => priceLine(product, previewPrepId, weightG),
    [product, previewPrepId, weightG],
  );

  const chosen = prepId !== null;
  const pieces = approximatePieces(product, weightG);

  function setWeight(next: Grams) {
    setWeightG(normalizeWeight(product, next));
  }

  function addToBasket() {
    if (prepId === null) return;

    dispatch({ type: "add", productId: product.id, prepId, weightG });

    const prepName = product.preps.find((p) => p.id === prepId)?.name ?? "";
    show({
      title: "Added to your basket",
      detail: `${product.name} · ${formatWeight(weightG)} · ${prepName.toLowerCase()}`,
      href: "/basket",
      actionLabel: "View",
    });
  }

  return (
    <div className="flex flex-col gap-4.5">
      <section className="flex flex-col gap-3">
        <StepHeading n={1}>Choose weight</StepHeading>

        <WeightSelector
          options={QUICK_WEIGHTS}
          valueG={weightG}
          customActive={custom}
          onChange={(g) => {
            setCustom(false);
            setWeight(g);
          }}
          onCustom={() => setCustom(true)}
        />

        {custom && (
          <div className="animate-rise">
            <WeightStepper
              valueG={weightG}
              stepG={product.stepG}
              min={product.minOrderG}
              max={maxG}
              onChange={setWeight}
            />
          </div>
        )}

        <span className="text-[11.5px] text-ink-muted">
          {pieces !== null
            ? `About ${pieces} fish · ${product.sizeGrade}`
            : product.sizeGrade}
        </span>

        {availableG < product.stockG && !soldOut && (
          <span className="text-[11.5px] font-semibold text-amber">
            {formatWeight(availableG)} left — the rest is already in your basket.
          </span>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <StepHeading n={2} note={chosen ? undefined : "Required"}>
          How should we prepare it?
        </StepHeading>
        <PreparationSelector options={product.preps} value={prepId} onChange={setPrepId} />
      </section>

      <section className="flex flex-col gap-2.5 rounded-card bg-abyss p-4">
        <Row label={`${formatWeight(line.weightG)} × ${formatNaira(line.unitPricePerKgKobo)}/kg`}>
          {formatNaira(line.totalKobo)}
        </Row>
        <Row label="Weight after preparation" accent>
          ≈ {formatWeight(line.preparedWeightG)}
        </Row>

        <div className="h-px bg-white/10" />

        <div className="flex items-baseline gap-2">
          <span className="flex-1 text-[13.5px] font-bold text-white">Total</span>
          <span className="font-display text-[25px] font-semibold text-white" aria-live="polite">
            {formatNaira(line.totalKobo)}
          </span>
        </div>
      </section>

      <div className="flex items-start gap-2.5 rounded-[14px] bg-tint-amber px-3.5 py-3">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#92500C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
          <path d="M12 4v3M7 7h10l3 7H4l3-7z" />
          <path d="M9 14a3 3 0 0 0 6 0" />
          <path d="M12 17v3M8.5 20h7" />
        </svg>
        <span className="text-[11.5px] leading-snug text-amber">
          Fish is never exact. We pack within 8% and charge the real weight — any difference comes
          back to your wallet the same day.
        </span>
      </div>

      {/* The purchase bar stays reachable while the customer is still deciding. */}
      <div className="glass-light fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-x-0 border-b-0 px-4 pt-3 pb-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] text-ink-muted">
            {formatWeight(line.weightG)}
            {chosen ? ` · ${product.preps.find((p) => p.id === prepId)?.name}` : ""}
          </span>
          <span className="font-display text-[21px] leading-tight font-semibold">
            {formatNaira(line.totalKobo)}
          </span>
        </div>

        <Button size="lg" className="flex-1" disabled={!chosen || soldOut} onClick={addToBasket}>
          {soldOut ? "All of it is in your basket" : chosen ? "Add to Basket" : "Choose a preparation"}
        </Button>
      </div>
    </div>
  );
}

function StepHeading({ n, note, children }: { n: number; note?: string; children: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-[21px] shrink-0 items-center justify-center rounded-full bg-abyss text-[11px] font-bold text-white">
        {n}
      </span>
      <span className="flex-1 text-sm font-bold">{children}</span>
      {note !== undefined && <span className="text-[10.5px] font-bold text-clay">{note}</span>}
    </div>
  );
}

function Row({
  label,
  accent = false,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex-1 text-[12.5px] text-[#A8C4C0]">{label}</span>
      <span className={`text-[13px] font-semibold ${accent ? "text-[#7FD3C4]" : "text-salt"}`}>
        {children}
      </span>
    </div>
  );
}
