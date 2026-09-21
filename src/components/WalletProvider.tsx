"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { fetchWallet, isDatabaseOn, payIntoWallet } from "@/app/actions/shop";
import { useAccount } from "@/components/AccountProvider";
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
  /** True once the wallet is the customer's, not this browser's. */
  readonly shared: boolean;
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
  const [shared, setShared] = useState(false);
  const account = useAccount();

  const phone = account.phone ?? "";

  const reload = useCallback(async () => {
    const on = await isDatabaseOn();
    setShared(on);

    if (!on) {
      try {
        setEntries(parseWallet(window.localStorage.getItem(WALLET_STORAGE_KEY)));
      } catch {
        // Blocked storage. An empty wallet is wrong but safe; throwing is not.
      }
      setReady(true);
      return;
    }

    setEntries((await fetchWallet(phone)).entries);
    setReady(true);
  }, [phone]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!ready || shared) return;
    try {
      window.localStorage.setItem(WALLET_STORAGE_KEY, serializeWallet(entries));
    } catch {
      // Full or blocked.
    }
  }, [entries, ready, shared]);

  const creditWallet = useCallback(
    (args: { amountKobo: Kobo; reason: Exclude<WalletReason, "spent">; orderId: string | null; note: string }) => {
      setEntries((prev) => credit(prev, { ...args, at: Date.now() }));

      if (shared) {
        void payIntoWallet({
          phone,
          amountKobo: args.amountKobo,
          reason: args.reason,
          orderCode: args.orderId,
        }).then(() => reload());
      }
    },
    [shared, phone, reload],
  );

  /**
   * Spend and report what was taken.
   *
   * The amount is computed from the ledger inside the state update so two
   * quick taps cannot both read the same balance and spend it twice. On a
   * shared wallet the spend is written as part of placing the order, not
   * here — two writes for one decision is how a wallet is debited for an
   * order that never saved.
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
      shared,
      credit: creditWallet,
      spendOn,
      coverage,
    }),
    [entries, ready, shared, creditWallet, spendOn, coverage],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (ctx === null) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
