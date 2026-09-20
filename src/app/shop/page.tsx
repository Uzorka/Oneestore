import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/ProductCard";
import { BOTTOM_CLEARANCE, Container } from "@/components/Container";
import { PageBar } from "@/components/TopBar";
import { categories, products } from "@/lib/seed";

export const metadata: Metadata = {
  title: "Shop",
  description: "Everything landed this morning, sold by the kilogram.",
};

export default function ShopPage() {
  const available = products.filter((p) => p.availability !== "hidden");

  return (
    <main>
      <PageBar title="Shop" backHref="/" />

      <Container className={`flex flex-col gap-7 pt-[92px] md:pt-[112px] ${BOTTOM_CLEARANCE}`}>
        <div className="flex items-end gap-2.5">
          <div className="flex flex-1 flex-col">
            <h2 className="font-display text-[22px] font-semibold md:text-[30px]">Today&rsquo;s board</h2>
            <span className="mt-0.5 text-[11.5px] text-ink-muted">
              {available.length} kinds · prices per kilogram, updated 6:12 AM
            </span>
          </div>
        </div>

        {/*
          On a phone these two live only on the home page, and the tab bar has
          no room for them. Someone who came straight to the catalog would
          otherwise have to go back home to find either.
        */}
        <div className="grid grid-cols-2 gap-3 lg:hidden">
          <Link
            href="/box"
            className="flex min-h-11 items-center gap-2.5 rounded-[15px] bg-abyss px-3.5 py-3"
          >
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none" stroke="#7FD3C4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M6 14l14-6 14 6-14 6-14-6z" />
              <path d="M6 14v12l14 6 14-6V14" />
            </svg>
            <span className="truncate text-[12.5px] font-bold text-white">Build Your Box</span>
          </Link>

          <Link
            href="/meals"
            className="flex min-h-11 items-center gap-2.5 rounded-[15px] border border-line bg-paper px-3.5 py-3"
          >
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none" stroke="#C64A26" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M8 17h24v9a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7v-9z" />
              <path d="M32 20h3a3 3 0 0 1 0 6h-3" />
            </svg>
            <span className="truncate text-[12.5px] font-bold">Shop by Meal</span>
          </Link>
        </div>

        {categories.map((category) => {
          const inCategory = available.filter((p) => p.categorySlug === category.slug);
          if (inCategory.length === 0) return null;

          return (
            <section key={category.slug} className="flex flex-col gap-3">
              <h3 className="text-[15px] font-bold">{category.name}</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
                {inCategory.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          );
        })}
      </Container>
    </main>
  );
}
