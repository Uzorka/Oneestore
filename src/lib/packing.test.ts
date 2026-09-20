import { describe, expect, it } from "vitest";

import { naira } from "./money";
import { createOrder } from "./orders";
import {
  chargedForLine,
  lineKey,
  overrideReason,
  packingState,
  packingSummary,
  recordPackedWeight,
  valueOfPackedWeight,
} from "./packing";
import { productMap } from "./seed";
import type { Address } from "./address";
import type { Order } from "./orders";
import type { CartLine, Product } from "./types";

const byId = productMap();
const croaker = byId.get("croaker") as Product;
const prawns = byId.get("tiger-prawns") as Product;

const ADDRESS: Address = {
  id: "a1",
  zoneId: "island",
  street: "14 Admiralty Way",
  landmark: "Opposite the Total filling station",
  recipientName: "Adaeze Okoro",
  recipientPhone: "+2348034128890",
  instructions: "",
  isDefault: true,
};

function order(lines: CartLine[]): Order {
  return createOrder({
    lines,
    productsById: byId,
    phone: "+2348034128890",
    address: ADDRESS,
    zoneId: "island",
    slotDate: "2026-09-22",
    slotWindowLabel: "9 AM – 1 PM",
    at: 1_700_000_000_000,
    random: () => 0.5,
  });
}

const twoKgCroaker = (): Order =>
  order([{ productId: "croaker", prepId: "whole", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo }]);

describe("recording weights", () => {
  it("starts with nothing on the scale, not with zero", () => {
    const o = twoKgCroaker();
    const [state] = packingState(o);

    expect(state?.actualG).toBeNull();
    expect(state?.reconciliation).toBeNull();
    expect(packingSummary(o).weighed).toBe(0);
    expect(packingSummary(o).complete).toBe(false);
  });

  it("keeps a weight the packer typed even when it is obviously wrong", () => {
    // 5 kg against a 2 kg order is a mistake worth seeing, not one worth
    // silently clamping — clamping hides it and changes what we think we sent.
    const o = recordPackedWeight(twoKgCroaker(), "croaker:whole", 5000);
    expect(packingState(o)[0]?.actualG).toBe(5000);
    expect(packingState(o)[0]?.withinTolerance).toBe(false);
  });

  it("can take a reading back off", () => {
    let o = recordPackedWeight(twoKgCroaker(), "croaker:whole", 1950);
    o = recordPackedWeight(o, "croaker:whole", null);

    expect(packingState(o)[0]?.actualG).toBeNull();
    expect(packingSummary(o).weighed).toBe(0);
  });

  it("never records a negative weight", () => {
    const o = recordPackedWeight(twoKgCroaker(), "croaker:whole", -500);
    expect(packingState(o)[0]?.actualG).toBe(0);
  });
});

