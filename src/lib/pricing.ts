import { priceForWeight } from "./money";
import type { Bps, CartLine, Grams, Kobo, PrepOption, Product } from "./types";

/**
 * The pricing and weight engine.
 *
 * Pure functions, no I/O, no framework. This is where the money bugs would
 * live, so it is written and tested in isolation before any screen depends on
 * it.
 *
 * The rules it enforces, in one place:
 *
 *  1. Money in kobo, weight in grams, both integers.
 *  2. A weight is clamped to what is in stock and snapped to the product's step.
 *  3. Preparation surcharges are per kilogram, added to the unit price.
 *  4. The customer is charged for the weight actually packed.
 *  5. Packed weight must land within ±8% of what was ordered.
 *  6. Packed under → the difference becomes wallet credit.
 *     Packed over → we absorb it. A card is never charged above the amount the
 *     customer authorised.
 */

/** Packed weight must be within this of the ordered weight. 800 bps = 8%. */
export const TOLERANCE_BPS: Bps = 800;

/** Box weight tiers: reach the weight, get the discount. */
export const BOX_TIERS: readonly { readonly minG: Grams; readonly discountBps: Bps }[] = [
  { minG: 5000, discountBps: 1000 },
  { minG: 3000, discountBps: 500 },
] as const;

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

/**
 * Bring a requested weight into something the product can actually sell:
 * snapped to its step, never below its minimum, never above what is in stock.
 *
 * Snapping rounds to the nearest step so a slider or a stepper cannot leave the
 * cart holding 1,237 g of fish.
 */
export function normalizeWeight(product: Product, requestedG: Grams): Grams {
  const step = Math.max(1, product.stepG);
  const snapped = Math.round(requestedG / step) * step;

  // Stock is the hard ceiling, but it is itself snapped down to a sellable
  // step — we cannot promise 6.3 kg when the step is 500 g.
  const sellableStockG = Math.floor(product.stockG / step) * step;
  const ceiling = Math.max(0, sellableStockG);

  if (ceiling < product.minOrderG) return 0;
  return Math.min(Math.max(snapped, product.minOrderG), ceiling);
}

/** Can this product be bought at all right now? */
export function isPurchasable(product: Product): boolean {
  return product.availability !== "hidden" && normalizeWeight(product, product.minOrderG) > 0;
}

/** Roughly how many fish a weight works out to, for "about 2 fish" guidance. */
export function approximatePieces(product: Product, weightG: Grams): number | null {
  if (product.unitWeightG === null || product.unitWeightG <= 0) return null;
  return Math.max(1, Math.round(weightG / product.unitWeightG));
}

// ---------------------------------------------------------------------------
// Line pricing
// ---------------------------------------------------------------------------

export interface PricedLine {
  readonly weightG: Grams;
  /** Weight remaining after preparation — filleting loses about half. */
  readonly preparedWeightG: Grams;
  readonly pricePerKgKobo: Kobo;
  readonly prepSurchargePerKgKobo: Kobo;
  /** Price per kg the customer is actually paying, preparation included. */
  readonly unitPricePerKgKobo: Kobo;
  readonly goodsKobo: Kobo;
  readonly prepKobo: Kobo;
  readonly totalKobo: Kobo;
}

export function findPrep(product: Product, prepId: string): PrepOption | undefined {
  return product.preps.find((p) => p.id === prepId);
}

/**
 * Price one line: a product, a preparation and a weight.
 *
 * Goods and preparation are rounded separately so both can be shown to the
 * customer as their own row and still add up to the total exactly — a basket
 * whose lines do not reconcile with its subtotal is a support ticket.
 */
