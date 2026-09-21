import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { raise, refund } from "./complaints";
import { naira } from "./money";
import { createOrder } from "./orders";
import {
  complaintToRow,
  orderLineToRow,
  orderToRow,
  rowToComplaint,
  rowToWalletEntry,
  toKobo,
  walletEntryToRow,
} from "./rows";
import { productMap } from "./seed";
import { credit } from "./wallet";
import type { Address } from "./address";
import type { CartLine, Product } from "./types";

/**
 * The mappers, through the real schema.
 *
 * A mapper tested against a hand-written object proves only that the author
 * was consistent with themselves. These write through the actual migration and
 * read back, so a column that does not exist, a constraint that rejects the
 * value, or a bigint arriving as a string all fail here rather than in Lagos.
 */

const PRELUDE = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated; create role service_role;
`;

const CUSTOMER = "33333333-3333-3333-3333-333333333333";
const PRODUCT = "44444444-4444-4444-4444-444444444444";

let db: PGlite;

const byId = productMap();
const croaker = byId.get("croaker") as Product;

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

function order(lines: CartLine[] = [
  { productId: "croaker", prepId: "whole", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
]) {
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

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(PRELUDE);

  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }

  await db.exec(`
    insert into customers (id, phone) values ('${CUSTOMER}', '+2348034128890');
    insert into delivery_zones (id, name, fee_kobo) values ('island', 'Lagos Island', 250000);
    insert into categories (slug, name) values ('fresh-fish', 'Fresh Fish');
    insert into products (id, slug, name, category_slug, price_per_kg_kobo, min_order_g, step_g)
      values ('44444444-4444-4444-4444-444444444444', 'croaker', 'Croaker', 'fresh-fish', 980000, 500, 250);
  `);
}, 60_000);

/** Insert a mapped row and hand back what the database stored. */
async function insert(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const keys = Object.keys(row);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

  const { rows } = await db.query<Record<string, unknown>>(
    `insert into ${table} (${keys.join(", ")}) values (${placeholders}) returning *`,
    keys.map((k) => row[k]),
  );

  return rows[0] as Record<string, unknown>;
}

describe("bigint money", () => {
  it("survives arriving as a string, which is how Postgres sends it", async () => {
    const saved = await insert("orders", orderToRow(order()));

    // The trap: "1960000" * 1 works in a test and concatenates in production.
    expect(toKobo(saved.total_kobo)).toBe(order().totalKobo);
    expect(typeof toKobo(saved.total_kobo)).toBe("number");
  });

  it("reads a plain number and a numeric string the same way", () => {
    expect(toKobo(1_960_000)).toBe(1_960_000);
    expect(toKobo("1960000")).toBe(1_960_000);
    expect(toKobo(null)).toBe(0);
    expect(toKobo("")).toBe(0);
  });
});

describe("an order", () => {
  it("writes through every column the schema actually has", async () => {
    const o = order();
    const saved = await insert("orders", { ...orderToRow(o), code: "ONE-ORD001", customer_id: CUSTOMER });

    expect(saved.code).toBe("ONE-ORD001");
    expect(saved.status).toBe("pending_payment");
    expect(toKobo(saved.delivery_kobo)).toBe(naira(2500));
    expect(saved.payment_method).toBe("on_delivery");
    expect(saved.delivery_window).toBe("9 AM – 1 PM");
  });

  it("keeps the discount rate that was authorised, not just the amount", async () => {
    const o = order([
      { productId: "croaker", prepId: "whole", weightG: 5000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
    ]);

    const saved = await insert("orders", { ...orderToRow(o), code: "ONE-ORD002", customer_id: CUSTOMER });

    // Without the rate, a line packed exactly to weight reconciles against the
    // undiscounted value and reads as money the shop absorbed.
    expect(saved.discount_bps).toBe(1000);
    expect(toKobo(saved.discount_kobo)).toBe(o.discountKobo);
  });

  it("writes its lines", async () => {
    const o = order();
    const saved = await insert("orders", { ...orderToRow(o), code: "ONE-ORD003", customer_id: CUSTOMER });

    const line = await insert(
      "order_items",
      orderLineToRow(o.lines[0] as never, saved.id as string, PRODUCT, null),
    );

    expect(line.product_name).toBe("Croaker");
    expect(line.ordered_g).toBe(2000);
    expect(toKobo(line.unit_price_per_kg_kobo)).toBe(croaker.pricePerKgKobo);
    // Nothing has been on the scale yet, and that is not the same as zero.
    expect(line.actual_g).toBeNull();
  });
});

describe("the link to the catalog", () => {
  it("refuses a line pointing at a product that does not exist", async () => {
    const o = order();
    const saved = await insert("orders", { ...orderToRow(o), code: "ONE-ORD004", customer_id: CUSTOMER });

    // The snapshot keeps the name and the price so a delisted product cannot
    // blank a receipt — but the line still has to point at a real product.
    await expect(
      insert(
        "order_items",
        orderLineToRow(o.lines[0] as never, saved.id as string, "55555555-5555-5555-5555-555555555555", null),
      ),
    ).rejects.toThrow();
  });
});

describe("a wallet entry", () => {
  it("round-trips through the ledger", async () => {
    const [entry] = credit([], {
      amountKobo: naira(980),
      reason: "short_weight",
      orderId: "ONE-WAL01",
      note: "Packed under",
      at: 1_700_000_000_000,
    });

    const saved = await insert("wallet_ledger", walletEntryToRow(entry as never, CUSTOMER));
    const back = rowToWalletEntry(saved);

    expect(back.amountKobo).toBe(naira(980));
    expect(back.reason).toBe("short_weight");
    expect(back.at).toBe(1_700_000_000_000);
  });

  it("is refused by the database if the code ever invents a reason", async () => {
    const [entry] = credit([], {
      amountKobo: naira(100),
      reason: "goodwill",
      orderId: null,
      note: "x",
      at: 1,
    });

    const row = { ...walletEntryToRow(entry as never, CUSTOMER), reason: "vibes" };
    await expect(insert("wallet_ledger", row)).rejects.toThrow();
  });
});

describe("a complaint", () => {
  it("round-trips, window and all", async () => {
    const o = order();
    const saved = await insert("orders", { ...orderToRow(o), code: "ONE-CMP99", customer_id: CUSTOMER });

    const complaint = raise({
      orderId: "ONE-CMP99",
      deliveredAt: 1_700_000_000_000,
      kind: "not_fresh",
      detail: "The snapper smells off.",
      at: 1_700_000_000_000 + 13 * 60_000,
    });

    const row = await insert("complaints", complaintToRow(complaint, saved.id as string, CUSTOMER));
    const back = rowToComplaint(row, "ONE-CMP99");

    expect(back.kind).toBe("not_fresh");
    expect(back.withinWindow).toBe(true);
    expect(back.status).toBe("open");
    expect(back.detail).toBe("The snapper smells off.");
    expect(back.resolvedAt).toBeNull();
  });

  it("carries a refund and the words the customer reads", async () => {
    const o = order();
    const saved = await insert("orders", { ...orderToRow(o), code: "ONE-CMP98", customer_id: CUSTOMER });

    const settled = refund(
      raise({
        orderId: "ONE-CMP98",
        deliveredAt: 1_700_000_000_000,
        kind: "wrong_weight",
        detail: "Short",
        at: 1_700_000_000_000 + 60_000,
      }),
      naira(1250),
      1_700_000_000_000 + 120_000,
      "Photo confirms it.",
    );

    const row = await insert("complaints", complaintToRow(settled, saved.id as string, CUSTOMER));
    const back = rowToComplaint(row, "ONE-CMP98");

    expect(back.status).toBe("refunded");
    expect(back.refundedKobo).toBe(naira(1250));
    expect(back.resolutionNote).toBe("Photo confirms it.");
    expect(back.resolvedAt).not.toBeNull();
  });

  it("cannot be stored twice against one order", async () => {
    const o = order();
    const saved = await insert("orders", { ...orderToRow(o), code: "ONE-CMP97", customer_id: CUSTOMER });

    const complaint = raise({
      orderId: "ONE-CMP97",
      deliveredAt: 1_700_000_000_000,
      kind: "late",
      detail: "Too late to cook",
      at: 1_700_000_000_000 + 60_000,
    });

    await insert("complaints", complaintToRow(complaint, saved.id as string, CUSTOMER));
    await expect(
      insert("complaints", complaintToRow(complaint, saved.id as string, CUSTOMER)),
    ).rejects.toThrow();
  });
});
