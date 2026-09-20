import { findZone } from "./delivery";
import type { E164 } from "./phone";

/**
 * Addresses.
 *
 * The landmark is required, and that is the whole point of this file. A Lagos
 * rider does not navigate by street number — they call and ask what the place
 * is near. An address without a landmark is a delivery that will need a phone
 * call to rescue, so the form refuses to accept one.
 */

export interface Address {
  readonly id: string;
  readonly zoneId: string;
  readonly street: string;
  /** "Opposite the blue mosque, after Shoprite". Required. */
  readonly landmark: string;
  readonly recipientName: string;
  readonly recipientPhone: E164;
  readonly instructions: string;
  readonly isDefault: boolean;
}

export type AddressDraft = Omit<Address, "id" | "isDefault">;

export type AddressField = "zoneId" | "street" | "landmark" | "recipientName" | "recipientPhone";

export type AddressErrors = Partial<Record<AddressField, string>>;

const MIN_STREET = 5;
const MIN_LANDMARK = 4;

/**
 * Validate a draft.
 *
 * Every message says what to do, not what went wrong: "Add a nearby landmark"
 * rather than "landmark: invalid".
 */
export function validateAddress(draft: Partial<AddressDraft>): AddressErrors {
  const errors: AddressErrors = {};

  const zoneId = (draft.zoneId ?? "").trim();
  if (zoneId === "") {
    errors.zoneId = "Choose the area we are delivering to.";
  } else if (findZone(zoneId) === undefined) {
    errors.zoneId = "We don't deliver to that area yet.";
  }

  const street = (draft.street ?? "").trim();
  if (street === "") {
    errors.street = "Add the street and house number.";
  } else if (street.length < MIN_STREET) {
    errors.street = "That looks too short to find.";
  }

  const landmark = (draft.landmark ?? "").trim();
  if (landmark === "") {
    errors.landmark = "Add a nearby landmark — the rider will ask for one.";
  } else if (landmark.length < MIN_LANDMARK) {
    errors.landmark = "Give the rider a bit more to go on.";
  }

  const name = (draft.recipientName ?? "").trim();
  if (name === "") errors.recipientName = "Who should the rider ask for?";

  const phone = (draft.recipientPhone ?? "").trim();
  if (phone === "") errors.recipientPhone = "We need a number for the rider to call.";

  return errors;
}

export function isValidAddress(draft: Partial<AddressDraft>): boolean {
  return Object.keys(validateAddress(draft)).length === 0;
}

/** One line, the way it reads on a packing slip and a confirmation screen. */
export function formatAddress(address: Address): string {
  const zone = findZone(address.zoneId);
  const parts = [address.street, address.landmark, zone?.name].filter(
    (p): p is string => p !== undefined && p.trim() !== "",
  );
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// The address book
// ---------------------------------------------------------------------------

export interface AddressBook {
  readonly addresses: readonly Address[];
  readonly selectedId: string | null;
}

export const EMPTY_BOOK: AddressBook = { addresses: [], selectedId: null };

export type AddressAction =
  | { readonly type: "add"; readonly draft: AddressDraft; readonly id: string }
  | { readonly type: "update"; readonly id: string; readonly draft: AddressDraft }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "select"; readonly id: string }
  | { readonly type: "restore"; readonly book: AddressBook };

export function addressReducer(book: AddressBook, action: AddressAction): AddressBook {
  switch (action.type) {
    case "add": {
      if (!isValidAddress(action.draft)) return book;

      const first = book.addresses.length === 0;
      const address: Address = { ...action.draft, id: action.id, isDefault: first };

      return {
        addresses: [...book.addresses, address],
        // A new address is what the customer just typed, so it is the one
        // they mean to use.
        selectedId: action.id,
      };
    }

    case "update": {
      if (!isValidAddress(action.draft)) return book;
      return {
        ...book,
        addresses: book.addresses.map((a) => (a.id === action.id ? { ...a, ...action.draft } : a)),
      };
    }

    case "remove": {
      const addresses = book.addresses.filter((a) => a.id !== action.id);
      const selectedId =
        book.selectedId === action.id ? (addresses[0]?.id ?? null) : book.selectedId;
      return { addresses, selectedId };
    }

    case "select":
      return book.addresses.some((a) => a.id === action.id)
        ? { ...book, selectedId: action.id }
        : book;

    case "restore":
      return sanitizeBook(action.book);
  }
}

export function selectedAddress(book: AddressBook): Address | undefined {
  if (book.selectedId === null) return undefined;
  return book.addresses.find((a) => a.id === book.selectedId);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_VERSION = 1;
export const ADDRESS_STORAGE_KEY = "oneestore.addresses.v1";

/** Drop anything that would not pass validation today. */
export function sanitizeBook(book: AddressBook): AddressBook {
  const addresses = (Array.isArray(book.addresses) ? book.addresses : []).filter(
    (a): a is Address =>
      typeof a === "object" &&
      a !== null &&
      typeof a.id === "string" &&
      a.id !== "" &&
      isValidAddress(a),
  );

  const selectedId =
    typeof book.selectedId === "string" && addresses.some((a) => a.id === book.selectedId)
      ? book.selectedId
      : (addresses[0]?.id ?? null);

  return { addresses, selectedId };
}

export function serializeBook(book: AddressBook): string {
  return JSON.stringify({ v: STORAGE_VERSION, book });
}

export function parseBook(raw: string | null): AddressBook {
  if (raw === null || raw === "") return EMPTY_BOOK;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_BOOK;

    const stored = parsed as { v?: number; book?: AddressBook };
    if (stored.v !== STORAGE_VERSION) return EMPTY_BOOK;
    if (typeof stored.book !== "object" || stored.book === null) return EMPTY_BOOK;

    return sanitizeBook(stored.book);
  } catch {
    return EMPTY_BOOK;
  }
}
