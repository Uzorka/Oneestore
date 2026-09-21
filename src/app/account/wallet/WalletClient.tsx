"use client";

import Link from "next/link";

import { useWallet } from "@/components/WalletProvider";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { formatNaira } from "@/lib/money";
import { reasonLabel } from "@/lib/wallet";

/**
 * The wallet.
 *
 * A balance on its own does not answer the first question anyone asks about
 * money that appeared without them paying it in — where did this come from? So
 * the ledger is the page, and the balance sits on top of it.
 */
export function WalletClient() {
  const { entries, balanceKobo, ready } = useWallet();

  if (!ready) return <ProductCardSkeleton />;

  const sorted = [...entries].sort((a, b) => b.at - a.at);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 rounded-card bg-abyss p-5">
        <span className="text-[12px] font-semibold text-[#A8C4C0]">Your balance</span>
        <span className="font-display text-[34px] leading-none font-semibold text-white">
          {formatNaira(balanceKobo)}
        </span>
        <span className="text-[11.5px] leading-snug text-[#A8C4C0]">
          {balanceKobo > 0
            ? "Taken off your next order automatically. It does not expire."
            : "Money comes back here when an order is packed under what you asked for, or when we put something right."}
        </span>
      </section>

      {sorted.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-paper px-4 py-8 text-center text-[13px] text-ink-muted">
          Nothing has moved yet.
        </p>
      ) : (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-bold">Every movement</h2>

          {sorted.map((entry) => {
            const incoming = entry.amountKobo > 0;

            /*
              The whole row is the link when there is an order behind it. An
              order number set inline is sixteen pixels tall — a tap target
              only in theory.
            */
            const Row = entry.orderId === null ? "div" : Link;
            const rowProps = entry.orderId === null ? {} : { href: `/account/orders/${entry.orderId}` };

            return (
              <Row
                key={entry.id}
                {...(rowProps as { href: string })}
                className="flex items-center gap-3 rounded-card border border-line bg-paper p-3.5"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                    incoming ? "bg-tint-mint" : "bg-sand"
                  }`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={incoming ? "#1C6B4A" : "#6E8481"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    {incoming ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
                  </svg>
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13.5px] font-bold">{reasonLabel(entry.reason)}</span>
                  <span className="truncate text-[11.5px] text-ink-muted">{entry.note}</span>
                  <span className="text-[11px] text-ink-faint">
                    {new Date(entry.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className={`text-[14px] font-bold ${incoming ? "text-reef" : ""}`}>
                    {incoming ? "+" : "−"}
                    {formatNaira(Math.abs(entry.amountKobo))}
                  </span>
                  {entry.orderId !== null && (
                    <span className="font-mono text-[10.5px] font-bold text-lagoon">
                      {entry.orderId}
                    </span>
                  )}
                </span>
              </Row>
            );
          })}
        </section>
      )}
    </div>
  );
}
