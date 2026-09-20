import { products as seedProducts } from "./seed";
import type { Availability, Grams, Kobo, Product } from "./types";

/**
 * The morning price board.
 *
 * Prices move every day, so the catalog in `seed.ts` is a starting point, not
 * the truth. What the shop sets each morning lives here as an overlay on top
 * of it — which is also exactly the shape the row will have when this moves to
 * a table: a product and the few fields the shop actually changes.
 *
 * The central decision is **draft and published**. Typing a new price must not
 * change what a customer is looking at mid-sentence, and a morning's pricing
 * is a single act of judgement across the whole board — you do not want half
 * of it live while someone is still deciding about the prawns. So edits
 * accumulate in a draft, the storefront reads only what has been published,
 * and publishing is one deliberate action.
 */

export interface ProductEdit {
  readonly pricePerKgKobo?: Kobo;
  readonly stockG?: Grams;
  readonly availability?: Availability;
}

export type Overrides = Readonly<Record<string, ProductEdit>>;

export interface CatalogState {
  /** What the storefront is serving. */
  readonly published: Overrides;
  /** What the shop is in the middle of deciding. */
  readonly draft: Overrides;
  readonly publishedAt: number | null;
}

export const EMPTY_CATALOG_STATE: CatalogState = {
  published: {},
  draft: {},
  publishedAt: null,
};

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

export function applyEdit(product: Product, edit: ProductEdit | undefined): Product {
  if (edit === undefined) return product;

  return {
    ...product,
    pricePerKgKobo: edit.pricePerKgKobo ?? product.pricePerKgKobo,
    stockG: edit.stockG ?? product.stockG,
    availability: edit.availability ?? product.availability,
  };
}

export function applyOverrides(
  products: readonly Product[],
  overrides: Overrides,
): readonly Product[] {
  return products.map((p) => applyEdit(p, overrides[p.id]));
}

/** The catalog a customer sees: seed plus whatever has been published. */
export function publishedProducts(state: CatalogState): readonly Product[] {
  return applyOverrides(seedProducts, state.published);
}

/** The catalog the shop sees while editing: published plus unsaved changes. */
export function draftProducts(state: CatalogState): readonly Product[] {
  return applyOverrides(seedProducts, { ...state.published, ...state.draft });
}

