"use client";

import { useEffect, useRef, useState } from "react";

import { Artwork } from "@/components/Artwork";

/**
 * The hero film.
 *
 * Three things govern how this is loaded rather than just dropped in:
 *
 *  1. **Data.** Most of this shop's customers are on Lagos mobile data. An
 *     autoplaying embed on the home page spends their money before they have
 *     seen a price, so below `lg` nothing loads until they ask for it — the
 *     poster frame and a play button, and the iframe only on a tap.
 *  2. **Failure.** The film is someone else's file on someone else's service.
 *     If it is taken down, made private or region-blocked, the hero must not
 *     become an empty grey box, so the drawn artwork sits underneath
 *     everything and is what shows when the poster cannot load.
 *  3. **Tracking.** `youtube-nocookie.com` is used so the home page does not
 *     set advertising cookies on a visitor who never pressed play.
 *
 * To change the film, change `VIDEO`. To move off YouTube entirely, this is
 * the only component that knows it was ever there.
 */

const VIDEO = {
  id: "ELEZpHYng4U",
  /** Where the useful footage starts, in seconds. */
  startSeconds: 300,
  title: "Fresh seafood, landed this morning",
} as const;

function embedSrc({ autoplay }: { autoplay: boolean }): string {
  const params = new URLSearchParams({
    start: String(VIDEO.startSeconds),
    autoplay: autoplay ? "1" : "0",
    mute: autoplay ? "1" : "0",
    controls: autoplay ? "0" : "1",
    loop: "1",
    playlist: VIDEO.id, // a single-video loop needs itself as the playlist
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
  });

  return `https://www.youtube-nocookie.com/embed/${VIDEO.id}?${params.toString()}`;
}

/** How long to give the embed before deciding it is not coming. */
const LOAD_TIMEOUT_MS = 8000;

export function HeroVideo({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<"poster" | "ambient" | "playing">("poster");
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [reach, setReach] = useState<"checking" | "ok" | "unreachable">("checking");
  const posterRef = useRef<HTMLImageElement>(null);

  /*
    The poster frame doubles as a reachability probe.
    
    An iframe gives nothing to catch when it fails: blocked, region-locked or
    merely unanswered, the browser quietly paints its own grey error document
    over whatever is underneath — and `onLoad` fires for that error document
    too, so it cannot be distinguished from success either. The thumbnail is
    an ordinary image on the same service, and an image does report failure.
    If it cannot be fetched, no iframe is mounted at all: the drawn artwork
    stays, and there is no play button offering something that will not play.
  */
  useEffect(() => {
    const el = posterRef.current;
    if (el === null || !el.complete) return;
    setReach(el.naturalWidth > 0 ? "ok" : "unreachable");
  }, []);

  // Ambient playback is a wide-screen affordance only. matchMedia rather than
  // a CSS class, because the cost here is the network request, and CSS cannot
  // decline to make one.
  useEffect(() => {
    if (reach !== "ok") return;

    const wide = window.matchMedia("(min-width: 1024px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const decide = () => {
      setMode((current) =>
        current === "playing" ? current : wide.matches && !reduced.matches ? "ambient" : "poster",
      );
    };

    decide();
    wide.addEventListener("change", decide);
    reduced.addEventListener("change", decide);
    return () => {
      wide.removeEventListener("change", decide);
      reduced.removeEventListener("change", decide);
    };
  }, [reach]);

  // Second line of defence: a frame that never says it loaded goes away.
  useEffect(() => {
    if (mode === "poster" || frameLoaded) return;

    const timer = setTimeout(() => setMode("poster"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mode, frameLoaded]);

  const showFrame = reach === "ok" && mode !== "poster";

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* The floor: drawn, local, and always there. */}
      <Artwork kind="fish" alt={VIDEO.title} seed="hero" className="absolute inset-0 size-full" />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={posterRef}
        src={`https://i.ytimg.com/vi/${VIDEO.id}/maxresdefault.jpg`}
        alt={VIDEO.title}
        onLoad={() => setReach("ok")}
        onError={() => setReach("unreachable")}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-[var(--m-standard)] ${
          reach === "ok" ? "opacity-100" : "opacity-0"
        }`}
      />

      {showFrame && (
        <iframe
          key={mode}
          src={embedSrc({ autoplay: mode === "ambient" })}
          title={VIDEO.title}
          onLoad={() => setFrameLoaded(true)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          style={
            mode === "ambient"
              ? {
                  /*
                    Cover, not contain. A 16:9 frame in a box of another shape
                    leaves bars, so it is sized from the viewport width and
                    centred, with `minHeight` catching the case where the hero
                    is taller than 56.25% of the screen. The overflow is
                    cropped by the section, which is how YouTube's own chrome
                    ends up outside the visible area.
                  */
                  width: "100vw",
                  height: "56.25vw",
                  minHeight: "100%",
                  minWidth: "177.78vh",
                }
              : undefined
          }
          className={`absolute border-0 transition-opacity duration-[var(--m-standard)] ${
            frameLoaded ? "opacity-100" : "opacity-0"
          } ${
            // Ambient is decoration and never takes the pointer. A film the
            // customer actually asked for behaves normally.
            mode === "ambient"
              ? "pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              : "inset-0 size-full"
          }`}
        />
      )}

      {reach === "ok" && mode === "poster" && (
        <button
          type="button"
          onClick={() => {
            setFrameLoaded(false);
            setMode("playing");
          }}
          className="absolute right-3 bottom-3 flex min-h-11 items-center transition-transform duration-[var(--m-fast)] hover:-translate-y-0.5 md:right-6 md:bottom-6"
        >
          <span className="flex items-center gap-2.5 rounded-full bg-abyss/85 py-3 pr-5 pl-4 backdrop-blur-md">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#7FD3C4]">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
            <span className="text-[12.5px] font-bold text-salt">Watch the morning landing</span>
          </span>
        </button>
      )}

      {mode === "ambient" && frameLoaded && (
        // Ambient playback is silent and cropped, so it needs a way to become
        // the real thing — with sound, controls and the whole frame.
        <button
          type="button"
          onClick={() => {
            setFrameLoaded(false);
            setMode("playing");
          }}
          className="absolute right-3 bottom-3 flex min-h-11 items-center gap-2 rounded-full bg-abyss/85 px-4 backdrop-blur-md transition-colors hover:bg-abyss md:right-6 md:bottom-6"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7FD3C4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10" />
          </svg>
          <span className="text-[12px] font-bold text-salt">Play with sound</span>
        </button>
      )}
    </div>
  );
}
