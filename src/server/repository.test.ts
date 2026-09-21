import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { naira } from "@/lib/money";
import { createOrder } from "@/lib/orders";
import type { Address } from "@/lib/address";
import type { CartLine, Product } from "@/lib/types";

import {
  advanceOrder,
  complaintFor,
  creditWallet,
  ensureCustomer,
  listOrders,
  loadCatalog,
  orderEvents,
  placeOrder,
  publishPrices,
  raiseComplaint,
  recordPackedWeight,
  refundComplaint,
  walletBalance,
  walletEntries,
} from "./repository";
import { inTransaction } from "./sql";

/**
 * The repository, against a real Postgres.
 *
 * PGlite is served over a TCP socket and reached with the same `pg` driver
 * that will talk to Supabase, so what these tests exercise is the wire
 * protocol, the parameter binding, the constraints and the transactions — not
 * a mock that agrees with whatever the author assumed.
 *
 * The one thing left untested is the connection string itself.
 */

const PRELUDE = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated; create role service_role;
`;

const PHONE = "+2348034128890";

let db: PGlite;
let server: PGLiteSocketServer;
let pool: pg.Pool;

const ADDRESS: Address = {
  id: "a1",
  zoneId: "island",
  street: "14 Admiralty Way, Lekki Phase 1",
  landmark: "Opposite the Total filling station",
  recipientName: "Adaeze Okoro",
  recipientPhone: PHONE,
  instructions: "",
  isDefault: true,
};

let catalog: ReadonlyMap<string, Product>;
let codeCounter = 0;

function anOrder(lines?: CartLine[]) {
  codeCounter += 1;
  const croaker = catalog.get("croaker") as Product;

  const order = createOrder({
    lines: lines ?? [
      { productId: "croaker", prepId: "whole", weightG: 2000, unitPricePerKgKoboSnapshot: croaker.pricePerKgKobo },
    ],
    productsById: catalog,
    phone: PHONE,
    address: ADDRESS,
    zoneId: "island",
    slotDate: "2026-09-22",
    slotWindowLabel: "9 AM – 1 PM",
    at: Date.now(),
    random: () => 0.5,
  });

  // Distinct codes, since the generator is deterministic here.
  return { ...order, id: `ONE-TEST${String(codeCounter).padStart(2, "0")}` };
}

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(PRELUDE);

  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  await db.exec(readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8"));

  server = new PGLiteSocketServer({ db, port: 5434, host: "127.0.0.1" });
  await server.start();

  /*
    More than one connection on purpose. A test that deliberately violates a
    constraint can leave the socket unusable, and with a pool of one every
    test after it fails at `connect` rather than at anything it did. The pool
    discards a broken client and opens another.
  */
  pool = new pg.Pool({ host: "127.0.0.1", port: 5434, user: "postgres", database: "postgres", max: 4 });
  pool.on("error", () => {
    // An idle client dropped by the server is not a test failure.
  });

  const products = await loadCatalog(pool);
  catalog = new Map(products.map((p) => [p.id, p]));
}, 90_000);

afterAll(async () => {
  await pool?.end();
  await server?.stop();
  await db?.close();
});

describe("the catalog", () => {
  it("comes back whole, preparations and all, in one query", async () => {
    const products = await loadCatalog(pool);

    expect(products.length).toBeGreaterThan(5);
    const croaker = products.find((p) => p.slug === "croaker");
    expect(croaker?.name).toBe("Croaker");
    expect(croaker?.pricePerKgKobo).toBe(naira(9800));
    expect(croaker?.preps.length).toBeGreaterThan(1);
    expect(croaker?.preps.some((p) => p.surchargePerKgKobo === 0)).toBe(true);
  });

  it("reads money as an integer, not the string Postgres sends", async () => {
    const [product] = await loadCatalog(pool);
    expect(Number.isInteger(product?.pricePerKgKobo)).toBe(true);
  });

  it("does not multiply a rating by the number of preparations", async () => {
    // Joining reviews alongside preps inflates every average in a way that
    // still looks like a plausible rating.
    await pool.query(
      `insert into reviews (product_id, rating) select id, 4 from products where slug = 'croaker'`,
    );
    await pool.query(
      `insert into reviews (product_id, rating) select id, 2 from products where slug = 'croaker'`,
    );

    const croaker = (await loadCatalog(pool)).find((p) => p.slug === "croaker");
    expect(croaker?.rating).toBe(3);
    expect(croaker?.ratingCount).toBe(2);
  });

  it("publishes a whole board in one statement", async () => {
    const changed = await publishPrices(pool, [
      { slug: "croaker", pricePerKgKobo: naira(10_400) },
      { slug: "titus", stockG: 12_000 },
    ]);

    expect(changed).toBe(2);

    const products = await loadCatalog(pool);
    expect(products.find((p) => p.slug === "croaker")?.pricePerKgKobo).toBe(naira(10_400));
    expect(products.find((p) => p.slug === "titus")?.stockG).toBe(12_000);

    await publishPrices(pool, [{ slug: "croaker", pricePerKgKobo: naira(9800) }]);
  });
});

describe("customers", () => {
  it("are their phone number, and asking twice is the same customer", async () => {
    const first = await ensureCustomer(pool, "+2348030000001");
    const again = await ensureCustomer(pool, "+2348030000001");

    expect(again).toBe(first);
  });
});

describe("placing an order", () => {
  it("writes the order, its lines and its first event together", async () => {
    const order = anOrder();
    const { created } = await inTransaction(pool, (tx) => placeOrder(tx, { order }));
    expect(created).toBe(true);

    const items = await pool.query(`select * from order_items i join orders o on o.id = i.order_id where o.code = $1`, [order.id]);
    expect(items.rows).toHaveLength(1);
    expect(items.rows[0]?.product_name).toBe("Croaker");
    expect(items.rows[0]?.actual_g).toBeNull();

    const events = await orderEvents(pool, order.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("pending_payment");
  });

  it("is idempotent, so a double tap is one order", async () => {
    const order = anOrder();

    const first = await inTransaction(pool, (tx) => placeOrder(tx, { order }));
    const second = await inTransaction(pool, (tx) => placeOrder(tx, { order }));

    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    const { rows } = await pool.query(`select count(*)::int as n from orders where code = $1`, [order.id]);
    expect(rows[0]?.n).toBe(1);
  });

  it("spends wallet credit as part of the same write", async () => {
    await creditWallet(pool, { phone: PHONE, amountKobo: naira(1500), reason: "goodwill", orderCode: null });
    const before = await walletBalance(pool, PHONE);

    const order = anOrder();
    await inTransaction(pool, (tx) => placeOrder(tx, { order, fromWalletKobo: naira(1000) }));

    expect(await walletBalance(pool, PHONE)).toBe(before - naira(1000));
  });

  it("leaves nothing behind when the write fails half way", async () => {
    const before = await walletBalance(pool, PHONE);
    const { rows: countBefore } = await pool.query<{ n: number }>(`select count(*)::int as n from orders`);

    const order = anOrder();

    await expect(
      inTransaction(pool, async (tx) => {
        await placeOrder(tx, { order, fromWalletKobo: naira(100) });
        // Whatever goes wrong after the order is written — a bad status, a
        // dropped connection — must not leave a spent wallet behind.
        throw new Error("something failed after the order was written");
      }),
    ).rejects.toThrow();

    const { rows: countAfter } = await pool.query<{ n: number }>(`select count(*)::int as n from orders`);
    expect(countAfter[0]?.n).toBe(countBefore[0]?.n);
    expect(await walletBalance(pool, PHONE)).toBe(before);
  });
});

describe("moving an order along", () => {
  it("records every step with its own event", async () => {
    const order = anOrder();
    await inTransaction(pool, (tx) => placeOrder(tx, { order }));

    await advanceOrder(pool, order.id, "sourcing", "Picked at Epe");
    await advanceOrder(pool, order.id, "quality_checked");

    const events = await orderEvents(pool, order.id);
    expect(events.map((e) => e.status)).toEqual(["pending_payment", "sourcing", "quality_checked"]);
    expect(events[1]?.note).toBe("Picked at Epe");
  });

  it("says so when there is no such order", async () => {
    expect(await advanceOrder(pool, "ONE-NOPE00", "sourcing")).toBe(false);
  });

  // That the database refuses a status the code does not know is covered in
  // schema.test.ts, against the constraint itself. Repeating it here through a
  // live connection only exercises how PGlite's socket server handles a failed
  // statement, which is not a property of this shop.
});

describe("weighing", () => {
  it("records what came off the scale against the right line", async () => {
    const order = anOrder();
    await inTransaction(pool, (tx) => placeOrder(tx, { order }));

    expect(await recordPackedWeight(pool, order.id, "croaker", "whole", 1900)).toBe(true);

    const { rows } = await pool.query<{ actual_g: number }>(
      `select i.actual_g from order_items i join orders o on o.id = i.order_id where o.code = $1`,
      [order.id],
    );
    expect(rows[0]?.actual_g).toBe(1900);
  });

  it("can take a reading back off, which is not the same as zero", async () => {
    const order = anOrder();
    await inTransaction(pool, (tx) => placeOrder(tx, { order }));

    await recordPackedWeight(pool, order.id, "croaker", "whole", 1900);
    await recordPackedWeight(pool, order.id, "croaker", "whole", null);

    const { rows } = await pool.query(
      `select i.actual_g from order_items i join orders o on o.id = i.order_id where o.code = $1`,
      [order.id],
    );
    expect(rows[0]?.actual_g).toBeNull();
  });
});

describe("the wallet", () => {
  it("is the sum of its ledger, read through the view", async () => {
    const phone = "+2348030000002";
    await creditWallet(pool, { phone, amountKobo: naira(980), reason: "short_weight", orderCode: null });
    await creditWallet(pool, { phone, amountKobo: naira(500), reason: "goodwill", orderCode: null });

    expect(await walletBalance(pool, phone)).toBe(naira(1480));
    expect(await walletEntries(pool, phone)).toHaveLength(2);
  });

  it("does not pay the same shortfall twice when a weight is corrected", async () => {
    const phone = "+2348030000003";
    const order = { ...anOrder(), phone };
    await inTransaction(pool, (tx) => placeOrder(tx, { order }));

    await creditWallet(pool, { phone, amountKobo: naira(980), reason: "short_weight", orderCode: order.id });
    await creditWallet(pool, { phone, amountKobo: naira(1200), reason: "short_weight", orderCode: order.id });

    expect(await walletBalance(pool, phone)).toBe(naira(1200));
    expect(await walletEntries(pool, phone)).toHaveLength(1);
  });

  it("keeps a refund separate from a short weight on the same order", async () => {
    const phone = "+2348030000004";
    const order = { ...anOrder(), phone };
    await inTransaction(pool, (tx) => placeOrder(tx, { order }));

    await creditWallet(pool, { phone, amountKobo: naira(980), reason: "short_weight", orderCode: order.id });
    await creditWallet(pool, { phone, amountKobo: naira(5000), reason: "complaint_refund", orderCode: order.id });

    expect(await walletBalance(pool, phone)).toBe(naira(5980));
  });

  it("ignores a credit of nothing", async () => {
    const phone = "+2348030000005";
    await creditWallet(pool, { phone, amountKobo: 0, reason: "goodwill", orderCode: null });

    expect(await walletBalance(pool, phone)).toBe(0);
  });
});

describe("complaints", () => {
  it("opens inside the window and goes to a person outside it", async () => {
    const inside = anOrder();
    await inTransaction(pool, (tx) => placeOrder(tx, { order: inside }));
    await raiseComplaint(pool, {
      orderCode: inside.id, phone: PHONE, kind: "not_fresh",
      detail: "Smells off", deliveredAt: Date.now(), withinWindow: true,
    });
    expect((await complaintFor(pool, inside.id))?.status).toBe("open");

    const late = anOrder();
    await inTransaction(pool, (tx) => placeOrder(tx, { order: late }));
    await raiseComplaint(pool, {
      orderCode: late.id, phone: PHONE, kind: "late",
      detail: "Too late", deliveredAt: Date.now() - 5 * 3600_000, withinWindow: false,
    });
    expect((await complaintFor(pool, late.id))?.status).toBe("needs_review");
  });

  it("allows only one per order", async () => {
    const order = anOrder();
    await inTransaction(pool, (tx) => placeOrder(tx, { order }));

    const first = await raiseComplaint(pool, {
      orderCode: order.id, phone: PHONE, kind: "not_fresh",
      detail: "One", deliveredAt: Date.now(), withinWindow: true,
    });
    const second = await raiseComplaint(pool, {
      orderCode: order.id, phone: PHONE, kind: "wrong_item",
      detail: "Two", deliveredAt: Date.now(), withinWindow: true,
    });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect((await complaintFor(pool, order.id))?.detail).toBe("One");
  });

  it("pays the refund into the wallet in the same breath as settling it", async () => {
    const phone = "+2348030000006";
    const order = { ...anOrder(), phone };
    await inTransaction(pool, (tx) => placeOrder(tx, { order }));
    await raiseComplaint(pool, {
      orderCode: order.id, phone, kind: "not_fresh",
      detail: "Off", deliveredAt: Date.now(), withinWindow: true,
    });

    const settled = await inTransaction(pool, (tx) =>
      refundComplaint(tx, { orderCode: order.id, phone, amountKobo: naira(12_500), note: "Photo confirms it." }),
    );

    expect(settled).toBe(true);
    // Marking it refunded without moving the money is a note claiming we paid.
    expect(await walletBalance(pool, phone)).toBe(naira(12_500));
    expect((await complaintFor(pool, order.id))?.status).toBe("refunded");
  });

  it("will not settle the same complaint twice", async () => {
    const phone = "+2348030000007";
    const order = { ...anOrder(), phone };
    await inTransaction(pool, (tx) => placeOrder(tx, { order }));
    await raiseComplaint(pool, {
      orderCode: order.id, phone, kind: "not_fresh",
      detail: "Off", deliveredAt: Date.now(), withinWindow: true,
    });

    await inTransaction(pool, (tx) =>
      refundComplaint(tx, { orderCode: order.id, phone, amountKobo: naira(1000), note: "Done" }),
    );
    const again = await inTransaction(pool, (tx) =>
      refundComplaint(tx, { orderCode: order.id, phone, amountKobo: naira(1000), note: "Again" }),
    );

    expect(again).toBe(false);
    expect(await walletBalance(pool, phone)).toBe(naira(1000));
  });
});

describe("a customer's own orders", () => {
  it("come back newest first and only theirs", async () => {
    const phone = "+2348030000008";
    const mine = { ...anOrder(), phone };
    await inTransaction(pool, (tx) => placeOrder(tx, { order: mine }));

    const theirs = { ...anOrder(), phone: "+2348030000009" };
    await inTransaction(pool, (tx) => placeOrder(tx, { order: theirs }));

    const list = await listOrders(pool, phone);
    expect(list.map((o) => o.code)).toEqual([mine.id]);
    expect(list[0]?.lineCount).toBe(1);
    expect(list[0]?.totalKobo).toBe(mine.totalKobo);
  });
});
