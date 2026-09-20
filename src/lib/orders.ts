import { formatAddress } from "./address";
import { deliveryFeeKobo, findZone } from "./delivery";
import { priceBasket } from "./pricing";
import type { Address } from "./address";
import type { CartLine, Grams, Kobo, OrderStatus, Product } from "./types";

/**
 * Orders.
 *
 * Pure, like the pricing engine and for the same reason: an order is the
 * record of what someone agreed to pay, and it has to still say that tomorrow.
 *
 * Two decisions run through the whole file:
 *
 *  1. **An order is a snapshot, not a set of references.** Product names,
 *     preparation names and prices are copied into the order when it is
 *     placed. Tomorrow's price rise must not rewrite yesterday's receipt, and
 *     a product delisted next week must not turn last week's order into blanks.
 *  2. **The status machine is explicit.** Every legal move is declared in
 *     `ORDER_FLOW`, so an order cannot skip from `sourcing` to `delivered`
 *     because a screen somewhere called the wrong function.
 *
 * Payment is deliberately absent. An order is placed unpaid and settled on
 * delivery; when a gateway is connected, `pending_payment -> paid` is already
 * a legal move and nothing else here changes.
 */

export interface OrderLine {
  readonly productId: string;
  readonly productName: string;
  readonly prepId: string;
  readonly prepName: string;
  readonly weightG: Grams;
  /** What the customer will actually be handed, after preparation loss. */
  readonly preparedWeightG: Grams;
  readonly unitPricePerKgKobo: Kobo;
  readonly goodsKobo: Kobo;
  readonly prepKobo: Kobo;
  readonly totalKobo: Kobo;
}

export interface OrderEvent {
  readonly status: OrderStatus;
  readonly at: number;
  readonly note?: string;
}

export interface Order {
  /** Short, sayable over the phone: `ONE-4KQ9P2`. */
  readonly id: string;
  readonly placedAt: number;
  readonly status: OrderStatus;

  readonly lines: readonly OrderLine[];
  readonly totalWeightG: Grams;
  readonly subtotalKobo: Kobo;
  readonly discountBps: number;
  readonly discountKobo: Kobo;
  readonly deliveryKobo: Kobo;
  readonly totalKobo: Kobo;

  readonly phone: string;
  readonly address: Address;
  readonly zoneId: string;
  readonly slotDate: string;
  readonly slotWindowLabel: string;

  /**
   * How the money is being handled. Only `on_delivery` exists while there is
   * no gateway; the field is here so adding one is a new value rather than a
   * new column everywhere.
   */
  readonly settlement: "on_delivery";
  readonly history: readonly OrderEvent[];
}

// ---------------------------------------------------------------------------
// The status machine
// ---------------------------------------------------------------------------

/** Every legal move. Anything not listed here cannot happen. */
export const ORDER_FLOW: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["sourcing", "paid", "cancelled"],
  paid: ["sourcing", "cancelled", "refunded"],
  sourcing: ["quality_checked", "on_hold", "cancelled"],
  quality_checked: ["preparing", "on_hold", "cancelled"],
  preparing: ["packed", "on_hold", "cancelled"],
  packed: ["dispatched", "on_hold", "cancelled"],
  dispatched: ["delivered", "on_hold"],
  delivered: ["refunded"],
  on_hold: ["sourcing", "quality_checked", "preparing", "packed", "dispatched", "cancelled"],
  cancelled: ["refunded"],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_FLOW[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return ORDER_FLOW[status].length === 0;
}

/**
 * Move an order on. Returns the order unchanged if the move is not legal —
 * callers get a value, not an exception, because a stale tab clicking an old
 * button is a normal event, not a crash.
 */
export function advance(order: Order, to: OrderStatus, at: number, note?: string): Order {
  if (!canTransition(order.status, to)) return order;

  return {
    ...order,
    status: to,
    history: [...order.history, note === undefined ? { status: to, at } : { status: to, at, note }],
  };
}

const LABELS: Record<OrderStatus, string> = {
  pending_payment: "Order placed",
  paid: "Paid",
  sourcing: "At the jetty",
  quality_checked: "Quality checked",
  preparing: "Being prepared",
  packed: "Packed on ice",
  dispatched: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  on_hold: "On hold",
};

export function statusLabel(status: OrderStatus): string {
  return LABELS[status];
}

/** What the customer is told is happening, in the words of the thing itself. */
const EXPLANATIONS: Record<OrderStatus, string> = {
  pending_payment: "We have your order. You pay the rider on delivery.",
  paid: "Payment received.",
  sourcing: "We are picking your fish off the morning's landing.",
  quality_checked: "Checked by hand — gills, eyes, firmness — before anything is cut.",
  preparing: "Being cleaned and cut the way you asked.",
  packed: "Weighed on camera and packed on ice.",
  dispatched: "With the rider and on the way to you.",
  delivered: "Delivered. Anything wrong, tell us within 2 hours.",
  cancelled: "This order was cancelled.",
  refunded: "Refunded in full.",
  on_hold: "Paused — we will call you about this one.",
};

