import type { ReactNode } from "react";

type Tone = "light" | "dark" | "sheet";

const TONES: Record<Tone, string> = {
  light: "glass-light",
  dark: "glass-dark",
  sheet: "glass-sheet",
};

/**
 * A translucent surface. Only ever placed over content — navigation, floating
 * controls, sheets and drawers. Never over an empty background, where the blur
 * has nothing to do and the effect reads as noise.
 */
export function GlassSurface({
  tone = "light",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`${TONES[tone]} ${className}`}>{children}</div>;
}
