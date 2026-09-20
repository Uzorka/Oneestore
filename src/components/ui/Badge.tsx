import type { ReactNode } from "react";

type Tone = "stock" | "low" | "soon" | "alert" | "neutral";

const TONES: Record<Tone, string> = {
  stock: "bg-tint-mint text-reef",
  low: "bg-tint-amber text-amber",
  soon: "bg-sand text-ink-muted",
  alert: "bg-tint-clay text-clay",
  neutral: "bg-sand text-ink-soft",
};

/** A small state chip. Always carries a word — never colour alone. */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`${TONES[tone]} inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold`}
    >
      {children}
    </span>
  );
}
