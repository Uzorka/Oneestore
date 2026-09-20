"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ORDERS_STORAGE_KEY, advance, parseOrders, serializeOrders } from "@/lib/orders";
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
  readonly place: (order: Order) => void;
  readonly move: (id: string, to: OrderStatus, note?: string) => void;
  readonly byId: (id: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<readonly Order[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOrders(parseOrders(window.localStorage.getItem(ORDERS_STORAGE_KEY)));
    } catch {
      // Blocked storage. An empty history is the right answer, not a crash.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(ORDERS_STORAGE_KEY, serializeOrders(orders));
    } catch {
      // Full or blocked. The order still exists for this session.
    }
  }, [orders, ready]);

  // Newest first: the order someone is asking about is almost always the last
  // one they placed.
  const place = useCallback((order: Order) => {
    setOrders((prev) => [order, ...prev]);
  }, []);

  const move = useCallback((id: string, to: OrderStatus, note?: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? advance(o, to, Date.now(), note) : o)),
    );
  }, []);

  const byId = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);

  const value = useMemo(
    () => ({ orders, ready, place, move, byId }),
    [orders, ready, place, move, byId],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (ctx === null) throw new Error("useOrders must be used inside <OrdersProvider>");
  return ctx;
}
