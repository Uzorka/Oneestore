import { priceForWeight } from "./money";
import { normalizeWeight } from "./pricing";
import type { Order } from "./orders";
import type { CartLine, Grams, Kobo, Product } from "./types";

/**
 * Ordering the same thing again.
 *
 * The obvious version — put the old lines back in the basket — is wrong here,
 * because this shop's prices move every morning. A customer who tapped "order
 * again" on a ₦19,600 basket and found ₦22,400 at checkout would be right to
 * feel tricked, so what changed is worked out first and shown before anything
 * is added.
 *
 * Stock moves too. Last week's 2 kg of croaker may be 900 g today, so each
 * line is re-checked against what is actually there and reported as available,
 * reduced or gone — rather than silently clamped, which hides it.
 */

export type ReorderState = "unchanged" | "price_changed" | "reduced" | "unavailable";

export interface ReorderLine {
  readonly productId: string;
  readonly productName: string;
  readonly prepId: string;
  readonly prepName: string;
  readonly state: ReorderState;
  /** What was ordered last time. */
  readonly previousWeightG: Grams;
  /** What can be ordered now — zero when there is none to be had. */
  readonly weightG: Grams;
  readonly previousUnitPricePerKgKobo: Kobo;
  readonly unitPricePerKgKobo: Kobo;
  readonly previousTotalKobo: Kobo;
  readonly totalKobo: Kobo;
}

export interface ReorderPlan {
  readonly lines: readonly ReorderLine[];
  readonly previousTotalKobo: Kobo;
  readonly totalKobo: Kobo;
  /** True when anything at all differs from last time. */
  readonly changed: boolean;
  readonly anyAvailable: boolean;
}

/**
 * Work out what ordering this again would mean today.
 *
 * Nothing is added to the basket here — this only reports, so the screen can
 * show the differences and let the customer decide.
 */
export function planReorder(
  order: Order,
  productsById: ReadonlyMap<string, Product>,
  options: { readonly remainingG?: (productId: string) => Grams } = {},
): ReorderPlan {
  const lines: ReorderLine[] = [];

  for (const line of order.lines) {
    const product = productsById.get(line.productId);

    const base = {
      productId: line.productId,
      productName: line.productName,
      prepId: line.prepId,
      prepName: line.prepName,
      previousWeightG: line.weightG,
      previousUnitPricePerKgKobo: line.unitPricePerKgKobo,
      previousTotalKobo: line.totalKobo,
    };

    // Gone from the catalog, hidden, or nothing left on the board.
    if (product === undefined || product.availability === "hidden") {
      lines.push({ ...base, state: "unavailable", weightG: 0, unitPricePerKgKobo: 0, totalKobo: 0 });
      continue;
    }

    const prep = product.preps.find((p) => p.id === line.prepId);
    const unitPricePerKgKobo = product.pricePerKgKobo + (prep?.surchargePerKgKobo ?? 0);

    const headroomG = options.remainingG?.(product.id) ?? product.stockG;
    const weightG =
      headroomG < product.minOrderG
        ? 0
        : normalizeWeight({ ...product, stockG: headroomG }, Math.min(line.weightG, headroomG));

    if (weightG <= 0) {
      lines.push({ ...base, state: "unavailable", weightG: 0, unitPricePerKgKobo, totalKobo: 0 });
      continue;
    }

    const totalKobo = priceForWeight(unitPricePerKgKobo, weightG);

    const state: ReorderState =
      weightG < line.weightG
        ? "reduced"
        : unitPricePerKgKobo !== line.unitPricePerKgKobo
          ? "price_changed"
          : "unchanged";

    lines.push({ ...base, state, weightG, unitPricePerKgKobo, totalKobo });
  }

  const previousTotalKobo = lines.reduce((sum, l) => sum + l.previousTotalKobo, 0);
  const totalKobo = lines.reduce((sum, l) => sum + l.totalKobo, 0);

  return {
    lines,
    previousTotalKobo,
    totalKobo,
    changed: lines.some((l) => l.state !== "unchanged"),
    anyAvailable: lines.some((l) => l.weightG > 0),
  };
}

/** The lines a plan would actually put in the basket. */
export function toCartLines(plan: ReorderPlan): readonly CartLine[] {
  return plan.lines
    .filter((l) => l.weightG > 0)
    .map((l) => ({
      productId: l.productId,
      prepId: l.prepId,
      weightG: l.weightG,
      // Today's price, not the old one. The customer has just been shown the
      // difference and agreed to it; carrying yesterday's snapshot forward
      // would make the basket argue with the board.
      unitPricePerKgKoboSnapshot: l.unitPricePerKgKobo,
    }));
}

/** Plain words for what happened to one line. */
export function stateNote(line: ReorderLine): string | null {
  switch (line.state) {
    case "unchanged":
      return null;
    case "price_changed":
      return line.unitPricePerKgKobo > line.previousUnitPricePerKgKobo
        ? "Dearer than last time"
        : "Cheaper than last time";
    case "reduced":
      return "Less available than you ordered";
    case "unavailable":
      return "Not on the board today";
  }
}
