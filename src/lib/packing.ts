import { priceForWeight } from "./money";
import { isWithinTolerance, reconcileLine, reconcileOrder, toleranceBand } from "./pricing";
import type { Order, OrderLine } from "./orders";
import type { Grams, Kobo } from "./types";
import type { Reconciliation } from "./pricing";

/**
 * The packing room.
 *
 * This is where an order stops being a promise and becomes a weight. The
 * customer asked for 2 kg of croaker; the fish on the scale is 1.94 kg. Every
 * rule in the pricing engine about tolerance, wallet credit and never charging
 * above the authorised amount exists for this moment, and this module is what
 * finally applies them.
 *
 * Nothing here decides money on its own — it hands weights to `reconcileLine`
 * and arranges the answers. That keeps one implementation of the rule that
 * matters: a card is never charged above what the customer approved.
 */

/** Lines are identified by product and preparation, as they are in the cart. */
export function lineKey(line: Pick<OrderLine, "productId" | "prepId">): string {
  return `${line.productId}:${line.prepId}`;
}

/**
 * What the customer was actually charged for one line.
 *
 * The volume discount is a basket-level figure, so each line carries its own
 * share of it. Charged and packed value are both measured at this same rate —
 * measuring the packed weight at the undiscounted rate would read the discount
 * itself as an overpack the shop had absorbed.
 */
export function chargedForLine(line: OrderLine, discountBps: number): Kobo {
  return line.totalKobo - Math.floor((line.totalKobo * discountBps) / 10000);
}

export interface PackedLineState {
  readonly line: OrderLine;
  readonly key: string;
  readonly actualG: Grams | null;
  readonly band: { readonly minG: Grams; readonly maxG: Grams };
  readonly withinTolerance: boolean;
  readonly reconciliation: Reconciliation | null;
}

/**
 * Record what came off the scale.
 *
 * Weights are not validated away here. A packer who types 5 kg for a 2 kg
 * order has made a mistake worth seeing on screen, not one worth silently
 * clamping — clamping would hide the error and quietly change what the shop
 * believes it packed.
 */
export function recordPackedWeight(order: Order, key: string, actualG: Grams | null): Order {
  const packed = { ...(order.packed ?? {}) };

  if (actualG === null) delete packed[key];
  else packed[key] = Math.max(0, Math.round(actualG));

  return { ...order, packed };
}

/** Every line with its scale reading and what that reading means. */
export function packingState(order: Order): readonly PackedLineState[] {
  return order.lines.map((line) => {
    const key = lineKey(line);
    const actualG = order.packed?.[key] ?? null;
    const band = toleranceBand(line.weightG);

    if (actualG === null) {
      return { line, key, actualG: null, band, withinTolerance: true, reconciliation: null };
    }

    return {
      line,
      key,
      actualG,
      band,
      withinTolerance: isWithinTolerance(line.weightG, actualG),
      reconciliation: reconcileLine({
        orderedG: line.weightG,
        actualG,
        unitPricePerKgKobo: line.unitPricePerKgKobo,
        chargedKobo: chargedForLine(line, order.discountBps),
        discountBps: order.discountBps,
      }),
    };
  });
}

export interface PackingSummary {
  readonly weighed: number;
  readonly total: number;
  readonly complete: boolean;
  /** True when any line is outside ±8% and a supervisor must agree to it. */
  readonly needsOverride: boolean;
  readonly walletCreditKobo: Kobo;
  readonly absorbedKobo: Kobo;
  /** Goods total after settlement — never more than was authorised. */
  readonly goodsKobo: Kobo;
  readonly totalKobo: Kobo;
}

export function packingSummary(order: Order): PackingSummary {
  const states = packingState(order);
  const weighed = states.filter((s) => s.reconciliation !== null);

  const settled = reconcileOrder(weighed.map((s) => s.reconciliation as Reconciliation));

  // Lines not yet on the scale still stand at what was ordered.
  const unweighedKobo = states
    .filter((s) => s.reconciliation === null)
    .reduce((sum, s) => sum + chargedForLine(s.line, order.discountBps), 0);

  const weighedChargedKobo = weighed.reduce(
    (sum, s) => sum + chargedForLine(s.line, order.discountBps),
    0,
  );

  // What the customer ends up paying: what they authorised, less anything we
  // packed under. Never more — an overpack is the shop's to absorb.
  const goodsKobo = unweighedKobo + weighedChargedKobo - settled.walletCreditKobo;

  return {
    weighed: weighed.length,
    total: states.length,
    complete: weighed.length === states.length && states.length > 0,
    needsOverride: settled.needsOverride,
    walletCreditKobo: settled.walletCreditKobo,
    absorbedKobo: settled.absorbedKobo,
    goodsKobo,
    totalKobo: goodsKobo + order.deliveryKobo,
  };
}

/**
 * What the scale reading is worth, for the line the packer is looking at.
 * Shown live as they type, so an underpack is visible before it is saved.
 */
export function valueOfPackedWeight(
  line: OrderLine,
  actualG: Grams,
  discountBps: number,
): Kobo {
  const gross = priceForWeight(line.unitPricePerKgKobo, actualG);
  return gross - Math.floor((gross * discountBps) / 10000);
}

/** Plain words for why a weight cannot be saved without a supervisor. */
export function overrideReason(line: OrderLine, actualG: Grams): string | null {
  if (isWithinTolerance(line.weightG, actualG)) return null;

  const band = toleranceBand(line.weightG);
  const under = actualG < band.minG;

  return under
    ? `${(actualG / 1000).toFixed(2)} kg is more than 8% under the ${(line.weightG / 1000).toFixed(2)} kg ordered. A supervisor has to agree to this one.`
    : `${(actualG / 1000).toFixed(2)} kg is more than 8% over the ${(line.weightG / 1000).toFixed(2)} kg ordered. The customer is not charged for the extra — a supervisor has to agree to send it.`;
}
