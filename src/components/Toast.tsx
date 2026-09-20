"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Confirmation, not interruption.
 *
 * Adding to the basket never navigates. A toast says what happened and offers
 * the two things a customer might want next — carry on, or go and look — then
 * takes itself away.
 */

interface ToastMessage {
  readonly title: string;
  readonly detail?: string;
  readonly href?: string;
  readonly actionLabel?: string;
}

interface ToastContextValue {
  readonly show: (message: ToastMessage) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: ToastMessage) => {
    if (timer.current !== null) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        Polite, not assertive: a confirmation should not interrupt a screen
        reader mid-sentence. It sits above the nav so it never covers it.
      */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3.5 bottom-24 z-50 flex justify-center"
      >
        {message !== null && (
          <div className="animate-rise pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[15px] bg-abyss/95 px-4 py-3.5 shadow-[0_14px_40px_rgb(11_43_46_/_0.28)] backdrop-blur-lg">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-reef">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13.5px] font-bold text-white">{message.title}</span>
              {message.detail !== undefined && (
                <span className="truncate text-[11.5px] text-[#A8C4C0]">{message.detail}</span>
              )}
            </span>

            {message.href !== undefined && (
              <Link
                href={message.href}
                onClick={() => setMessage(null)}
                className="flex min-h-11 shrink-0 items-center px-1 text-[12.5px] font-bold text-[#7FD3C4]"
              >
                {message.actionLabel ?? "View"}
              </Link>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
