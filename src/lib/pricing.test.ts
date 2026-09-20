import { describe, expect, it } from "vitest";

import { formatNaira, formatPerKg, formatWeight, naira, priceForWeight } from "./money";
import {
  BOX_TIERS,
  TOLERANCE_BPS,
  approximatePieces,
  boxDiscountBps,
  isPurchasable,
  isWithinTolerance,
  mealQuantities,
  normalizeWeight,
  priceBasket,
  priceBox,
  priceDrift,
  priceLine,
  reconcileLine,
  reconcileOrder,
  toleranceBand,
} from "./pricing";
import { PREPS, productMap, products } from "./seed";
import type { CartLine, Product } from "./types";

const byId = productMap();
const croaker = byId.get("croaker") as Product;
const prawns = byId.get("tiger-prawns") as Product;

describe("money", () => {
  it("converts naira to kobo as integers", () => {
    expect(naira(9800)).toBe(980_000);
    expect(naira(0.5)).toBe(50);
  });

  it("prices a weight by rounding once, half-up", () => {
    // ₦9,800/kg × 1.5 kg = ₦14,700
    expect(priceForWeight(980_000, 1500)).toBe(1_470_000);
    // a weight that does not divide cleanly still lands on a whole kobo
    expect(priceForWeight(980_000, 333)).toBe(Math.round((980_000 * 333) / 1000));
    expect(Number.isInteger(priceForWeight(1_234_567, 777))).toBe(true);
  });

  it("hides kobo on whole naira and shows it otherwise", () => {
    expect(formatNaira(980_000)).toBe("₦9,800");
    expect(formatNaira(980_050)).toBe("₦9,800.50");
    expect(formatNaira(980_005)).toBe("₦9,800.05");
    expect(formatNaira(0)).toBe("₦0");
    expect(formatNaira(-250_000)).toBe("−₦2,500");
    expect(formatPerKg(980_000)).toBe("₦9,800/kg");
  });

  it("formats grams the way people say them", () => {
    expect(formatWeight(500)).toBe("500 g");
    expect(formatWeight(1000)).toBe("1 kg");
    expect(formatWeight(1500)).toBe("1.5 kg");
    expect(formatWeight(1250)).toBe("1.25 kg");
    expect(formatWeight(2000)).toBe("2 kg");
  });
});

describe("normalizeWeight", () => {
  it("snaps to the product step", () => {
    // croaker steps in 250 g
    expect(normalizeWeight(croaker, 1100)).toBe(1000);
    expect(normalizeWeight(croaker, 1200)).toBe(1250);
    expect(normalizeWeight(croaker, 1375)).toBe(1500);
  });

  it("never goes below the minimum order", () => {
    expect(normalizeWeight(croaker, 1)).toBe(croaker.minOrderG);
    expect(normalizeWeight(croaker, 0)).toBe(croaker.minOrderG);
  });

  it("never exceeds sellable stock", () => {
    const thin: Product = { ...croaker, stockG: 1600, stepG: 500, minOrderG: 500 };
    // 1600 g of stock at a 500 g step is 1500 g we can actually sell
    expect(normalizeWeight(thin, 5000)).toBe(1500);
  });

  it("returns 0 when stock cannot cover the minimum order", () => {
    const empty: Product = { ...croaker, stockG: 100, minOrderG: 500, stepG: 500 };
    expect(normalizeWeight(empty, 500)).toBe(0);
    expect(isPurchasable(empty)).toBe(false);
  });

  it("treats hidden products as not purchasable even with stock", () => {
    expect(isPurchasable({ ...croaker, availability: "hidden" })).toBe(false);
    expect(isPurchasable(croaker)).toBe(true);
  });
});

