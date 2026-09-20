import { describe, expect, it } from "vitest";

import {
  EMPTY_CART,
  cartLineCount,
  cartReducer,
  cartWeightG,
  isEmpty,
  lineId,
  parseCart,
  priceCart,
  reconcileWithCatalog,
  remainingStockG,
  serializeCart,
  staleLines,
  toCartLines,
} from "./cart";
import type { CartAction, CartState } from "./cart";
import { naira } from "./money";
import { priceLine } from "./pricing";
import { productMap } from "./seed";
import type { Product } from "./types";

const catalog = productMap();
const croaker = catalog.get("croaker") as Product;
const prawns = catalog.get("tiger-prawns") as Product;

/** Apply a sequence of actions, so tests read like a customer's session. */
function run(actions: readonly CartAction[], start: CartState = EMPTY_CART): CartState {
  return actions.reduce((s, a) => cartReducer(s, a, catalog), start);
}

const add = (productId: string, prepId: string, weightG: number): CartAction => ({
  type: "add",
  productId,
  prepId,
  weightG,
  at: 1_700_000_000_000,
});

describe("adding to the basket", () => {
  it("creates a line and snapshots today's price", () => {
    const state = run([add("croaker", "cleaned", 2000)]);

    expect(cartLineCount(state)).toBe(1);
    expect(state.lines[0]).toMatchObject({
      id: "croaker:cleaned",
      productId: "croaker",
      prepId: "cleaned",
      weightG: 2000,
      unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo,
    });
  });

  it("merges the same product and preparation into one line", () => {
    const state = run([add("croaker", "cleaned", 1000), add("croaker", "cleaned", 500)]);

    expect(cartLineCount(state)).toBe(1);
    expect(state.lines[0]?.weightG).toBe(1500);
  });

  it("keeps different preparations of the same fish apart", () => {
    const state = run([add("croaker", "cleaned", 1000), add("croaker", "filleted", 1000)]);

    expect(cartLineCount(state)).toBe(2);
    expect(state.lines.map((l) => l.id)).toEqual(["croaker:cleaned", "croaker:filleted"]);
  });

  it("snaps the added weight to the product's step", () => {
    const state = run([add("croaker", "whole", 1100)]);
    expect(state.lines[0]?.weightG).toBe(1000);
  });

  it("ignores a product that is not in the catalog", () => {
    const state = run([add("ghost-fish", "whole", 1000)]);
    expect(isEmpty(state)).toBe(true);
  });

  it("keeps the original price snapshot when topping a line up", () => {
    const cheaper: Product = { ...croaker, pricePerKgKobo: naira(9000) };
    const first = cartReducer(EMPTY_CART, add("croaker", "whole", 1000), new Map([["croaker", cheaper]]));
    // the board moves before they add more
    const second = cartReducer(first, add("croaker", "whole", 1000), catalog);

    expect(second.lines[0]?.weightG).toBe(2000);
    expect(second.lines[0]?.unitPricePerKgKoboSnapshot).toBe(naira(9000));
  });
});

describe("aggregate stock", () => {
  it("counts what the basket already holds against what is left", () => {
    // tiger prawns: 6 kg in stock
    const state = run([add("tiger-prawns", "shell-on", 4000)]);
    expect(remainingStockG(state, "tiger-prawns", catalog)).toBe(2000);
  });

  it("stops two lines of the same fish exceeding stock between them", () => {
    // Each line alone would be legal — together they are not.
    const state = run([
      add("tiger-prawns", "shell-on", 5000),
      add("tiger-prawns", "peeled", 5000),
    ]);

    expect(cartWeightG(state)).toBeLessThanOrEqual(prawns.stockG);
    expect(state.lines.find((l) => l.id === "tiger-prawns:peeled")?.weightG).toBe(1000);
  });

  it("does not count a line against its own ceiling", () => {
    const state = run([add("tiger-prawns", "shell-on", 2000)]);
    // this line may grow into the whole 6 kg, not just the 4 kg beside it
    expect(remainingStockG(state, "tiger-prawns", catalog, "tiger-prawns:shell-on")).toBe(6000);
  });

  it("refuses a line when nothing is left", () => {
    const state = run([
      add("tiger-prawns", "shell-on", 6000),
      add("tiger-prawns", "peeled", 1000),
    ]);

    expect(cartLineCount(state)).toBe(1);
    expect(cartWeightG(state)).toBe(6000);
  });
});

