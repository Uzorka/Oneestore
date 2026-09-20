import Link from "next/link";

import { FishMark, tintFor } from "@/components/FishMark";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { formatWeight } from "@/lib/money";
import type { Product } from "@/lib/types";

/**
 * A product card carries five things and no more: image, name, price, unit and
 * availability. Everything else belongs on the product page — a card crowded
 * with detail is a card nobody reads.
 */
export function ProductCard({ product }: { product: Product }) {
  const { tint, stroke } = tintFor(product.slug);
  const low = product.availability === "today" && product.stockG <= 6000;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-2.5 transition-transform duration-[var(--m-fast)] ease-[var(--ease-fast)] hover:-translate-y-0.5"
    >
      <FishMark tint={tint} stroke={stroke} className="h-26 rounded-xl" />

      <span className="text-sm leading-tight font-bold">{product.name}</span>

      <div className="flex items-end gap-2">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <Price amountKobo={product.pricePerKgKobo} suffix="/kg" />
          {product.availability === "tomorrow" ? (
            <Badge tone="soon">Tomorrow</Badge>
          ) : low ? (
            <Badge tone="low">Only {formatWeight(product.stockG)} left</Badge>
          ) : (
            <Badge tone="stock">{formatWeight(product.stockG)} today</Badge>
          )}
        </span>

        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-clay text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
