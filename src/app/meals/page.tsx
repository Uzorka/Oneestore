import type { Metadata } from "next";
import Link from "next/link";

import { BOTTOM_CLEARANCE, Container } from "@/components/Container";
import { FishMark, tintFor } from "@/components/FishMark";
import { PageBar } from "@/components/TopBar";
import { formatNaira } from "@/lib/money";
import { mealLines, priceBasket } from "@/lib/pricing";
import { meals, productMap } from "@/lib/seed";

export const metadata: Metadata = {
  title: "Shop by Meal",
  description: "Pick the dish and we work out what seafood you need, and how much of it.",
};

export default function MealsPage() {
  const catalog = productMap();

  const cards = meals.map((meal) => {
    // "From" is the required ingredients only, at the default serving count —
    // the honest floor, not a figure the customer can never actually reach.
    const required = mealLines({
      meal,
      serves: meal.defaultServes,
      productsById: catalog,
      excluded: new Set(meal.ingredients.filter((i) => i.optional).map((i) => i.productId)),
    });

    const names = meal.ingredients
      .map((i) => catalog.get(i.productId)?.name)
      .filter((n): n is string => n !== undefined);

    return {
      meal,
      fromKobo: priceBasket(required, catalog).payableKobo,
      names,
      ...tintFor(meal.slug),
    };
  });

  return (
    <main>
      <PageBar title="Shop by Meal" backHref="/" />

      <Container className={`flex flex-col gap-6 pt-[92px] md:pt-[112px] ${BOTTOM_CLEARANCE}`}>
        <header className="flex flex-col gap-1.5">
          <h1 className="font-display text-[26px] leading-tight font-semibold md:text-[36px]">
            What are you cooking?
          </h1>
          <p className="max-w-prose text-[13px] leading-relaxed text-ink-soft md:text-[15px]">
            Pick the dish and we work out what you need and how much. Change anything before it reaches
            your basket.
          </p>
        </header>

        <div className="grid gap-3 md:grid-cols-2 md:gap-5 lg:gap-6">
          {cards.map(({ meal, fromKobo, names, tint, stroke }) => (
            <Link
              key={meal.slug}
              href={`/meals/${meal.slug}`}
              className="flex flex-col gap-3 rounded-card border border-line bg-paper p-3 transition-transform duration-[var(--m-fast)] hover:-translate-y-0.5 md:p-4"
            >
              <FishMark tint={tint} stroke={stroke} className="h-36 w-full rounded-[15px] md:h-44" label={false} />

              <div className="flex flex-col gap-1.5">
                <span className="w-fit rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
                  Serves {meal.defaultServes}
                </span>

                <h2 className="font-display text-[19px] font-semibold md:text-[22px]">{meal.name}</h2>

                <p className="text-[12px] leading-snug text-ink-muted md:text-[13px]">
                  {names.join(", ")}
                </p>
              </div>

              <div className="flex items-baseline gap-1.5 pt-0.5">
                <span className="text-[11.5px] text-ink-muted">from</span>
                <span className="text-[17px] font-bold">{formatNaira(fromKobo)}</span>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-[11.5px] leading-snug text-ink-muted">
          Quantities are for the seafood only. Okra, palm oil, seasoning and everything else in the pot
          are yours to add.
        </p>
      </Container>
    </main>
  );
}
