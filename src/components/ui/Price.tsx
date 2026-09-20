import { formatNaira } from "@/lib/money";
import type { Kobo } from "@/lib/types";

/**
 * A price. The display serif is what makes a price on this storefront look
 * like a market board rather than a spreadsheet cell.
 */
export function Price({
  amountKobo,
  size = "md",
  suffix,
}: {
  amountKobo: Kobo;
  size?: "sm" | "md" | "lg" | "xl";
  suffix?: string;
}) {
  const sizes = {
    sm: "text-[15px]",
    md: "text-[17px]",
    lg: "text-[21px]",
    xl: "text-[31px]",
  } as const;

  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`font-display font-semibold ${sizes[size]}`}>{formatNaira(amountKobo)}</span>
      {suffix !== undefined && <span className="text-[11px] text-ink-muted">{suffix}</span>}
    </span>
  );
}
