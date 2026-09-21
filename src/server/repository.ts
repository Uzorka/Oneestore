import { balanceKobo } from "@/lib/wallet";
import { rowToComplaint, rowToWalletEntry, toKobo } from "@/lib/rows";
import type { Complaint, ComplaintKind } from "@/lib/complaints";
import type { Order } from "@/lib/orders";
import type { WalletEntry } from "@/lib/wallet";
import type { Grams, Kobo, OrderStatus, Product } from "@/lib/types";

import type { SqlExecutor } from "./sql";

/**
 * Everything the shop keeps, in Postgres.
 *
 * Written as SQL against the schema in `supabase/migrations/`, and exercised
 * in the tests through the same `pg` driver that talks to Supabase — so these
 * queries are run, not merely written.
 *
 * Two rules shape most of what follows:
 *
 *  1. **A customer is a phone number**, until there is real auth. Every entry
 *     point takes one and upserts, because the alternative is an order with no
 *     owner and a wallet nobody can spend.
 *  2. **Money moves inside a transaction.** Placing an order writes the order,
 *     its lines, its first event and possibly a wallet spend; half of that is
 *     worse than none, so callers hand in a transaction and the failure case
 *     leaves nothing behind.
 */

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function ensureCustomer(tx: SqlExecutor, phone: string): Promise<string> {
  // Upsert rather than select-then-insert: two tabs checking out at once would
  // otherwise race and one would fail on the unique index.
  const { rows } = await tx.query<{ id: string }>(
    `insert into customers (phone, phone_verified_at)
     values ($1, now())
     on conflict (phone) do update set phone_verified_at = coalesce(customers.phone_verified_at, now())
     returning id`,
    [phone],
  );

  return rows[0]?.id as string;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

interface ProductRow {
  id: string; slug: string; name: string; local_names: string[]; category_slug: string;
  description: string; price_per_kg_kobo: string; min_order_g: number; step_g: number;
  stock_g: number; availability: string; size_grade: string; origin: string;
  unit_weight_g: number | null;
  preps: { id: string; key: string; name: string; surcharge: string; yield_bps: number }[] | null;
  rating: string | null;
  rating_count: number;
}

/**
 * The catalog, as the storefront needs it.
 *
 * Preparations come back with the product in one query. Fetching them per
 * product is the classic N+1: ten products on a shop page become eleven round
 * trips, and on a Lagos connection that is the page.
 */
export async function loadCatalog(tx: SqlExecutor): Promise<readonly Product[]> {
  const { rows } = await tx.query<ProductRow>(
    `select p.*,
            coalesce(
              json_agg(
                json_build_object('id', o.id, 'key', o.key, 'name', o.name,
                                  'surcharge', o.surcharge_per_kg_kobo, 'yield_bps', o.yield_bps)
                order by o.sort
              ) filter (where o.id is not null),
              '[]'
            ) as preps,
            r.rating,
            coalesce(r.rating_count, 0) as rating_count
     from products p
     left join prep_options o on o.product_id = p.id
     -- Ratings are aggregated in a subquery rather than joined in: joining
     -- reviews alongside preps multiplies the rows and every average comes
     -- back wrong in a way that looks plausible.
     left join lateral (
       select round(avg(rating)::numeric, 1) as rating, count(*)::int as rating_count
       from reviews where product_id = p.id
     ) r on true
     group by p.id, r.rating, r.rating_count
     order by p.name`,
  );

  return rows.map((row) => ({
    id: row.slug,
    slug: row.slug,
    name: row.name,
    localNames: row.local_names ?? [],
    categorySlug: row.category_slug,
    description: row.description,
    pricePerKgKobo: toKobo(row.price_per_kg_kobo),
    minOrderG: row.min_order_g,
    stepG: row.step_g,
    stockG: row.stock_g,
    availability: row.availability as Product["availability"],
    sizeGrade: row.size_grade,
    origin: row.origin,
    unitWeightG: row.unit_weight_g,
    rating: row.rating === null ? 0 : Number(row.rating),
    ratingCount: row.rating_count,
    preps: (row.preps ?? []).map((p) => ({
      id: p.key,
      name: p.name,
      surchargePerKgKobo: toKobo(p.surcharge),
      yieldBps: p.yield_bps,
    })),
  }));
}

/**
 * Publish the morning's board.
 *
 * One statement for the whole board, so the storefront never serves a catalog
 * that is half yesterday's — a price rise on croaker landing before the one on
 * prawns is exactly the window someone buys in.
 */
export async function publishPrices(
  tx: SqlExecutor,
  changes: readonly { slug: string; pricePerKgKobo?: Kobo; stockG?: Grams; availability?: string }[],
): Promise<number> {
  if (changes.length === 0) return 0;

  const { rows } = await tx.query<{ slug: string }>(
    `update products p set
       price_per_kg_kobo = coalesce(v.price, p.price_per_kg_kobo),
       stock_g           = coalesce(v.stock, p.stock_g),
       availability      = coalesce(v.availability, p.availability)
     from jsonb_to_recordset($1::jsonb)
       as v(slug text, price bigint, stock int, availability text)
     where p.slug = v.slug
     returning p.slug`,
    [JSON.stringify(changes.map((c) => ({
      slug: c.slug,
      price: c.pricePerKgKobo ?? null,
      stock: c.stockG ?? null,
      availability: c.availability ?? null,
    })))],
  );

  return rows.length;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface PlaceOrderArgs {
  readonly order: Order;
  /** Wallet credit to spend on it, already decided by the caller. */
  readonly fromWalletKobo?: Kobo;
}

/**
 * Write an order.
 *
 * Idempotent on the order code: a customer who taps "place order" twice, or
 * whose phone retries the request on a flaky connection, gets one order.
 * Returning the existing row rather than raising means the second tap lands on
 * their order page instead of an error.
 */
export async function placeOrder(tx: SqlExecutor, args: PlaceOrderArgs): Promise<{ id: string; created: boolean }> {
  const { order } = args;

  const customerId = await ensureCustomer(tx, order.phone);

  const existing = await tx.query<{ id: string }>(`select id from orders where code = $1`, [order.id]);
  if (existing.rows.length > 0) return { id: existing.rows[0]?.id as string, created: false };

  const address = await tx.query<{ id: string }>(
    `insert into addresses
       (customer_id, zone_id, lga, area, street, landmark, recipient_name, recipient_phone, instructions)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [customerId, order.address.zoneId, order.address.lga, order.address.area,
     order.address.street, order.address.landmark,
     order.address.recipientName, order.address.recipientPhone, order.address.instructions],
  );

  const goodsKobo = order.lines.reduce((sum, l) => sum + l.goodsKobo, 0);
  const prepKobo = order.lines.reduce((sum, l) => sum + l.prepKobo, 0);

  const { rows } = await tx.query<{ id: string }>(
    `insert into orders
       (code, customer_id, address_id, zone_id, delivery_date, delivery_window, status,
        goods_kobo, prep_kobo, delivery_kobo, discount_kobo, discount_bps,
        wallet_applied_kobo, total_kobo, payment_method, placed_at)
     values ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     returning id`,
    [order.id, customerId, address.rows[0]?.id, order.zoneId, order.slotDate, order.slotWindowLabel,
     order.status, goodsKobo, prepKobo, order.deliveryKobo, order.discountKobo, order.discountBps,
     args.fromWalletKobo ?? 0, order.totalKobo, order.settlement, new Date(order.placedAt).toISOString()],
  );

  const orderId = rows[0]?.id as string;

  for (const line of order.lines) {
    await tx.query(
      `insert into order_items
         (order_id, product_id, prep_option_id, product_name, prep_name,
          ordered_g, unit_price_per_kg_kobo, line_total_kobo)
       select $1, p.id, o.id, $2, $3, $4, $5, $6
       from products p
       left join prep_options o on o.product_id = p.id and o.key = $8
       where p.slug = $7`,
      [orderId, line.productName, line.prepName, line.weightG,
       line.unitPricePerKgKobo, line.totalKobo, line.productId, line.prepId],
    );
  }

  await tx.query(
    `insert into order_events (order_id, status, note) values ($1, $2, $3)`,
    [orderId, order.status, "Placed"],
  );

  if ((args.fromWalletKobo ?? 0) > 0) {
    await tx.query(
      `insert into wallet_ledger (customer_id, delta_kobo, reason, order_id)
       values ($1, $2, 'spent', $3)`,
      [customerId, -(args.fromWalletKobo as number), orderId],
    );
  }

  return { id: orderId, created: true };
}

/** Move an order on, recording why. Returns false if the move is not legal. */
export async function advanceOrder(
  tx: SqlExecutor,
  code: string,
  to: OrderStatus,
  note = "",
): Promise<boolean> {
  const { rows } = await tx.query<{ id: string }>(
    `update orders set status = $2, updated_at = now() where code = $1 returning id`,
    [code, to],
  );

  const id = rows[0]?.id;
  if (id === undefined) return false;

  await tx.query(`insert into order_events (order_id, status, note) values ($1, $2, $3)`, [id, to, note]);
  return true;
}

/** Record what came off the scale for one line. */
export async function recordPackedWeight(
  tx: SqlExecutor,
  code: string,
  productSlug: string,
  prepKey: string,
  actualG: Grams | null,
): Promise<boolean> {
  /*
    Written as a plain subselect rather than an `update ... from` with a
    correlated lookup: the clever version killed the connection outright, and
    a query that has to be clever to find one row is a query that will be
    wrong later anyway.

    `$4::int` is explicit because the parameter is legitimately null — taking
    a reading back off is not the same as weighing something at zero, and
    Postgres cannot infer a type from null alone.
  */
  const { rows } = await tx.query<{ id: string }>(
    `update order_items set actual_g = $4::int
     where id = (
       select i.id from order_items i
       join orders o on o.id = i.order_id
       join products p on p.id = i.product_id
       left join prep_options po on po.id = i.prep_option_id
       where o.code = $1 and p.slug = $2 and coalesce(po.key, '') = $3
       limit 1
     )
     returning id`,
    [code, productSlug, prepKey, actualG],
  );

  return rows.length > 0;
}

export interface OrderSummaryRow {
  readonly code: string;
  readonly status: OrderStatus;
  readonly totalKobo: Kobo;
  readonly placedAt: number;
  readonly slotDate: string;
  readonly slotWindowLabel: string;
  readonly lineCount: number;
}

export async function listOrders(tx: SqlExecutor, phone: string): Promise<readonly OrderSummaryRow[]> {
  const { rows } = await tx.query<Record<string, unknown>>(
    `select o.code, o.status, o.total_kobo, o.placed_at, o.delivery_date, o.delivery_window,
            count(i.id)::int as line_count
     from orders o
     join customers c on c.id = o.customer_id
     left join order_items i on i.order_id = o.id
     where c.phone = $1
     group by o.id
     order by o.placed_at desc`,
    [phone],
  );

  return rows.map((r) => ({
    code: String(r.code),
    status: String(r.status) as OrderStatus,
    totalKobo: toKobo(r.total_kobo),
    placedAt: new Date(String(r.placed_at)).getTime(),
    slotDate: r.delivery_date === null ? "" : String(r.delivery_date).slice(0, 10),
    slotWindowLabel: String(r.delivery_window ?? ""),
    lineCount: Number(r.line_count),
  }));
}

/**
 * One order, whole: lines, events and the address it is going to.
 *
 * Three queries rather than one join. Joining lines and events together
 * multiplies the rows — three lines and five events come back as fifteen —
 * and every total computed from that is wrong in a way that looks arithmetical
 * rather than structural.
 */
export async function getOrder(tx: SqlExecutor, code: string): Promise<Order | null> {
  const { rows } = await tx.query<Record<string, unknown>>(
    `select o.*, c.phone,
            a.zone_id as addr_zone, a.lga, a.area, a.street, a.landmark,
            a.recipient_name, a.recipient_phone, a.instructions
     from orders o
     join customers c on c.id = o.customer_id
     left join addresses a on a.id = o.address_id
     where o.code = $1`,
    [code],
  );

  const row = rows[0];
  if (row === undefined) return null;

  const lines = await tx.query<Record<string, unknown>>(
    `select i.*, p.slug as product_slug,
            coalesce(po.key, '') as prep_key,
            coalesce(po.yield_bps, 10000) as yield_bps
     from order_items i
     join products p on p.id = i.product_id
     left join prep_options po on po.id = i.prep_option_id
     where i.order_id = $1
     order by i.id`,
    [row.id],
  );

  const events = await orderEvents(tx, code);

  const goodsKobo = toKobo(row.goods_kobo);
  const prepKobo = toKobo(row.prep_kobo);

  const packed: Record<string, Grams> = {};
  for (const line of lines.rows) {
    if (line.actual_g !== null && line.actual_g !== undefined) {
      packed[`${String(line.product_slug)}:${String(line.prep_key)}`] = Number(line.actual_g);
    }
  }

  return {
    id: code,
    placedAt: new Date(String(row.placed_at)).getTime(),
    status: String(row.status) as OrderStatus,
    lines: lines.rows.map((line) => {
      const weightG = Number(line.ordered_g);
      return {
        productId: String(line.product_slug),
        productName: String(line.product_name),
        prepId: String(line.prep_key),
        prepName: String(line.prep_name ?? ""),
        weightG,
        preparedWeightG: Math.round((weightG * Number(line.yield_bps)) / 10000),
        unitPricePerKgKobo: toKobo(line.unit_price_per_kg_kobo),
        goodsKobo: toKobo(line.line_total_kobo),
        prepKobo: 0,
        totalKobo: toKobo(line.line_total_kobo),
      };
    }),
    totalWeightG: lines.rows.reduce((sum, l) => sum + Number(l.ordered_g), 0),
    subtotalKobo: goodsKobo + prepKobo,
    discountBps: Number(row.discount_bps ?? 0),
    discountKobo: toKobo(row.discount_kobo),
    deliveryKobo: toKobo(row.delivery_kobo),
    totalKobo: toKobo(row.total_kobo),
    phone: String(row.phone),
    address: {
      id: String(row.address_id ?? ""),
      lga: String(row.lga ?? ""),
      area: String(row.area ?? ""),
      zoneId: String(row.addr_zone ?? row.zone_id ?? ""),
      street: String(row.street ?? ""),
      landmark: String(row.landmark ?? ""),
      recipientName: String(row.recipient_name ?? ""),
      recipientPhone: String(row.recipient_phone ?? row.phone),
      instructions: String(row.instructions ?? ""),
      isDefault: false,
    },
    zoneId: String(row.zone_id ?? ""),
    slotDate: row.delivery_date === null ? "" : String(row.delivery_date).slice(0, 10),
    slotWindowLabel: String(row.delivery_window ?? ""),
    settlement: "on_delivery",
    history: events.map((e) => (e.note === "" ? { status: e.status, at: e.at } : e)),
    ...(Object.keys(packed).length > 0 ? { packed } : {}),
  };
}

export async function orderEvents(
  tx: SqlExecutor,
  code: string,
): Promise<readonly { status: OrderStatus; at: number; note: string }[]> {
  const { rows } = await tx.query<Record<string, unknown>>(
    `select e.status, e.created_at, e.note
     from order_events e join orders o on o.id = e.order_id
     where o.code = $1 order by e.created_at, e.id`,
    [code],
  );

  return rows.map((r) => ({
    status: String(r.status) as OrderStatus,
    at: new Date(String(r.created_at)).getTime(),
    note: String(r.note ?? ""),
  }));
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export async function walletEntries(tx: SqlExecutor, phone: string): Promise<readonly WalletEntry[]> {
  const { rows } = await tx.query<Record<string, unknown>>(
    `select w.id, w.delta_kobo, w.reason, w.created_at, o.code as order_code,
            case w.reason
              when 'short_weight' then 'Packed under'
              when 'complaint_refund' then 'Refund'
              when 'spent' then 'Used on an order'
              else 'Put right'
            end as note
     from wallet_ledger w
     join customers c on c.id = w.customer_id
     left join orders o on o.id = w.order_id
     where c.phone = $1
     order by w.created_at desc`,
    [phone],
  );

  return rows.map(rowToWalletEntry);
}

export async function walletBalance(tx: SqlExecutor, phone: string): Promise<Kobo> {
  // Read through the view, which is the only place a balance should come from.
  const { rows } = await tx.query<{ balance_kobo: string }>(
    `select b.balance_kobo from customer_wallet_balances b
     join customers c on c.id = b.customer_id where c.phone = $1`,
    [phone],
  );

  return toKobo(rows[0]?.balance_kobo ?? 0);
}

/**
 * Credit a wallet, once per order and reason.
 *
 * Packing an order, correcting a weight and packing it again must not pay the
 * customer twice — so the same movement replaces the earlier one rather than
 * adding to it, exactly as the in-memory ledger does.
 */
export async function creditWallet(
  tx: SqlExecutor,
  args: { phone?: string; amountKobo: Kobo; reason: "short_weight" | "complaint_refund" | "goodwill"; orderCode: string | null },
): Promise<void> {
  if (args.amountKobo <= 0) return;

  /*
    When there is an order, the money belongs to *its* customer — looked up
    here rather than taken from the caller.

    The packing room is not signed in as anybody. Crediting whoever happens to
    be holding the device paid a short weight into an empty phantom account
    and left the actual customer with nothing, which is exactly what happened
    the first time this ran end to end.
  */
  const customerId =
    args.orderCode === null
      ? await ensureCustomer(tx, args.phone as string)
      : (
          await tx.query<{ customer_id: string }>(
            `select customer_id from orders where code = $1`,
            [args.orderCode],
          )
        ).rows[0]?.customer_id;

  if (customerId === undefined) return;

  if (args.orderCode !== null) {
    await tx.query(
      `delete from wallet_ledger w
       using orders o
       where w.order_id = o.id and o.code = $1 and w.customer_id = $2 and w.reason = $3`,
      [args.orderCode, customerId, args.reason],
    );
  }

  await tx.query(
    `insert into wallet_ledger (customer_id, delta_kobo, reason, order_id)
     values ($1, $2, $3, (select id from orders where code = $4))`,
    [customerId, args.amountKobo, args.reason, args.orderCode],
  );
}

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

export async function raiseComplaint(
  tx: SqlExecutor,
  args: {
    orderCode: string;
    phone: string;
    kind: ComplaintKind;
    detail: string;
    deliveredAt: number;
    withinWindow: boolean;
  },
): Promise<string | null> {
  const customerId = await ensureCustomer(tx, args.phone);

  const { rows } = await tx.query<{ id: string }>(
    `insert into complaints
       (order_id, customer_id, kind, detail, delivered_at, within_window, status)
     select o.id, $2, $3, $4, $5::timestamptz, $6, $7
     from orders o where o.code = $1
     on conflict (order_id) do nothing
     returning id`,
    [args.orderCode, customerId, args.kind, args.detail,
     new Date(args.deliveredAt).toISOString(), args.withinWindow,
     args.withinWindow ? "open" : "needs_review"],
  );

  return rows[0]?.id ?? null;
}

export async function complaintFor(tx: SqlExecutor, orderCode: string): Promise<Complaint | null> {
  const { rows } = await tx.query<Record<string, unknown>>(
    `select c.* from complaints c join orders o on o.id = c.order_id where o.code = $1`,
    [orderCode],
  );

  const row = rows[0];
  return row === undefined ? null : rowToComplaint(row, orderCode);
}

/**
 * Settle a complaint and pay the refund in the same breath.
 *
 * Marking it refunded without moving the money is a note claiming we paid, so
 * both happen in one transaction or neither does.
 */
export async function refundComplaint(
  tx: SqlExecutor,
  args: { orderCode: string; amountKobo: Kobo; note: string },
): Promise<boolean> {
  const { rows } = await tx.query<{ id: string }>(
    `update complaints c set status = 'refunded', refunded_kobo = $2,
                             resolution_note = $3, resolved_at = now()
     from orders o
     where c.order_id = o.id and o.code = $1 and c.status in ('open', 'needs_review')
     returning c.id`,
    // The phone is not a parameter here: passing one the statement never uses
    // leaves Postgres unable to infer its type, and it rejects the whole query.
    [args.orderCode, args.amountKobo, args.note],
  );

  if (rows.length === 0) return false;

  // No phone: the refund goes to the order's customer, whoever is settling it.
  await creditWallet(tx, {
    amountKobo: args.amountKobo,
    reason: "complaint_refund",
    orderCode: args.orderCode,
  });

  return true;
}

/** The balance a wallet would show, from entries already read. */
export function balanceOf(entries: readonly WalletEntry[]): Kobo {
  return balanceKobo(entries);
}
