"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { findZone } from "@/lib/delivery";
import { AREAS, searchAreas } from "@/lib/lagos";
import { formatNaira } from "@/lib/money";
import type { LagosArea } from "@/lib/lagos";

/**
 * Where in Lagos the customer lives.
 *
 * A plain `<select>` of several hundred areas is a scroll nobody finishes on a
 * phone, so this is a combobox: type a few letters, pick from what matches. It
 * searches the local government too, because somebody who does not see their
 * own area types "Alimosho" and expects the list.
 *
 * It is a real combobox rather than a div that looks like one — arrow keys
 * move through the options, Enter takes one, Escape closes, and the whole
 * thing is announced. A shop that only works with a mouse is a shop that does
 * not work for everyone.
 *
 * The delivery fee is shown against each option. The zone is not asked for at
 * all: the customer knows their area, not the shop's pricing bands.
 */
export function AreaPicker({
  lga,
  area,
  onPick,
  error,
}: {
  lga: string;
  area: string;
  onPick: (picked: LagosArea) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const chosen = useMemo(
    () => AREAS.find((a) => a.lga === lga && a.name === area),
    [lga, area],
  );

  const results = useMemo(() => searchAreas(query, 60), [query]);

  // Clicking outside is how people close these, so it has to work.
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      if (boxRef.current !== null && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted option in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(picked: LagosArea) {
    onPick(picked);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (next + results.length) % Math.max(1, results.length);
      });
      return;
    }

    if (e.key === "Enter" && open) {
      const picked = results[active];
      if (picked !== undefined) { e.preventDefault(); choose(picked); }
      return;
    }

    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5" ref={boxRef}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold text-ink-muted">
          Area and local government
        </span>

        <div className="relative">
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] !== undefined ? `${listId}-${active}` : undefined}
            value={open ? query : chosen === undefined ? "" : `${chosen.name}, ${chosen.lga}`}
            placeholder="Start typing — Lekki, Ikeja, Alimosho…"
            onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
            onFocus={() => { setQuery(""); setOpen(true); }}
            onKeyDown={onKeyDown}
            className={`h-12 w-full rounded-control border px-3.5 text-[15px] outline-none ${
              error === undefined ? "border-line" : "border-clay"
            }`}
          />

          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-muted"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </label>

      {error !== undefined && (
        <span className="text-[11.5px] font-semibold text-clay">{error}</span>
      )}

      {chosen !== undefined && !open && (
        <span className="text-[11.5px] text-ink-muted">
          {feeNote(chosen)}
        </span>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          ref={listRef}
          aria-label="Areas in Lagos"
          className="animate-rise max-h-72 overflow-y-auto rounded-card border border-line bg-paper py-1 shadow-[0_12px_34px_rgb(11_43_46_/_0.12)]"
        >
          {results.length === 0 && (
            <li className="px-3.5 py-3 text-[12.5px] text-ink-muted">
              Nothing matches that. Try your local government — Alimosho, Eti-Osa, Kosofe.
            </li>
          )}

          {results.map((option, i) => (
            <li
              key={`${option.lga}:${option.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              // mousedown only keeps the field from blurring before the click
              // lands; the choice is made on click, so anything that clicks —
              // a mouse, a tap, assistive software — works.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(option)}
              className={`flex min-h-11 cursor-pointer items-center gap-3 px-3.5 py-2 ${
                i === active ? "bg-tint-mint" : ""
              }`}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px] font-semibold">{option.name}</span>
                <span className="text-[11px] text-ink-muted">{option.lga}</span>
              </span>
              <span className="shrink-0 text-[11.5px] font-semibold text-ink-muted">
                {shortFee(option)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function shortFee(area: LagosArea): string {
  const zone = findZone(area.zoneId);
  return zone === undefined ? "" : formatNaira(zone.feeKobo);
}

function feeNote(area: LagosArea): string {
  const zone = findZone(area.zoneId);
  if (zone === undefined) return "";

  return `${zone.name} run — delivery ${formatNaira(zone.feeKobo)}, or free over ₦100,000.`;
}
