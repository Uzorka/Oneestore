"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  CATALOG_STORAGE_KEY,
  EMPTY_CATALOG_STATE,
  discardDraft,
  draftProducts,
  parseCatalog,
  productMapFrom,
  publish,
  publishedProducts,
  serializeCatalog,
  stageEdit,
} from "@/lib/catalog";
import type { CatalogState, ProductEdit } from "@/lib/catalog";
import type { Product } from "@/lib/types";

/**
 * The catalog the whole app reads.
 *
 * The storefront gets what the shop has **published**; the price board gets
 * the draft on top. Everything that used to call `productMap()` directly goes
 * through here now, which is what makes a price set in the admin actually
 * reach a customer's basket.
 *
 * `ready` matters more than it looks: the server renders seed prices, and the
 * overlay only exists in the browser. Components that price money wait for it
 * rather than flashing yesterday's number.
 */

interface CatalogContextValue {
  readonly products: readonly Product[];
  readonly productMap: ReadonlyMap<string, Product>;
  /** Published plus unsaved edits — the shop's working view. */
  readonly draft: readonly Product[];
  readonly state: CatalogState;
  readonly ready: boolean;
  readonly edit: (productId: string, edit: ProductEdit) => void;
  readonly publishDraft: () => void;
  readonly discard: () => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CatalogState>(EMPTY_CATALOG_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setState(parseCatalog(window.localStorage.getItem(CATALOG_STORAGE_KEY)));
    } catch {
      // Blocked storage. Seed prices are wrong but sellable; an exception is
      // a shop with no catalog at all.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(CATALOG_STORAGE_KEY, serializeCatalog(state));
    } catch {
      // Full or blocked — the board still works for this session.
    }
  }, [state, ready]);

  const edit = useCallback((productId: string, next: ProductEdit) => {
    setState((prev) => stageEdit(prev, productId, next));
  }, []);

  const publishDraft = useCallback(() => {
    setState((prev) => publish(prev, Date.now()));
  }, []);

  const discard = useCallback(() => {
    setState((prev) => discardDraft(prev));
  }, []);

  const products = useMemo(() => publishedProducts(state), [state]);
  const draft = useMemo(() => draftProducts(state), [state]);
  const productMap = useMemo(() => productMapFrom(products), [products]);

  const value = useMemo(
    () => ({ products, productMap, draft, state, ready, edit, publishDraft, discard }),
    [products, productMap, draft, state, ready, edit, publishDraft, discard],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (ctx === null) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return ctx;
}
