import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FishMark, tintFor } from "@/components/FishMark";
import { PageBar } from "@/components/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { formatWeight } from "@/lib/money";
import { products, productBySlug } from "@/lib/seed";

import { ProductCustomizer } from "./ProductCustomizer";

/** Pre-render the catalog: these pages are read far more often than they change. */
export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (product === undefined) return { title: "Not found" };

  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (product === undefined) notFound();

  const { tint, stroke } = tintFor(product.slug);

  return (
    <main>
      <PageBar title={product.name} backHref="/shop" />

      <FishMark tint={tint} stroke={stroke} className="h-[262px]" label={false} />

      <div className="flex flex-col gap-4.5 px-4.5 pt-4.5 pb-32">
        <header className="flex flex-col gap-2.5">
          <div className="flex items-start gap-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h1 className="font-display text-[26px] leading-tight font-semibold">{product.name}</h1>
              <span className="text-[12.5px] text-ink-muted">
                {product.localNames.join(", ")} · {product.origin}
              </span>
            </div>

            {product.rating !== null && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#C64A26">
                  <path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.8l6-.8z" />
                </svg>
                <span className="text-xs font-bold">{product.rating}</span>
                <span className="text-[11px] text-ink-muted">({product.ratingCount})</span>
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <Price amountKobo={product.pricePerKgKobo} size="xl" suffix="per kg" />
            <span className="flex-1" />
            {product.availability === "today" ? (
              <Badge tone="stock">{formatWeight(product.stockG)} available</Badge>
            ) : (
              <Badge tone="soon">Tomorrow</Badge>
            )}
          </div>
        </header>

        <ProductCustomizer product={product} />

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[15px] font-semibold">Good to know</h2>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">{product.description}</p>
        </section>
      </div>
    </main>
  );
}
