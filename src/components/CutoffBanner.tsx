"use client";

import { useEffect, useState } from "react";

import { SAME_DAY_CUTOFF_HOUR, timeToCutoff } from "@/lib/delivery";

/**
 * The same-day countdown.
 *
 * It renders nothing on the server: the cut-off depends on the current minute,
 * and a server-rendered countdown would either hydrate into a mismatch or sit
 * there frozen and wrong. It ticks every 30 seconds, which is enough for a
 * minute-resolution display without waking the device needlessly.
 */
export function CutoffBanner() {
  const [left, setLeft] = useState<{ hours: number; minutes: number } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tick = () => {
      setLeft(timeToCutoff(new Date()));
      setReady(true);
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!ready) {
    // Hold the space so nothing jumps when the countdown arrives.
    return <div className="h-11" aria-hidden="true" />;
  }

  if (left === null) {
    return (
      <div className="flex items-center gap-2.5 rounded-[13px] bg-sand px-3.5 py-3">
        <ClockIcon className="shrink-0 text-ink-muted" />
        <span className="text-[12.5px] leading-snug text-ink-soft">
          Today&rsquo;s {SAME_DAY_CUTOFF_HOUR} AM cut-off has passed — ordering now is for tomorrow.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-[13px] bg-tint-amber px-3.5 py-3">
      <ClockIcon className="shrink-0 text-amber" />
      <span className="text-[12.5px] leading-snug text-amber">
        <strong className="font-bold">
          {left.hours > 0 ? `${left.hours}h ` : ""}
          {left.minutes}m left
        </strong>{" "}
        for delivery today, 4–8 PM
      </span>
    </div>
  );
}

function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
