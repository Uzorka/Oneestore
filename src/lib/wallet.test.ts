import { describe, expect, it } from "vitest";

import { naira } from "./money";
import {
  balanceKobo,
  coverageKobo,
  credit,
  parseWallet,
  reasonLabel,
  serializeWallet,
  spend,
} from "./wallet";
import type { WalletEntry, WalletReason } from "./wallet";

const put = (entries: readonly WalletEntry[], amount: number, orderId = "ONE-A", at = 1) =>
  credit(entries, { amountKobo: amount, reason: "short_weight", orderId, note: "Packed under", at });

describe("the balance", () => {
  it("starts empty", () => {
    expect(balanceKobo([])).toBe(0);
  });

  it("is the sum of the ledger, not a number kept alongside it", () => {
    let w = put([], naira(882));
    w = credit(w, { amountKobo: naira(1200), reason: "complaint_refund", orderId: "ONE-B", note: "Snapper was off", at: 2 });

    expect(balanceKobo(w)).toBe(naira(2082));
    expect(w).toHaveLength(2);
  });

  it("keeps the reason for every movement, because that is the first question asked", () => {
    const [entry] = put([], naira(882));
    expect(entry?.reason).toBe("short_weight");
    expect(entry?.orderId).toBe("ONE-A");
    expect(entry?.note).toBe("Packed under");
  });
});

describe("crediting", () => {
  it("ignores a credit of nothing", () => {
    expect(put([], 0)).toEqual([]);
    expect(put([], -500)).toEqual([]);
  });

  it("does not pay twice when an order is weighed again", () => {
    // A packer corrects a weight and saves; the customer must not be paid
    // for the same shortfall a second time.
    let w = put([], naira(882));
    w = put(w, naira(950));

    expect(w).toHaveLength(1);
    expect(balanceKobo(w)).toBe(naira(950));
  });

  it("keeps a refund separate from a short weight on the same order", () => {
    let w = put([], naira(882));
    w = credit(w, { amountKobo: naira(5000), reason: "complaint_refund", orderId: "ONE-A", note: "Off", at: 3 });

    // Different reasons, same order: both are owed.
    expect(w).toHaveLength(2);
    expect(balanceKobo(w)).toBe(naira(5882));
  });

  it("keeps credits from different orders apart", () => {
    let w = put([], naira(882), "ONE-A");
    w = put(w, naira(400), "ONE-B", 2);

    expect(w).toHaveLength(2);
    expect(balanceKobo(w)).toBe(naira(1282));
  });

  it("can put something right by hand", () => {
    const w = credit([], { amountKobo: naira(2000), reason: "goodwill", orderId: null, note: "Late twice", at: 1 });
    expect(balanceKobo(w)).toBe(naira(2000));
  });
});

describe("spending", () => {
  it("covers a bill it can afford and leaves nothing to pay", () => {
    const w = put([], naira(5000));
    const result = spend(w, { billKobo: naira(3000), orderId: "ONE-C", at: 5 });

    expect(result.spentKobo).toBe(naira(3000));
    expect(result.remainingKobo).toBe(0);
    expect(balanceKobo(result.entries)).toBe(naira(2000));
  });

  it("pays what it can and hands back the rest of the bill", () => {
    const w = put([], naira(2000));
    const result = spend(w, { billKobo: naira(9000), orderId: "ONE-C", at: 5 });

    expect(result.spentKobo).toBe(naira(2000));
    expect(result.remainingKobo).toBe(naira(7000));
    expect(balanceKobo(result.entries)).toBe(0);
  });

  it("never goes negative, whatever it is asked to pay", () => {
    const w = put([], naira(1000));

    for (const bill of [0, naira(1), naira(1000), naira(50_000)]) {
      const result = spend(w, { billKobo: bill, orderId: "ONE-C", at: 5 });
      expect(balanceKobo(result.entries)).toBeGreaterThanOrEqual(0);
      expect(result.spentKobo).toBeLessThanOrEqual(naira(1000));
    }
  });

  it("does nothing at all with an empty wallet", () => {
    const result = spend([], { billKobo: naira(4000), orderId: "ONE-C", at: 5 });

    expect(result.entries).toEqual([]);
    expect(result.spentKobo).toBe(0);
    expect(result.remainingKobo).toBe(naira(4000));
  });

  it("refuses to be tricked into paying out by a negative bill", () => {
    const w = put([], naira(1000));
    const result = spend(w, { billKobo: -naira(5000), orderId: "ONE-C", at: 5 });

    expect(result.spentKobo).toBe(0);
    expect(result.remainingKobo).toBe(0);
    expect(balanceKobo(result.entries)).toBe(naira(1000));
  });

  it("says what it would cover without moving anything", () => {
    const w = put([], naira(2000));

    expect(coverageKobo(w, naira(9000))).toBe(naira(2000));
    expect(coverageKobo(w, naira(500))).toBe(naira(500));
    expect(coverageKobo([], naira(500))).toBe(0);
    // The ledger is untouched by asking.
    expect(balanceKobo(w)).toBe(naira(2000));
  });

  it("leaves a record of what the money was used on", () => {
    const w = put([], naira(5000));
    const { entries } = spend(w, { billKobo: naira(3000), orderId: "ONE-C", at: 5 });
    const last = entries[entries.length - 1];

    expect(last?.reason).toBe("spent");
    expect(last?.amountKobo).toBe(-naira(3000));
    expect(last?.orderId).toBe("ONE-C");
  });
});

describe("labels", () => {
  it("gives every reason words a customer would use", () => {
    for (const reason of ["short_weight", "complaint_refund", "spent", "goodwill"] as WalletReason[]) {
      expect(reasonLabel(reason).length).toBeGreaterThan(0);
    }
  });
});

describe("persistence", () => {
  it("round-trips", () => {
    let w = put([], naira(882));
    w = spend(w, { billKobo: naira(500), orderId: "ONE-C", at: 6 }).entries;

    expect(parseWallet(serializeWallet(w))).toEqual(w);
  });

  it("survives junk rather than losing the whole ledger", () => {
    expect(parseWallet(null)).toEqual([]);
    expect(parseWallet("not json")).toEqual([]);
    expect(parseWallet(JSON.stringify({ v: 99, entries: [] }))).toEqual([]);
  });

  it("drops entries that are not movements and keeps the ones that are", () => {
    const [good] = put([], naira(882));
    const raw = JSON.stringify({
      v: 1,
      entries: [good, { id: "x" }, null, { ...good, amountKobo: 0 }, { ...good, reason: "invented" }],
    });

    expect(parseWallet(raw)).toEqual([good]);
  });

  it("drops a fractional amount, because kobo are integers", () => {
    const [good] = put([], naira(882));
    const raw = JSON.stringify({ v: 1, entries: [{ ...good, amountKobo: 12.5 }] });

    expect(parseWallet(raw)).toEqual([]);
  });
});
