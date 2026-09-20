import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Absence should still move someone forward, so an empty state always carries
 * the way out of it.
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  actionHref,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-card border border-line bg-paper px-4 py-7 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-tint-teal text-lagoon">
        {icon}
      </span>
      <span className="text-sm font-bold">{title}</span>
      <span className="text-xs leading-relaxed text-ink-muted">{body}</span>
      <Link
        href={actionHref}
        className="mt-1 flex min-h-11 items-center rounded-control bg-clay px-5 text-[13.5px] font-bold text-white"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
