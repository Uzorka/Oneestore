"use client";

import { formatWeight } from "@/lib/money";
import type { Grams, Product } from "@/lib/types";

/**
 * Step a weight by the product's own step.
 *
 * Shared by the box builder and the meal builder so the two cannot drift
 * apart. Both buttons are 44px: this is the control a customer taps most on
 * these screens, and it is the one that costs money to mis-tap.
 */
export function WeightStepper({
  product,
  weightG,
  onStep,
  decrementLabel,
}: {
  product: Product;
  weightG: Grams;
  onStep: (product: Product, direction: 1 | -1) => void;
  /** Spoken label for the minus button — it removes at the minimum weight. */
  decrementLabel?: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-control border border-line bg-paper p-1">
      <button
        type="button"
        onClick={() => onStep(product, -1)}
        aria-label={decrementLabel ?? `Less ${product.name}`}
        className="flex size-11 items-center justify-center rounded-[10px] bg-sand transition-colors duration-[var(--m-fast)] hover:bg-line"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </button>

      <span className="min-w-[46px] text-center text-[12.5px] font-bold tabular-nums">
        {formatWeight(weightG)}
      </span>

      <button
        type="button"
        onClick={() => onStep(product, 1)}
        aria-label={`More ${product.name}`}
        className="flex size-11 items-center justify-center rounded-[10px] bg-sand transition-colors duration-[var(--m-fast)] hover:bg-line"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </span>
  );
}