export function productMapFrom(products: readonly Product[]): ReadonlyMap<string, Product> {
  return new Map(products.map((p) => [p.id, p]));
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/**
 * Stage a change.
 *
 * An edit back to the published value is removed rather than stored, so the
 * "unsaved changes" count means what it says: typing 9,800 over 9,800 is not
 * a change, and a board claiming three edits when nothing differs teaches the
 * shop to ignore the number.
 */
export function stageEdit(state: CatalogState, productId: string, edit: ProductEdit): CatalogState {
  const base = seedProducts.find((p) => p.id === productId);
  if (base === undefined) return state;

  const live = applyEdit(base, state.published[productId]);
  const merged: ProductEdit = { ...state.draft[productId], ...edit };

  const kept: { -readonly [K in keyof ProductEdit]: ProductEdit[K] } = {};
  if (merged.pricePerKgKobo !== undefined && merged.pricePerKgKobo !== live.pricePerKgKobo) {
    kept.pricePerKgKobo = merged.pricePerKgKobo;
  }
  if (merged.stockG !== undefined && merged.stockG !== live.stockG) {
    kept.stockG = merged.stockG;
  }
  if (merged.availability !== undefined && merged.availability !== live.availability) {
    kept.availability = merged.availability;
  }

  const draft = { ...state.draft };
  if (Object.keys(kept).length === 0) delete draft[productId];
  else draft[productId] = kept;

  return { ...state, draft };
}

export function discardDraft(state: CatalogState): CatalogState {
  return { ...state, draft: {} };
}

/** Make the draft live, in one move. */
export function publish(state: CatalogState, at: number): CatalogState {
  if (Object.keys(state.draft).length === 0) return state;

  const published = { ...state.published };
  for (const [productId, edit] of Object.entries(state.draft)) {
    published[productId] = { ...published[productId], ...edit };
  }

  return { published, draft: {}, publishedAt: at };
}

// ---------------------------------------------------------------------------
// What changed
// ---------------------------------------------------------------------------

export interface Change {
  readonly productId: string;
  readonly productName: string;
  readonly field: "pricePerKgKobo" | "stockG" | "availability";
  readonly from: Kobo | Grams | Availability;
  readonly to: Kobo | Grams | Availability;
}

/** Every unpublished difference, for the shop to read before committing to it. */
export function pendingChanges(state: CatalogState): readonly Change[] {
  const out: Change[] = [];

  for (const [productId, edit] of Object.entries(state.draft)) {
    const base = seedProducts.find((p) => p.id === productId);
    if (base === undefined) continue;

    const live = applyEdit(base, state.published[productId]);

    if (edit.pricePerKgKobo !== undefined) {
      out.push({ productId, productName: base.name, field: "pricePerKgKobo", from: live.pricePerKgKobo, to: edit.pricePerKgKobo });
    }
    if (edit.stockG !== undefined) {
      out.push({ productId, productName: base.name, field: "stockG", from: live.stockG, to: edit.stockG });
    }
    if (edit.availability !== undefined) {
      out.push({ productId, productName: base.name, field: "availability", from: live.availability, to: edit.availability });
    }
  }

  return out;
}

export function changeCount(state: CatalogState): number {
  return Object.keys(state.draft).length;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_VERSION = 1;
export const CATALOG_STORAGE_KEY = "oneestore.catalog.v1";

export function serializeCatalog(state: CatalogState): string {
  return JSON.stringify({ v: STORAGE_VERSION, ...state });
}

/**
 * Read the board back defensively. A corrupt overlay must not take the shop
 * down: falling back to seed prices shows something wrong and sellable, where
 * a thrown error shows nothing at all.
 */
export function parseCatalog(raw: string | null): CatalogState {
  if (raw === null) return EMPTY_CATALOG_STATE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_CATALOG_STATE;

    const { v, published, draft, publishedAt } = parsed as {
      v?: unknown; published?: unknown; draft?: unknown; publishedAt?: unknown;
    };
    if (v !== STORAGE_VERSION) return EMPTY_CATALOG_STATE;

    return {
      published: sanitize(published),
      draft: sanitize(draft),
      publishedAt: typeof publishedAt === "number" ? publishedAt : null,
    };
  } catch {
    return EMPTY_CATALOG_STATE;
  }
}

const AVAILABILITY: readonly string[] = ["today", "tomorrow", "hidden"];

function sanitize(value: unknown): Overrides {
  if (typeof value !== "object" || value === null) return {};

  const out: Record<string, ProductEdit> = {};

  for (const [productId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null) continue;
    if (!seedProducts.some((p) => p.id === productId)) continue;

    const { pricePerKgKobo, stockG, availability } = raw as Record<string, unknown>;
    const edit: { -readonly [K in keyof ProductEdit]: ProductEdit[K] } = {};

    // Money and weight are integers, and a negative one is not a typo worth
    // honouring — it is a price that would pay the customer to take the fish.
    if (typeof pricePerKgKobo === "number" && Number.isInteger(pricePerKgKobo) && pricePerKgKobo > 0) {
      edit.pricePerKgKobo = pricePerKgKobo;
    }
    if (typeof stockG === "number" && Number.isInteger(stockG) && stockG >= 0) {
      edit.stockG = stockG;
    }
    if (typeof availability === "string" && AVAILABILITY.includes(availability)) {
      edit.availability = availability as Availability;
    }

    if (Object.keys(edit).length > 0) out[productId] = edit;
  }

  return out;
}
