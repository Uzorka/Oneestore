import { naira } from "./money";
import type { Category, Meal, PrepOption, Product } from "./types";

/**
 * Seed catalog.
 *
 * Every price, stock figure and rating here is **placeholder sample data** so
 * the storefront can be built and reviewed before the real market board exists.
 * It is replaced by the daily publish from the admin price board; nothing in the
 * application should treat these numbers as authoritative.
 */

/**
 * Preparations, with the surcharge per kilogram and what is left of the raw
 * weight afterwards. The yield is the number customers are never told
 * elsewhere: a kilogram of croaker becomes about 520 g of fillet, and finding
 * that out at the door is how a shop loses someone for good.
 */
export const PREPS: Record<string, PrepOption> = {
  whole: { id: "whole", name: "Whole", surchargePerKgKobo: 0, yieldBps: 10000 },
  cleaned: { id: "cleaned", name: "Cleaned", surchargePerKgKobo: naira(500), yieldBps: 8800 },
  filleted: { id: "filleted", name: "Filleted", surchargePerKgKobo: naira(1200), yieldBps: 5200 },
  "steak-cut": { id: "steak-cut", name: "Steak Cut", surchargePerKgKobo: naira(700), yieldBps: 8500 },
  peeled: { id: "peeled", name: "Peeled & deveined", surchargePerKgKobo: naira(900), yieldBps: 6000 },
  "shell-on": { id: "shell-on", name: "Shell on", surchargePerKgKobo: 0, yieldBps: 10000 },
};

function preps(...ids: string[]): readonly PrepOption[] {
  return ids.map((id) => {
    const prep = PREPS[id];
    if (prep === undefined) throw new Error(`Unknown preparation in seed data: ${id}`);
    return prep;
  });
}

export const categories: readonly Category[] = [
  { slug: "fresh-fish", name: "Fresh Fish" },
  { slug: "prawns-shrimp", name: "Prawns & Shrimp" },
  { slug: "shellfish", name: "Shellfish" },
  { slug: "smoked-dried", name: "Smoked & Dried" },
];

export const products: readonly Product[] = [
  {
    id: "croaker",
    slug: "croaker",
    name: "Croaker",
    localNames: ["apoda"],
    categorySlug: "fresh-fish",
    description:
      "Firm white flesh with a mild, slightly sweet taste — the Lagos standard for pepper soup, and it holds together on the grill.",
    pricePerKgKobo: naira(9800),
    minOrderG: 500,
    stepG: 250,
    stockG: 24_000,
    availability: "today",
    sizeGrade: "0.8–1.4 kg each",
    origin: "Epe jetty",
    unitWeightG: 1100,
    preps: preps("whole", "cleaned", "filleted", "steak-cut"),
    rating: 4.8,
    ratingCount: 213,
  },
  {
    id: "red-snapper",
    slug: "red-snapper",
    name: "Red Snapper",
    localNames: ["eja osan", "osan"],
    categorySlug: "fresh-fish",
    description: "Line-caught, sweet and clean. The fish to use when the dish is meant to impress.",
    pricePerKgKobo: naira(12_500),
    minOrderG: 500,
    stepG: 250,
    stockG: 11_000,
    availability: "today",
    sizeGrade: "1–2 kg each",
    origin: "Badagry",
    unitWeightG: 1400,
    preps: preps("whole", "cleaned", "filleted", "steak-cut"),
    rating: 4.9,
    ratingCount: 88,
  },
  {
    id: "titus",
    slug: "titus",
    name: "Titus",
    localNames: ["mackerel", "shawa titus"],
    categorySlug: "fresh-fish",
    description: "Rich, oily mackerel. Grills beautifully and forgives a hot pan.",
    pricePerKgKobo: naira(6200),
    minOrderG: 500,
    stepG: 250,
    stockG: 70_000,
    availability: "today",
    sizeGrade: "Grade A",
    origin: "Atlantic, frozen at sea",
    unitWeightG: 450,
    preps: preps("whole", "cleaned"),
    rating: 4.6,
    ratingCount: 402,
  },
  {
    id: "catfish",
    slug: "catfish",
    name: "Catfish",
    localNames: ["point and kill", "obokun"],
    categorySlug: "fresh-fish",
    description: "Live until you order it. The backbone of a proper catfish pepper soup.",
    pricePerKgKobo: naira(5400),
    minOrderG: 500,
    stepG: 250,
    stockG: 32_000,
    availability: "today",
    sizeGrade: "1–1.8 kg each",
    origin: "Ikorodu ponds",
    unitWeightG: 1400,
    preps: preps("whole", "cleaned", "steak-cut"),
    rating: 4.7,
    ratingCount: 156,
  },
  {
    id: "tilapia",
    slug: "tilapia",
    name: "Tilapia",
    localNames: ["epiya"],
    categorySlug: "fresh-fish",
    description: "Mild and lean, farmed in Ikorodu. Good for anyone who finds mackerel too strong.",
    pricePerKgKobo: naira(5900),
    minOrderG: 500,
    stepG: 250,
    stockG: 18_000,
    availability: "today",
    sizeGrade: "0.5–0.9 kg each",
    origin: "Ikorodu ponds",
    unitWeightG: 700,
    preps: preps("whole", "cleaned", "filleted"),
    rating: 4.5,
    ratingCount: 61,
  },
  {
    id: "tiger-prawns",
    slug: "tiger-prawns",
    name: "Tiger Prawns",
    localNames: ["ede", "jumbo prawns"],
    categorySlug: "prawns-shrimp",
    description: "Head-on jumbo prawns. Sweet, meaty, and the reason people order seafood at all.",
    pricePerKgKobo: naira(18_500),
    minOrderG: 500,
    stepG: 250,
    stockG: 6000,
    availability: "today",
    sizeGrade: "Jumbo, head-on",
    origin: "Lagos lagoon",
    unitWeightG: null,
    preps: preps("shell-on", "peeled", "whole"),
    rating: 4.9,
    ratingCount: 174,
  },
  {
    id: "brown-shrimps",
    slug: "brown-shrimps",
    name: "Brown Shrimps",
    localNames: ["ede", "shrimps"],
    categorySlug: "prawns-shrimp",
    description: "Small, intensely flavoured shrimps. What okra soup is actually asking for.",
    pricePerKgKobo: naira(11_000),
    minOrderG: 500,
    stepG: 250,
    stockG: 14_000,
    availability: "today",
    sizeGrade: "Small",
    origin: "Makoko",
    unitWeightG: null,
    preps: preps("shell-on", "peeled"),
    rating: 4.6,
    ratingCount: 97,
  },
  {
    id: "blue-crab",
    slug: "blue-crab",
    name: "Blue Crab",
    localNames: ["akan", "crab"],
    categorySlug: "shellfish",
    description: "Live lagoon crab. Sweet meat, and the shells make the stock worth making.",
    pricePerKgKobo: naira(8400),
    minOrderG: 500,
    stepG: 250,
    stockG: 9000,
    availability: "today",
    sizeGrade: "Medium",
    origin: "Lagos lagoon",
    unitWeightG: 220,
    preps: preps("whole", "cleaned"),
    rating: 4.4,
    ratingCount: 43,
  },
  {
    id: "panla",
    slug: "panla",
    name: "Panla",
    localNames: ["hake", "stockfish", "panla gbigbe"],
    categorySlug: "smoked-dried",
    description: "Dried hake, split and ready for the pot. Keeps for weeks in a dry cupboard.",
    pricePerKgKobo: naira(7600),
    minOrderG: 500,
    stepG: 250,
    stockG: 26_000,
    availability: "today",
    sizeGrade: "Split",
    origin: "Dried in Lagos",
    unitWeightG: null,
    preps: preps("whole"),
    rating: 4.5,
    ratingCount: 129,
  },
  {
    id: "bonga",
    slug: "bonga",
    name: "Bonga",
    localNames: ["shawa", "smoked shawa"],
    categorySlug: "smoked-dried",
    description: "Smoked over firewood the traditional way. Deep, smoky, and ready to eat.",
    pricePerKgKobo: naira(8900),
    minOrderG: 500,
    stepG: 250,
    stockG: 4000,
    availability: "tomorrow",
    sizeGrade: "Medium",
    origin: "Makoko smokehouse",
    unitWeightG: 300,
    preps: preps("whole"),
    rating: 4.8,
    ratingCount: 76,
  },
];