describe("settlement", () => {
  it("credits a wallet when we pack under", () => {
    // 2 kg ordered at N9,800/kg = N19,600. Packed 1.9 kg = N18,620.
    const o = recordPackedWeight(twoKgCroaker(), "croaker:whole", 1900);
    const summary = packingSummary(o);

    expect(summary.walletCreditKobo).toBe(naira(980));
    expect(summary.absorbedKobo).toBe(0);
    expect(summary.goodsKobo).toBe(naira(18_620));
  });

  it("absorbs an overpack rather than charging for it", () => {
    const o = recordPackedWeight(twoKgCroaker(), "croaker:whole", 2100);
    const summary = packingSummary(o);

    expect(summary.absorbedKobo).toBe(naira(980));
    expect(summary.walletCreditKobo).toBe(0);

    // The customer still pays exactly what they authorised, not a kobo more.
    expect(summary.goodsKobo).toBe(naira(19_600));
  });

  it("never lets the total exceed what was authorised, however it was packed", () => {
    const authorised = twoKgCroaker().totalKobo;

    for (const actualG of [1500, 1900, 2000, 2100, 2500, 9000]) {
      const o = recordPackedWeight(twoKgCroaker(), "croaker:whole", actualG);
      expect(packingSummary(o).totalKobo).toBeLessThanOrEqual(authorised);
    }
  });

  it("leaves lines that are not yet weighed standing at what was ordered", () => {
    const o = order([
      { productId: "croaker", prepId: "whole", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
      { productId: "tiger-prawns", prepId: "shell-on", weightG: 1000, unitPricePerKgKoboSnapshot: prawns.pricePerKgKobo },
    ]);

    // 3 kg between them, so the basket earned the 5% tier and every figure
    // below is net of it — including what the underpack gives back.
    expect(o.discountBps).toBe(500);

    const half = recordPackedWeight(o, "croaker:whole", 1900);
    const summary = packingSummary(half);

    expect(summary.weighed).toBe(1);
    expect(summary.complete).toBe(false);

    // Croaker: N19,600 less 5% = N18,620 charged, packed 1.9 kg = N17,689,
    // so N931 goes back. Prawns: not yet weighed, standing at N17,575.
    expect(summary.walletCreditKobo).toBe(naira(931));
    expect(summary.goodsKobo).toBe(naira(17_575) + naira(18_620) - naira(931));
  });

  it("measures a discounted line against the rate it was charged at", () => {
    // 5 kg earns the 10% tier. Packed exactly to weight, nothing is owed
    // either way — the discount must not read as an overpack we absorbed.
    const o = recordPackedWeight(
      order([{ productId: "croaker", prepId: "whole", weightG: 5000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo }]),
      "croaker:whole",
      5000,
    );

    const summary = packingSummary(o);
    expect(summary.walletCreditKobo).toBe(0);
    expect(summary.absorbedKobo).toBe(0);
  });

  it("is complete only when every line has been on the scale", () => {
    const o = order([
      { productId: "croaker", prepId: "whole", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
      { productId: "tiger-prawns", prepId: "shell-on", weightG: 1000, unitPricePerKgKoboSnapshot: prawns.pricePerKgKobo },
    ]);

    let packed = recordPackedWeight(o, "croaker:whole", 2000);
    expect(packingSummary(packed).complete).toBe(false);

    packed = recordPackedWeight(packed, "tiger-prawns:shell-on", 1000);
    expect(packingSummary(packed).complete).toBe(true);
  });
});

describe("the tolerance band", () => {
  it("passes a weight inside ±8% without a supervisor", () => {
    const o = recordPackedWeight(twoKgCroaker(), "croaker:whole", 1850);
    expect(packingSummary(o).needsOverride).toBe(false);
    expect(overrideReason(o.lines[0] as never, 1850)).toBeNull();
  });

  it("stops a weight more than 8% under", () => {
    const o = recordPackedWeight(twoKgCroaker(), "croaker:whole", 1800);
    expect(packingSummary(o).needsOverride).toBe(true);
    expect(overrideReason(o.lines[0] as never, 1800)).toContain("under");
  });

  it("stops a weight more than 8% over, and says who pays for it", () => {
    const o = recordPackedWeight(twoKgCroaker(), "croaker:whole", 2200);
    expect(packingSummary(o).needsOverride).toBe(true);
    expect(overrideReason(o.lines[0] as never, 2200)).toContain("not charged");
  });

  it("reports the band the packer has to hit", () => {
    const [state] = packingState(twoKgCroaker());
    expect(state?.band).toEqual({ minG: 1840, maxG: 2160 });
  });
});

describe("live figures while weighing", () => {
  it("values a reading at the rate the line was charged at", () => {
    const o = twoKgCroaker();
    const line = o.lines[0] as never;

    expect(valueOfPackedWeight(line, 1900, 0)).toBe(naira(18_620));
    expect(valueOfPackedWeight(line, 1900, 1000)).toBe(naira(16_758));
  });

  it("charges a line net of its share of the basket discount", () => {
    const o = order([
      { productId: "croaker", prepId: "whole", weightG: 5000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
    ]);

    expect(o.discountBps).toBe(1000);
    expect(chargedForLine(o.lines[0] as never, o.discountBps)).toBe(naira(44_100));
  });

  it("keys lines the way the cart does", () => {
    expect(lineKey({ productId: "croaker", prepId: "filleted" })).toBe("croaker:filleted");
  });
});