describe("changing a line", () => {
  it("sets a weight, snapped and clamped", () => {
    const state = run([
      add("croaker", "whole", 1000),
      { type: "setWeight", id: "croaker:whole", weightG: 2600 },
    ]);
    expect(state.lines[0]?.weightG).toBe(2500);
  });

  it("clamps a small positive weight up to the minimum rather than deleting it", () => {
    const state = run([
      add("croaker", "whole", 2000),
      { type: "setWeight", id: "croaker:whole", weightG: 300 },
    ]);
    expect(state.lines[0]?.weightG).toBe(croaker.minOrderG);
  });

  it("removes the line when the weight goes to nothing", () => {
    const state = run([
      add("croaker", "whole", 1000),
      { type: "setWeight", id: "croaker:whole", weightG: 0 },
    ]);
    expect(isEmpty(state)).toBe(true);
  });

  it("will not let one line grow into another line's stock", () => {
    const state = run([
      add("tiger-prawns", "shell-on", 2000),
      add("tiger-prawns", "peeled", 2000),
      { type: "setWeight", id: "tiger-prawns:shell-on", weightG: 6000 },
    ]);

    expect(state.lines.find((l) => l.id === "tiger-prawns:shell-on")?.weightG).toBe(4000);
    expect(cartWeightG(state)).toBe(6000);
  });

  it("ignores an unknown line", () => {
    const state = run([add("croaker", "whole", 1000), { type: "setWeight", id: "nope", weightG: 5000 }]);
    expect(state.lines[0]?.weightG).toBe(1000);
  });

  it("removes and clears", () => {
    const withTwo = run([add("croaker", "whole", 1000), add("titus", "whole", 1000)]);

    expect(cartLineCount(cartReducer(withTwo, { type: "remove", id: "croaker:whole" }, catalog))).toBe(1);
    expect(isEmpty(cartReducer(withTwo, { type: "clear" }, catalog))).toBe(true);
  });

  it("keeps the chosen delivery zone when the basket is cleared", () => {
    const state = run([
      add("croaker", "whole", 1000),
      { type: "setZone", zoneId: "island" },
      { type: "clear" },
    ]);

    expect(isEmpty(state)).toBe(true);
    expect(state.zoneId).toBe("island");
  });
});

describe("price drift", () => {
  it("accepts today's price only when the customer says so", () => {
    const yesterday: Product = { ...croaker, pricePerKgKobo: naira(9500) };
    let state = cartReducer(EMPTY_CART, add("croaker", "whole", 1000), new Map([["croaker", yesterday]]));
    expect(state.lines[0]?.unitPricePerKgKoboSnapshot).toBe(naira(9500));

    // simply pricing the basket against today's catalog does not move it
    priceCart(state, catalog);
    expect(state.lines[0]?.unitPricePerKgKoboSnapshot).toBe(naira(9500));

    state = cartReducer(state, { type: "acceptPrice", id: "croaker:whole" }, catalog);
    expect(state.lines[0]?.unitPricePerKgKoboSnapshot).toBe(naira(9800));
  });
});

describe("pricing the basket", () => {
  it("agrees with the engine, line for line", () => {
    const state = run([add("croaker", "cleaned", 2500), add("tiger-prawns", "shell-on", 2000)]);
    const totals = priceCart(state, catalog);

    const expected =
      priceLine(croaker, "cleaned", 2500).totalKobo + priceLine(prawns, "shell-on", 2000).totalKobo;

    expect(totals.subtotalKobo).toBe(expected);
    expect(totals.totalWeightG).toBe(4500);
  });

  it("hands the engine exactly what it holds", () => {
    const state = run([add("croaker", "cleaned", 1000)]);
    expect(toCartLines(state)).toEqual([
      {
        productId: "croaker",
        prepId: "cleaned",
        weightG: 1000,
        unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo,
      },
    ]);
  });

  it("prices an empty basket at nothing", () => {
    const totals = priceCart(EMPTY_CART, catalog);
    expect(totals.subtotalKobo).toBe(0);
    expect(totals.totalWeightG).toBe(0);
  });
});

describe("persistence", () => {
  it("round-trips through storage", () => {
    const state = run([add("croaker", "cleaned", 1500), { type: "setZone", zoneId: "lekki-ajah" }]);
    expect(parseCart(serializeCart(state))).toEqual(state);
  });

  it("returns an empty basket rather than throwing on nonsense", () => {
    expect(parseCart(null)).toEqual(EMPTY_CART);
    expect(parseCart("")).toEqual(EMPTY_CART);
    expect(parseCart("{oh no")).toEqual(EMPTY_CART);
    expect(parseCart("null")).toEqual(EMPTY_CART);
    expect(parseCart('"a string"')).toEqual(EMPTY_CART);
    expect(parseCart("[]")).toEqual(EMPTY_CART);
  });

  it("discards a basket written by an older schema", () => {
    expect(parseCart(JSON.stringify({ v: 0, state: { lines: [], zoneId: null } }))).toEqual(EMPTY_CART);
  });

  it("drops individual lines that have been tampered with", () => {
    const raw = JSON.stringify({
      v: 1,
      state: {
        zoneId: null,
        lines: [
          { id: "croaker:whole", productId: "croaker", prepId: "whole", weightG: 1000, unitPricePerKgKoboSnapshot: 980000, addedAt: 1 },
          // a free fish, and a fractional gram
          { id: "croaker:cleaned", productId: "croaker", prepId: "cleaned", weightG: 1000, unitPricePerKgKoboSnapshot: 0, addedAt: 1 },
          { id: "titus:whole", productId: "titus", prepId: "whole", weightG: 12.5, unitPricePerKgKoboSnapshot: 620000, addedAt: 1 },
        ],
      },
    });

    const state = parseCart(raw);
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]?.id).toBe("croaker:whole");
  });
});

