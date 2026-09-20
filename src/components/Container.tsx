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

/**
 * Bottom clearance for a page that also carries a floating action bar.
 *
 * The bar is glass, so content that ends underneath it is not hidden — it
 * shows through, half-legible, behind the total. It has to end above it.
 *
 * Below `md` the bar clears the tab bar as well, so it is about 160px tall.
 * At `md` the tab bar is gone and the bar shrinks. At `lg` the bar is gone
 * too and the action has moved into the summary column.
 */
export const ACTION_BAR_CLEARANCE = "pb-48 md:pb-28 lg:pb-16";
