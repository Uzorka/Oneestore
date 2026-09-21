"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  fetchAllOrders,
  fetchOrders,
  isDatabaseOn,
  moveOrder,
  saveOrder,
  saveWeight,
} from "@/app/actions/shop";
import { useAccount } from "@/components/AccountProvider";
import { ORDERS_STORAGE_KEY, advance, parseOrders, serializeOrders } from "@/lib/orders";
import { recordPackedWeight } from "@/lib/packing";
import type { Order } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";

/**
 * Orders, held in the browser.
 *
 * A thin wrapper like `CartProvider`: every rule lives in `lib/orders.ts` and
 * is tested there. This only holds the list and writes it to localStorage.
 *
 * Which is also the honest limit of it. An order that exists only in one
 * browser is not an order the shop can pack — this is the shape the screens
 * need, waiting for the table behind it. Everything here maps one-to-one onto
 * a row, so the swap is this file and nothing else.
 */

interface OrdersContextValue {
  readonly orders: readonly Order[];
  readonly ready: boolean;
  /** True once orders are coming from the database rather than this browser. */
  readonly shared: boolean;
  readonly refresh: () => Promise<void>;
  readonly place: (order: Order, fromWalletKobo?: number) => void;
  readonly move: (id: string, to: OrderStatus, note?: string) => void;
  /** Swap an order for an updated copy. */
  readonly replace: (order: Order) => void;
  /** Record what came off the scale, locally and in the database. */
  readonly setWeight: (code: string, productId: string, prepId: string, actualG: number | null) => void;
  readonly byId: (id: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<readonly Order[]>([]);
  const [ready, setReady] = useState(false);
  const [shared, setShared] = useState(false);
  const account = useAccount();

  const phone = account.phone ?? "";

  /*
    Where orders live is decided once, by asking the server whether it has a
    database. Until that answer arrives nothing is written anywhere, because
    writing to localStorage and then discovering there is a database is how an
    order ends up in one place and not the other.
  */
  const reload = useCallback(async () => {
    const on = await isDatabaseOn();
    setShared(on);

    if (!on) {
      try {
        setOrders(parseOrders(window.localStorage.getItem(ORDERS_STORAGE_KEY)));
      } catch {
        // Blocked storage. An empty history is the right answer, not a crash.
      }
      setReady(true);
      return;
    }

    // The packing room needs every order; a customer needs their own. Asking
    // for all of them without a phone is what makes the admin screens work
    // before there is any sign-in.
    setOrders(phone === "" ? await fetchAllOrders() : await fetchOrders(phone));
    setReady(true);
  }, [phone]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!ready || shared) return;
    try {
      window.localStorage.setItem(ORDERS_STORAGE_KEY, serializeOrders(orders));
    } catch {
      // Full or blocked. The order still exists for this session.
    }
  }, [orders, ready, shared]);

  // Newest first: the order someone is asking about is almost always the last
  // one they placed.
  const place = useCallback(
    (order: Order, fromWalletKobo = 0) => {
      setOrders((prev) => [order, ...prev]);

      // The wallet spend goes in with the order, in one transaction. Debiting
      // it separately is how a wallet is emptied by an order that never saved.
      if (shared) void saveOrder(order, fromWalletKobo).then(() => reload());
    },
    [shared, reload],
  );

  const move = useCallback(
    (id: string, to: OrderStatus, note?: string) => {
      setOrders((prev) => prev.map((o) => (o.id === id ? advance(o, to, Date.now(), note) : o)));
      if (shared) void moveOrder(id, to, note ?? "").then(() => reload());
    },
    [shared, reload],
  );

  const replace = useCallback((next: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)));
  }, []);

  /*
    The weight is applied locally first so the figures on screen move as the
    packer types, then written. A scale reading that only lived in the browser
    it was typed into would be the one number in this shop that has to be
    shared and is not.
  */
  const setWeight = useCallback(
    (code: string, productId: string, prepId: string, actualG: number | null) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === code ? recordPackedWeight(o, `${productId}:${prepId}`, actualG) : o)),
      );
      if (shared) void saveWeight(code, productId, prepId, actualG);
    },
    [shared],
  );

  const byId = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);

  const value = useMemo(
    () => ({ orders, ready, shared, place, move, replace, setWeight, byId, refresh: reload }),
    [orders, ready, shared, place, move, replace, setWeight, byId, reload],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (ctx === null) throw new Error("useOrders must be used inside <OrdersProvider>");
  return ctx;
}