describe("reconciling a restored basket with today's catalog", () => {
  it("keeps what is still on sale", () => {
    const state = run([add("croaker", "cleaned", 1500)]);
    expect(reconcileWithCatalog(state, catalog)).toEqual(state);
  });

  it("drops a product that has left the catalog", () => {
    const state = run([add("croaker", "whole", 1000), add("titus", "whole", 1000)]);
    const thinner = new Map(catalog);
    thinner.delete("titus");

    expect(reconcileWithCatalog(state, thinner).lines.map((l) => l.productId)).toEqual(["croaker"]);
  });

  it("drops a product that has been hidden", () => {
    const state = run([add("croaker", "whole", 1000)]);
    const hidden = new Map(catalog);
    hidden.set("croaker", { ...croaker, availability: "hidden" });

    expect(reconcileWithCatalog(state, hidden).lines).toHaveLength(0);
  });

  it("drops a line whose preparation is no longer offered", () => {
    const state = run([add("croaker", "filleted", 1000)]);
    const fewer = new Map(catalog);
    fewer.set("croaker", { ...croaker, preps: croaker.preps.filter((p) => p.id !== "filleted") });

    expect(reconcileWithCatalog(state, fewer).lines).toHaveLength(0);
  });

  it("shrinks a line to the stock that is left", () => {
    const state = run([add("croaker", "whole", 5000)]);
    const short = new Map(catalog);
    short.set("croaker", { ...croaker, stockG: 2000 });

    expect(reconcileWithCatalog(state, short).lines[0]?.weightG).toBe(2000);
  });

  it("shares the remaining stock between lines instead of overselling it", () => {
    const state = run([add("croaker", "whole", 2000), add("croaker", "cleaned", 2000)]);
    const short = new Map(catalog);
    short.set("croaker", { ...croaker, stockG: 3000 });

    const reconciled = reconcileWithCatalog(state, short);
    expect(reconciled.lines.reduce((s, l) => s + l.weightG, 0)).toBeLessThanOrEqual(3000);
  });

  it("keeps the delivery zone", () => {
    const state = run([add("croaker", "whole", 1000), { type: "setZone", zoneId: "outer" }]);
    expect(reconcileWithCatalog(state, catalog).zoneId).toBe("outer");
  });
});

describe("restoring a saved basket", () => {
  it("puts the lines back with their price snapshots intact", () => {
    const yesterday: Product = { ...croaker, pricePerKgKobo: naira(9500) };
    const saved = cartReducer(EMPTY_CART, add("croaker", "whole", 1000), new Map([["croaker", yesterday]]));

    // restored against today's catalog, where croaker is ₦9,800
    const restored = cartReducer(EMPTY_CART, { type: "restore", state: saved }, catalog);

    expect(restored.lines[0]?.unitPricePerKgKoboSnapshot).toBe(naira(9500));
    expect(restored.lines[0]?.weightG).toBe(1000);
  });

  it("reconciles as it restores", () => {
    const saved = run([add("croaker", "whole", 5000), { type: "setZone", zoneId: "island" }]);
    const short = new Map(catalog);
    short.set("croaker", { ...croaker, stockG: 2000 });

    const restored = cartReducer(EMPTY_CART, { type: "restore", state: saved }, short);
    expect(restored.lines[0]?.weightG).toBe(2000);
    expect(restored.zoneId).toBe("island");
  });

  it("survives a saved basket full of products that are gone", () => {
    const saved = run([add("croaker", "whole", 1000)]);
    const restored = cartReducer(EMPTY_CART, { type: "restore", state: saved }, new Map());
    expect(isEmpty(restored)).toBe(true);
  });
});

describe("stale lines", () => {
  it("names the lines that can no longer be fulfilled", () => {
    const state = run([add("croaker", "whole", 1000), add("titus", "whole", 1000)]);
    const short = new Map(catalog);
    short.set("titus", { ...(catalog.get("titus") as Product), stockG: 0 });

    expect(staleLines(state, short).map((l) => l.productId)).toEqual(["titus"]);
  });

  it("finds none in a healthy basket", () => {
    const state = run([add("croaker", "whole", 1000)]);
    expect(staleLines(state, catalog)).toHaveLength(0);
  });
});

describe("line ids", () => {
  it("are derived from the product and preparation, so merging is deterministic", () => {
    expect(lineId("croaker", "cleaned")).toBe("croaker:cleaned");
  });
});
