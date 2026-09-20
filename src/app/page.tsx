import Link from "next/link";

import { BOTTOM_CLEARANCE, Container } from "@/components/Container";
import { CutoffBanner } from "@/components/CutoffBanner";
import { FishMark } from "@/components/FishMark";
import { ProductCard } from "@/components/ProductCard";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { products } from "@/lib/seed";

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

export default function HomePage() {
  const today = products.filter((p) => p.availability === "today").slice(0, 4);

  return (
    <main>
      <TopBar />

      {/*
        The hero stacks on a phone and splits in two from `lg`, where a single
        column would leave the headline stranded in a very wide band.
      */}
      <section className="bg-tint-teal pt-[74px] md:pt-[82px]">
        <Container className="flex flex-col gap-8 py-10 lg:flex-row lg:items-center lg:gap-16 lg:py-16">
          <div className="flex flex-col gap-4 lg:flex-1">
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-abyss/85 px-3 py-1.5 backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-[#7FD3C4]" />
              <span className="text-[11.5px] font-semibold text-salt">Boats landed 5:40 AM</span>
            </span>

            <h1 className="font-display text-[33px] leading-[1.08] font-semibold md:text-[46px] lg:text-[56px]">
              Fresh seafood,
              <br />
              weighed for you.
            </h1>

            <p className="max-w-prose text-[13.5px] leading-relaxed text-ink-soft md:text-base">
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
                <CutoffBanner />
              </div>
            </div>
          </div>

          <FishMark
            tint="rgb(255 255 255 / 0.45)"
            stroke="#0F5D57"
            className="hidden h-[380px] rounded-[26px] lg:flex lg:flex-1"
          />
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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {today.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
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
