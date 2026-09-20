"use client";

import { useCatalog } from "@/components/CatalogProvider";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { formatWeight } from "@/lib/money";
import type { Product } from "@/lib/types";

/**
 * The headline price on a server-rendered page.
 *
 * Server components cannot see the published board — it lives in the browser
 * until the catalog moves to a table. This renders the seed price for the
 * first paint and swaps to what the shop published, so a customer cannot
 * click a card at one price and land on a page showing another.
 */
export function LivePrice({ product: seed }: { product: Product }) {
  const { productMap, ready } = useCatalog();
  const product = ready ? (productMap.get(seed.id) ?? seed) : seed;

  const low = product.availability === "today" && product.stockG <= 6000;

  return (
    <>
      <Price amountKobo={product.pricePerKgKobo} size="xl" suffix="per kg" />
      {product.availability === "tomorrow" ? (
        <Badge tone="soon">Tomorrow</Badge>
      ) : low ? (
        <Badge tone="low">Only {formatWeight(product.stockG)} left</Badge>
      ) : (
        <Badge tone="stock">{formatWeight(product.stockG)} available</Badge>
      )}
    </>
  );
}