/** Products keyed by id, for the pricing engine. */
export function productMap(): ReadonlyMap<string, Product> {
  return new Map(products.map((p) => [p.id, p]));
}

export function productBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/**
 * Search across English and local names both, because someone looking for
 * croaker is as likely to type "apoda", and someone after mackerel will type
 * "titus" every time.
 */
export function searchProducts(query: string): readonly Product[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];

  return products.filter((p) => {
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.localNames.some((n) => n.toLowerCase().includes(q))) return true;
    const category = categories.find((c) => c.slug === p.categorySlug);
    return category !== undefined && category.name.toLowerCase().includes(q);
  });
}

export const meals: readonly Meal[] = [
  {
    slug: "seafood-okra",
    name: "Seafood Okra",
    description: "The full-house version, with enough crab in it to be worth the work.",
    defaultServes: 4,
    ingredients: [
      { productId: "croaker", gPerServing: 375, optional: false },
      { productId: "tiger-prawns", gPerServing: 125, optional: false },
      { productId: "blue-crab", gPerServing: 125, optional: false },
      { productId: "panla", gPerServing: 62, optional: true },
    ],
  },
  {
    slug: "pepper-soup",
    name: "Pepper Soup",
    description: "Catfish, plenty of heat, and nothing in the way of it.",
    defaultServes: 4,
    ingredients: [
      { productId: "catfish", gPerServing: 400, optional: false },
      { productId: "brown-shrimps", gPerServing: 60, optional: true },
    ],
  },
  {
    slug: "seafood-pasta",
    name: "Seafood Pasta",
    description: "Prawns and shrimps, quickly. A weeknight dish that does not taste like one.",
    defaultServes: 4,
    ingredients: [
      { productId: "tiger-prawns", gPerServing: 200, optional: false },
      { productId: "brown-shrimps", gPerServing: 100, optional: false },
    ],
  },
  {
    slug: "seafood-boil",
    name: "Seafood Boil",
    description: "For a crowd. One pot, everything in it, newspaper on the table.",
    defaultServes: 6,
    ingredients: [
      { productId: "tiger-prawns", gPerServing: 200, optional: false },
      { productId: "blue-crab", gPerServing: 250, optional: false },
      { productId: "red-snapper", gPerServing: 250, optional: false },
      { productId: "brown-shrimps", gPerServing: 80, optional: true },
    ],
  },
];

export function mealBySlug(slug: string): Meal | undefined {
  return meals.find((m) => m.slug === slug);
}
