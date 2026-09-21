import { describe, expect, it } from "vitest";

import { naira } from "./money";
import { createOrder } from "./orders";
import { planReorder, stateNote, toCartLines } from "./reorder";
import { productMap } from "./seed";
import type { Address } from "./address";
import type { CartLine, Product } from "./types";

const byId = productMap();
const croaker = byId.get("croaker") as Product;
const prawns = byId.get("tiger-prawns") as Product;

const ADDRESS: Address = {
  id: "a1",
  lga: "Eti-Osa",
  area: "Ikoyi",
  zoneId: "island",
  street: "14 Admiralty Way",
  landmark: "Opposite the Total filling station",
  recipientName: "Adaeze Okoro",
  recipientPhone: "+2348034128890",
  instructions: "",
  isDefault: true,
};

function lastWeek(lines: CartLine[]) {
  return createOrder({
    lines,
    productsById: byId,
    phone: "+2348034128890",
    address: ADDRESS,
    zoneId: "island",
    slotDate: "2026-09-15",
    slotWindowLabel: "9 AM – 1 PM",
    at: 1_700_000_000_000,
    random: () => 0.5,
  });
}

const twoKg = () =>
  lastWeek([{ productId: "croaker", prepId: "whole", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo }]);

/** Today's catalog, with one product changed. */
function catalogWith(changes: Partial<Product> & { id: string }): ReadonlyMap<string, Product> {
  const next = new Map(byId);
  const base = byId.get(changes.id) as Product;
  next.set(changes.id, { ...base, ...changes });
  return next;
}

describe("nothing has changed", () => {
  it("reports every line unchanged and the same total", () => {
    const plan = planReorder(twoKg(), byId);

    expect(plan.changed).toBe(false);
    expect(plan.totalKobo).toBe(plan.previousTotalKobo);
    expect(plan.lines[0]?.state).toBe("unchanged");
    expect(stateNote(plan.lines[0] as never)).toBeNull();
  });
});

describe("the price has moved", () => {
  it("says so rather than quietly charging the new one", () => {
    // This is the whole reason reordering is not just "put the lines back".
    const today = catalogWith({ id: "croaker", pricePerKgKobo: naira(11_200) });
    const plan = planReorder(twoKg(), today);

    expect(plan.lines[0]?.state).toBe("price_changed");
    expect(stateNote(plan.lines[0] as never)).toBe("Dearer than last time");
    expect(plan.totalKobo).toBe(naira(22_400));
    expect(plan.previousTotalKobo).toBe(naira(19_600));
    expect(plan.changed).toBe(true);
  });

  it("says when it has moved the customer's way too", () => {
    const today = catalogWith({ id: "croaker", pricePerKgKobo: naira(8000) });
    const plan = planReorder(twoKg(), today);

    expect(stateNote(plan.lines[0] as never)).toBe("Cheaper than last time");
    expect(plan.totalKobo).toBeLessThan(plan.previousTotalKobo);
  });

  it("carries today's price into the basket, not yesterday's", () => {
    const today = catalogWith({ id: "croaker", pricePerKgKobo: naira(11_200) });
    const [line] = toCartLines(planReorder(twoKg(), today));

    // The customer has just been shown the difference. A basket holding the
    // old snapshot would argue with the board it was filled from.
    expect(line?.unitPricePerKgKoboSnapshot).toBe(naira(11_200));
  });
});

describe("there is less of it than there was", () => {
  it("reduces the line to what is there and says so", () => {
    const today = catalogWith({ id: "croaker", stockG: 900 });
    const plan = planReorder(twoKg(), today);

    expect(plan.lines[0]?.state).toBe("reduced");
    expect(plan.lines[0]?.weightG).toBe(750); // snapped to the 250 g step
    expect(stateNote(plan.lines[0] as never)).toBe("Less available than you ordered");
  });

  it("counts what the basket already holds against the stock", () => {
    const plan = planReorder(twoKg(), byId, { remainingG: () => 1000 });

    expect(plan.lines[0]?.weightG).toBe(1000);
    expect(plan.lines[0]?.state).toBe("reduced");
  });
});

describe("it is not on the board", () => {
  it("marks a hidden product unavailable rather than pricing it at zero", () => {
    const today = catalogWith({ id: "croaker", availability: "hidden" });
    const plan = planReorder(twoKg(), today);

    expect(plan.lines[0]?.state).toBe("unavailable");
    expect(plan.lines[0]?.weightG).toBe(0);
    expect(plan.anyAvailable).toBe(false);
  });

  it("marks a sold-out product unavailable", () => {
    const today = catalogWith({ id: "croaker", stockG: 0 });
    expect(planReorder(twoKg(), today).lines[0]?.state).toBe("unavailable");
  });

  it("marks a product that has left the catalog unavailable, not missing", () => {
    // A receipt from last month must still read. The snapshot on the order
    // carries the name and the price, so the line can be shown and refused.
    const plan = planReorder(twoKg(), new Map());

    expect(plan.lines[0]?.productName).toBe("Croaker");
    expect(plan.lines[0]?.state).toBe("unavailable");
  });

  it("leaves unavailable lines out of the basket", () => {
    const today = catalogWith({ id: "croaker", stockG: 0 });
    const order = lastWeek([
      { productId: "croaker", prepId: "whole", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
      { productId: "tiger-prawns", prepId: "shell-on", weightG: 1000, unitPricePerKgKoboSnapshot: prawns.pricePerKgKobo },
    ]);

    const lines = toCartLines(planReorder(order, today));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.productId).toBe("tiger-prawns");
  });
});

describe("preparation surcharges", () => {
  it("are part of the price that is compared", () => {
    const order = lastWeek([
      { productId: "croaker", prepId: "cleaned", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
    ]);

    const plan = planReorder(order, byId);
    const cleaned = croaker.preps.find((p) => p.id === "cleaned");

    expect(plan.lines[0]?.unitPricePerKgKobo).toBe(
      croaker.pricePerKgKobo + (cleaned?.surchargePerKgKobo ?? 0),
    );
    expect(plan.lines[0]?.state).toBe("unchanged");
  });
});
