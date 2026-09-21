import type { Kobo } from "./types";

/**
 * The wallet.
 *
 * Two things the shop has been promising on screen since the first milestone
 * finally have somewhere to land: the difference when an order is packed under
 * what was ordered, and a refund when something arrives wrong.
 *
 * It is a **ledger, not a balance**. A single number that goes up and down
 * cannot answer "why do I have ₦882?", and that is the first question anyone
 * asks about money that appeared without them paying it in. Every movement
 * keeps its reason and the order it came from, and the balance is derived.
 *
 * Three decisions worth stating:
 *
 *  1. **Credit never expires.** Expiring money the shop already owes someone
 *     is a way of not paying it. If that ever changes it must be a deliberate
 *     new entry type, not a silent sweep.
 *  2. **The balance cannot go negative.** Spending is clamped at what is
 *     there, so no path through this file can leave a customer owing the shop
 *     money they never agreed to borrow.
 *  3. **Entries are append-only.** Correcting a mistake is another entry, not
 *     an edit, so the history still explains the balance afterwards.
 */

export type WalletReason =
  /** Packed under what was ordered — the difference comes back. */
  | "short_weight"
  /** Something was wrong with the order and we refunded it. */
  | "complaint_refund"
  /** Spent against a later order. */
  | "spent"
  /** Put right by hand, when the shop owes something the rules did not catch. */
  | "goodwill";

export interface WalletEntry {
  readonly id: string;
  readonly at: number;
  /** Positive puts money in, negative takes it out. Never zero. */
  readonly amountKobo: Kobo;
  readonly reason: WalletReason;
  /** The order this movement belongs to, where there is one. */
  readonly orderId: string | null;
  readonly note: string;
}

export function balanceKobo(entries: readonly WalletEntry[]): Kobo {
  return entries.reduce((sum, e) => sum + e.amountKobo, 0);
}

const LABELS: Record<WalletReason, string> = {
  short_weight: "Packed under",
  complaint_refund: "Refund",
  spent: "Used on an order",
  goodwill: "Put right",
};

export function reasonLabel(reason: WalletReason): string {
  return LABELS[reason];
}

function entryId(at: number, seed: string): string {
  return `w-${at.toString(36)}-${seed}`;
}

/**
 * Put money in.
 *
 * Credits are **idempotent per order and reason**: packing an order, changing
 * a weight and packing it again must not pay the customer twice. Re-crediting
 * the same order for the same reason replaces the earlier entry rather than
 * adding to it.
 */
export function credit(
  entries: readonly WalletEntry[],
  args: {
    readonly amountKobo: Kobo;
    readonly reason: Exclude<WalletReason, "spent">;
    readonly orderId: string | null;
    readonly note: string;
    readonly at: number;
  },
): readonly WalletEntry[] {
  if (args.amountKobo <= 0) return entries;

  const without =
    args.orderId === null
      ? entries
      : entries.filter((e) => !(e.orderId === args.orderId && e.reason === args.reason));

  return [
    ...without,
    {
      id: entryId(args.at, `${args.orderId ?? "x"}-${args.reason}`),
      at: args.at,
      amountKobo: args.amountKobo,
      reason: args.reason,
      orderId: args.orderId,
      note: args.note,
    },
  ];
}

export interface SpendResult {
  readonly entries: readonly WalletEntry[];
  /** What was actually taken — never more than the balance or the bill. */
  readonly spentKobo: Kobo;
  /** What is left to pay by other means. */
  readonly remainingKobo: Kobo;
}

/**
 * Spend against a bill.
 *
 * Takes the smaller of the balance and the bill, so a wallet cannot overpay an
 * order and cannot go negative. The rest of the bill is returned rather than
 * assumed to be zero.
 */
export function spend(
  entries: readonly WalletEntry[],
  args: { readonly billKobo: Kobo; readonly orderId: string; readonly at: number },
): SpendResult {
  const available = balanceKobo(entries);
  const spentKobo = Math.max(0, Math.min(available, args.billKobo));

  if (spentKobo === 0) {
    return { entries, spentKobo: 0, remainingKobo: Math.max(0, args.billKobo) };
  }

  return {
    entries: [
      ...entries,
      {
        id: entryId(args.at, `${args.orderId}-spent`),
        at: args.at,
        amountKobo: -spentKobo,
        reason: "spent",
        orderId: args.orderId,
        note: `Used on ${args.orderId}`,
      },
    ],
    spentKobo,
    remainingKobo: args.billKobo - spentKobo,
  };
}

/** How much of a bill this wallet would cover, without moving anything. */
export function coverageKobo(entries: readonly WalletEntry[], billKobo: Kobo): Kobo {
  return Math.max(0, Math.min(balanceKobo(entries), Math.max(0, billKobo)));
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_VERSION = 1;
export const WALLET_STORAGE_KEY = "oneestore.wallet.v1";

export function serializeWallet(entries: readonly WalletEntry[]): string {
  return JSON.stringify({ v: STORAGE_VERSION, entries });
}

export function parseWallet(raw: string | null): readonly WalletEntry[] {
  if (raw === null) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];

    const { v, entries } = parsed as { v?: unknown; entries?: unknown };
    if (v !== STORAGE_VERSION || !Array.isArray(entries)) return [];

    return entries.filter(isEntry);
  } catch {
    return [];
  }
}

const REASONS: readonly string[] = ["short_weight", "complaint_refund", "spent", "goodwill"];

function isEntry(value: unknown): value is WalletEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Partial<WalletEntry>;

  return (
    typeof e.id === "string" &&
    typeof e.at === "number" &&
    typeof e.amountKobo === "number" &&
    Number.isInteger(e.amountKobo) &&
    e.amountKobo !== 0 &&
    typeof e.reason === "string" &&
    REASONS.includes(e.reason) &&
    (e.orderId === null || typeof e.orderId === "string") &&
    typeof e.note === "string"
  );
}
