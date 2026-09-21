"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Container } from "@/components/Container";
import { Wordmark } from "@/components/TopBar";
import { isConfigured } from "@/lib/supabase";

/**
 * Operations.
 *
 * Built for a phone first, and not by shrinking a desktop table. The people
 * using this are standing at a jetty at six in the morning with one hand on a
 * crate — so every row is a card with a real tap target, the numbers that
 * matter are large, and nothing needs a horizontal scroll to read.
 *
 * It is a separate shell from the storefront on purpose: no basket, no
 * account, no floating tab bar. Different job, different chrome.
 */

const SECTIONS = [
  { href: "/admin", label: "Today" },
  { href: "/admin/pricing", label: "Prices & stock" },
  { href: "/admin/orders", label: "Packing queue" },
] as const;

export function AdminShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-dvh bg-sand">
      <header className="glass-light fixed inset-x-0 top-0 z-40 border-x-0 border-t-0">
        <Container className="flex h-[66px] items-center gap-3 md:h-[74px]">
          <Link href="/admin" className="flex min-h-11 shrink-0 items-center">
            <Wordmark />
          </Link>
          <span className="hidden text-[11.5px] font-semibold text-ink-muted sm:block">
            Operations · Lekki hub
          </span>

          <span className="flex-1" />

          <Link
            href="/"
            className="flex min-h-11 items-center rounded-control px-3 text-[12.5px] font-bold text-lagoon"
          >
            View storefront
          </Link>
        </Container>
      </header>

      <Container className="flex flex-col gap-5 pt-[84px] pb-16 md:pt-[96px]">
        <nav aria-label="Operations">
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {SECTIONS.map((s) => {
              const active = pathname === s.href || (s.href !== "/admin" && pathname.startsWith(s.href));
              return (
                <li key={s.href} className="shrink-0">
                  <Link
                    href={s.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-control px-4 text-[13px] font-bold whitespace-nowrap transition-colors duration-[var(--m-fast)] ${
                      active ? "bg-abyss text-salt" : "border border-line bg-paper text-ink-soft hover:bg-white"
                    }`}
                  >
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {!isConfigured() && (
          /*
            Said plainly, where the shop works. Everything on these screens is
            held in this one browser: another phone sees a different shop, and
            a cleared browser is a cleared shop. Nobody should mistake this for
            something taking real orders.
          */
          <div className="flex gap-2.5 rounded-card border-[1.5px] border-[#F0DFBE] bg-[#FBEFD8] p-3.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92500C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
              <path d="M12 8.5v4.5M12 16.5v.5" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span className="text-[12px] leading-snug text-[#6E3D08]">
              <strong className="font-bold">No database connected.</strong> Orders, the wallet,
              complaints and the price board are held in this browser only — another device sees a
              different shop, and clearing the browser clears all of it. Set the Supabase keys in
              <code className="px-1 font-mono text-[11px]">.env.local</code> to make this real.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="font-display text-[24px] leading-tight font-semibold md:text-[32px]">
              {title}
            </h1>
            {subtitle !== undefined && (
              <p className="text-[12px] text-ink-muted md:text-[13px]">{subtitle}</p>
            )}
          </div>
          {action}
        </div>

        {children}
      </Container>
    </main>
  );
}

/** A number the shop reads at a glance, not a chart. */
export function Stat({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "warn" | "good";
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-card border p-3.5 ${
        tone === "warn"
          ? "border-[#F0DFBE] bg-[#FBEFD8]"
          : tone === "good"
            ? "border-line bg-tint-mint"
            : "border-line bg-paper"
      }`}
    >
      <span className="text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
        {label}
      </span>
      <span className="font-display text-[22px] leading-none font-semibold md:text-[26px]">
        {value}
      </span>
      {note !== undefined && <span className="text-[11px] text-ink-muted">{note}</span>}
    </div>
  );
}
