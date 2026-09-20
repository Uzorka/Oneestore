import type { Grams, Kobo } from "./types";

/** ₦1 in kobo. */
export const KOBO_PER_NAIRA = 100;

/** 1 kg in grams. */
export const G_PER_KG = 1000;

/**
 * Naira to kobo. Only for reading configured or seeded prices — never for
 * arithmetic on a total, which stays in kobo throughout.
 */
export function naira(amount: number): Kobo {
  return Math.round(amount * KOBO_PER_NAIRA);
}

/**
 * Price for a weight, given a price per kilogram.
 *
 * This is the one multiplication the whole business rests on, so it rounds
 * once, to the kobo, half-up. Both operands are integers and the largest
 * realistic product (₦25,000/kg × 24 kg) is about 6e10 — far inside the safe
 * integer range, so there is no float drift to accumulate.
 */
export function priceForWeight(perKgKobo: Kobo, weightG: Grams): Kobo {
  return Math.round((perKgKobo * weightG) / G_PER_KG);
}

/**
 * Format kobo as naira for display: `₦9,800`, or `₦9,800.50` when there is a
 * kobo remainder. Nigerian retail hides whole-naira decimals, and showing
 * `₦9,800.00` on a market board reads as a foreign import.
 */
export function formatNaira(amountKobo: Kobo): string {
  const negative = amountKobo < 0;
  const abs = Math.abs(amountKobo);
  const wholeNaira = Math.floor(abs / KOBO_PER_NAIRA);
  const remainder = abs % KOBO_PER_NAIRA;

  const body =
    remainder === 0
      ? wholeNaira.toLocaleString("en-NG")
      : `${wholeNaira.toLocaleString("en-NG")}.${String(remainder).padStart(2, "0")}`;

  return `${negative ? "−" : ""}₦${body}`;
}

/** `₦9,800/kg` */
export function formatPerKg(perKgKobo: Kobo): string {
  return `${formatNaira(perKgKobo)}/kg`;
}

/**
 * Format grams as kilograms: `2 kg`, `1.5 kg`, `750 g`.
 *
 * Under a kilogram people say grams, so that is what we show.
 */
export function formatWeight(weightG: Grams): string {
  if (weightG < G_PER_KG) return `${weightG} g`;

  const kg = weightG / G_PER_KG;
  if (weightG % G_PER_KG === 0) return `${kg} kg`;
  if (weightG % 100 === 0) return `${kg.toFixed(1)} kg`;
  return `${kg.toFixed(2)} kg`;
}
