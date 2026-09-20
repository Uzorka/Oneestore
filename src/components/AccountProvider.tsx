"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { ReactNode } from "react";

import {
  ADDRESS_STORAGE_KEY,
  EMPTY_BOOK,
  addressReducer,
  parseBook,
  serializeBook,
} from "@/lib/address";
import type { AddressAction, AddressBook, AddressDraft } from "@/lib/address";
import { EchoSmsSender, issueChallenge, verificationMessage, verifyChallenge } from "@/lib/otp";
import type { Challenge, IssueResult, VerifyResult } from "@/lib/otp";
import type { E164 } from "@/lib/phone";

/**
 * The customer: their verified phone number and their address book.
 *
 * Two deliberate choices about what is and is not stored:
 *
 *   - The **address book persists**. Re-typing a Lagos address and its
 *     landmark on every order is exactly the friction this shop exists to
 *     remove.
 *   - The **challenge never persists**. A live verification code sitting in
 *     localStorage is a code anyone with the device can read, so it lives in
 *     memory and dies with the tab.
 *
 * Verification currently runs through `EchoSmsSender`, which hands the code
 * back instead of sending it. Swapping in Termii means replacing that one
 * object with a call to a server route — no other file changes.
 */

const PHONE_STORAGE_KEY = "oneestore.phone.v1";

interface AccountContextValue {
  readonly phone: E164 | null;
  readonly verified: boolean;
  readonly challenge: Challenge | null;
  /** The code the stand-in "sent". Null once a real provider is wired in. */
  readonly devCode: string | null;
  readonly ready: boolean;

  readonly requestCode: (phone: E164) => Promise<IssueResult>;
  readonly submitCode: (entered: string) => VerifyResult;
  readonly signOut: () => void;

  readonly book: AddressBook;
  readonly addAddress: (draft: AddressDraft) => string;
  readonly dispatchAddress: (action: AddressAction) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const sender = new EchoSmsSender();

export function AccountProvider({ children }: { children: ReactNode }) {
  const [phone, setPhone] = useState<E164 | null>(null);
  const [verified, setVerified] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [book, dispatchAddress] = useReducer(addressReducer, EMPTY_BOOK);

  useEffect(() => {
    try {
      const savedPhone = window.localStorage.getItem(PHONE_STORAGE_KEY);
      if (savedPhone !== null && savedPhone !== "") {
        setPhone(savedPhone);
        setVerified(true);
      }
      dispatchAddress({ type: "restore", book: parseBook(window.localStorage.getItem(ADDRESS_STORAGE_KEY)) });
    } catch {
      // Blocked storage: the customer verifies again this session and nothing breaks.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(ADDRESS_STORAGE_KEY, serializeBook(book));
    } catch {
      // Not fatal — the address still works for this order.
    }
  }, [book, ready]);

  const requestCode = useCallback(
    async (next: E164): Promise<IssueResult> => {
      // Resends are counted against the same budget as the first send, so the
      // previous challenge is what carries the history.
      const previous = challenge?.phone === next ? challenge : undefined;
      const issued = issueChallenge({ phone: next, now: Date.now(), previous });

      if (!issued.ok) return issued;

      await sender.send(next, verificationMessage(issued.challenge.code));

      setPhone(next);
      setVerified(false);
      setChallenge(issued.challenge);
      setDevCode(issued.challenge.code);

      return issued;
    },
    [challenge],
  );

  const submitCode = useCallback(
    (entered: string): VerifyResult => {
      if (challenge === null) {
        return { ok: false, reason: "expired", message: "Ask for a code first." };
      }

      const { result, challenge: next } = verifyChallenge({
        challenge,
        entered,
        now: Date.now(),
      });

      setChallenge(next);

      if (result.ok) {
        setVerified(true);
        setDevCode(null);
        try {
          window.localStorage.setItem(PHONE_STORAGE_KEY, challenge.phone);
        } catch {
          // Session-only verification is still a verified session.
        }
      }

      return result;
    },
    [challenge],
  );

  const signOut = useCallback(() => {
    setPhone(null);
    setVerified(false);
    setChallenge(null);
    setDevCode(null);
    try {
      window.localStorage.removeItem(PHONE_STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }, []);

  const addAddress = useCallback((draft: AddressDraft): string => {
    const id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `addr-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    dispatchAddress({ type: "add", draft, id });
    return id;
  }, []);

  const value = useMemo(
    () => ({
      phone,
      verified,
      challenge,
      devCode,
      ready,
      requestCode,
      submitCode,
      signOut,
      book,
      addAddress,
      dispatchAddress,
    }),
    [phone, verified, challenge, devCode, ready, requestCode, submitCode, signOut, book, addAddress],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (ctx === null) throw new Error("useAccount must be used inside <AccountProvider>");
  return ctx;
}
