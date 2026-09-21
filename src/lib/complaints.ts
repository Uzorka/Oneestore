import type { Kobo } from "./types";

/**
 * "Not right? Tell us within 2 hours."
 *
 * The home page has promised this since the first screen was drawn, and until
 * now there was nowhere to say it. This is that promise written down as rules.
 *
 * The window is the delicate part. Two hours is short, and a customer who
 * misses it by ten minutes with a genuine complaint is exactly who the shop
 * cannot afford to turn away — so the window governs *the fast path*, not the
 * right to complain. Past it, the form still opens; it just goes to a person
 * instead of being resolved on the spot. A rule that produces "sorry, you are
 * eleven minutes late, enjoy your bad fish" is a rule that loses customers
 * faster than the fish did.
 */

export const COMPLAINT_WINDOW_MS = 2 * 60 * 60 * 1000;

export type ComplaintKind =
  | "not_fresh"
  | "wrong_weight"
  | "wrong_item"
  | "missing_item"
  | "late"
  | "other";

export type ComplaintStatus = "open" | "needs_review" | "refunded" | "declined";

export interface Complaint {
  readonly id: string;
  readonly orderId: string;
  readonly raisedAt: number;
  /** When the order was delivered — the window is measured from here. */
  readonly deliveredAt: number;
  readonly kind: ComplaintKind;
  readonly detail: string;
  /** Which lines it is about, by `productId:prepId`. Empty means the order. */
  readonly lineKeys: readonly string[];
  /** True when it arrived inside the promised window. */
  readonly withinWindow: boolean;
  readonly status: ComplaintStatus;
  readonly resolvedAt: number | null;
  readonly refundedKobo: Kobo;
  readonly resolutionNote: string;
}

const KIND_LABELS: Record<ComplaintKind, string> = {
  not_fresh: "It was not fresh",
  wrong_weight: "The weight was wrong",
  wrong_item: "Wrong fish arrived",
  missing_item: "Something was missing",
  late: "It arrived too late to use",
  other: "Something else",
};

export function kindLabel(kind: ComplaintKind): string {
  return KIND_LABELS[kind];
}

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: "Waiting on us",
  needs_review: "Being looked at",
  refunded: "Refunded",
  declined: "Not refunded",
};

export function statusLabel(status: ComplaintStatus): string {
  return STATUS_LABELS[status];
}

/** Milliseconds left to report, or 0 once the window has closed. */
export function timeLeftMs(deliveredAt: number, now: number): number {
  return Math.max(0, deliveredAt + COMPLAINT_WINDOW_MS - now);
}

export function isWithinWindow(deliveredAt: number, now: number): boolean {
  return timeLeftMs(deliveredAt, now) > 0;
}

/** "1h 47m left to report a problem." */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "closed";

  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m`;

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function raise(args: {
  readonly orderId: string;
  readonly deliveredAt: number;
  readonly kind: ComplaintKind;
  readonly detail: string;
  readonly lineKeys?: readonly string[];
  readonly at: number;
}): Complaint {
  const withinWindow = isWithinWindow(args.deliveredAt, args.at);

  return {
    id: `c-${args.at.toString(36)}-${args.orderId}`,
    orderId: args.orderId,
    raisedAt: args.at,
    deliveredAt: args.deliveredAt,
    kind: args.kind,
    detail: args.detail.trim(),
    lineKeys: args.lineKeys ?? [],
    withinWindow,
    // Inside the window it is ours to settle. Outside it, a person looks —
    // rather than the door being shut.
    status: withinWindow ? "open" : "needs_review",
    resolvedAt: null,
    refundedKobo: 0,
    resolutionNote: "",
  };
}

export function refund(complaint: Complaint, amountKobo: Kobo, at: number, note: string): Complaint {
  if (complaint.status === "refunded" || complaint.status === "declined") return complaint;

  return {
    ...complaint,
    status: "refunded",
    resolvedAt: at,
    refundedKobo: Math.max(0, Math.round(amountKobo)),
    resolutionNote: note,
  };
}

/**
 * Turn one down.
 *
 * A reason is required. "Declined" with nothing after it is the kind of answer
 * that turns a complaint into a chargeback.
 */
export function decline(complaint: Complaint, at: number, note: string): Complaint {
  if (complaint.status === "refunded" || complaint.status === "declined") return complaint;
  if (note.trim() === "") return complaint;

  return {
    ...complaint,
    status: "declined",
    resolvedAt: at,
    refundedKobo: 0,
    resolutionNote: note.trim(),
  };
}

export function isOpen(complaint: Complaint): boolean {
  return complaint.status === "open" || complaint.status === "needs_review";
}

/** A complaint already raised against this order, if there is one. */
export function forOrder(
  complaints: readonly Complaint[],
  orderId: string,
): Complaint | undefined {
  return complaints.find((c) => c.orderId === orderId);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_VERSION = 1;
export const COMPLAINTS_STORAGE_KEY = "oneestore.complaints.v1";

export function serializeComplaints(complaints: readonly Complaint[]): string {
  return JSON.stringify({ v: STORAGE_VERSION, complaints });
}

export function parseComplaints(raw: string | null): readonly Complaint[] {
  if (raw === null) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];

    const { v, complaints } = parsed as { v?: unknown; complaints?: unknown };
    if (v !== STORAGE_VERSION || !Array.isArray(complaints)) return [];

    return complaints.filter(isComplaint);
  } catch {
    return [];
  }
}

const KINDS: readonly string[] = ["not_fresh", "wrong_weight", "wrong_item", "missing_item", "late", "other"];
const STATUSES: readonly string[] = ["open", "needs_review", "refunded", "declined"];

function isComplaint(value: unknown): value is Complaint {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Partial<Complaint>;

  return (
    typeof c.id === "string" &&
    typeof c.orderId === "string" &&
    typeof c.raisedAt === "number" &&
    typeof c.kind === "string" &&
    KINDS.includes(c.kind) &&
    typeof c.status === "string" &&
    STATUSES.includes(c.status) &&
    Array.isArray(c.lineKeys)
  );
}
