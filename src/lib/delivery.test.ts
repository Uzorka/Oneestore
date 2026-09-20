import { describe, expect, it } from "vitest";

import {
  FREE_DELIVERY_THRESHOLD_KOBO,
  SAME_DAY_CUTOFF_HOUR,
  ZONES,
  availableSlots,
  boxCountFor,
  deliveryDays,
  deliveryFeeKobo,
  findZone,
  isBeforeCutoff,
  isDeliveryDay,
  lagosTime,
  timeToCutoff,
  toFreeDeliveryKobo,
} from "./delivery";
import { naira } from "./money";
import type { DeliveryZone } from "./types";

const island = findZone("island") as DeliveryZone;

/** A UTC instant that is `hour`:`minute` in Lagos (UTC+1) on a given date. */
function lagos(isoDate: string, hour: number, minute = 0): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y as number, (m as number) - 1, d as number, hour - 1, minute));
}

// 2026-09-18 is a Friday; 2026-09-21 is a Monday.
const FRIDAY = "2026-09-18";
const SUNDAY = "2026-09-20";
const MONDAY = "2026-09-21";

describe("zones", () => {
  it("has a fee for every zone and finds them by id", () => {
    expect(ZONES.length).toBeGreaterThan(0);
    for (const zone of ZONES) {
      expect(zone.feeKobo, zone.id).toBeGreaterThan(0);
      expect(findZone(zone.id)).toEqual(zone);
      expect(zone.areas.length, `${zone.id} names its areas`).toBeGreaterThan(0);
    }
    expect(findZone("atlantis")).toBeUndefined();
  });

  it("charges the zone fee below the free-delivery threshold", () => {
    expect(deliveryFeeKobo(island, naira(50_000))).toBe(island.feeKobo);
    expect(deliveryFeeKobo(island, FREE_DELIVERY_THRESHOLD_KOBO - 1)).toBe(island.feeKobo);
  });

  it("waives it exactly at the threshold, not a kobo later", () => {
    expect(deliveryFeeKobo(island, FREE_DELIVERY_THRESHOLD_KOBO)).toBe(0);
    expect(deliveryFeeKobo(island, FREE_DELIVERY_THRESHOLD_KOBO + naira(1))).toBe(0);
  });

  it("says how much more earns free delivery", () => {
    expect(toFreeDeliveryKobo(naira(74_950))).toBe(naira(25_050));
    expect(toFreeDeliveryKobo(FREE_DELIVERY_THRESHOLD_KOBO)).toBe(0);
    // never negative — an over-threshold basket does not owe us weight
    expect(toFreeDeliveryKobo(naira(250_000))).toBe(0);
  });
});

describe("lagosTime", () => {
  it("reads a UTC instant as Lagos wall clock", () => {
    const t = lagosTime(new Date("2026-09-18T09:30:00Z"));
    expect(t.hour).toBe(10);
    expect(t.minute).toBe(30);
    expect(t.isoDate).toBe("2026-09-18");
    expect(t.weekday).toBe(5); // Friday
  });

  it("rolls the date over at Lagos midnight, not UTC midnight", () => {
    // 23:30 UTC is already 00:30 the next day in Lagos
    const t = lagosTime(new Date("2026-09-18T23:30:00Z"));
    expect(t.isoDate).toBe("2026-09-19");
    expect(t.hour).toBe(0);
  });
});

describe("the same-day cut-off", () => {
  it("is 11 AM Lagos time", () => {
    expect(SAME_DAY_CUTOFF_HOUR).toBe(11);
  });

  it("is open before and closed after", () => {
    expect(isBeforeCutoff(lagos(FRIDAY, 8, 46))).toBe(true);
    expect(isBeforeCutoff(lagos(FRIDAY, 10, 59))).toBe(true);
    expect(isBeforeCutoff(lagos(FRIDAY, 11, 0))).toBe(false);
    expect(isBeforeCutoff(lagos(FRIDAY, 15, 0))).toBe(false);
  });

  it("counts down honestly to the minute", () => {
    expect(timeToCutoff(lagos(FRIDAY, 8, 46))).toEqual({ hours: 2, minutes: 14 });
    expect(timeToCutoff(lagos(FRIDAY, 10, 59))).toEqual({ hours: 0, minutes: 1 });
    expect(timeToCutoff(lagos(FRIDAY, 6, 0))).toEqual({ hours: 5, minutes: 0 });
  });

  it("returns null once it has passed rather than a negative countdown", () => {
    expect(timeToCutoff(lagos(FRIDAY, 11, 0))).toBeNull();
    expect(timeToCutoff(lagos(FRIDAY, 23, 59))).toBeNull();
  });
});

