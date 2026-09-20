"use client";

import { useEffect, useRef, useState } from "react";

import type { ArtKind } from "@/lib/types";

/**
 * Product and meal imagery.
 *
 * Two layers. Underneath, artwork drawn per species — a prawn is drawn as a
 * prawn, a crab as a crab — over a tinted ground, so a catalog reads as a
 * shelf rather than as ten copies of the same placeholder. On top, the
 * photograph, once there is one, faded in when it loads.
 *
 * The photograph wins whenever the file exists. Dropping `croaker.jpg` into
 * `public/images/products/` is the whole of adding one: if the file is not
 * there the request fails, `onError` fires, and the artwork underneath is what
 * stays on screen. No code changes, no broken-image icon, no empty box.
 *
 * Stock photography is deliberately not shipped here. A photo of a fish we did
 * not catch, sold under a promise about the fish we did, is the one thing on
 * this site that would be a lie.
 */

export type { ArtKind };

const GROUNDS: Record<ArtKind, { from: string; to: string; ink: string }> = {
  fish: { from: "#DCEAE7", to: "#B9D8D2", ink: "#0F5D57" },
  prawn: { from: "#F8E6DD", to: "#EFCBBA", ink: "#C64A26" },
  crab: { from: "#E7F1EC", to: "#C9E3D6", ink: "#1C6B4A" },
  dried: { from: "#F4EFE3", to: "#E3D8C2", ink: "#8A6A32" },
  meal: { from: "#F2EDE3", to: "#DFD3BF", ink: "#0F5D57" },
};

