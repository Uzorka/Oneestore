"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { ReactNode } from "react";

import {
  EMPTY_CART,
  STORAGE_KEY,
  cartReducer,
  parseCart,
  remainingStockG,
  serializeCart,
} from "@/lib/cart";
import type { CartAction, CartState } from "@/lib/cart";
import { productMap } from "@/lib/seed";
import type { Grams } from "@/lib/types";

/**
 * A thin React wrapper around the pure cart reducer.
 *
 * All the logic — merging, stock ceilings, clamping — lives in `lib/cart.ts`
 * and is tested there. This file only handles the two things React has to do:
 * hold the state, and keep it in localStorage.
 *
 * The catalog is the seed data for now. When Supabase lands it is passed in
 * here instead, and nothing else in the tree has to change.
 */

interface CartContextValue {
  readonly state: CartState;
  readonly dispatch: (action: CartAction) => void;
  /** False until localStorage has been read, so the UI can avoid a flash. */
  readonly ready: boolean;
  readonly remainingG: (productId: string, exceptId?: string) => Grams;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const catalog = useMemo(() => productMap(), []);

  const reduce = useCallback(
    (state: CartState, action: CartAction) => cartReducer(state, action, catalog),
    [catalog],
  );

  const [state, dispatch] = useReducer(reduce, EMPTY_CART);
  const [ready, setReady] = useState(false);

  // Restore once on mount. Rendering the server's empty basket first and
  // filling it in after hydration avoids a mismatch, which is why `ready`
  // exists rather than trying to read storage during render.
  useEffect(() => {
    let restored = EMPTY_CART;
    try {
      restored = parseCart(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      // Private browsing, blocked storage — an empty basket is the right answer.
    }

    // `restore` keeps each line's price snapshot; replaying adds would stamp
    // today's price on everything and erase the drift the customer must accept.
    dispatch({ type: "restore", state: restored });
    setReady(true);
  }, [catalog]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeCart(state));
    } catch {
      // Storage full or blocked. The basket still works for this session.
    }
  }, [state, ready]);

  const remainingG = useCallback(
    (productId: string, exceptId?: string) => remainingStockG(state, productId, catalog, exceptId),
    [state, catalog],
  );

  const value = useMemo(
    () => ({ state, dispatch, ready, remainingG }),
    [state, ready, remainingG],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (ctx === null) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
