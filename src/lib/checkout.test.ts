import { describe, expect, it } from "vitest";

import {
  EMPTY_BOOK,
  addressReducer,
  formatAddress,
  isValidAddress,
  parseBook,
  sanitizeBook,
  selectedAddress,
  serializeBook,
  validateAddress,
} from "./address";
import type { Address, AddressDraft } from "./address";
import {
  CODE_TTL_MS,
  EchoSmsSender,
  MAX_ATTEMPTS,
  MAX_SENDS_PER_HOUR,
  RESEND_COOLDOWN_MS,
  attemptsLeft,
  generateCode,
  isExpired,
  issueChallenge,
  resendInSeconds,
  verificationMessage,
  verifyChallenge,
} from "./otp";
import type { Challenge } from "./otp";
import {
  formatNigerianMobile,
  isValidNigerianMobile,
  maskNigerianMobile,
  phoneError,
  toE164,
} from "./phone";

// ---------------------------------------------------------------------------
// Phone numbers
// ---------------------------------------------------------------------------

describe("Nigerian phone numbers", () => {
  it("accepts the four ways a customer actually types one number", () => {
    const forms = ["0803 412 8890", "08034128890", "+234 803 412 8890", "2348034128890"];
    for (const form of forms) {
      expect(toE164(form), form).toBe("+2348034128890");
    }
  });

  it("shrugs off punctuation people paste in", () => {
    expect(toE164("+234-803-412-8890")).toBe("+2348034128890");
    expect(toE164("(0803) 412 8890")).toBe("+2348034128890");
    expect(toE164("  08034128890  ")).toBe("+2348034128890");
  });

  it("knows the networks", () => {
    expect(isValidNigerianMobile("08034128890")).toBe(true); // MTN
    expect(isValidNigerianMobile("08094128890")).toBe(true); // 9mobile
    expect(isValidNigerianMobile("08054128890")).toBe(true); // Glo
    expect(isValidNigerianMobile("08024128890")).toBe(true); // Airtel
  });

  it("rejects a prefix no Nigerian network uses", () => {
    expect(isValidNigerianMobile("08334128890")).toBe(false);
    expect(toE164("08334128890")).toBeNull();
  });

  it("rejects landlines and nonsense", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("012345678")).toBeNull();
    expect(toE164("0803412889")).toBeNull(); // one digit short
    expect(toE164("080341288901")).toBeNull(); // one too many
    expect(toE164("not a phone")).toBeNull();
  });

  it("shows a number the way a Nigerian reads it back", () => {
    expect(formatNigerianMobile("+2348034128890")).toBe("0803 412 8890");
    expect(maskNigerianMobile("+2348034128890")).toBe("0803 *** 8890");
  });

  it("says what to do rather than what is invalid", () => {
    expect(phoneError("")).toMatch(/need a phone number/);
    expect(phoneError("0803")).toMatch(/too short/);
    expect(phoneError("080341288901234")).toMatch(/too long/);
    expect(phoneError("08334128890")).toMatch(/network/);
    expect(phoneError("0803 412 8890")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

const PHONE = "+2348034128890";
const T0 = 1_700_000_000_000;

function challengeAt(now: number, code = "1234", previous?: Challenge): Challenge {
  const issued = issueChallenge({ phone: PHONE, now, code, previous });
  if (!issued.ok) throw new Error(`expected a code to issue: ${issued.reason}`);
  return issued.challenge;
}

describe("verification codes", () => {
  it("generates the right shape, from real randomness", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateCode()).toMatch(/^\d{4}$/);
    }
    expect(generateCode(6)).toMatch(/^\d{6}$/);
  });

  it("accepts the right code", () => {
    const challenge = challengeAt(T0);
    expect(verifyChallenge({ challenge, entered: "1234", now: T0 + 1000 }).result.ok).toBe(true);
  });

  it("ignores spaces in what was typed", () => {
    const challenge = challengeAt(T0);
    expect(verifyChallenge({ challenge, entered: "1 2 3 4", now: T0 }).result.ok).toBe(true);
  });

  it("counts down the tries and says how many are left", () => {
    let challenge = challengeAt(T0);

    const first = verifyChallenge({ challenge, entered: "0000", now: T0 });
    expect(first.result.ok).toBe(false);
    expect(first.result.ok === false && first.result.message).toMatch(/4 tries left/);
    challenge = first.challenge;

    expect(attemptsLeft(challenge)).toBe(MAX_ATTEMPTS - 1);
  });

  it("locks after too many wrong codes, and stays locked for the right one", () => {
    let challenge = challengeAt(T0);

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      challenge = verifyChallenge({ challenge, entered: "0000", now: T0 }).challenge;
    }

    expect(attemptsLeft(challenge)).toBe(0);

    const locked = verifyChallenge({ challenge, entered: "1234", now: T0 });
    expect(locked.result.ok).toBe(false);
    expect(locked.result.ok === false && locked.result.reason).toBe("locked");
  });

  it("expires after five minutes", () => {
    const challenge = challengeAt(T0);

    expect(isExpired(challenge, T0 + CODE_TTL_MS - 1)).toBe(false);
    expect(isExpired(challenge, T0 + CODE_TTL_MS)).toBe(true);

    const late = verifyChallenge({ challenge, entered: "1234", now: T0 + CODE_TTL_MS });
    expect(late.result.ok).toBe(false);
    expect(late.result.ok === false && late.result.reason).toBe("expired");
  });

  it("does not burn an attempt on an expired code", () => {
    const challenge = challengeAt(T0);
    const late = verifyChallenge({ challenge, entered: "0000", now: T0 + CODE_TTL_MS });
    expect(late.challenge.attempts).toBe(0);
  });
});