export function priceLine(product: Product, prepId: string, requestedG: Grams): PricedLine {
  const prep = findPrep(product, prepId);
  if (prep === undefined) {
    throw new Error(`Unknown preparation "${prepId}" for product "${product.slug}"`);
  }

  const weightG = normalizeWeight(product, requestedG);
  const goodsKobo = priceForWeight(product.pricePerKgKobo, weightG);
  const prepKobo = priceForWeight(prep.surchargePerKgKobo, weightG);

  return {
    weightG,
    preparedWeightG: Math.round((weightG * prep.yieldBps) / 10000),
    pricePerKgKobo: product.pricePerKgKobo,
    prepSurchargePerKgKobo: prep.surchargePerKgKobo,
    unitPricePerKgKobo: product.pricePerKgKobo + prep.surchargePerKgKobo,
    goodsKobo,
    prepKobo,
    totalKobo: goodsKobo + prepKobo,
  };
}

// ---------------------------------------------------------------------------
// Basket
// ---------------------------------------------------------------------------

export interface BasketTotals {
  readonly lines: readonly PricedLine[];
  readonly totalWeightG: Grams;
  readonly goodsKobo: Kobo;
  readonly prepKobo: Kobo;
  /** Goods plus preparation, before delivery. */
  readonly subtotalKobo: Kobo;
}

export function priceBasket(
  lines: readonly CartLine[],
  productsById: ReadonlyMap<string, Product>,
): BasketTotals {
  const priced: PricedLine[] = [];

  for (const line of lines) {
    const product = productsById.get(line.productId);
    if (product === undefined) continue;
    priced.push(priceLine(product, line.prepId, line.weightG));
  }

  const goodsKobo = priced.reduce((sum, l) => sum + l.goodsKobo, 0);
  const prepKobo = priced.reduce((sum, l) => sum + l.prepKobo, 0);

  return {
    lines: priced,
    totalWeightG: priced.reduce((sum, l) => sum + l.weightG, 0),
    goodsKobo,
    prepKobo,
    subtotalKobo: goodsKobo + prepKobo,
  };
}

/**
 * Has the market moved since this line went into the basket?
 *
 * The customer is shown the difference and has to accept it. Silently
 * re-pricing at checkout is the fastest way to lose someone.
 */
export function priceDrift(
  line: CartLine,
  product: Product,
): { readonly changed: boolean; readonly fromKobo: Kobo; readonly toKobo: Kobo } {
  return {
    changed: line.unitPricePerKgKoboSnapshot !== product.pricePerKgKobo,
    fromKobo: line.unitPricePerKgKoboSnapshot,
    toKobo: product.pricePerKgKobo,
  };
}

// ---------------------------------------------------------------------------
// Weight tolerance and reconciliation
// ---------------------------------------------------------------------------

export interface ToleranceBand {
  readonly minG: Grams;
  readonly maxG: Grams;
}

export function toleranceBand(orderedG: Grams): ToleranceBand {
  const slack = (orderedG * TOLERANCE_BPS) / 10000;
  return { minG: Math.floor(orderedG - slack), maxG: Math.ceil(orderedG + slack) };
}

export function isWithinTolerance(orderedG: Grams, actualG: Grams): boolean {
  const band = toleranceBand(orderedG);
  return actualG >= band.minG && actualG <= band.maxG;
}

export interface Reconciliation {
  readonly orderedG: Grams;
  readonly actualG: Grams;
  readonly chargedKobo: Kobo;
  /** What the packed weight is actually worth. */
  readonly actualValueKobo: Kobo;
  /** Refunded to the customer's wallet when we packed under. */
  readonly walletCreditKobo: Kobo;
  /** What we swallow when we packed over. Never billed to the customer. */
  readonly absorbedKobo: Kobo;
  readonly withinTolerance: boolean;
  /** True when a packer needs a supervisor to save this weight. */
  readonly needsOverride: boolean;
}

/**
 * Settle a line once it has been weighed.
 *
 * Packed under, the difference goes back as wallet credit — instant, no
 * gateway round-trip, and it brings the customer back. Packed over, we absorb
 * it: a card is never charged above the authorised amount, because doing that
 * collects chargebacks and destroys the trust the whole proposition rests on.
 */
