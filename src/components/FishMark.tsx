/**
 * Placeholder artwork.
 *
 * There is no photography yet, so product imagery is a tinted panel with a
 * line-drawn mark and a visible "Photo" label. A labelled placeholder is
 * honest; a stock photo of a salmon fillet would quietly undermine the Fresh
 * Promise the whole proposition rests on.
 */
export function FishMark({
  tint,
  stroke,
  className = "",
  label = true,
}: {
  tint: string;
  stroke: string;
  className?: string;
  label?: boolean;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: tint }}
    >
      <svg viewBox="0 0 40 40" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-3/5">
        <path d="M4 20c5-7 12-10 18-10s11 4 13 10c-2 6-7 10-13 10S9 27 4 20z" />
        <path d="M35 20l-4-5v10l4-5z" />
        <circle cx="14" cy="18" r="1.2" fill={stroke} />
      </svg>
      {label && (
        <span className="absolute right-2 bottom-1.5 text-[8px] tracking-[0.08em] uppercase" style={{ color: stroke }}>
          Photo
        </span>
      )}
    </div>
  );
}

/** Tints cycle so a grid of cards does not read as one flat block. */
const TINTS = [
  { tint: "var(--color-tint-teal)", stroke: "#0F5D57" },
  { tint: "var(--color-tint-clay)", stroke: "#C64A26" },
  { tint: "var(--color-tint-mint)", stroke: "#1C6B4A" },
  { tint: "var(--color-sand)", stroke: "#0F5D57" },
] as const;

export function tintFor(seed: string): { tint: string; stroke: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length] as { tint: string; stroke: string };
}
