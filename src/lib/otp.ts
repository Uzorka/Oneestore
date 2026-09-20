import type { E164 } from "./phone";

/**
 * Phone verification.
 *
 * All the rules live here as pure functions over an explicit clock, so they
 * can be tested without waiting six minutes for a code to expire. Nothing in
 * this file sends anything — see `SmsSender` at the bottom, which is the one
 * seam where Termii (or any other provider) plugs in.
 *
 * The limits exist because SMS costs money and an unprotected OTP endpoint is
 * a way to spend someone else's. Every one of them is enforced in the
 * verifier, not in the UI, because a UI check is a suggestion.
 */

export const CODE_LENGTH = 4;
export const CODE_TTL_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60_000;
/** Codes one number may request in a rolling hour. */
export const MAX_SENDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60_000;

export interface Challenge {
  readonly phone: E164;
  readonly code: string;
  readonly issuedAt: number;
  readonly attempts: number;
  /** When each code for this number went out, for the hourly ceiling. */
  readonly sendTimes: readonly number[];
}

export type VerifyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "expired" | "wrong" | "locked"; readonly message: string };

export type IssueResult =
  | { readonly ok: true; readonly challenge: Challenge }
  | { readonly ok: false; readonly reason: "cooldown" | "hourly"; readonly message: string; readonly retryAfterMs: number };

/**
 * A four-digit code.
 *
 * `crypto.getRandomValues` rather than `Math.random`: this is the only thing
 * standing between a stranger and someone's order history.
 */
export function generateCode(length: number = CODE_LENGTH): string {
  const digits = new Uint8Array(length);
  crypto.getRandomValues(digits);
  return Array.from(digits, (d) => String(d % 10)).join("");
}

/**
 * Issue a code, subject to the cooldown and the hourly ceiling.
 *
 * `previous` is the challenge already outstanding for this number, if any, so
 * resends are counted against the same budget.
 */
export function issueChallenge(args: {
  readonly phone: E164;
  readonly now: number;
  readonly previous?: Challenge;
  readonly code?: string;
}): IssueResult {
  const { phone, now, previous } = args;

  const recentSends = (previous?.sendTimes ?? []).filter((t) => now - t < HOUR_MS);

  const lastSend = recentSends[recentSends.length - 1];
  if (lastSend !== undefined && now - lastSend < RESEND_COOLDOWN_MS) {
    const retryAfterMs = RESEND_COOLDOWN_MS - (now - lastSend);
    return {
      ok: false,
      reason: "cooldown",
      retryAfterMs,
      message: `Wait ${Math.ceil(retryAfterMs / 1000)}s before asking for another code.`,
    };
  }

  if (recentSends.length >= MAX_SENDS_PER_HOUR) {
    const oldest = recentSends[0] as number;
    const retryAfterMs = HOUR_MS - (now - oldest);
    return {
      ok: false,
      reason: "hourly",
      retryAfterMs,
      message: "Too many codes requested for this number. Try again in an hour, or call us.",
    };
  }

  return {
    ok: true,
    challenge: {
      phone,
      code: args.code ?? generateCode(),
      issuedAt: now,
      attempts: 0,
      sendTimes: [...recentSends, now],
    },
  };
}

export function isExpired(challenge: Challenge, now: number): boolean {
  return now - challenge.issuedAt >= CODE_TTL_MS;
}

export function attemptsLeft(challenge: Challenge): number {
  return Math.max(0, MAX_ATTEMPTS - challenge.attempts);
}

/**
 * Check a code.
 *
 * Returns the updated challenge alongside the result so the attempt count
 * cannot be lost by a caller that forgets to save it.
 */
export function verifyChallenge(args: {
  readonly challenge: Challenge;
  readonly entered: string;
  readonly now: number;
}): { readonly result: VerifyResult; readonly challenge: Challenge } {
  const { challenge, entered, now } = args;

  if (attemptsLeft(challenge) === 0) {
    return {
      challenge,
      result: {
        ok: false,
        reason: "locked",
        message: "Too many wrong codes. Ask for a new one.",
      },
    };
  }

  if (isExpired(challenge, now)) {
    return {
      challenge,
      result: {
        ok: false,
        reason: "expired",
        message: "That code has expired. Ask for a new one.",
      },
    };
  }

  const cleaned = entered.replace(/[^\d]/g, "");

  if (cleaned !== challenge.code) {
    const next: Challenge = { ...challenge, attempts: challenge.attempts + 1 };
    const left = attemptsLeft(next);
    return {
      challenge: next,
      result: {
        ok: false,
        reason: left === 0 ? "locked" : "wrong",
        message:
          left === 0
            ? "Too many wrong codes. Ask for a new one."
            : `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`,
      },
    };
  }

  return { challenge, result: { ok: true } };
}

/** Seconds until another code may be requested, or 0 if one may be now. */
export function resendInSeconds(challenge: Challenge | null, now: number): number {
  if (challenge === null) return 0;
  const last = challenge.sendTimes[challenge.sendTimes.length - 1];
  if (last === undefined) return 0;
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - (now - last)) / 1000));
}

// ---------------------------------------------------------------------------
// The one seam
// ---------------------------------------------------------------------------

/**
 * Sending an SMS. This is the only part of verification that talks to the
 * outside world.
 *
 * Termii is the intended provider — its Nigerian deliverability is better than
 * the generic international gateways — and it slots in here as one
 * implementation of this interface, called from a server route so the API key
 * never reaches the browser.
 */
export interface SmsSender {
  send(to: E164, message: string): Promise<void>;
}

export function verificationMessage(code: string): string {
  return `${code} is your ONEESTORE code. It expires in 5 minutes. We will never ask you for it.`;
}

/**
 * The stand-in used until Termii is wired up: it "sends" by handing the code
 * back to the caller, which the checkout screen shows in a clearly-marked
 * development notice.
 *
 * It exists so the whole verification flow — cooldowns, expiry, attempt
 * limits — is exercised for real before a single SMS is paid for.
 */
export class EchoSmsSender implements SmsSender {
  public readonly sent: { to: E164; message: string }[] = [];

  async send(to: E164, message: string): Promise<void> {
    this.sent.push({ to, message });
  }
}
