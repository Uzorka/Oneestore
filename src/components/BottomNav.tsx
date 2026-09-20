"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useCart } from "@/components/CartProvider";
import { cartLineCount } from "@/lib/cart";

/**
 * Phone navigation: a floating glass bar over the page.
 *
 * Five destinations within thumb reach. Orders are not one of them — an
 * order belongs to the person who placed it, so it lives inside Account
 * rather than competing for a slot with shopping.
 *
 * This is a phone control. From `md` up the top bar carries navigation and
 * this is hidden, rather than stretched across a screen it was never drawn
 * for.
 */

interface Tab {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
}

const icon = (paths: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

const TABS: readonly Tab[] = [
  { href: "/", label: "Home", icon: icon(<><path d="M4 11l8-6.5 8 6.5" /><path d="M6.5 10v9h11v-9" /></>) },
  {
    href: "/shop",
    label: "Shop",
    icon: icon(
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
      </>,
    ),
  },
  { href: "/search", label: "Search", icon: icon(<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>) },
  {
    href: "/basket",
    label: "Basket",
    icon: icon(
      <>
        <path d="M4 5h2l2.2 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L21 9H7" />
        <circle cx="10.5" cy="20" r="1.3" />
        <circle cx="18" cy="20" r="1.3" />
      </>,
    ),
  },
  {
    href: "/account",
    label: "Account",
    icon: icon(<><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.4-4 4.1-5.5 7.5-5.5s6.1 1.5 7.5 5.5" /></>),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { state, ready } = useCart();

  // The product page has its own sticky purchase bar on a phone; two stacked
  // bars is one too many, and the purchase bar is the one that matters there.
  if (pathname.startsWith("/product/")) return null;

  // Operations is not the storefront. Someone weighing fish at the jetty has
  // no use for a basket tab, and it sits on top of the figures they are
  // reading.
  if (pathname.startsWith("/admin")) return null;

  const count = ready ? cartLineCount(state) : 0;

  return (
    <nav
      aria-label="Main"
      className="glass-light fixed right-3.5 bottom-4 left-3.5 z-40 flex h-[68px] items-stretch rounded-[22px] px-1.5 py-[7px] md:hidden"
    >
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const badge = tab.href === "/basket" && count > 0 ? count : undefined;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 items-stretch"
          >
            <span
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-colors duration-[var(--m-fast)] ease-[var(--ease-fast)] ${
                active ? "bg-white/90 text-abyss shadow-[0_3px_10px_rgb(11_43_46_/_0.1)]" : "text-ink-faint"
              }`}
            >
              <span className="relative flex items-center justify-center">
                {tab.icon}
                {badge !== undefined && (
                  <span
                    key={badge}
                    className="animate-pop absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[9.5px] font-bold text-white"
                  >
                    {badge}
                  </span>
                )}
              </span>
              <span className={`text-[9.5px] ${active ? "font-bold" : "font-medium"}`}>{tab.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
