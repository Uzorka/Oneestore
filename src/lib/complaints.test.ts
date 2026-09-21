import { describe, expect, it } from "vitest";

import {
  COMPLAINT_WINDOW_MS,
  decline,
  forOrder,
  formatTimeLeft,
  isOpen,
  isWithinWindow,
  kindLabel,
  parseComplaints,
  raise,
  refund,
  serializeComplaints,
  statusLabel,
  timeLeftMs,
} from "./complaints";
import { naira } from "./money";
import type { ComplaintKind, ComplaintStatus } from "./complaints";

const DELIVERED = 1_700_000_000_000;
const MINUTE = 60_000;

const at = (minutesAfter: number) => DELIVERED + minutesAfter * MINUTE;

const complain = (minutesAfter: number) =>
  raise({
    orderId: "ONE-A",
    deliveredAt: DELIVERED,
    kind: "not_fresh",
    detail: "  The snapper smells off  ",
    at: at(minutesAfter),
  });

describe("the two-hour window", () => {
  it("is two hours from delivery, not from ordering", () => {
    expect(COMPLAINT_WINDOW_MS).toBe(2 * 60 * 60 * 1000);
    expect(isWithinWindow(DELIVERED, at(119))).toBe(true);
    expect(isWithinWindow(DELIVERED, at(121))).toBe(false);
  });

  it("counts down and stops at zero", () => {
    expect(timeLeftMs(DELIVERED, at(0))).toBe(COMPLAINT_WINDOW_MS);
    expect(timeLeftMs(DELIVERED, at(90))).toBe(30 * MINUTE);
    expect(timeLeftMs(DELIVERED, at(500))).toBe(0);
  });

  it("says how long is left in words someone can act on", () => {
    expect(formatTimeLeft(107 * MINUTE)).toBe("1h 47m");
    expect(formatTimeLeft(30 * MINUTE)).toBe("30m");
    expect(formatTimeLeft(0)).toBe("closed");
  });
});

describe("raising one", () => {
  it("is settled on the spot inside the window", () => {
    const c = complain(45);
    expect(c.withinWindow).toBe(true);
    expect(c.status).toBe("open");
  });

  it("still opens after the window, but goes to a person", () => {
    // Eleven minutes late with a genuine complaint is exactly the customer
    // the shop cannot afford to turn away. The door does not shut.
    const c = complain(131);
    expect(c.withinWindow).toBe(false);
    expect(c.status).toBe("needs_review");
    expect(isOpen(c)).toBe(true);
  });

  it("tidies what was typed", () => {
    expect(complain(10).detail).toBe("The snapper smells off");
  });

  it("can be about particular lines, or about the whole order", () => {
    const whole = complain(10);
    expect(whole.lineKeys).toEqual([]);

    const line = raise({
      orderId: "ONE-A",
      deliveredAt: DELIVERED,
      kind: "wrong_weight",
      detail: "Short",
      lineKeys: ["croaker:whole"],
      at: at(10),
    });
    expect(line.lineKeys).toEqual(["croaker:whole"]);
  });

  it("starts owing nothing until someone decides", () => {
    const c = complain(10);
    expect(c.refundedKobo).toBe(0);
    expect(c.resolvedAt).toBeNull();
  });
});

describe("resolving one", () => {
  it("refunds and records what was paid back", () => {
    const c = refund(complain(10), naira(9800), at(20), "Photo shows it clearly. Full refund.");

    expect(c.status).toBe("refunded");
    expect(c.refundedKobo).toBe(naira(9800));
    expect(c.resolvedAt).toBe(at(20));
    expect(isOpen(c)).toBe(false);
  });

  it("will not pay out twice on the same complaint", () => {
    const once = refund(complain(10), naira(9800), at(20), "Refunded");
    const twice = refund(once, naira(9800), at(30), "Again");

    expect(twice).toBe(once);
  });

  it("will not reopen a settled complaint by declining it", () => {
    const refunded = refund(complain(10), naira(5000), at(20), "Refunded");
    expect(decline(refunded, at(30), "Changed my mind")).toBe(refunded);
  });

  it("refuses to decline without a reason", () => {
    // "Declined" with nothing after it is how a complaint becomes a chargeback.
    const c = complain(10);
    expect(decline(c, at(20), "   ")).toBe(c);
    expect(decline(c, at(20), "")).toBe(c);
  });

  it("declines with a reason, and keeps it", () => {
    const c = decline(complain(10), at(20), "Photo shows a different shop's packaging.");

    expect(c.status).toBe("declined");
    expect(c.resolutionNote).toBe("Photo shows a different shop's packaging.");
    expect(c.refundedKobo).toBe(0);
  });

  it("never records a negative refund", () => {
    expect(refund(complain(10), -naira(500), at(20), "x").refundedKobo).toBe(0);
  });
});

describe("finding one", () => {
  it("finds the complaint against an order", () => {
    const list = [complain(10)];
    expect(forOrder(list, "ONE-A")?.orderId).toBe("ONE-A");
    expect(forOrder(list, "ONE-B")).toBeUndefined();
  });
});

describe("labels", () => {
  it("gives every kind and status plain words", () => {
    for (const kind of ["not_fresh", "wrong_weight", "wrong_item", "missing_item", "late", "other"] as ComplaintKind[]) {
      expect(kindLabel(kind).length).toBeGreaterThan(0);
    }
    for (const status of ["open", "needs_review", "refunded", "declined"] as ComplaintStatus[]) {
      expect(statusLabel(status).length).toBeGreaterThan(0);
    }
  });
});

describe("persistence", () => {
  it("round-trips", () => {
    const list = [refund(complain(10), naira(1000), at(20), "ok"), complain(200)];
    expect(parseComplaints(serializeComplaints(list))).toEqual(list);
  });

  it("survives junk", () => {
    expect(parseComplaints(null)).toEqual([]);
    expect(parseComplaints("nope")).toEqual([]);
    expect(parseComplaints(JSON.stringify({ v: 9, complaints: [] }))).toEqual([]);
  });

  it("drops entries that are not complaints", () => {
    const good = complain(10);
    const raw = JSON.stringify({
      v: 1,
      complaints: [good, { id: "x" }, null, { ...good, kind: "invented" }, { ...good, status: "sorted" }],
    });

    expect(parseComplaints(raw)).toEqual([good]);
  });
});