describe("resend limits", () => {
  it("makes a customer wait a minute between codes", () => {
    const first = challengeAt(T0);

    const tooSoon = issueChallenge({ phone: PHONE, now: T0 + 30_000, previous: first });
    expect(tooSoon.ok).toBe(false);
    expect(tooSoon.ok === false && tooSoon.reason).toBe("cooldown");
    expect(tooSoon.ok === false && tooSoon.message).toMatch(/30s/);

    const later = issueChallenge({ phone: PHONE, now: T0 + RESEND_COOLDOWN_MS, previous: first });
    expect(later.ok).toBe(true);
  });

  it("counts down the cooldown for the UI", () => {
    const challenge = challengeAt(T0);
    expect(resendInSeconds(challenge, T0)).toBe(60);
    expect(resendInSeconds(challenge, T0 + 30_000)).toBe(30);
    expect(resendInSeconds(challenge, T0 + RESEND_COOLDOWN_MS)).toBe(0);
    expect(resendInSeconds(null, T0)).toBe(0);
  });

  it("caps how many codes one number can burn in an hour", () => {
    let challenge = challengeAt(T0);

    // space each request past the cooldown
    for (let i = 1; i < MAX_SENDS_PER_HOUR; i += 1) {
      challenge = challengeAt(T0 + i * RESEND_COOLDOWN_MS, "1234", challenge);
    }

    const blocked = issueChallenge({
      phone: PHONE,
      now: T0 + MAX_SENDS_PER_HOUR * RESEND_COOLDOWN_MS,
      previous: challenge,
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.ok === false && blocked.reason).toBe("hourly");
  });

  it("lets the hourly budget roll off", () => {
    let challenge = challengeAt(T0);
    for (let i = 1; i < MAX_SENDS_PER_HOUR; i += 1) {
      challenge = challengeAt(T0 + i * RESEND_COOLDOWN_MS, "1234", challenge);
    }

    const afterAnHour = issueChallenge({
      phone: PHONE,
      now: T0 + 60 * 60_000 + 1,
      previous: challenge,
    });
    expect(afterAnHour.ok).toBe(true);
  });
});

describe("the SMS seam", () => {
  it("never puts the code in a message that invites sharing it", async () => {
    const message = verificationMessage("1234");
    expect(message).toContain("1234");
    expect(message).toMatch(/never ask you for it/i);
  });

  it("can be driven by a stand-in until Termii is wired up", async () => {
    const sender = new EchoSmsSender();
    await sender.send(PHONE, verificationMessage("4729"));

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe(PHONE);
    expect(sender.sent[0]?.message).toContain("4729");
  });
});

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

const DRAFT: AddressDraft = {
  zoneId: "island",
  street: "14B Fola Osibo Street",
  landmark: "Opposite the blue mosque, after Shoprite",
  recipientName: "Adaeze Okonkwo",
  recipientPhone: "+2348034128890",
  instructions: "",
};

describe("address validation", () => {
  it("accepts a complete address", () => {
    expect(validateAddress(DRAFT)).toEqual({});
    expect(isValidAddress(DRAFT)).toBe(true);
  });

  it("will not take an address without a landmark", () => {
    const errors = validateAddress({ ...DRAFT, landmark: "" });
    expect(errors.landmark).toMatch(/landmark/i);
    expect(isValidAddress({ ...DRAFT, landmark: "" })).toBe(false);
  });

  it("will not take a landmark too thin to help a rider", () => {
    expect(validateAddress({ ...DRAFT, landmark: "st" }).landmark).toBeTruthy();
  });

  it("needs a street that could be found", () => {
    expect(validateAddress({ ...DRAFT, street: "" }).street).toMatch(/street/i);
    expect(validateAddress({ ...DRAFT, street: "14B" }).street).toMatch(/too short/i);
  });

  it("needs a zone we actually deliver to", () => {
    expect(validateAddress({ ...DRAFT, zoneId: "" }).zoneId).toBeTruthy();
    expect(validateAddress({ ...DRAFT, zoneId: "abuja" }).zoneId).toMatch(/don't deliver/i);
  });

  it("needs someone to ask for and a number to call", () => {
    expect(validateAddress({ ...DRAFT, recipientName: "" }).recipientName).toBeTruthy();
    expect(validateAddress({ ...DRAFT, recipientPhone: "" }).recipientPhone).toBeTruthy();
  });

  it("reads back the way a packing slip prints it", () => {
    const address: Address = { ...DRAFT, id: "a1", isDefault: true };
    expect(formatAddress(address)).toBe(
      "14B Fola Osibo Street · Opposite the blue mosque, after Shoprite · Lagos Island",
    );
  });
});

describe("the address book", () => {
  it("adds, marks the first as default, and selects it", () => {
    const book = addressReducer(EMPTY_BOOK, { type: "add", draft: DRAFT, id: "a1" });

    expect(book.addresses).toHaveLength(1);
    expect(book.addresses[0]?.isDefault).toBe(true);
    expect(book.selectedId).toBe("a1");
    expect(selectedAddress(book)?.street).toBe(DRAFT.street);
  });

  it("selects whatever was added most recently", () => {
    let book = addressReducer(EMPTY_BOOK, { type: "add", draft: DRAFT, id: "a1" });
    book = addressReducer(book, {
      type: "add",
      draft: { ...DRAFT, street: "9 Admiralty Way", landmark: "Beside the filling station" },
      id: "a2",
    });

    expect(book.addresses).toHaveLength(2);
    expect(book.selectedId).toBe("a2");
    expect(book.addresses[1]?.isDefault).toBe(false);
  });

  it("refuses to store an address that could not be delivered to", () => {
    const book = addressReducer(EMPTY_BOOK, {
      type: "add",
      draft: { ...DRAFT, landmark: "" },
      id: "a1",
    });
    expect(book).toEqual(EMPTY_BOOK);
  });

  it("moves the selection when the selected address is removed", () => {
    let book = addressReducer(EMPTY_BOOK, { type: "add", draft: DRAFT, id: "a1" });
    book = addressReducer(book, {
      type: "add",
      draft: { ...DRAFT, street: "9 Admiralty Way" },
      id: "a2",
    });

    book = addressReducer(book, { type: "remove", id: "a2" });
    expect(book.selectedId).toBe("a1");

    book = addressReducer(book, { type: "remove", id: "a1" });
    expect(book.selectedId).toBeNull();
  });

  it("ignores a selection that does not exist", () => {
    const book = addressReducer(EMPTY_BOOK, { type: "add", draft: DRAFT, id: "a1" });
    expect(addressReducer(book, { type: "select", id: "nope" }).selectedId).toBe("a1");
  });

  it("updates in place without disturbing the selection", () => {
    let book = addressReducer(EMPTY_BOOK, { type: "add", draft: DRAFT, id: "a1" });
    book = addressReducer(book, {
      type: "update",
      id: "a1",
      draft: { ...DRAFT, landmark: "Next to the new bakery" },
    });

    expect(book.addresses[0]?.landmark).toBe("Next to the new bakery");
    expect(book.selectedId).toBe("a1");
  });
});

describe("address persistence", () => {
  it("round-trips", () => {
    const book = addressReducer(EMPTY_BOOK, { type: "add", draft: DRAFT, id: "a1" });
    expect(parseBook(serializeBook(book))).toEqual(book);
  });

  it("gives back an empty book rather than throwing", () => {
    expect(parseBook(null)).toEqual(EMPTY_BOOK);
    expect(parseBook("{broken")).toEqual(EMPTY_BOOK);
    expect(parseBook("null")).toEqual(EMPTY_BOOK);
    expect(parseBook(JSON.stringify({ v: 0, book: { addresses: [], selectedId: null } }))).toEqual(EMPTY_BOOK);
  });

  it("drops stored addresses that would no longer be accepted", () => {
    const book = sanitizeBook({
      selectedId: "bad",
      addresses: [
        { ...DRAFT, id: "good", isDefault: true },
        // saved before the landmark was required
        { ...DRAFT, id: "bad", landmark: "", isDefault: false },
      ],
    });

    expect(book.addresses.map((a) => a.id)).toEqual(["good"]);
    expect(book.selectedId).toBe("good");
  });

  it("drops an address in a zone we have stopped serving", () => {
    const book = sanitizeBook({
      selectedId: null,
      addresses: [{ ...DRAFT, id: "a1", zoneId: "ibadan", isDefault: true }],
    });
    expect(book.addresses).toHaveLength(0);
    expect(book.selectedId).toBeNull();
  });
});
