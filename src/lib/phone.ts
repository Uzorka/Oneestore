/**
 * Nigerian phone numbers.
 *
 * The phone number is the account here — it is how a customer signs in, how
 * the rider reaches them, and where the WhatsApp updates go. So it has to
 * survive every way a Lagos customer will actually type it:
 *
 *   0803 412 8890      the way it is spoken and written locally
 *   +234 803 412 8890  the way a contact card stores it
 *   234 803 412 8890   the way some forms paste it
 *   08034128890        no spaces at all
 *
 * All four are the same person, so all four normalise to one canonical form.
 */

/** Canonical storage form: E.164, e.g. `+2348034128890`. */
export type E164 = string;

const NIGERIA_CC = "234";

/**
 * Mobile network codes in use in Nigeria, without the leading zero.
 *
 * Kept as a list rather than a loose `0\d{10}` pattern so a typo like 0703 vs
 * 0733 is caught at entry rather than at the door, when a rider cannot get
 * through.
 */
const MOBILE_PREFIXES = [
  // MTN
  "703", "704", "706", "803", "806", "810", "813", "814", "816", "903", "906", "913", "916",
  // Airtel
  "701", "708", "802", "808", "812", "901", "902", "904", "907", "912",
  // Glo
  "705", "805", "807", "811", "815", "905", "915",
  // 9mobile
  "809", "817", "818", "908", "909",
] as const;

/** Strip everything that is not a digit or a leading plus. */
function digitsOnly(input: string): string {
  return input.replace(/[^\d]/g, "");
}

/**
 * Reduce any of the accepted forms to the ten digits after the country code,
 * or null when it cannot be one.
 */
function toSubscriberDigits(input: string): string | null {
  const digits = digitsOnly(input);

  // +234 803 412 8890 / 234 803 412 8890
  if (digits.startsWith(NIGERIA_CC) && digits.length === 13) {
    return digits.slice(3);
  }

  // 0803 412 8890
  if (digits.startsWith("0") && digits.length === 11) {
    return digits.slice(1);
  }

  // 803 412 8890 — typed without the trunk zero
  if (digits.length === 10) return digits;

  return null;
}

export function isValidNigerianMobile(input: string): boolean {
  const subscriber = toSubscriberDigits(input);
  if (subscriber === null) return false;
  return MOBILE_PREFIXES.some((p) => subscriber.startsWith(p));
}

/** Normalise to E.164, or null if this is not a Nigerian mobile number. */
export function toE164(input: string): E164 | null {
  const subscriber = toSubscriberDigits(input);
  if (subscriber === null) return null;
  if (!MOBILE_PREFIXES.some((p) => subscriber.startsWith(p))) return null;
  return `+${NIGERIA_CC}${subscriber}`;
}

/**
 * How a Nigerian reads their own number back: `0803 412 8890`.
 *
 * Confirmation screens use this, not E.164 — nobody checks a delivery number
 * against `+2348034128890` and feels certain.
 */
export function formatNigerianMobile(input: string): string {
  const subscriber = toSubscriberDigits(input);
  if (subscriber === null) return input;
  return `0${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`;
}

/** Partly hidden, for showing where a code was sent: `0803 *** 8890`. */
export function maskNigerianMobile(input: string): string {
  const subscriber = toSubscriberDigits(input);
  if (subscriber === null) return input;
  return `0${subscriber.slice(0, 3)} *** ${subscriber.slice(6)}`;
}

/** The message a customer should see when their number will not do. */
export function phoneError(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return "We need a phone number — the rider will call it.";

  const digits = digitsOnly(trimmed);
  if (digits.length < 10) return "That number looks too short.";
  if (toSubscriberDigits(trimmed) === null) return "That number looks too long.";
  if (!isValidNigerianMobile(trimmed)) {
    return "We don't recognise that network. Check the first four digits.";
  }
  return null;
}
