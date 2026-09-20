"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FishMark, tintFor } from "@/components/FishMark";
import { EmptyState } from "@/components/ui/EmptyState";
import { Price } from "@/components/ui/Price";
import { categories, products, searchProducts } from "@/lib/seed";

const POPULAR = ["croaker", "tiger-prawns", "catfish", "titus"];
const RECENT = ["croaker", "apoda", "ede", "panla"];

/**
 * Search runs against local names as well as English ones, so "apoda" finds
 * croaker and "titus" finds mackerel. Results appear as the customer types —
 * there is no submit step.
 */
export function SearchClient() {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = useMemo(() => searchProducts(trimmed), [trimmed]);

  const popular = POPULAR.map((id) => products.find((p) => p.id === id)).filter(
    (p) => p !== undefined,
  );

  return (
    <div className="flex flex-col gap-5.5">
      <label className="flex h-[50px] items-center gap-2.5 rounded-[14px] border border-line bg-paper px-3.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F5D57" strokeWidth="2" strokeLinecap="round" className="shrink-0">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <span className="sr-only">Search seafood</span>
        <input
          type="search"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search croaker, titus, ede…"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        />
        {trimmed !== "" && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="-mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <span className="flex size-5.5 items-center justify-center rounded-full bg-line">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </span>
          </button>
        )}
      </label>

      {trimmed === "" ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-[0.07em] text-ink-muted uppercase">Recent</h2>
            <div className="flex flex-wrap gap-2">
              {RECENT.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 text-[13px] font-semibold"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7A8D8B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                  {term}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-[0.07em] text-ink-muted uppercase">
              Popular right now
            </h2>
            <div className="flex flex-col gap-2.5">
              {popular.map((product) => (
                <ResultRow key={product.id} slug={product.slug} name={product.name} categorySlug={product.categorySlug} priceKobo={product.pricePerKgKobo} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-[0.07em] text-ink-muted uppercase">Categories</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href="/shop"
                  className="flex min-h-13 items-center gap-2.5 rounded-[13px] border border-line bg-paper px-3.5 text-[13px] font-semibold"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : results.length === 0 ? (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
            </svg>
          }
          title="Nothing matches that yet"
          body="Try a local name — apoda, titus, ede, panla — or browse the whole catch."
          actionLabel="Browse Seafood"
          actionHref="/shop"
        />
      ) : (
        <section className="flex flex-col gap-2.5">
          <span className="text-[11.5px] text-ink-muted">
            {results.length === 1 ? "1 match" : `${results.length} matches`}
          </span>
          {results.map((product) => (
            <ResultRow key={product.id} slug={product.slug} name={product.name} categorySlug={product.categorySlug} priceKobo={product.pricePerKgKobo} />
          ))}
        </section>
      )}
    </div>
  );
}

function ResultRow({
  slug,
  name,
  categorySlug,
  priceKobo,
}: {
  slug: string;
  name: string;
  categorySlug: string;
  priceKobo: number;
}) {
  const { tint, stroke } = tintFor(slug);
  const category = categories.find((c) => c.slug === categorySlug);

  return (
    <Link
      href={`/product/${slug}`}
      className="flex items-center gap-3 rounded-[15px] border border-line bg-paper p-2.5"
    >
      <FishMark tint={tint} stroke={stroke} className="size-14 shrink-0 rounded-xl" label={false} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-bold">{name}</span>
        <span className="text-[11.5px] text-ink-muted">{category?.name}</span>
      </span>
      <span className="shrink-0 text-right">
        <Price amountKobo={priceKobo} size="sm" />
        <span className="block text-[10.5px] text-ink-muted">per kg</span>
      </span>
    </Link>
  );
}