export function statusExplanation(status: OrderStatus): string {
  return EXPLANATIONS[status];
}

/**
 * The stages a customer is shown, in order.
 *
 * Deliberately not every status: `paid` and `quality_checked` are real steps
 * we run, but a tracker with nine ticks on it tells someone less than one with
 * five. Exceptions (`cancelled`, `on_hold`, `refunded`) are not stages at all
 * — they are shown on their own, because they are not progress.
 */
export const CUSTOMER_STAGES: readonly OrderStatus[] = [
  "pending_payment",
  "sourcing",
  "preparing",
  "dispatched",
  "delivered",
];

export function stageIndex(status: OrderStatus): number {
  const exact = CUSTOMER_STAGES.indexOf(status);
  if (exact !== -1) return exact;

  // Statuses that are real but not shown map to the stage they belong to.
  switch (status) {
    case "paid":
      return 0;
    case "quality_checked":
      return 1;
    case "packed":
      return 2;
    default:
      return -1; // cancelled, refunded, on_hold — not progress
  }
}

// ---------------------------------------------------------------------------
// Placing one
// ---------------------------------------------------------------------------

// No 0/O, no 1/I/L, no 8/B. These are the pairs that come back wrong when an
// order number is read out over a phone line.
const ID_ALPHABET = "23456789ACDEFGHJKMNPQRSTUVWXYZ";

/**
 * A short order number, read out over the phone without spelling.
 *
 * `random` is injectable so tests are not at the mercy of chance, and so the
 * server can pass a source that guarantees uniqueness once there is one.
 */
export function orderId(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)];
  }
  return `ONE-${out}`;
}

export function createOrder(args: {
  readonly lines: readonly CartLine[];
  readonly productsById: ReadonlyMap<string, Product>;
  readonly phone: string;
  readonly address: Address;
  readonly zoneId: string;
  readonly slotDate: string;
  readonly slotWindowLabel: string;
  readonly at: number;
  readonly random?: () => number;
}): Order {
  const { lines, productsById, phone, address, zoneId, slotDate, slotWindowLabel, at } = args;

  const totals = priceBasket(lines, productsById);

  const orderLines: OrderLine[] = [];
  for (const [index, line] of lines.entries()) {
    const product = productsById.get(line.productId);
    const priced = totals.lines[index];
    if (product === undefined || priced === undefined) continue;

    const prep = product.preps.find((p) => p.id === line.prepId);

    orderLines.push({
      productId: line.productId,
      productName: product.name,
      prepId: line.prepId,
      prepName: prep?.name ?? line.prepId,
      weightG: priced.weightG,
      preparedWeightG: priced.preparedWeightG,
      unitPricePerKgKobo: priced.unitPricePerKgKobo,
      goodsKobo: priced.goodsKobo,
      prepKobo: priced.prepKobo,
      totalKobo: priced.totalKobo,
    });
  }

  const zone = findZone(zoneId);
  const deliveryKobo = zone === undefined ? 0 : deliveryFeeKobo(zone, totals.payableKobo);

  return {
    id: orderId(args.random),
    placedAt: at,
    status: "pending_payment",
    lines: orderLines,
    totalWeightG: totals.totalWeightG,
    subtotalKobo: totals.subtotalKobo,
    discountBps: totals.discountBps,
    discountKobo: totals.discountKobo,
    deliveryKobo,
    totalKobo: totals.payableKobo + deliveryKobo,
    phone,
    address,
    zoneId,
    slotDate,
    slotWindowLabel,
    settlement: "on_delivery",
    history: [{ status: "pending_payment", at }],
  };
}

/** One line of address for a list row. */
export function orderAddressLine(order: Order): string {
  return formatAddress(order.address);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_VERSION = 1;
export const ORDERS_STORAGE_KEY = "oneestore.orders.v1";

export function serializeOrders(orders: readonly Order[]): string {
  return JSON.stringify({ v: STORAGE_VERSION, orders });
}

/**
 * Read orders back defensively. A half-written or hand-edited store must not
 * take the account page down, so anything that does not look like an order is
 * dropped rather than trusted.
 */
export function parseOrders(raw: string | null): readonly Order[] {
  if (raw === null) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];

    const { v, orders } = parsed as { v?: unknown; orders?: unknown };
    if (v !== STORAGE_VERSION || !Array.isArray(orders)) return [];

    return orders.filter(isOrder);
  } catch {
    return [];
  }
}

function isOrder(value: unknown): value is Order {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Partial<Order>;

  return (
    typeof o.id === "string" &&
    typeof o.placedAt === "number" &&
    typeof o.status === "string" &&
    o.status in ORDER_FLOW &&
    Array.isArray(o.lines) &&
    typeof o.totalKobo === "number" &&
    Array.isArray(o.history)
  );
}
