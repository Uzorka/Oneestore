import type { ReactNode } from "react";

/**
 * The measure the whole site is laid out on.
 *
 * Content stops growing at 1180px. Past that a product grid turns into a
 * horizon of cards and body copy runs to unreadable line lengths, so the
 * page centres instead of stretching.
 */
export function Container({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1180px] px-4.5 md:px-8 lg:px-12 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Bottom clearance.
 *
 * Below `md` the floating tab bar overlays the page and content has to end
 * above it. From `md` up the tab bar is gone and that space would just be a
 * hole, so the padding goes with it.
 */
export const BOTTOM_CLEARANCE = "pb-28 md:pb-16";
