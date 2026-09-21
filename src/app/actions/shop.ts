"use server";

import {
  advanceOrder,
  complaintFor,
  creditWallet,
  getOrder,
  listOrders,
  placeOrder,
  raiseComplaint,
  recordPackedWeight,
  refundComplaint,
  walletBalance,
  walletEntries,
} from "@/server/repository";
import { databaseConfigured, inTransaction, pool } from "@/server/sql";
import type { Complaint, ComplaintKind } from "@/lib/complaints";
import type { Order } from "@/lib/orders";
import type { WalletEntry } from "@/lib/wallet";
import type { Grams, Kobo, OrderStatus } from "@/lib/types";

/**
 * What the browser is allowed to ask the database.
 *
 * The screens do not hold a connection or compose SQL — they call these, and
 * the queries live in `src/server/repository.ts` where they are tested against
 * a real Postgres.
 *
 * Every function returns a value the browser can use rather than throwing on a
 * missing database. With no `DATABASE_URL` they answer "not connected" and the
 * providers stay on their local stand-in, which is what keeps the app working
 * for someone who has just cloned it.
 */

export async function isDatabaseOn(): Promise<boolean> {
  return databaseConfigured() && pool() !== null;
}

/** Orders for one phone number, newest first, whole. */
export async function fetchOrders(phone: string): Promise<readonly Order[]> {
  const db = pool();
  if (db === null || phone === "") return [];

  const summaries = await listOrders(db, phone);

  // Sequential on purpose: a pool of five and a customer with forty orders
  // would otherwise open forty connections at once and get none of them.
  const orders: Order[] = [];
  for (const summary of summaries) {
    const order = await getOrder(db, summary.code);
    if (order !== null) orders.push(order);
  }

  return orders;
}

export async function fetchOrder(code: string): Promise<Order | null> {
  const db = pool();
  return db === null ? null : getOrder(db, code);
}

/** Every order in the shop, for the packing queue. */
export async function fetchAllOrders(limit = 100): Promise<readonly Order[]> {
  const db = pool();
  if (db === null) return [];

  const { rows } = await db.query<{ code: string }>(
    `select code from orders order by placed_at desc limit $1`,
    [limit],
  );

  const orders: Order[] = [];
  for (const row of rows) {
    const order = await getOrder(db, row.code);
    if (order !== null) orders.push(order);
  }

  return orders;
}

export async function saveOrder(order: Order, fromWalletKobo: Kobo): Promise<boolean> {
  const db = pool();
  if (db === null) return false;

  await inTransaction(db, (tx) => placeOrder(tx, { order, fromWalletKobo }));
  return true;
}

export async function moveOrder(code: string, to: OrderStatus, note = ""): Promise<boolean> {
  const db = pool();
  return db === null ? false : advanceOrder(db, code, to, note);
}

export async function saveWeight(
  code: string,
  productSlug: string,
  prepKey: string,
  actualG: Grams | null,
): Promise<boolean> {
  const db = pool();
  return db === null ? false : recordPackedWeight(db, code, productSlug, prepKey, actualG);
}

export async function fetchWallet(
  phone: string,
): Promise<{ entries: readonly WalletEntry[]; balanceKobo: Kobo }> {
  const db = pool();
  if (db === null || phone === "") return { entries: [], balanceKobo: 0 };

  return {
    entries: await walletEntries(db, phone),
    balanceKobo: await walletBalance(db, phone),
  };
}

export async function payIntoWallet(args: {
  phone?: string;
  amountKobo: Kobo;
  reason: "short_weight" | "complaint_refund" | "goodwill";
  orderCode: string | null;
}): Promise<boolean> {
  const db = pool();
  if (db === null) return false;

  await creditWallet(db, args);
  return true;
}

export async function fetchComplaint(orderCode: string): Promise<Complaint | null> {
  const db = pool();
  return db === null ? null : complaintFor(db, orderCode);
}

export async function sendComplaint(args: {
  orderCode: string;
  phone: string;
  kind: ComplaintKind;
  detail: string;
  deliveredAt: number;
  withinWindow: boolean;
}): Promise<boolean> {
  const db = pool();
  if (db === null) return false;

  return (await raiseComplaint(db, args)) !== null;
}

export async function settleComplaint(args: {
  orderCode: string;
  amountKobo: Kobo;
  note: string;
}): Promise<boolean> {
  const db = pool();
  if (db === null) return false;

  // The refund and the wallet movement are one transaction: marking a
  // complaint refunded without paying it is a note claiming we paid.
  return inTransaction(db, (tx) => refundComplaint(tx, args));
}
