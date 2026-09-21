import type { Address } from "./address";
import type { Complaint, ComplaintKind, ComplaintStatus } from "./complaints";
import type { Order, OrderLine } from "./orders";
import type { WalletEntry, WalletReason } from "./wallet";
import type { Grams, Kobo, OrderStatus } from "./types";

/**
 * Between the database and the domain.
 *
 * Postgres speaks snake_case, ISO timestamps and bigint-as-string; the app
 * speaks camelCase, epoch milliseconds and integers. Every conversion lives
 * here so there is one place to be wrong, and these are tested by writing
 * through the real schema and reading back — not by trusting the shapes to
 * line up.
 *
 * `bigint` is the trap worth naming: node-postgres and PostgREST both hand
 * back `bigint` columns as **strings**, because a kobo total can exceed what a
 * JavaScript number holds exactly. `"1960000" * 1` looks fine in a test and
 * concatenates in production, so every money field goes through `toKobo`.
 */

export function toKobo(value: unknown): Kobo {
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "string" && value.trim() !== "") return Math.round(Number(value));
  return 0;
}

function toGrams(value: unknown): Grams {
  return toKobo(value);
}

function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "number") return value;
  return 0;
}

function toIso(millis: number): string {
  return new Date(millis).toISOString();
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderRow {
  readonly code: string;
  readonly status: string;
  readonly goods_kobo: number | string;
  readonly prep_kobo: number | string;
  readonly delivery_kobo: number | string;
  readonly discount_kobo: number | string;
  readonly discount_bps: number;
  readonly total_kobo: number | string;
  readonly zone_id: string | null;
  readonly delivery_date: string | null;
  readonly delivery_window: string | null;
  readonly payment_method: string | null;
  readonly placed_at: string | Date;
}

export function orderToRow(order: Order): Record<string, unknown> {
  return {
    code: order.id,
    status: order.status,
    goods_kobo: order.lines.reduce((sum, l) => sum + l.goodsKobo, 0),
    prep_kobo: order.lines.reduce((sum, l) => sum + l.prepKobo, 0),
    delivery_kobo: order.deliveryKobo,
    discount_kobo: order.discountKobo,
    discount_bps: order.discountBps,
    total_kobo: order.totalKobo,
    zone_id: order.zoneId,
    delivery_date: order.slotDate,
    delivery_window: order.slotWindowLabel,
    payment_method: order.settlement,
    placed_at: toIso(order.placedAt),
  };
}

/**
 * A line, for the database.
 *
 * `productId` is the catalog's UUID, not the slug the domain object carries —
 * the column is a foreign key, and the order has to stay linked to the product
 * for stock and reporting. The names and the price travel alongside it anyway:
 * they are the snapshot, so delisting a product next week does not blank last
 * week's receipt.
 */
export function orderLineToRow(
  line: OrderLine,
  orderId: string,
  productId: string,
  prepOptionId: string | null,
): Record<string, unknown> {
  return {
    order_id: orderId,
    product_id: productId,
    prep_option_id: prepOptionId,
    product_name: line.productName,
    prep_name: line.prepName,
    ordered_g: line.weightG,
    unit_price_per_kg_kobo: line.unitPricePerKgKobo,
    line_total_kobo: line.totalKobo,
  };
}

export function rowToOrderLine(row: Record<string, unknown>): OrderLine {
  const weightG = toGrams(row.ordered_g);

  return {
    productId: String(row.product_slug ?? row.product_id ?? ""),
    productName: String(row.product_name ?? ""),
    prepId: String(row.prep_slug ?? row.prep_option_id ?? ""),
    prepName: String(row.prep_name ?? ""),
    weightG,
    // The database keeps what was ordered and what was packed; prepared weight
    // is derived from the preparation's yield and belongs to the catalog.
    preparedWeightG: toGrams(row.prepared_g ?? weightG),
    unitPricePerKgKobo: toKobo(row.unit_price_per_kg_kobo),
    goodsKobo: toKobo(row.goods_kobo ?? row.line_total_kobo),
    prepKobo: toKobo(row.prep_kobo ?? 0),
    totalKobo: toKobo(row.line_total_kobo),
  };
}

export function rowToOrder(
  row: Record<string, unknown>,
  lines: readonly OrderLine[],
  events: readonly { status: OrderStatus; at: number; note?: string }[],
  address: Address,
  phone: string,
): Order {
  const goods = toKobo(row.goods_kobo);
  const prep = toKobo(row.prep_kobo);

  return {
    id: String(row.code ?? ""),
    placedAt: toMillis(row.placed_at),
    status: String(row.status) as OrderStatus,
    lines,
    totalWeightG: lines.reduce((sum, l) => sum + l.weightG, 0),
    subtotalKobo: goods + prep,
    discountBps: Number(row.discount_bps ?? 0),
    discountKobo: toKobo(row.discount_kobo),
    deliveryKobo: toKobo(row.delivery_kobo),
    totalKobo: toKobo(row.total_kobo),
    phone,
    address,
    zoneId: String(row.zone_id ?? ""),
    slotDate: String(row.delivery_date ?? ""),
    slotWindowLabel: String(row.delivery_window ?? ""),
    settlement: "on_delivery",
    history: events.map((e) => (e.note === undefined ? { status: e.status, at: e.at } : e)),
  };
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export function walletEntryToRow(entry: WalletEntry, customerId: string): Record<string, unknown> {
  return {
    customer_id: customerId,
    delta_kobo: entry.amountKobo,
    reason: entry.reason,
    created_at: toIso(entry.at),
  };
}

export function rowToWalletEntry(row: Record<string, unknown>): WalletEntry {
  return {
    id: String(row.id ?? ""),
    at: toMillis(row.created_at),
    amountKobo: toKobo(row.delta_kobo),
    reason: String(row.reason) as WalletReason,
    orderId: row.order_code === null || row.order_code === undefined ? null : String(row.order_code),
    note: String(row.note ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

export function complaintToRow(
  complaint: Complaint,
  orderId: string,
  customerId: string,
): Record<string, unknown> {
  return {
    order_id: orderId,
    customer_id: customerId,
    kind: complaint.kind,
    detail: complaint.detail,
    delivered_at: toIso(complaint.deliveredAt),
    raised_at: toIso(complaint.raisedAt),
    within_window: complaint.withinWindow,
    status: complaint.status,
    refunded_kobo: complaint.refundedKobo,
    resolution_note: complaint.resolutionNote,
    resolved_at: complaint.resolvedAt === null ? null : toIso(complaint.resolvedAt),
  };
}

export function rowToComplaint(row: Record<string, unknown>, orderCode: string): Complaint {
  return {
    id: String(row.id ?? ""),
    orderId: orderCode,
    raisedAt: toMillis(row.raised_at),
    deliveredAt: toMillis(row.delivered_at),
    kind: String(row.kind) as ComplaintKind,
    detail: String(row.detail ?? ""),
    lineKeys: [],
    withinWindow: row.within_window === true,
    status: String(row.status) as ComplaintStatus,
    resolvedAt: row.resolved_at === null || row.resolved_at === undefined ? null : toMillis(row.resolved_at),
    refundedKobo: toKobo(row.refunded_kobo),
    resolutionNote: String(row.resolution_note ?? ""),
  };
}
