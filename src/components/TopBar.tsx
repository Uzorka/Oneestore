"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/components/CartProvider";
import { Container } from "@/components/Container";
import { cartLineCount, priceCart } from "@/lib/cart";
import { formatNaira } from "@/lib/money";
import { productMap } from "@/lib/seed";

/** The wordmark, set in the sans at wide tracking — never the display serif. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-abyss md:size-9">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#7FD3C4" strokeWidth="1.9" strokeLinecap="round">
          <path d="M3 14c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0" />
          <path d="M3 9c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0" />
        </svg>
      </span>
      <span className="text-sm font-bold tracking-[0.05em] md:text-base">ONEESTORE</span>
    </span>
  );
}

/**
 * `wide` items appear only from `lg`. At `md` the bar already carries a logo,
 * search, account and basket; four nav items on top of that overflow 768px and
 * the first thing flexbox crushes is the wordmark. They stay reachable there
 * from the home page cards.
 */
const NAV = [
  { href: "/shop", label: "Shop", wide: false },
  { href: "/box", label: "Build Your Box", wide: true },
  { href: "/meals", label: "Shop by Meal", wide: true },
  { href: "/#fresh-promise", label: "Fresh Promise", wide: false },
] as const;

/**
 * The header.
 *
 * Below `md` it is a compact glass bar, because navigation belongs in the
 * floating tab bar within thumb reach. From `md` up there is no tab bar, so
 * this carries the whole thing — search, location, account and a basket that
 * shows its running total, which a phone keeps at the bottom of the screen.
 */
export function TopBar({ area = "Lekki Phase 1" }: { area?: string }) {
  const pathname = usePathname();
  const { state, ready } = useCart();

  const count = ready ? cartLineCount(state) : 0;
  const totals = ready && count > 0 ? priceCart(state, productMap()) : null;

  return (
    <header className="glass-light fixed inset-x-0 top-0 z-40 border-x-0 border-t-0">
      <Container className="flex h-[74px] items-center gap-3 md:h-[82px] md:gap-3 lg:gap-5">
        <Link href="/" className="flex min-h-11 shrink-0 flex-col justify-center gap-0.5">
          <Wordmark />
          <span className="flex items-center gap-1 pl-[42px] text-[10.5px] text-ink-muted md:hidden">
            <PinIcon />
            {area}
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex lg:gap-1">
          {NAV.map((item) => {
            const active = item.href !== "/#fresh-promise" && pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${item.wide ? "hidden lg:flex" : "flex"} min-h-11 items-center rounded-lg px-2 text-[13px] whitespace-nowrap transition-colors duration-[var(--m-fast)] lg:text-sm ${
                  active ? "font-bold text-abyss" : "font-medium text-ink-soft hover:text-abyss"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <span className="flex-1" />

        <Link
          href="/search"
          className="hidden h-11 items-center gap-2.5 rounded-control bg-sand px-3.5 text-[13.5px] text-ink-muted transition-colors hover:bg-line md:flex md:w-32 lg:w-56"
        >
          <SearchIcon />
          <span className="truncate">Search croaker, titus, ede…</span>
        </Link>

        <span className="hidden h-11 shrink-0 items-center gap-1.5 rounded-control border border-line bg-paper px-3 text-[12.5px] font-semibold whitespace-nowrap lg:flex">
          <PinIcon />
          {area}
        </span>

        {/* On a phone only search sits up here; the rest is in the tab bar. */}
        <Link
          href="/search"
          aria-label="Search seafood"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/70 md:hidden"
        >
          <SearchIcon />
        </Link>

        <Link
          href="/account"
          aria-label="Your account"
          className="hidden size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper transition-colors hover:bg-sand md:flex"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8.5" r="3.8" />
            <path d="M4.5 20c1.4-4 4.1-5.5 7.5-5.5s6.1 1.5 7.5 5.5" />
          </svg>
        </Link>

        <Link
          href="/basket"
          className="relative hidden h-11 shrink-0 items-center gap-2.5 rounded-control bg-abyss px-4 text-[13.5px] font-semibold whitespace-nowrap text-salt transition-colors hover:bg-[#123a3e] md:flex"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h2l2.2 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L21 9H7" />
            <circle cx="10.5" cy="20" r="1.3" />
            <circle cx="18" cy="20" r="1.3" />
          </svg>
          {totals !== null ? formatNaira(totals.payableKobo) : "Basket"}
          {count > 0 && (
            <span
              key={count}
              className="animate-pop absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white"
            >
              {count}
            </span>
          )}
        </Link>
      </Container>
    </header>
  );
}

/**
 * Inner pages: a back-and-title bar on a phone, the full navigation on a
 * desktop. A back arrow is a phone affordance — on a wide screen the customer
 * has the whole menu and their browser's own history.
 */
export function PageBar({ title, backHref }: { title: string; backHref: string }) {
  return (
    <>
      <div className="hidden md:block">
        <TopBar />
      </div>

      <header className="glass-light fixed inset-x-0 top-0 z-40 border-x-0 border-t-0 md:hidden">
        <Container className="flex h-[74px] items-center gap-2">
          <Link href={backHref} aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-xl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="flex-1 text-base font-bold">{title}</h1>
        </Container>
      </header>
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}
