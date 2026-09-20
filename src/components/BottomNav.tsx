"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/components/CartProvider";
import { cartLineCount } from "@/lib/cart";
import type { ReactNode } from "react";

/**
 * The mobile navigation: a floating glass bar over the page content.
 *
 * Five destinations, not the desktop menu shrunk down. Everything else lives in
 * bottom sheets and contextual menus, within reach of a thumb.
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
  {
    href: "/",
    label: "Home",
    icon: icon(
      <>
        <path d="M4 11l8-6.5 8 6.5" />
        <path d="M6.5 10v9h11v-9" />
      </>,
    ),
  },
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
  {
    href: "/search",
    label: "Search",
    icon: icon(
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
      </>,
    ),
  },
  {
    href: "/orders",
    label: "Orders",
    icon: icon(
      <>
        <path d="M6 3.5h9l4 4v13H6z" />
        <path d="M9 11h7M9 15h7" />
      </>,
    ),
  },
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
];

export function BottomNav() {
  const pathname = usePathname();
  const { state, ready } = useCart();

  // The badge appears only once the saved basket has been read, so it never
  // flashes an empty count and then jumps.
  const count = ready ? cartLineCount(state) : 0;

  /**
   * The product page has its own sticky purchase bar. Two stacked bars at the
   * bottom of a phone is one too many, and the purchase bar is the one that
   * matters there — so the nav stands down.
   */
  if (pathname.startsWith("/product/")) return null;

  return (
    <nav
      aria-label="Main"
      className="glass-light fixed right-3.5 bottom-4 left-3.5 z-40 flex h-[68px] items-stretch rounded-[22px] px-1.5 py-[7px]"
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