describe("priceLine", () => {
  it("adds the preparation surcharge per kilogram, not per line", () => {
    const whole = priceLine(croaker, "whole", 2000);
    const cleaned = priceLine(croaker, "cleaned", 2000);

    // cleaning is +₦500/kg, so 2 kg costs ₦1,000 more — not ₦500
    expect(cleaned.totalKobo - whole.totalKobo).toBe(naira(1000));
    expect(cleaned.prepKobo).toBe(naira(1000));
    expect(cleaned.unitPricePerKgKobo).toBe(croaker.pricePerKgKobo + naira(500));
  });

  it("reports goods and preparation that add up to the total exactly", () => {
    for (const grams of [500, 750, 1000, 1250, 3333, 7000]) {
      const line = priceLine(croaker, "filleted", grams);
      expect(line.goodsKobo + line.prepKobo).toBe(line.totalKobo);
      expect(Number.isInteger(line.totalKobo)).toBe(true);
    }
  });

  it("estimates the weight left after preparation", () => {
    expect(priceLine(croaker, "whole", 2000).preparedWeightG).toBe(2000);
    // filleting yields 52%
    expect(priceLine(croaker, "filleted", 2000).preparedWeightG).toBe(1040);
    expect(priceLine(croaker, "cleaned", 1000).preparedWeightG).toBe(880);
  });

  it("prices the weight it actually normalized, not the one requested", () => {
    const line = priceLine(croaker, "whole", 1100);
    expect(line.weightG).toBe(1000);
    expect(line.totalKobo).toBe(priceForWeight(croaker.pricePerKgKobo, 1000));
  });

  it("refuses an unknown preparation rather than guessing", () => {
    expect(() => priceLine(croaker, "smoked-over-firewood", 1000)).toThrow(/Unknown preparation/);
  });

  it("matches the figures used in the design", () => {
    // 2.5 kg croaker, cleaned: ₦9,800 + ₦500 = ₦10,300/kg → ₦25,750
    const line = priceLine(croaker, "cleaned", 2500);
    expect(line.unitPricePerKgKobo).toBe(naira(10_300));
    expect(line.totalKobo).toBe(naira(25_750));
  });
});

