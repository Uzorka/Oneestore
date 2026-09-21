"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  WALLET_STORAGE_KEY,
  balanceKobo,
  coverageKobo,
  credit,
  parseWallet,
  serializeWallet,
  spend,
} from "@/lib/wallet";
import type { WalletEntry, WalletReason } from "@/lib/wallet";
import type { Kobo } from "@/lib/types";

/** A thin wrapper over the wallet ledger. Every rule lives in `lib/wallet.ts`. */

interface WalletContextValue {
  readonly entries: readonly WalletEntry[];
  readonly balanceKobo: Kobo;
  readonly ready: boolean;
  readonly credit: (args: {
    amountKobo: Kobo;
    reason: Exclude<WalletReason, "spent">;
    orderId: string | null;
    note: string;
  }) => void;
  readonly spendOn: (billKobo: Kobo, orderId: string) => Kobo;
  readonly coverage: (billKobo: Kobo) => Kobo;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly WalletEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setEntries(parseWallet(window.localStorage.getItem(WALLET_STORAGE_KEY)));
    } catch {
      // Blocked storage. An empty wallet is wrong but safe; throwing is not.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(WALLET_STORAGE_KEY, serializeWallet(entries));
    } catch {
      // Full or blocked.
    }
  }, [entries, ready]);

  const creditWallet = useCallback(
    (args: { amountKobo: Kobo; reason: Exclude<WalletReason, "spent">; orderId: string | null; note: string }) => {
      setEntries((prev) => credit(prev, { ...args, at: Date.now() }));
    },
    [],
  );

  /**
   * Spend and report what was taken.
   *
   * The amount is computed from the ledger inside the state update so two
   * quick taps cannot both read the same balance and spend it twice.
   */
  const spendOn = useCallback((billKobo: Kobo, orderId: string) => {
    let taken = 0;
    setEntries((prev) => {
      const result = spend(prev, { billKobo, orderId, at: Date.now() });
      taken = result.spentKobo;
      return result.entries;
    });
    return taken;
  }, []);

  const coverage = useCallback((billKobo: Kobo) => coverageKobo(entries, billKobo), [entries]);

  const value = useMemo(
    () => ({
      entries,
      balanceKobo: balanceKobo(entries),
      ready,
      credit: creditWallet,
      spendOn,
      coverage,
    }),
    [entries, ready, creditWallet, spendOn, coverage],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (ctx === null) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
