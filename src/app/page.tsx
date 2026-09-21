import Link from "next/link";

import { BOTTOM_CLEARANCE, Container } from "@/components/Container";
import { CutoffBanner } from "@/components/CutoffBanner";
import { HeroVideo } from "@/components/HeroVideo";
import { ProductCard } from "@/components/ProductCard";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { Artwork } from "@/components/Artwork";
import { ZONES } from "@/lib/delivery";
import { LGAS } from "@/lib/lagos";
import { formatNaira } from "@/lib/money";
import { mealLines, priceBasket } from "@/lib/pricing";
import { categories, mealPhoto, meals, productMap, products } from "@/lib/seed";

const PROMISE = [
  {
    title: "Caught today or it is not listed.",
    body: "Nothing sits in a freezer waiting for you.",
  },
  {
    title: "Weighed on camera.",
    body: "You pay for the weight that reaches your door, to the gram.",
  },
  {
    title: "Not right? Tell us within 2 hours.",
    body: "Send a photo and we refund it. No argument.",
  },
] as const;

const STEPS = [
  {
    title: "Pick the weight",
    body: "Everything is sold by the kilogram. Take 800 g or take four — you are not buying a pack someone else decided on.",
  },
  {
    title: "Say how you want it",
    body: "Whole, cleaned, filleted, steak-cut. Filleting loses about half the weight and we tell you before you choose, not after.",
  },
  {
    title: "It arrives on ice",
    body: "Weighed on camera before it leaves. You pay for the weight that reaches your door, to the gram.",
  },
] as const;