describe("priceBasket", () => {
  const lines: CartLine[] = [
    { productId: "croaker", prepId: "cleaned", weightG: 2500, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
    { productId: "tiger-prawns", prepId: "whole", weightG: 2000, unitPricePerKgKoboSnapshot: prawns.pricePerKgKobo },
    { productId: "catfish", prepId: "steak-cut", weightG: 2000, unitPricePerKgKoboSnapshot: naira(5400) },
  ];

  it("sums weight and money without drift", () => {
    const totals = priceBasket(lines, byId);
    expect(totals.totalWeightG).toBe(6500);
    expect(totals.goodsKobo + totals.prepKobo).toBe(totals.subtotalKobo);
    expect(Number.isInteger(totals.subtotalKobo)).toBe(true);
  });

  it("reconciles with the design's basket: ₦72,300 goods + ₦2,650 preparation", () => {
    const totals = priceBasket(lines, byId);
    expect(totals.goodsKobo).toBe(naira(72_300));
    expect(totals.prepKobo).toBe(naira(2650));
    expect(totals.subtotalKobo).toBe(naira(74_950));
  });

  it("skips lines whose product has gone away instead of throwing", () => {
    const totals = priceBasket(
      [...lines, { productId: "ghost-fish", prepId: "whole", weightG: 1000, unitPricePerKgKoboSnapshot: 1 }],
      byId,
    );
    expect(totals.lines).toHaveLength(3);
  });

  it("stays exact across a large basket", () => {
    const many: CartLine[] = Array.from({ length: 200 }, () => ({
      productId: "croaker",
      prepId: "filleted",
      weightG: 1250,
      unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo,
    }));
    const totals = priceBasket(many, byId);
    const one = priceLine(croaker, "filleted", 1250);
    expect(totals.subtotalKobo).toBe(one.totalKobo * 200);
  });
});

describe("priceDrift", () => {
  it("notices when the morning board moved under a basket", () => {
    const line: CartLine = {
      productId: "croaker",
      prepId: "whole",
      weightG: 1000,
      unitPricePerKgKoboSnapshot: naira(9500),
    };
    const drift = priceDrift(line, croaker);
    expect(drift.changed).toBe(true);
    expect(drift.fromKobo).toBe(naira(9500));
    expect(drift.toKobo).toBe(naira(9800));
  });

  it("is quiet when the price held", () => {
    const line: CartLine = {
      productId: "croaker",
      prepId: "whole",
      weightG: 1000,
      unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo,
    };
    expect(priceDrift(line, croaker).changed).toBe(false);
  });
});

describe("tolerance", () => {
  it("is ±8%", () => {
    expect(TOLERANCE_BPS).toBe(800);
    const band = toleranceBand(2500);
    expect(band.minG).toBe(2300);
    expect(band.maxG).toBe(2700);
  });

  it("accepts the edges of the band and rejects just outside", () => {
    expect(isWithinTolerance(2500, 2300)).toBe(true);
    expect(isWithinTolerance(2500, 2700)).toBe(true);
    expect(isWithinTolerance(2500, 2299)).toBe(false);
    expect(isWithinTolerance(2500, 2701)).toBe(false);
  });
});

describe("reconcileLine", () => {
  const unit = naira(10_300); // croaker, cleaned

  it("credits the wallet when we packed under", () => {
    const charged = priceForWeight(unit, 2500);
    const r = reconcileLine({ orderedG: 2500, actualG: 2460, unitPricePerKgKobo: unit, chargedKobo: charged });

    expect(r.walletCreditKobo).toBe(priceForWeight(unit, 40));
    expect(r.absorbedKobo).toBe(0);
    expect(r.withinTolerance).toBe(true);
    expect(r.needsOverride).toBe(false);
  });

  it("absorbs the difference when we packed over, and never charges more", () => {
    const charged = priceForWeight(unit, 2500);
    const r = reconcileLine({ orderedG: 2500, actualG: 2600, unitPricePerKgKobo: unit, chargedKobo: charged });

    expect(r.walletCreditKobo).toBe(0);
    expect(r.absorbedKobo).toBe(priceForWeight(unit, 100));
    // the authorised amount is the ceiling, always
    expect(r.chargedKobo).toBe(charged);
  });

  it("settles to nothing when the weight is exact", () => {
    const charged = priceForWeight(unit, 2500);
    const r = reconcileLine({ orderedG: 2500, actualG: 2500, unitPricePerKgKobo: unit, chargedKobo: charged });
    expect(r.walletCreditKobo).toBe(0);
    expect(r.absorbedKobo).toBe(0);
  });

  it("demands a supervisor override outside the band", () => {
    const charged = priceForWeight(unit, 2500);
    expect(
      reconcileLine({ orderedG: 2500, actualG: 2000, unitPricePerKgKobo: unit, chargedKobo: charged }).needsOverride,
    ).toBe(true);
    expect(
      reconcileLine({ orderedG: 2500, actualG: 3000, unitPricePerKgKobo: unit, chargedKobo: charged }).needsOverride,
    ).toBe(true);
  });

  it("matches the design's order: 6.5 kg ordered, 6.38 kg packed, ₦1,644 back", () => {
    const parts = [
      { ordered: 2500, actual: 2460, unit: naira(10_300) }, // croaker, cleaned
      { ordered: 2000, actual: 1940, unit: naira(18_500) }, // tiger prawns
      { ordered: 2000, actual: 1980, unit: naira(6100) }, // catfish, steak cut
    ];

    const reconciled = parts.map((p) =>
      reconcileLine({
        orderedG: p.ordered,
        actualG: p.actual,
        unitPricePerKgKobo: p.unit,
        chargedKobo: priceForWeight(p.unit, p.ordered),
      }),
    );

    const order = reconcileOrder(reconciled);
    expect(order.walletCreditKobo).toBe(naira(1644));
    expect(order.absorbedKobo).toBe(0);
    expect(order.needsOverride).toBe(false);
  });

  it("nets credits and absorptions separately across an order", () => {
    const unitA = naira(10_000);
    const order = reconcileOrder([
      reconcileLine({ orderedG: 1000, actualG: 950, unitPricePerKgKobo: unitA, chargedKobo: naira(10_000) }),
      reconcileLine({ orderedG: 1000, actualG: 1050, unitPricePerKgKobo: unitA, chargedKobo: naira(10_000) }),
    ]);

    // they do not cancel out — the customer gets their credit, we eat the overage
    expect(order.walletCreditKobo).toBe(naira(500));
    expect(order.absorbedKobo).toBe(naira(500));
  });
});

describe("Build Your Box", () => {
  it("earns a discount at each tier boundary and not a gram before", () => {
    expect(boxDiscountBps(2999)).toBe(0);
    expect(boxDiscountBps(3000)).toBe(500);
    expect(boxDiscountBps(4999)).toBe(500);
    expect(boxDiscountBps(5000)).toBe(1000);
    expect(boxDiscountBps(20_000)).toBe(1000);
  });

  it("declares its tiers heaviest first, so lookup finds the best one", () => {
    const mins = BOX_TIERS.map((t) => t.minG);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
  });

  it("rounds the discount down so a box never undercuts its parts", () => {
    const lines: CartLine[] = [
      { productId: "croaker", prepId: "whole", weightG: 3250, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
    ];
    const box = priceBox(lines, byId);
    expect(box.discountBps).toBe(500);
    expect(box.discountKobo).toBe(Math.floor((box.grossKobo * 500) / 10000));
    expect(box.netKobo).toBe(box.grossKobo - box.discountKobo);
  });

  it("says how much more reaches the next tier", () => {
    const light = priceBox(
      [{ productId: "croaker", prepId: "whole", weightG: 1000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo }],
      byId,
    );
    expect(light.gToNextTierG).toBe(2000);
    expect(light.nextTierDiscountBps).toBe(500);

    const mid = priceBox(
      [{ productId: "croaker", prepId: "whole", weightG: 3500, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo }],
      byId,
    );
    expect(mid.gToNextTierG).toBe(1500);
    expect(mid.nextTierDiscountBps).toBe(1000);
  });

  it("has no next tier once the top one is reached", () => {
    const heavy = priceBox(
      [{ productId: "croaker", prepId: "whole", weightG: 6000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo }],
      byId,
    );
    expect(heavy.gToNextTierG).toBeNull();
    expect(heavy.nextTierDiscountBps).toBeNull();
    expect(heavy.discountBps).toBe(1000);
  });

  it("is free and empty with nothing in it", () => {
    const empty = priceBox([], byId);
    expect(empty.totalWeightG).toBe(0);
    expect(empty.netKobo).toBe(0);
    expect(empty.discountKobo).toBe(0);
  });
});

describe("Shop by Meal", () => {
  const ingredients = [
    { productId: "croaker", gPerServing: 375, optional: false },
    { productId: "tiger-prawns", gPerServing: 125, optional: false },
    { productId: "blue-crab", gPerServing: 125, optional: false },
    { productId: "panla", gPerServing: 62, optional: true },
  ];

  it("scales with servings and snaps to each product's step", () => {
    const four = mealQuantities(ingredients, 4, byId);
    const croakerLine = four.find((i) => i.productId === "croaker");
    expect(croakerLine?.weightG).toBe(1500);

    const eight = mealQuantities(ingredients, 8, byId);
    expect(eight.find((i) => i.productId === "croaker")?.weightG).toBe(3000);
  });

  it("can leave the optional ingredients out", () => {
    const required = mealQuantities(ingredients, 4, byId, { includeOptional: false });
    expect(required.some((i) => i.productId === "panla")).toBe(false);
    expect(required).toHaveLength(3);
  });

  it("prices the required set of Seafood Okra for four at ₦28,150", () => {
    const required = mealQuantities(ingredients, 4, byId, { includeOptional: false });
    const lines: CartLine[] = required.map((i) => ({
      productId: i.productId,
      prepId: "whole",
      weightG: i.weightG,
      unitPricePerKgKoboSnapshot: (byId.get(i.productId) as Product).pricePerKgKobo,
    }));

    expect(priceBasket(lines, byId).subtotalKobo).toBe(naira(28_150));
  });

  it("never asks for less than one serving", () => {
    const zero = mealQuantities(ingredients, 0, byId);
    const one = mealQuantities(ingredients, 1, byId);
    expect(zero).toEqual(one);
  });
});

describe("seed catalog", () => {
  it("is internally consistent", () => {
    for (const p of products) {
      expect(p.pricePerKgKobo, `${p.slug} price`).toBeGreaterThan(0);
      expect(Number.isInteger(p.pricePerKgKobo), `${p.slug} price is integer kobo`).toBe(true);
      expect(p.stepG, `${p.slug} step`).toBeGreaterThan(0);
      expect(p.minOrderG % p.stepG, `${p.slug} minimum is a whole number of steps`).toBe(0);
      expect(p.preps.length, `${p.slug} has preparations`).toBeGreaterThan(0);
    }
  });

  it("has unique slugs", () => {
    const slugs = products.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every preparation a plausible yield", () => {
    for (const prep of Object.values(PREPS)) {
      expect(prep.yieldBps).toBeGreaterThan(0);
      expect(prep.yieldBps).toBeLessThanOrEqual(10000);
      expect(prep.surchargePerKgKobo).toBeGreaterThanOrEqual(0);
    }
  });

  it("counts pieces only where a unit weight is known", () => {
    expect(approximatePieces(croaker, 2200)).toBe(2);
    expect(approximatePieces({ ...croaker, unitWeightG: null }, 2200)).toBeNull();
  });
});
