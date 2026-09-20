import type { DeliveryZone, Grams, Kobo } from "./types";

/**
 * Delivery: zones, fees, the same-day cut-off and the slots that follow from it.
 *
 * Lagos is priced by zone rather than by distance. Journey time here is decided
 * by the Third Mainland Bridge and the hour of day, not by kilometres, so a
 * distance calculation would quote confidently wrong numbers.
 *
 * Every function takes `now` explicitly. Nothing reads the clock on its own,
 * so the cut-off is testable and server and client cannot disagree.
 */

/** Free delivery once the seafood alone reaches this. */
export const FREE_DELIVERY_THRESHOLD_KOBO: Kobo = 10_000_000; // ₦100,000

/** Order before this hour (Lagos time) for delivery today. */
export const SAME_DAY_CUTOFF_HOUR = 11;

/** Lagos is UTC+1 year round — no daylight saving to account for. */
const LAGOS_UTC_OFFSET_HOURS = 1;

export const ZONES: readonly DeliveryZone[] = [
  {
    id: "island",
    name: "Lagos Island",
    areas: ["Victoria Island", "Ikoyi", "Lekki Phase 1"],
    feeKobo: 250_000,
  },
  {
    id: "lekki-ajah",
    name: "Lekki – Ajah",
    areas: ["Sangotedo", "Awoyaya", "Ajah"],
    feeKobo: 350_000,
  },
  {
    id: "mainland-central",
    name: "Mainland central",
    areas: ["Ikeja", "Yaba", "Surulere", "Maryland"],
    feeKobo: 200_000,
  },
  {
    id: "outer",
    name: "Outer Lagos",
    areas: ["Ikorodu", "Alimosho", "Epe", "Badagry"],
    feeKobo: 450_000,
  },
] as const;

export function findZone(zoneId: string): DeliveryZone | undefined {
  return ZONES.find((z) => z.id === zoneId);
}

/** What delivery costs, given how much seafood is in the basket. */
export function deliveryFeeKobo(zone: DeliveryZone, goodsKobo: Kobo): Kobo {
  return goodsKobo >= FREE_DELIVERY_THRESHOLD_KOBO ? 0 : zone.feeKobo;
}

/** How much more seafood earns free delivery, or 0 once it is earned. */
export function toFreeDeliveryKobo(goodsKobo: Kobo): Kobo {
  return Math.max(0, FREE_DELIVERY_THRESHOLD_KOBO - goodsKobo);
}

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

export interface LagosTime {
  readonly year: number;
  /** 1–12. */
  readonly month: number;
  /** 1–31. */
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** 0 = Sunday. */
  readonly weekday: number;
  /** `YYYY-MM-DD` in Lagos time. */
  readonly isoDate: string;
}

/** Read a UTC instant as Lagos wall-clock time. */
export function lagosTime(now: Date): LagosTime {
  const shifted = new Date(now.getTime() + LAGOS_UTC_OFFSET_HOURS * 3600_000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();

  return {
    year,
    month,
    day,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
    isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/** Is there still time to order for delivery today? */
export function isBeforeCutoff(now: Date): boolean {
  const t = lagosTime(now);
  return t.hour < SAME_DAY_CUTOFF_HOUR;
}

/**
 * Time left before the same-day cut-off, or null once it has passed.
 *
 * This drives the countdown the storefront shows, which is the single strongest
 * nudge on the page — so it has to be honest to the minute.
 */
export function timeToCutoff(now: Date): { readonly hours: number; readonly minutes: number } | null {
  const t = lagosTime(now);
  if (t.hour >= SAME_DAY_CUTOFF_HOUR) return null;

  const minutesLeft = (SAME_DAY_CUTOFF_HOUR - t.hour) * 60 - t.minute;
  return { hours: Math.floor(minutesLeft / 60), minutes: minutesLeft % 60 };
}

/**
 * Mondays are closed: the boats do not go out on Sundays, so there is nothing
 * landed to deliver. Unavailable days say this rather than greying out.
 */
export function isDeliveryDay(weekday: number): boolean {
  return weekday !== 1;
}

export interface DeliverySlot {
  /** `YYYY-MM-DD` in Lagos time. */
  readonly isoDate: string;
  readonly weekday: number;
  readonly windowId: string;
  readonly windowLabel: string;
  readonly available: boolean;
  /** Why it cannot be chosen — shown to the customer, never left blank. */
  readonly unavailableReason: string | null;
}

const WINDOWS = [
  { id: "morning", label: "9 AM – 1 PM", startHour: 9 },
  { id: "afternoon", label: "12 – 4 PM", startHour: 12 },
  { id: "evening", label: "4 – 8 PM", startHour: 16 },
] as const;

/**
 * The delivery slots on offer over the next `days` days.
 *
 * Today only offers windows that start after the cut-off has been met and that
 * have not already begun.
 */
export function availableSlots(now: Date, days = 5): readonly DeliverySlot[] {
  const t = lagosTime(now);
  const beforeCutoff = isBeforeCutoff(now);
  const slots: DeliverySlot[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const dayStart = new Date(
      Date.UTC(t.year, t.month - 1, t.day + offset, 12 - LAGOS_UTC_OFFSET_HOURS),
    );
    const day = lagosTime(dayStart);
    const isToday = offset === 0;

    for (const w of WINDOWS) {
      let available = true;
      let reason: string | null = null;

      if (!isDeliveryDay(day.weekday)) {
        available = false;
        reason = "Closed on Mondays — the boats do not go out on Sundays";
      } else if (isToday && !beforeCutoff) {
        available = false;
        reason = `Today's ${SAME_DAY_CUTOFF_HOUR} AM cut-off has passed`;
      } else if (isToday && w.startHour <= t.hour) {
        available = false;
        reason = "This window has already started";
      }

      slots.push({
        isoDate: day.isoDate,
        weekday: day.weekday,
        windowId: w.id,
        windowLabel: w.label,
        available,
        unavailableReason: reason,
      });
    }
  }

  return slots;
}

/** The days the date selector shows, with whether anything can be booked. */
export function deliveryDays(
  now: Date,
  days = 5,
): readonly {
  readonly isoDate: string;
  readonly weekday: number;
  readonly dayOfMonth: number;
  readonly available: boolean;
  readonly unavailableReason: string | null;
}[] {
  const slots = availableSlots(now, days);
  const byDate = new Map<string, DeliverySlot[]>();

  for (const slot of slots) {
    const existing = byDate.get(slot.isoDate);
    if (existing === undefined) byDate.set(slot.isoDate, [slot]);
    else existing.push(slot);
  }

  return [...byDate.entries()].map(([isoDate, daySlots]) => {
    const openSlot = daySlots.find((s) => s.available);
    const first = daySlots[0];
    return {
      isoDate,
      weekday: first === undefined ? 0 : first.weekday,
      dayOfMonth: Number(isoDate.slice(8, 10)),
      available: openSlot !== undefined,
      unavailableReason: openSlot !== undefined ? null : (first?.unavailableReason ?? null),
    };
  });
}

/**
 * Cold chain: how long a packed box stays cold. Used to warn a customer whose
 * chosen window is far enough out that they should be home for it.
 */
export const INSULATED_BOX_HOLD_HOURS = 6;

/** A rough packing-weight note for the rider manifest. */
export function boxCountFor(totalWeightG: Grams): number {
  const perBoxG = 8000;
  return Math.max(1, Math.ceil(totalWeightG / perBoxG));
}
