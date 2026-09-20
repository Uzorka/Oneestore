import type { Metadata } from "next";

import { ProductCard } from "@/components/ProductCard";
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

      <div className="flex flex-col gap-5 px-4.5 pt-[86px] pb-28">
        <div className="flex items-end gap-2.5">
          <div className="flex flex-1 flex-col">
            <h2 className="font-display text-[22px] font-semibold">Today&rsquo;s board</h2>
            <span className="mt-0.5 text-[11.5px] text-ink-muted">
              {available.length} kinds · prices per kilogram, updated 6:12 AM
            </span>
          </div>
        </div>

        {categories.map((category) => {
          const inCategory = available.filter((p) => p.categorySlug === category.slug);
          if (inCategory.length === 0) return null;

          return (
            <section key={category.slug} className="flex flex-col gap-3">
              <h3 className="text-[15px] font-bold">{category.name}</h3>
              <div className="grid grid-cols-2 gap-3">
                {inCategory.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
