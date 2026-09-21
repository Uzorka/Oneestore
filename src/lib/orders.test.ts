import { describe, expect, it } from "vitest";

import { naira } from "./money";
import {
  CUSTOMER_STAGES,
  ORDER_FLOW,
  advance,
  canTransition,
  createOrder,
  isTerminal,
  orderId,
  parseOrders,
  serializeOrders,
  stageIndex,
  statusExplanation,
  statusLabel,
} from "./orders";
import { productMap } from "./seed";
import type { Address } from "./address";
import type { Order } from "./orders";
import type { CartLine, OrderStatus, Product } from "./types";

const byId = productMap();
const croaker = byId.get("croaker") as Product;

const ADDRESS: Address = {
  id: "a1",
  lga: "Eti-Osa",
  area: "Ikoyi",
  zoneId: "lekki-ajah",
  street: "14 Admiralty Way, Lekki Phase 1",
  landmark: "Opposite the Total filling station",
  recipientName: "Adaeze Okoro",
  recipientPhone: "+2348034128890",
  instructions: "",
  isDefault: true,
};

function place(lines: CartLine[] = [
  { productId: "croaker", prepId: "whole", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
]): Order {
  let n = 0;
  return createOrder({
    lines,
    productsById: byId,
    phone: "+2348034128890",
    address: ADDRESS,
    zoneId: "lekki-ajah",
    slotDate: "2026-09-21",
    slotWindowLabel: "10 AM – 1 PM",
    at: 1_700_000_000_000,
    random: () => { n += 0.137; return n % 1; },
  });
}

describe("order numbers", () => {
  it("are short, prefixed and readable aloud", () => {
    const id = orderId(() => 0.5);
    expect(id).toMatch(/^ONE-[23456789ACDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  });

  it("leave out the characters people mishear", () => {
    // 0/O, 1/I/L: the pairs that come back wrong when read out over a phone.
    const suffixes = Array.from({ length: 300 }, (_, i) =>
      orderId(() => (i * 0.017) % 1).slice("ONE-".length),
    );

    expect(suffixes.join("")).not.toMatch(/[01OIL]/);
  });
});

describe("createOrder", () => {
  it("places unpaid and settles on delivery", () => {
    const order = place();
    expect(order.status).toBe("pending_payment");
    expect(order.settlement).toBe("on_delivery");
    expect(order.history).toEqual([{ status: "pending_payment", at: 1_700_000_000_000 }]);
  });

  it("snapshots names and prices rather than pointing at the catalog", () => {
    const order = place();
    const line = order.lines[0];

    expect(line?.productName).toBe(croaker.name);
    expect(line?.prepName).toBe("Whole");
    expect(line?.unitPricePerKgKobo).toBe(croaker.pricePerKgKobo);

    // 2 kg of croaker at its listed price, whatever the catalog does later.
    expect(line?.totalKobo).toBe(croaker.pricePerKgKobo * 2);
  });

  it("records the weight the customer will actually be handed", () => {
    const order = place([
      { productId: "croaker", prepId: "filleted", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
    ]);

    // Filleting keeps 52% — the order says so rather than implying 2 kg of fillet.
    expect(order.lines[0]?.weightG).toBe(2000);
    expect(order.lines[0]?.preparedWeightG).toBe(1040);
  });

  it("carries the delivery fee for the zone", () => {
    const order = place();
    expect(order.deliveryKobo).toBe(naira(3500));
    expect(order.totalKobo).toBe(order.subtotalKobo - order.discountKobo + order.deliveryKobo);
  });

  it("applies the volume discount the basket earned", () => {
    const order = place([
      { productId: "croaker", prepId: "whole", weightG: 5000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
    ]);

    expect(order.discountBps).toBe(1000);
    expect(order.discountKobo).toBeGreaterThan(0);
    expect(order.totalKobo).toBe(order.subtotalKobo - order.discountKobo + order.deliveryKobo);
  });
});

describe("the status machine", () => {
  it("lets an unpaid order start being sourced, since it settles on delivery", () => {
    expect(canTransition("pending_payment", "sourcing")).toBe(true);
  });

  it("still allows a gateway to be added without changing anything else", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("paid", "sourcing")).toBe(true);
  });

  it("refuses to skip stages", () => {
    expect(canTransition("sourcing", "delivered")).toBe(false);
    expect(canTransition("pending_payment", "dispatched")).toBe(false);
    expect(canTransition("preparing", "delivered")).toBe(false);
  });

  it("never moves backwards", () => {
    expect(canTransition("dispatched", "packed")).toBe(false);
    expect(canTransition("delivered", "dispatched")).toBe(false);
  });

  it("cannot cancel an order that is already with the rider", () => {
    // Someone is holding the fish. That is a phone call, not a button.
    expect(canTransition("dispatched", "cancelled")).toBe(false);
  });

  it("returns the order untouched on an illegal move rather than throwing", () => {
    const order = place();
    const same = advance(order, "delivered", 1);

    expect(same).toBe(order);
    expect(same.history).toHaveLength(1);
  });

  it("records every legal move in the history", () => {
    let order = place();
    order = advance(order, "sourcing", 2, "Picked at Epe");
    order = advance(order, "quality_checked", 3);

    expect(order.status).toBe("quality_checked");
    expect(order.history).toHaveLength(3);
    expect(order.history[1]).toEqual({ status: "sourcing", at: 2, note: "Picked at Epe" });
  });

  it("ends somewhere", () => {
    expect(isTerminal("refunded")).toBe(true);
    expect(isTerminal("delivered")).toBe(false); // a delivery can still be refunded
    expect(isTerminal("sourcing")).toBe(false);
  });

  it("can reach delivered from placed by legal moves alone", () => {
    let order = place();
    for (const step of ["sourcing", "quality_checked", "preparing", "packed", "dispatched", "delivered"] as const) {
      order = advance(order, step, 1);
    }
    expect(order.status).toBe("delivered");
  });

  it("gives every status a label and an explanation", () => {
    for (const status of Object.keys(ORDER_FLOW) as OrderStatus[]) {
      expect(statusLabel(status).length).toBeGreaterThan(0);
      expect(statusExplanation(status).length).toBeGreaterThan(0);
    }
  });
});

describe("what the customer is shown", () => {
  it("maps the stages we run but do not display onto the ones we do", () => {
    expect(stageIndex("paid")).toBe(stageIndex("pending_payment"));
    expect(stageIndex("quality_checked")).toBe(stageIndex("sourcing"));
    expect(stageIndex("packed")).toBe(stageIndex("preparing"));
  });

  it("treats an exception as not-progress rather than as a stage", () => {
    expect(stageIndex("cancelled")).toBe(-1);
    expect(stageIndex("on_hold")).toBe(-1);
    expect(stageIndex("refunded")).toBe(-1);
  });

  it("only advances through the shown stages", () => {
    const seen = CUSTOMER_STAGES.map(stageIndex);
    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("persistence", () => {
  it("round-trips", () => {
    const order = place();
    expect(parseOrders(serializeOrders([order]))).toEqual([order]);
  });

  it("survives junk without taking the account page down", () => {
    expect(parseOrders(null)).toEqual([]);
    expect(parseOrders("not json")).toEqual([]);
    expect(parseOrders("{}")).toEqual([]);
    expect(parseOrders(JSON.stringify({ v: 99, orders: [] }))).toEqual([]);
  });

  it("drops entries that are not orders and keeps the ones that are", () => {
    const order = place();
    const raw = JSON.stringify({ v: 1, orders: [order, { id: "nope" }, null, 7] });

    expect(parseOrders(raw)).toEqual([order]);
  });

  it("drops an order carrying a status the machine does not know", () => {
    const order = { ...place(), status: "teleported" };
    expect(parseOrders(JSON.stringify({ v: 1, orders: [order] }))).toEqual([]);
  });
});
