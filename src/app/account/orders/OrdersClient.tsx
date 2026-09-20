"use client";

import Link from "next/link";

import { useOrders } from "@/components/OrdersProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { formatNaira, formatWeight } from "@/lib/money";
import { stageIndex, statusLabel } from "@/lib/orders";
import type { Order } from "@/lib/orders";

/** Every order the customer has placed, newest first. */
export function OrdersClient() {
  const { orders, ready } = useOrders();

  if (!ready) {
    return (
      <div className="flex flex-col gap-3">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3.5h9l4 4v13H6z" />
            <path d="M9 11h7M9 15h7" />
          </svg>
        }
        title="No orders yet"
        body="Once you order, you can follow it from the jetty to your door."
        actionLabel="Browse Seafood"
        actionHref="/shop"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/account/orders/${order.id}`}
          className="flex flex-col gap-3 rounded-card border border-line bg-paper p-3.5 transition-transform duration-[var(--m-fast)] hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-bold tracking-tight">{order.id}</span>
              <StatusPill order={order} />
            </span>
            <span className="truncate text-[12px] text-ink-muted">
              {order.lines.map((l) => l.productName).join(", ")}
            </span>
            <span className="text-[11.5px] text-ink-faint">
              {formatWeight(order.totalWeightG)} · {order.slotDate} · {order.slotWindowLabel}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-0.5">
            <span className="text-[15px] font-bold">{formatNaira(order.totalKobo)}</span>
            <span className="text-[11px] text-ink-muted">on delivery</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function StatusPill({ order }: { order: Order }) {
  const exceptional = stageIndex(order.status) === -1;
  const done = order.status === "delivered";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
        exceptional
          ? "bg-tint-clay text-clay"
          : done
            ? "bg-tint-mint text-reef"
            : "bg-tint-teal text-lagoon"
      }`}
    >
      {statusLabel(order.status)}
    </span>
  );
}
