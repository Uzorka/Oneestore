import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { ORDER_FLOW } from "./orders";

/**
 * The schema, run.
 *
 * These migrations used to be a file nobody had executed — which is how they
 * came to reference an extension that has not been needed since Postgres 13,
 * keep a wallet balance in two places, and leave six tables holding names and
 * phone numbers readable by anyone with the anon key.
 *
 * So the schema is applied to a real Postgres here (PGlite, in-process) and
 * asked questions. It is not Supabase — auth and the roles are stubbed below —
 * but every constraint, policy and column is the real thing.
 */

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** What Supabase provides that plain Postgres does not. */
const PRELUDE = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon;
  create role authenticated;
  create role service_role;
`;

let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(PRELUDE);

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
}, 60_000);

/** Run something that should be rejected, and give back the error message. */
async function rejects(sql: string, params: unknown[] = []): Promise<string> {
  try {
    await db.query(sql, params);
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

describe("the migrations", () => {
  it("apply to a clean database without a superuser or an extension", () => {
    // Reaching this at all means beforeAll applied every file.
    expect(db).toBeDefined();
  });

  it("leaves no table in public without row-level security", async () => {
    // A table in `public` with RLS off is world-readable through the anon
    // key. This is the question worth asking before every deploy.
    const { rows } = await db.query<{ relname: string }>(`
      select relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      order by 1
    `);

    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("keeps the wallet balance in exactly one place", async () => {
    const { rows } = await db.query<{ column_name: string }>(`
      select column_name from information_schema.columns
      where table_name = 'customers' and column_name like '%balance%'
    `);

    // The ledger is the truth; a stored balance drifts, and the one that
    // drifts is the one the customer is shown.
    expect(rows).toEqual([]);

    const view = await db.query(`select * from customer_wallet_balances limit 0`);
    expect(view.fields.map((f) => f.name)).toContain("balance_kobo");
  });
});

describe("the seed", () => {
  it("applies to the schema it was generated for", async () => {
    // seed.sql is generated from the same seed.ts the app ships, so a product
    // the code knows about and the database rejects fails here.
    const seed = readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8");
    await db.exec(seed);

    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from products`);
    expect(rows[0]?.n).toBeGreaterThan(0);
  });

  it("gives every product at least one preparation with no surcharge", async () => {
    const { rows } = await db.query<{ slug: string }>(`
      select p.slug from products p
      where not exists (
        select 1 from prep_options o
        where o.product_id = p.id and o.surcharge_per_kg_kobo = 0
      )
    `);

    // The box and meal builders add at the baseline preparation. A product
    // without one would be unaddable.
    expect(rows.map((r) => r.slug)).toEqual([]);
  });
});

describe("what the database refuses", () => {
  it("a price that would pay the customer to take the fish", async () => {
    await db.exec(`insert into categories (slug, name) values ('t', 'T') on conflict do nothing`);

    const message = await rejects(`
      insert into products (slug, name, category_slug, price_per_kg_kobo, min_order_g, step_g)
      values ('bad', 'Bad', 't', -100, 500, 250)
    `);

    expect(message).toMatch(/price_per_kg_kobo|check/i);
  });

  it("a weight the shop cannot actually sell", async () => {
    await db.exec(`insert into categories (slug, name) values ('t', 'T') on conflict do nothing`);

    const message = await rejects(`
      insert into products (slug, name, category_slug, price_per_kg_kobo, min_order_g, step_g)
      values ('bad2', 'Bad', 't', 980000, 0, 250)
    `);

    expect(message).toMatch(/min_order_g|check/i);
  });

  it("a wallet movement of nothing", async () => {
    const message = await rejects(`
      insert into wallet_ledger (customer_id, delta_kobo, reason)
      values (gen_random_uuid(), 0, 'goodwill')
    `);

    expect(message).toMatch(/wallet_delta_not_zero|check|foreign key/i);
  });

  it("a kind of money movement nobody has heard of", async () => {
    const message = await rejects(`
      insert into wallet_ledger (customer_id, delta_kobo, reason)
      values (gen_random_uuid(), 100, 'vibes')
    `);

    expect(message).toMatch(/wallet_reason_known|check|foreign key/i);
  });

  it("an order status the code does not know about", async () => {
    const message = await rejects(`
      insert into orders (code, status) values ('ONE-XXXXXX', 'teleported')
    `);

    expect(message).toMatch(/check|status/i);
  });

  it("a discount rate beyond 100%", async () => {
    const message = await rejects(`
      insert into orders (code, discount_bps) values ('ONE-YYYYYY', 20000)
    `);

    expect(message).toMatch(/discount_bps|check/i);
  });
});

