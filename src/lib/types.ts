/**
 * Domain types for ONEESTORE.
 *
 * Two invariants hold everywhere in this codebase, because seafood is sold by
 * weight at a price that moves every morning:
 *
 *   - Money is an integer count of **kobo**. Never a float, never naira.
 *   - Weight is an integer count of **grams**. Never `2.5` kilograms.
 *
 * Every field carrying one of them says so in its name (`...Kobo`, `...G`), so
 * a float can never sneak in unnoticed during review.
 */

/** An integer count of kobo. 100 kobo = ₦1. */
export type Kobo = number;

/** An integer count of grams. 1000 g = 1 kg. */
export type Grams = number;

/** Basis points: 10000 bps = 100%. Used for yields and discounts. */
export type Bps = number;

export type Availability = "today" | "tomorrow" | "hidden";

/**
 * How the customer wants the fish prepared. The surcharge is per kilogram, not
 * per line, and the yield is what is left after preparation — filleting a
 * croaker loses roughly half its weight, and the customer is told that before
 * they buy rather than discovering it at the door.
 */
export interface PrepOption {
  readonly id: string;
  readonly name: string;
  readonly surchargePerKgKobo: Kobo;
  /** Share of the raw weight remaining after this preparation, in bps. */
  readonly yieldBps: Bps;
}

export interface Product {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /**
   * Nigerian and Yoruba names people actually search with — "apoda" for
   * croaker, "titus" for mackerel, "ede" for shrimp. Search matches these as
   * readily as the English name.
   */
  readonly localNames: readonly string[];
  readonly categorySlug: string;
  readonly description: string;
  readonly pricePerKgKobo: Kobo;
  readonly minOrderG: Grams;
  /** Weight is chosen in multiples of this. */
  readonly stepG: Grams;
  readonly stockG: Grams;
  readonly availability: Availability;
  readonly sizeGrade: string;
  readonly origin: string;
  /** Approximate weight of one fish, for "about 2 fish" guidance. */
  readonly unitWeightG: Grams | null;
  readonly preps: readonly PrepOption[];
  readonly rating: number | null;
  readonly ratingCount: number;
}

export interface Category {
  readonly slug: string;
  readonly name: string;
}

export interface DeliveryZone {
  readonly id: string;
  readonly name: string;
  readonly areas: readonly string[];
  readonly feeKobo: Kobo;
}

/** One line of a basket: a product, a preparation, and a weight. */
export interface CartLine {
  readonly productId: string;
  readonly prepId: string;
  readonly weightG: Grams;
  /**
   * The price per kg at the moment this line was added. Orders are never
   * re-priced by tomorrow's market; a changed price is surfaced to the
   * customer for explicit re-acceptance instead.
   */
  readonly unitPricePerKgKoboSnapshot: Kobo;
}

export interface MealIngredient {
  readonly productId: string;
  readonly gPerServing: Grams;
  readonly optional: boolean;
}

export interface Meal {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly defaultServes: number;
  readonly ingredients: readonly MealIngredient[];
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "sourcing"
  | "quality_checked"
  | "preparing"
  | "packed"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "on_hold";