describe("delivery days", () => {
  it("closes Mondays because the boats do not go out on Sundays", () => {
    expect(isDeliveryDay(1)).toBe(false);
    for (const weekday of [0, 2, 3, 4, 5, 6]) {
      expect(isDeliveryDay(weekday), `weekday ${weekday}`).toBe(true);
    }
  });

  it("marks Monday unavailable and says why", () => {
    const days = deliveryDays(lagos(SUNDAY, 8, 0), 3);
    const monday = days.find((d) => d.isoDate === MONDAY);

    expect(monday?.available).toBe(false);
    expect(monday?.unavailableReason).toMatch(/Monday/);
  });

  it("never leaves an unavailable day without an explanation", () => {
    for (const day of deliveryDays(lagos(FRIDAY, 14, 0), 5)) {
      if (!day.available) expect(day.unavailableReason, day.isoDate).toBeTruthy();
    }
  });

  it("reports the day of the month for the date selector", () => {
    const days = deliveryDays(lagos(FRIDAY, 8, 0), 2);
    expect(days[0]?.dayOfMonth).toBe(18);
    expect(days[1]?.dayOfMonth).toBe(19);
  });
});

describe("delivery slots", () => {
  it("offers today's evening window before the cut-off", () => {
    const slots = availableSlots(lagos(FRIDAY, 8, 46), 1);
    const evening = slots.find((s) => s.isoDate === FRIDAY && s.windowId === "evening");

    expect(evening?.available).toBe(true);
    expect(evening?.windowLabel).toBe("4 – 8 PM");
  });

  it("closes every window today once the cut-off has passed", () => {
    const slots = availableSlots(lagos(FRIDAY, 12, 0), 1);
    expect(slots.every((s) => !s.available)).toBe(true);
    expect(slots.every((s) => (s.unavailableReason ?? "").includes("cut-off"))).toBe(true);
  });

  it("does not offer a window that has already started", () => {
    // 10 AM: still before the cut-off, but the 9 AM window is gone
    const slots = availableSlots(lagos(FRIDAY, 10, 0), 1);
    const morning = slots.find((s) => s.windowId === "morning");
    const evening = slots.find((s) => s.windowId === "evening");

    expect(morning?.available).toBe(false);
    expect(morning?.unavailableReason).toMatch(/already started/);
    expect(evening?.available).toBe(true);
  });

  it("still offers tomorrow after today's cut-off has passed", () => {
    const slots = availableSlots(lagos(FRIDAY, 15, 0), 2);
    const tomorrow = slots.filter((s) => s.isoDate === "2026-09-19");
    expect(tomorrow.some((s) => s.available)).toBe(true);
  });

  it("gives three windows per day for the days requested", () => {
    const slots = availableSlots(lagos(FRIDAY, 8, 0), 4);
    expect(slots).toHaveLength(12);
    expect(new Set(slots.map((s) => s.isoDate)).size).toBe(4);
  });

  it("crosses a month boundary without losing a day", () => {
    const slots = availableSlots(lagos("2026-09-29", 8, 0), 4);
    const dates = [...new Set(slots.map((s) => s.isoDate))];
    expect(dates).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("packing", () => {
  it("works out how many insulated boxes an order needs", () => {
    expect(boxCountFor(0)).toBe(1);
    expect(boxCountFor(6500)).toBe(1);
    expect(boxCountFor(8000)).toBe(1);
    expect(boxCountFor(8001)).toBe(2);
    expect(boxCountFor(20_000)).toBe(3);
  });
});
