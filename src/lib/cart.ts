import { priceBasket } from "./pricing";
import { normalizeWeight } from "./pricing";
import type { BasketTotals } from "./pricing";
import type { CartLine, Grams, Kobo, Product } from "./types";

/**
 * The basket.
 *
 * A pure reducer with no React and no storage, for the same reason the pricing
 * engine is pure: a basket that silently loses or double-counts weight is a
 * money bug, and money bugs are cheaper to catch in a test than in production.
 *
 * The rule that matters most here is **aggregate stock**. Pricing a single line
 * clamps that line to what is in stock, but two lines of the same croaker —
 * one cleaned, one filleted — can each be legal and still add up to more fish
 * than exists. The basket is the only place that can see both, so it is the
 * place that enforces the ceiling.
 */

export interface CartLineState {
  /** `productId:prepId` — identical product and preparation merge into one line. */
  readonly id: string;
  readonly productId: string;
  readonly prepId: string;
  readonly weightG: Grams;
  /**
   * The price per kg when this line was added. Kept even when the market moves,
   * so the customer is shown the change and accepts it rather than discovering
   * a new total at checkout.
   */
  readonly unitPricePerKgKoboSnapshot: Kobo;
  readonly addedAt: number;
}

export interface CartState {
  readonly lines: readonly CartLineState[];
  /** Chosen delivery zone, or null until the customer picks one. */
  readonly zoneId: string | null;
}

export const EMPTY_CART: CartState = { lines: [], zoneId: null };

export function lineId(productId: string, prepId: string): string {
  return `${productId}:${prepId}`;
}

export type CartAction =
  | { readonly type: "add"; readonly productId: string; readonly prepId: string; readonly weightG: Grams; readonly at?: number }
  | { readonly type: "setWeight"; readonly id: string; readonly weightG: Grams }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "setZone"; readonly zoneId: string | null }
  | { readonly type: "acceptPrice"; readonly id: string }
  | { readonly type: "restore"; readonly state: CartState }
  | { readonly type: "clear" };

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

/**
 * How much of a product is still available, given what the basket already
 * holds. `exceptId` lets a line ask "how much could *I* grow to" without
 * counting its own current weight against itself.
 */
export function remainingStockG(
  state: CartState,
  productId: string,
  catalog: ReadonlyMap<string, Product>,
  exceptId?: string,
): Grams {
  const product = catalog.get(productId);
  if (product === undefined) return 0;

  const claimed = state.lines
    .filter((l) => l.productId === productId && l.id !== exceptId)
    .reduce((sum, l) => sum + l.weightG, 0);

  return Math.max(0, product.stockG - claimed);
}

/**
 * Clamp a weight to what this line may actually hold: the product's own step
 * and minimum, and whatever stock the rest of the basket has left.
 */
function clampToBasket(
  state: CartState,
  product: Product,
  requestedG: Grams,
  exceptId: string,
): Grams {
  const available = remainingStockG(state, product.id, new Map([[product.id, product]]), exceptId);

  // Reuse the product's own snapping rules against the reduced ceiling.
  const constrained: Product = { ...product, stockG: available };
  return normalizeWeight(constrained, requestedG);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Apply an action to the basket.
 *
 * The catalog is passed in rather than imported so the reducer stays pure and
 * can be tested against any catalog, including one where a product has just
 * sold out.
 */
export function cartReducer(
  state: CartState,
  action: CartAction,
  catalog: ReadonlyMap<string, Product>,
): CartState {
  switch (action.type) {
    case "add": {
      const product = catalog.get(action.productId);
      if (product === undefined) return state;

      const id = lineId(action.productId, action.prepId);
      const existing = state.lines.find((l) => l.id === id);
      const wanted = (existing?.weightG ?? 0) + action.weightG;
      const weightG = clampToBasket(state, product, wanted, id);

      if (weightG <= 0) return state;

      if (existing !== undefined) {
        // Merging keeps the original price snapshot: the customer agreed to
        // that price for this line, and a top-up is not a new agreement.
        return {
          ...state,
          lines: state.lines.map((l) => (l.id === id ? { ...l, weightG } : l)),
        };
      }

      return {
        ...state,
        lines: [
          ...state.lines,
          {
            id,
            productId: action.productId,
            prepId: action.prepId,
            weightG,
            unitPricePerKgKoboSnapshot: product.pricePerKgKobo,
            addedAt: action.at ?? Date.now(),
          },
        ],
      };
    }

    case "setWeight": {
      const line = state.lines.find((l) => l.id === action.id);
      if (line === undefined) return state;

      const product = catalog.get(line.productId);
      if (product === undefined) return state;

      /*
       * Asking for nothing removes the line — that is what the minus button
       * does at the bottom of its range, and clamping back up to the minimum
       * there would trap the customer in a line they are trying to delete.
       *
       * A positive weight below the minimum still clamps up: someone typing
       * 300 g into a custom field means "the smallest you will sell me", not
       * "throw it away".
       */
      if (action.weightG <= 0) {
        return { ...state, lines: state.lines.filter((l) => l.id !== action.id) };
      }

      const weightG = clampToBasket(state, product, action.weightG, line.id);

      // Sold out from under them while the basket sat open.
      if (weightG <= 0) {
        return { ...state, lines: state.lines.filter((l) => l.id !== action.id) };
      }

      return {
        ...state,
        lines: state.lines.map((l) => (l.id === action.id ? { ...l, weightG } : l)),
      };
    }

    case "remove":
      return { ...state, lines: state.lines.filter((l) => l.id !== action.id) };

    case "setZone":
      return { ...state, zoneId: action.zoneId };

    case "acceptPrice": {
      const line = state.lines.find((l) => l.id === action.id);
      if (line === undefined) return state;

      const product = catalog.get(line.productId);
      if (product === undefined) return state;

      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.id ? { ...l, unitPricePerKgKoboSnapshot: product.pricePerKgKobo } : l,
        ),
      };
    }

    /*
     * Put back a basket that was already reconciled against the catalog,
     * price snapshots intact.
     *
     * This is deliberately not "replay the adds": re-adding would stamp
     * today's price onto every line and quietly erase the drift the customer
     * is owed a say in.
     */
    case "restore":
      return reconcileWithCatalog(action.state, catalog);

    case "clear":
      return { ...EMPTY_CART, zoneId: state.zoneId };
  }
}