export default function HomePage() {
  // Five, because the grid runs to five columns on a wide screen and a row
  // one short of full reads as something failing to load.
  const today = products.filter((p) => p.availability === "today").slice(0, 5);

  const catalog = productMap();

  const shelves = categories.map((category) => ({
    slug: category.slug,
    name: category.name,
    count: products.filter((p) => p.categorySlug === category.slug && p.availability !== "hidden").length,
    kind:
      category.slug === "prawns-shrimp"
        ? ("prawn" as const)
        : category.slug === "shellfish"
          ? ("crab" as const)
          : category.slug === "smoked-dried"
            ? ("dried" as const)
            : ("fish" as const),
  }));

  // The "from" price is the required ingredients at the default serving count
  // — the honest floor, the same figure the meals page quotes.
  const dishes = meals.map((meal) => ({
    meal,
    fromKobo: priceBasket(
      mealLines({
        meal,
        serves: meal.defaultServes,
        productsById: catalog,
        excluded: new Set(meal.ingredients.filter((i) => i.optional).map((i) => i.productId)),
      }),
      catalog,
    ).payableKobo,
  }));

  return (
    <main>
      <TopBar />

      {/*
        The film is the hero: full width, edge to edge, with everything else
        standing on top of it.

        Which makes contrast the whole problem. Footage moves, and a frame that
        was dark when the headline was placed is bright two seconds later — so
        the text never sits on the video directly. A scrim runs under it,
        opaque where the words are and clearing towards the far edge, and the
        headline keeps a shadow besides. Measured rather than eyeballed: every
        piece of text over the film is checked against WCAG AA.
      */}
      <section className="relative isolate flex min-h-[540px] flex-col justify-end overflow-hidden pt-[74px] md:min-h-[600px] md:pt-[82px] lg:h-[82vh] lg:max-h-[780px]">
        <HeroVideo className="absolute inset-0 -z-20" />

        {/*
          Weighted to where the words are rather than laid evenly over the
          film: opaque across the bottom fifth, clearing by the top. The
          measurements below are taken against the still fallback, and footage
          has brighter frames than a still, so the target is real headroom over
          AA rather than a pass by a hundredth.
        */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-t from-abyss from-20% via-abyss/80 via-60% to-abyss/10"
        />

        <Container className="flex flex-col gap-4 py-10 md:gap-5 md:py-14 lg:max-w-[1460px] lg:py-20">
          <span className="flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-abyss/88 px-3 py-1.5 backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-[#7FD3C4]" />
            <span className="text-[11.5px] font-semibold text-salt">Boats landed 5:40 AM</span>
          </span>

          <h1 className="max-w-[16ch] font-display text-[34px] leading-[1.06] font-semibold text-white [text-shadow:0_2px_24px_rgb(11_43_46_/_0.55)] md:text-[52px] lg:text-[64px]">
            Fresh seafood,
            <br />
            weighed for you.
          </h1>

          <p className="max-w-[42ch] text-[14px] leading-relaxed text-white/90 [text-shadow:0_1px_12px_rgb(11_43_46_/_0.6)] md:text-[17px]">
            Pick the weight. Tell us how to prepare it. It arrives on ice today.
          </p>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <ButtonLink href="/shop" size="lg" className="w-full sm:w-auto">
              Shop today&rsquo;s catch
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </ButtonLink>
            <div className="sm:max-w-sm sm:flex-1">
              <CutoffBanner onDark />
            </div>
          </div>
        </Container>
      </section>

      <Container className={`flex flex-col gap-10 pt-8 md:gap-14 md:pt-12 ${BOTTOM_CLEARANCE}`}>
        <div className="grid gap-3 md:grid-cols-2 md:gap-5">
          <Link
            href="/box"
            className="flex items-center gap-4 rounded-[19px] bg-abyss p-4.5 transition-transform duration-[var(--m-fast)] hover:-translate-y-0.5 md:p-6"
          >
            <span className="flex size-[62px] shrink-0 items-center justify-center rounded-[15px] border border-white/15 bg-white/10">
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" stroke="#7FD3C4" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 14l14-6 14 6-14 6-14-6z" />
                <path d="M6 14v12l14 6 14-6V14" />
                <path d="M20 20v12" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-display text-[19px] font-semibold text-white md:text-[22px]">
                Build Your Box
              </span>
              <span className="text-xs leading-snug text-[#A8C4C0] md:text-[13px]">
                Fill a box your way and watch it fill up. Better price per kg as it grows.
              </span>
            </span>
          </Link>

          <Link
            href="/meals"
            className="flex items-center gap-4 rounded-[19px] border border-line bg-paper p-4.5 transition-transform duration-[var(--m-fast)] hover:-translate-y-0.5 md:p-6"
          >
            <span className="flex size-[62px] shrink-0 items-center justify-center rounded-[15px] bg-tint-clay">
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" stroke="#C64A26" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 17h24v9a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7v-9z" />
                <path d="M32 20h3a3 3 0 0 1 0 6h-3" />
                <path d="M14 12c0-2 2-2 2-4M20 12c0-2 2-2 2-4M26 12c0-2 2-2 2-4" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-display text-[19px] font-semibold md:text-[22px]">Shop by Meal</span>
              <span className="text-xs leading-snug text-ink-muted md:text-[13px]">
                Seafood okra, pepper soup, pasta, boil — we work out the quantities.
              </span>
            </span>
          </Link>
        </div>

        {/*
          Straight to a shelf. Somebody who came for prawns should not have to
          read the whole page to find out there are prawns.
        */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[19px] font-semibold md:text-[28px]">
            What are you after?
          </h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {shelves.map((shelf) => (
              <Link
                key={shelf.slug}
                href={`/shop#${shelf.slug}`}
                className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-2.5 transition-transform duration-[var(--m-fast)] hover:-translate-y-0.5"
              >
                <Artwork
                  kind={shelf.kind}
                  alt={shelf.name}
                  seed={shelf.slug}
                  className="h-24 w-full rounded-xl md:h-28"
                />
                <span className="flex flex-col gap-0.5 px-0.5 pb-0.5">
                  <span className="text-[13.5px] font-bold">{shelf.name}</span>
                  <span className="text-[11px] text-ink-muted">
                    {shelf.count} {shelf.count === 1 ? "kind" : "kinds"} today
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-end gap-4">
            <div className="flex flex-1 flex-col">
              <h2 className="font-display text-[19px] font-semibold md:text-[28px]">
                Landed this morning
              </h2>
              <span className="mt-0.5 text-[11.5px] text-ink-muted md:text-[13px]">
                Prices updated 6:12 AM
              </span>
            </div>
            <Link
              href="/shop"
              className="flex min-h-11 items-center px-1 text-[13px] font-bold text-lagoon md:text-sm"
            >
              See all
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {today.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        {/*
          The meals, with real quantities behind them rather than a link that
          promises something vague.
        */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end gap-4">
            <div className="flex flex-1 flex-col">
              <h2 className="font-display text-[19px] font-semibold md:text-[28px]">
                Tonight&rsquo;s dinner, worked out
              </h2>
              <span className="mt-0.5 text-[11.5px] text-ink-muted md:text-[13px]">
                Pick the dish; we work out what to buy and how much
              </span>
            </div>
            <Link
              href="/meals"
              className="flex min-h-11 items-center px-1 text-[13px] font-bold text-lagoon md:text-sm"
            >
              All meals
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {dishes.map(({ meal, fromKobo }) => (
              <Link
                key={meal.slug}
                href={`/meals/${meal.slug}`}
                className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-2.5 transition-transform duration-[var(--m-fast)] hover:-translate-y-0.5"
              >
                <Artwork
                  kind="meal"
                  src={mealPhoto(meal)}
                  alt={meal.name}
                  seed={meal.slug}
                  className="h-28 w-full rounded-xl md:h-36"
                />
                <span className="flex flex-col gap-0.5 px-0.5 pb-0.5">
                  <span className="truncate text-[13.5px] font-bold">{meal.name}</span>
                  <span className="text-[11px] text-ink-muted">
                    Serves {meal.defaultServes} · from {formatNaira(fromKobo)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-card bg-abyss p-5 md:p-8">
          <h2 className="font-display text-[19px] font-semibold text-white md:text-[26px]">
            How it works
          </h2>

          <ol className="grid gap-5 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 font-display text-[15px] font-semibold text-[#7FD3C4]">
                  {i + 1}
                </span>
                <span className="font-display text-[16px] font-semibold text-white md:text-[19px]">
                  {step.title}
                </span>
                <span className="text-[12.5px] leading-relaxed text-[#A8C4C0]">{step.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[19px] font-semibold md:text-[28px]">
              Where we deliver
            </h2>
            <span className="text-[11.5px] text-ink-muted md:text-[13px]">
              All {LGAS.length} Lagos local governments. Free over {formatNaira(10_000_000)}.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {ZONES.map((zone) => (
              <div key={zone.id} className="flex flex-col gap-1.5 rounded-card border border-line bg-paper p-3.5">
                <span className="text-[13.5px] font-bold">{zone.name}</span>
                <span className="text-[11px] leading-snug text-ink-muted">
                  {zone.areas.join(", ")}
                </span>
                <span className="mt-auto pt-1 font-display text-[19px] font-semibold">
                  {formatNaira(zone.feeKobo)}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11.5px] leading-snug text-ink-muted">
            Order before 11 AM for the same day. Mondays are closed — the boats do not go out on
            Sundays, so there is nothing landed to deliver.
          </p>
        </section>

        <section
          id="fresh-promise"
          className="flex scroll-mt-28 flex-col gap-5 rounded-card border border-line bg-paper p-5 md:p-8"
        >
          <div className="flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F5D57" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M12 3.5l7 3v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9v-5l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <h2 className="flex-1 font-display text-[17px] font-semibold md:text-[22px]">
              The Fresh Promise
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-7">
            {PROMISE.map((item) => (
              <div key={item.title} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-tint-mint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1C6B4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className="text-[12.5px] leading-relaxed text-ink-soft">
                  <strong className="font-bold text-ink">{item.title}</strong> {item.body}
                </span>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </main>
  );
}