export function reconcileLine(args: {
  readonly orderedG: Grams;
  readonly actualG: Grams;
  readonly unitPricePerKgKobo: Kobo;
  readonly chargedKobo: Kobo;
}): Reconciliation {
  const { orderedG, actualG, unitPricePerKgKobo, chargedKobo } = args;

  const actualValueKobo = priceForWeight(unitPricePerKgKobo, actualG);
  const delta = chargedKobo - actualValueKobo;
  const withinTolerance = isWithinTolerance(orderedG, actualG);

  return {
    orderedG,
    actualG,
    chargedKobo,
    actualValueKobo,
    walletCreditKobo: delta > 0 ? delta : 0,
    absorbedKobo: delta < 0 ? -delta : 0,
    withinTolerance,
    needsOverride: !withinTolerance,
  };
}

/** Roll a whole order's reconciled lines into one wallet credit. */
export function reconcileOrder(
  lines: readonly Reconciliation[],
): { readonly walletCreditKobo: Kobo; readonly absorbedKobo: Kobo; readonly needsOverride: boolean } {
  return {
    walletCreditKobo: lines.reduce((sum, l) => sum + l.walletCreditKobo, 0),
    absorbedKobo: lines.reduce((sum, l) => sum + l.absorbedKobo, 0),
    needsOverride: lines.some((l) => l.needsOverride),
  };
}

// ---------------------------------------------------------------------------
// Build Your Box
// ---------------------------------------------------------------------------

export interface BoxTotals {
  readonly totalWeightG: Grams;
  readonly grossKobo: Kobo;
  readonly discountBps: Bps;
  readonly discountKobo: Kobo;
  readonly netKobo: Kobo;
  /** Weight still needed for the next tier, or null at the top tier. */
  readonly gToNextTierG: Grams | null;
  readonly nextTierDiscountBps: Bps | null;
}

/** The discount a box of this weight earns. */
export function boxDiscountBps(totalWeightG: Grams): Bps {
  for (const tier of BOX_TIERS) {
    if (totalWeightG >= tier.minG) return tier.discountBps;
  }
  return 0;
}

export function priceBox(
  lines: readonly CartLine[],
  productsById: ReadonlyMap<string, Product>,
): BoxTotals {
  const basket = priceBasket(lines, productsById);
  const discountBps = boxDiscountBps(basket.totalWeightG);

  // Round the discount down so a box never costs less than its parts imply.
  const discountKobo = Math.floor((basket.subtotalKobo * discountBps) / 10000);

  // Tiers are ordered heaviest first; the next one up is the last tier the box
  // has not yet reached.
  const unreached = [...BOX_TIERS].reverse().filter((t) => basket.totalWeightG < t.minG);
  const next = unreached[0];

  return {
    totalWeightG: basket.totalWeightG,
    grossKobo: basket.subtotalKobo,
    discountBps,
    discountKobo,
    netKobo: basket.subtotalKobo - discountKobo,
    gToNextTierG: next === undefined ? null : next.minG - basket.totalWeightG,
    nextTierDiscountBps: next === undefined ? null : next.discountBps,
  };
}

// ---------------------------------------------------------------------------
// Shop by Meal
// ---------------------------------------------------------------------------

/**
 * Scale a meal's recommended quantities to a number of servings.
 *
 * Quantities snap to each product's step, so what the meal suggests is
 * something the shop can actually weigh out.
 */
export function mealQuantities(
  ingredients: readonly { readonly productId: string; readonly gPerServing: Grams; readonly optional: boolean }[],
  serves: number,
  productsById: ReadonlyMap<string, Product>,
  options: { readonly includeOptional?: boolean } = {},
): readonly { readonly productId: string; readonly weightG: Grams; readonly optional: boolean }[] {
  const includeOptional = options.includeOptional ?? true;

  return ingredients
    .filter((i) => includeOptional || !i.optional)
    .map((i) => {
      const product = productsById.get(i.productId);
      const raw = i.gPerServing * Math.max(1, serves);
      return {
        productId: i.productId,
        weightG: product === undefined ? raw : normalizeWeight(product, raw),
        optional: i.optional,
      };
    })
    .filter((i) => i.weightG > 0);
}