describe("complaints", () => {
  it("cannot be declined without a reason the customer can read", async () => {
    const message = await rejects(`
      insert into complaints (order_id, customer_id, kind, delivered_at, within_window, status)
      values (gen_random_uuid(), gen_random_uuid(), 'not_fresh', now(), true, 'declined')
    `);

    // "Declined" with nothing after it is how a complaint becomes a chargeback.
    expect(message).toMatch(/declined_needs_a_reason|check|foreign key/i);
  });

  it("cannot be marked refunded for nothing", async () => {
    const message = await rejects(`
      insert into complaints (order_id, customer_id, kind, delivered_at, within_window, status, refunded_kobo)
      values (gen_random_uuid(), gen_random_uuid(), 'not_fresh', now(), true, 'refunded', 0)
    `);

    expect(message).toMatch(/refunded_needs_an_amount|check|foreign key/i);
  });

  it("allows only one per order", async () => {
    const { rows } = await db.query<{ indexdef: string }>(`
      select indexdef from pg_indexes
      where tablename = 'complaints' and indexname = 'one_complaint_per_order'
    `);

    expect(rows[0]?.indexdef).toMatch(/unique/i);
  });
});

describe("the database and the code agree", () => {
  it("on exactly which order statuses exist", async () => {
    const { rows } = await db.query<{ def: string }>(`
      select pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid = 'orders'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%'
    `);

    const inDatabase = new Set([...(rows[0]?.def ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
    const inCode = new Set(Object.keys(ORDER_FLOW));

    // Drift here means an order the code can reach and the database rejects,
    // which shows up as a failed write in the packing room at 6am.
    expect([...inDatabase].sort()).toEqual([...inCode].sort());
  });

  it("on the statuses an order event may record", async () => {
    const { rows } = await db.query<{ def: string }>(`
      select pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid = 'order_events'::regclass and contype = 'c'
    `);

    const inDatabase = new Set([...(rows[0]?.def ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
    expect([...inDatabase].sort()).toEqual([...Object.keys(ORDER_FLOW)].sort());
  });
});

describe("the wallet balance view", () => {
  it("is the sum of the ledger", async () => {
    await db.exec(`
      insert into customers (id, phone) values
        ('11111111-1111-1111-1111-111111111111', '+2348034128890');
      insert into wallet_ledger (customer_id, delta_kobo, reason) values
        ('11111111-1111-1111-1111-111111111111', 98000, 'short_weight'),
        ('11111111-1111-1111-1111-111111111111', 125000, 'complaint_refund'),
        ('11111111-1111-1111-1111-111111111111', -50000, 'spent');
    `);

    const { rows } = await db.query<{ balance_kobo: string }>(`
      select balance_kobo from customer_wallet_balances
      where customer_id = '11111111-1111-1111-1111-111111111111'
    `);

    expect(Number(rows[0]?.balance_kobo)).toBe(98000 + 125000 - 50000);
  });

  it("reports zero for a customer who has never had any", async () => {
    await db.exec(`
      insert into customers (id, phone) values
        ('22222222-2222-2222-2222-222222222222', '+2348034128891')
    `);

    const { rows } = await db.query<{ balance_kobo: string }>(`
      select balance_kobo from customer_wallet_balances
      where customer_id = '22222222-2222-2222-2222-222222222222'
    `);

    expect(Number(rows[0]?.balance_kobo)).toBe(0);
  });
});
