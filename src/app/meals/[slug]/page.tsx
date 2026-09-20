import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ACTION_BAR_CLEARANCE, Container } from "@/components/Container";
import { Artwork } from "@/components/Artwork";
import { PageBar } from "@/components/TopBar";
import { mealBySlug, mealPhoto, meals } from "@/lib/seed";
import { MealClient } from "./MealClient";

export function generateStaticParams() {
  return meals.map((meal) => ({ slug: meal.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meal = mealBySlug(slug);
  if (meal === undefined) return { title: "Meal not found" };

  return { title: meal.name, description: meal.description };
}

export default async function MealPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meal = mealBySlug(slug);
  if (meal === undefined) notFound();

  return (
    <main>
      <PageBar title={meal.name} backHref="/meals" />

      <Container className={`flex flex-col gap-6 pt-[92px] md:pt-[112px] ${ACTION_BAR_CLEARANCE}`}>
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
          <Artwork
            kind="meal"
            src={mealPhoto(meal)}
            alt={meal.name}
            seed={meal.slug}
            className="h-44 w-full rounded-card md:h-60 lg:h-72 lg:flex-1"
          />

          <div className="flex flex-col gap-1.5 lg:flex-1">
            <span className="w-fit rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
              Serves {meal.defaultServes}
            </span>
            <h1 className="font-display text-[26px] leading-tight font-semibold md:text-[36px]">
              {meal.name}
            </h1>
            <p className="max-w-prose text-[13px] leading-relaxed text-ink-soft md:text-[15px]">
              {meal.description}
            </p>
          </div>
        </header>

        <MealClient meal={meal} />
      </Container>
    </main>
  );
}