// ---------------------------------------------------------------------------
// Reading the basket
// ---------------------------------------------------------------------------

export function cartLineCount(state: CartState): number {
  return state.lines.length;
}

export function cartWeightG(state: CartState): Grams {
  return state.lines.reduce((sum, l) => sum + l.weightG, 0);
}

export function isEmpty(state: CartState): boolean {
  return state.lines.length === 0;
}

/** Hand the basket to the pricing engine in the shape it expects. */
export function toCartLines(state: CartState): readonly CartLine[] {
  return state.lines.map((l) => ({
    productId: l.productId,
    prepId: l.prepId,
    weightG: l.weightG,
    unitPricePerKgKoboSnapshot: l.unitPricePerKgKoboSnapshot,
  }));
}

export function priceCart(
  state: CartState,
  catalog: ReadonlyMap<string, Product>,
): BasketTotals {
  return priceBasket(toCartLines(state), catalog);
}

/**
 * Lines whose product has since left the catalog or sold out entirely. They
 * are surfaced and removed rather than silently priced at zero.
 */
export function staleLines(
  state: CartState,
  catalog: ReadonlyMap<string, Product>,
): readonly CartLineState[] {
  return state.lines.filter((l) => {
    const product = catalog.get(l.productId);
    return product === undefined || product.availability === "hidden" || product.stockG <= 0;
  });
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_VERSION = 1;
export const STORAGE_KEY = "oneestore.cart.v1";

interface StoredCart {
  readonly v: number;
  readonly state: CartState;
}

export function serializeCart(state: CartState): string {
  const payload: StoredCart = { v: STORAGE_VERSION, state };
  return JSON.stringify(payload);
}

/**
 * Read a stored basket back.
 *
 * Anything unexpected — a corrupt string, an older schema, a hand-edited value
 * — yields an empty basket rather than throwing. A customer with a broken
 * localStorage entry should see an empty basket, not a blank page.
 */
export function parseCart(raw: string | null): CartState {
  if (raw === null || raw === "") return EMPTY_CART;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_CART;

    const stored = parsed as Partial<StoredCart>;
    if (stored.v !== STORAGE_VERSION) return EMPTY_CART;
    if (typeof stored.state !== "object" || stored.state === null) return EMPTY_CART;

    const lines = (stored.state as CartState).lines;
    if (!Array.isArray(lines)) return EMPTY_CART;

    const clean = lines.filter(
      (l): l is CartLineState =>
        typeof l === "object" &&
        l !== null &&
        typeof l.id === "string" &&
        typeof l.productId === "string" &&
        typeof l.prepId === "string" &&
        Number.isInteger(l.weightG) &&
        l.weightG > 0 &&
        Number.isInteger(l.unitPricePerKgKoboSnapshot) &&
        l.unitPricePerKgKoboSnapshot > 0,
    );

    const zoneId = (stored.state as CartState).zoneId;

    return { lines: clean, zoneId: typeof zoneId === "string" ? zoneId : null };
  } catch {
    return EMPTY_CART;
  }
}

/**
 * Bring a restored basket back in line with today's catalog: drop what is gone,
 * and shrink anything that no longer fits in stock.
 *
 * Prices are deliberately *not* refreshed here — drift is shown to the customer
 * and accepted explicitly.
 */
export function reconcileWithCatalog(
  state: CartState,
  catalog: ReadonlyMap<string, Product>,
): CartState {
  let next: CartState = { ...state, lines: [] };

  for (const line of state.lines) {
    const product = catalog.get(line.productId);
    if (product === undefined) continue;
    if (product.availability === "hidden") continue;
    if (!product.preps.some((p) => p.id === line.prepId)) continue;

    const weightG = clampToBasket(next, product, line.weightG, line.id);
    if (weightG <= 0) continue;

    next = { ...next, lines: [...next.lines, { ...line, weightG }] };
  }

  return next;
}