export function Artwork({
  kind,
  src,
  alt,
  className = "",
  seed = "",
}: {
  kind: ArtKind;
  /** Photograph path. Falls back to the artwork if the file is not there. */
  src?: string;
  alt: string;
  className?: string;
  /** Varies the ground slightly so a grid does not read as one flat block. */
  seed?: string;
}) {
  const [photoOk, setPhotoOk] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  /*
    The server renders the <img>, so the browser has usually finished with it
    — loaded or 404 — before React hydrates and attaches onLoad/onError. Those
    events never fire for a request that already finished, which left a
    photograph that had downloaded perfectly sitting at opacity 0. So on mount
    we ask the element what happened instead of waiting to be told.
  */
  useEffect(() => {
    const el = imgRef.current;
    if (el === null || !el.complete) return;
    if (el.naturalWidth > 0) setLoaded(true);
    else setPhotoOk(false);
  }, [src]);

  const ground = GROUNDS[kind];
  const id = `${kind}-${seed || alt}`.replace(/[^a-z0-9-]/gi, "");

  // A small, stable rotation of the ground so neighbouring cards differ.
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const angle = 120 + (hash % 4) * 30;
  const hue = (hash % 5) * 4 - 8;

  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      {/*
        The tint and the drawing sit on their own layer so the hue shift that
        keeps neighbouring cards from matching cannot reach the photograph and
        recolour the fish.
      */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(${angle}deg, ${ground.from}, ${ground.to})`,
          filter: `hue-rotate(${hue}deg)`,
        }}
      />

      <svg
        viewBox="0 0 120 80"
        className="absolute inset-0 size-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ground.ink} stopOpacity="0.20" />
            <stop offset="100%" stopColor={ground.ink} stopOpacity="0.07" />
          </linearGradient>
        </defs>

        {/* Water, faintly, under everything. */}
        <g stroke={ground.ink} strokeOpacity="0.13" strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d="M-6 68c8-4 16-4 24 0s16 4 24 0 16-4 24 0 16 4 24 0 16-4 24 0" />
          <path d="M-6 75c8-4 16-4 24 0s16 4 24 0 16-4 24 0 16 4 24 0 16-4 24 0" />
        </g>

        <g
          transform="translate(60 38)"
          fill={`url(#body-${id})`}
          stroke={ground.ink}
          strokeOpacity="0.85"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {kind === "prawn" ? <Prawn ink={ground.ink} /> : null}
          {kind === "crab" ? <Crab ink={ground.ink} /> : null}
          {kind === "meal" ? <Bowl ink={ground.ink} /> : null}
          {kind === "fish" || kind === "dried" ? (
            <Fish ink={ground.ink} dried={kind === "dried"} species={seed} />
          ) : null}
        </g>
      </svg>

      {src !== undefined && photoOk && (
        /*
          A plain img, not next/image: these are static files the shop drops in
          by hand, and next/image would demand dimensions we do not have for a
          file that may not exist yet.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setPhotoOk(false)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-[var(--m-standard)] ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

/**
 * Fish differ. A croaker, a mackerel and a catfish do not share a silhouette,
 * and five identical drawings in a row read as a wireframe rather than a
 * catalog — so the shape is keyed to the species, and anything unrecognised
 * falls back to a plain one.
 */
const FISH_SHAPES: Record<string, {
  depth: number;
  forked: boolean;
  barbels?: boolean;
  stripes?: boolean;
  spots?: boolean;
  spines?: boolean;
}> = {
  croaker: { depth: 1, forked: false, spots: true },
  "red-snapper": { depth: 1.22, forked: true },
  titus: { depth: 0.78, forked: true, stripes: true },
  catfish: { depth: 0.9, forked: false, barbels: true },
  tilapia: { depth: 1.28, forked: false, spines: true },
  panla: { depth: 0.84, forked: false },
  bonga: { depth: 1.1, forked: true, stripes: true },
};

function Fish({ ink, dried, species }: { ink: string; dried: boolean; species: string }) {
  const shape = FISH_SHAPES[species] ?? { depth: 1, forked: false };

  return (
    <g transform="translate(-42 -24) scale(0.92)">
      <g transform={`translate(0 ${26 - 26 * shape.depth}) scale(1 ${shape.depth})`}>
        <path d="M22 26C30 10 58 6 74 15c7 4 12 8 16 11-4 3-9 7-16 11-16 9-44 5-52-11z" />

        {shape.forked ? (
          <path d="M22 26 4 10l6 16-6 16z" />
        ) : (
          <path d="M22 26 6 13l4 13-4 13z" />
        )}

        {shape.spines ? (
          <path d="M40 9l3-6 3 6 3-6 3 6 3-6 3 6" fill="none" />
        ) : (
          <path d="M44 10c5-7 14-7 18 1" fill="none" />
        )}

        <path d="M50 38c3 7 10 8 13 3" fill="none" />
        <path d="M70 15c-5 6-5 16 0 22" fill="none" strokeOpacity="0.5" />

        {shape.stripes === true && (
          <g fill="none" strokeOpacity="0.45" strokeWidth="1.4">
            <path d="M40 13c-2 8-2 16 0 24M50 12c-2 8-2 18 0 26M60 13c-2 8-2 17 0 25" />
          </g>
        )}

        {shape.spots === true && (
          <g fill={ink} stroke="none" fillOpacity="0.28">
            <circle cx="46" cy="20" r="1.8" />
            <circle cx="56" cy="27" r="1.8" />
            <circle cx="44" cy="32" r="1.8" />
          </g>
        )}

        {shape.barbels === true && (
          <g fill="none" strokeOpacity="0.6" strokeWidth="1.4">
            <path d="M88 28c5 3 8 7 9 12M86 30c3 5 4 10 3 15" />
          </g>
        )}

        <circle cx="80" cy="23" r="2.4" fill={ink} stroke="none" fillOpacity="0.85" />
      </g>

      {dried && (
        // Smoke, for the smoked and dried shelf.
        <g fill="none" strokeOpacity="0.4" strokeWidth="1.5">
          <path d="M34 4c4-4 0-7 3-10" />
          <path d="M46 2c4-4 0-7 3-10" />
        </g>
      )}
    </g>
  );
}

function Prawn({ ink }: { ink: string }) {
  return (
    <g transform="translate(-40 -28)">
      <path d="M74 10C46 8 22 24 26 44c2 10 13 14 20 8-9-3-13-11-9-20 5-12 21-19 37-22z" />
      <path d="M46 52l10 10M46 52v12M46 52l-9 10" fill="none" />
      <g fill="none" strokeOpacity="0.55" strokeWidth="1.4">
        <path d="M74 10c9-5 15-8 22-10M74 14c9-2 16 0 22 3" />
        <path d="M38 30c-4 3-7 4-11 4M42 40c-4 3-8 4-12 4M48 48c-4 3-8 5-12 5" />
        <path d="M56 16c-5 4-9 9-11 15M64 13c-5 5-9 10-12 17" />
      </g>
      <circle cx="70" cy="15" r="2.2" fill={ink} stroke="none" fillOpacity="0.85" />
    </g>
  );
}

function Crab({ ink }: { ink: string }) {
  return (
    <g transform="translate(-40 -26)">
      <path d="M22 30c0-10 8-16 18-16s18 6 18 16c0 8-8 13-18 13s-18-5-18-13z" />
      <path d="M22 26c-7-3-12-8-13-15-4 3-4 8-1 11M58 26c7-3 12-8 13-15 4 3 4 8 1 11" />
      <path d="M9 11c3-4 8-4 11 0s1 8-3 9M71 11c-3-4-8-4-11 0s-1 8 3 9" />
      <g fill="none" strokeOpacity="0.7">
        <path d="M23 34c-6 2-10 6-13 11M25 39c-5 3-8 8-9 13M57 34c6 2 10 6 13 11M55 39c5 3 8 8 9 13" />
      </g>
      <circle cx="34" cy="24" r="2.1" fill={ink} stroke="none" fillOpacity="0.85" />
      <circle cx="46" cy="24" r="2.1" fill={ink} stroke="none" fillOpacity="0.85" />
    </g>
  );
}

function Bowl({ ink }: { ink: string }) {
  return (
    <g transform="translate(-38 -26)">
      <path d="M10 32h60v6c0 12-10 21-23 21H33c-13 0-23-9-23-21v-6z" />
      <path d="M70 36h6a7 7 0 0 1 0 14h-6" fill="none" />
      <g fill="none" strokeOpacity="0.5" strokeWidth="1.5">
        <path d="M24 24c4-5-2-8 2-13M40 22c4-5-2-8 2-13M56 24c4-5-2-8 2-13" />
      </g>
      <path d="M22 40c6 3 12 3 18 0s12-3 18 0" fill="none" strokeOpacity="0.45" />
      <circle cx="33" cy="48" r="2" fill={ink} stroke="none" fillOpacity="0.5" />
      <circle cx="47" cy="50" r="2" fill={ink} stroke="none" fillOpacity="0.5" />
    </g>
  );
}
