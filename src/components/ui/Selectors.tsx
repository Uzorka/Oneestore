"use client";

import { formatNaira, formatWeight } from "@/lib/money";
import type { Grams, PrepOption } from "@/lib/types";

/**
 * The selection controls.
 *
 * Every one of them is a real `<button>` with `aria-pressed`, because a
 * selected state that Tab cannot reach is not a control, it is a picture of
 * one. Selection responds within 120ms — the `--m-fast` token.
 */

const PILL_BASE =
  "flex-1 min-h-[46px] rounded-control text-[13.5px] transition-[transform,background-color,box-shadow] duration-[var(--m-fast)] ease-[var(--ease-fast)]";

export function WeightSelector({
  options,
  valueG,
  onChange,
  customLabel = "Custom",
  onCustom,
  customActive = false,
}: {
  options: readonly Grams[];
  valueG: Grams;
  onChange: (grams: Grams) => void;
  customLabel?: string;
  onCustom?: () => void;
  customActive?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {options.map((grams) => {
        const on = !customActive && valueG === grams;
        return (
          <button
            key={grams}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(grams)}
            className={`${PILL_BASE} ${
              on
                ? "bg-lagoon font-bold text-white shadow-[0_5px_14px_rgb(15_93_87_/_0.26)]"
                : "border border-line bg-paper font-semibold text-ink-soft"
            }`}
          >
            {formatWeight(grams)}
          </button>
        );
      })}

      {onCustom !== undefined && (
        <button
          type="button"
          aria-pressed={customActive}
          onClick={onCustom}
          className={`${PILL_BASE} ${
            customActive
              ? "bg-lagoon font-bold text-white shadow-[0_5px_14px_rgb(15_93_87_/_0.26)]"
              : "border border-line bg-paper font-semibold text-ink-soft"
          }`}
        >
          {customLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Preparation. The surcharge is printed on the option itself — a cost that
 * only appears in the basket is a cost the customer feels tricked by.
 */
export function PreparationSelector({
  options,
  value,
  onChange,
}: {
  options: readonly PrepOption[];
  value: string | null;
  onChange: (prepId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((prep) => {
        const on = prep.id === value;
        return (
          <button
            key={prep.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(prep.id)}
            className={`flex min-h-[58px] flex-col items-start gap-1 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-[var(--m-fast)] ease-[var(--ease-fast)] ${
              on ? "border-[1.5px] border-lagoon bg-tint-mint" : "border border-line bg-paper"
            }`}
          >
            <span className="flex w-full items-center gap-1.5">
              <span className="flex-1 text-[13px] font-bold">{prep.name}</span>
              <span
                aria-hidden="true"
                className={`flex size-[17px] shrink-0 items-center justify-center rounded-full ${
                  on ? "bg-lagoon" : "border-[1.5px] border-line"
                }`}
              >
                {on && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
            </span>
            <span className="text-[11px] text-ink-muted">
              {prep.surchargePerKgKobo === 0
                ? "No extra charge"
                : `+${formatNaira(prep.surchargePerKgKobo)}/kg`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A weight stepper. The number is the thing, so it is the biggest element. */
export function WeightStepper({
  valueG,
  stepG,
  onChange,
  min,
  max,
}: {
  valueG: Grams;
  stepG: Grams;
  onChange: (grams: Grams) => void;
  min: Grams;
  max: Grams;
}) {
  const atMin = valueG <= min;
  const atMax = valueG >= max;

  return (
    <div className="flex items-center gap-3.5 rounded-[15px] border border-line bg-paper p-3">
      <button
        type="button"
        disabled={atMin}
        onClick={() => onChange(Math.max(min, valueG - stepG))}
        aria-label={`Reduce by ${formatWeight(stepG)}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-control border-[1.5px] border-line bg-paper disabled:opacity-40"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </button>

      <span className="flex-1 text-center font-display text-2xl font-semibold" aria-live="polite">
        {formatWeight(valueG)}
      </span>

      <button
        type="button"
        disabled={atMax}
        onClick={() => onChange(Math.min(max, valueG + stepG))}
        aria-label={`Add ${formatWeight(stepG)}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-control bg-lagoon text-white disabled:opacity-40"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
