import Link from "next/link";

/** The wordmark, set in the sans at wide tracking — never the display serif. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-abyss">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#7FD3C4" strokeWidth="1.9" strokeLinecap="round">
          <path d="M3 14c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0" />
          <path d="M3 9c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0" />
        </svg>
      </span>
      <span className="text-sm font-bold tracking-[0.05em]">ONEESTORE</span>
    </span>
  );
}

/**
 * The page header. Glass, because it sits over the content that scrolls
 * beneath it.
 */
export function TopBar({ area = "Lekki Phase 1" }: { area?: string }) {
  return (
    <header className="glass-light fixed inset-x-0 top-0 z-40 flex h-[74px] items-center gap-3 border-x-0 border-t-0 px-4.5">
      <Link href="/" className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Wordmark />
        <span className="flex items-center gap-1 pl-[42px] text-[10.5px] text-ink-muted">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
          {area}
        </span>
      </Link>

      <Link
        href="/search"
        aria-label="Search seafood"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/70"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
      </Link>
    </header>
  );
}

/** A plain back-and-title bar for the inner pages. */
export function PageBar({ title, backHref }: { title: string; backHref: string }) {
  return (
    <header className="glass-light fixed inset-x-0 top-0 z-40 flex h-[74px] items-center gap-2 border-x-0 border-t-0 px-4.5">
      <Link href={backHref} aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-xl">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="flex-1 text-base font-bold">{title}</h1>
    </header>
  );
}
