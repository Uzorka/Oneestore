"use client";

import Link from "next/link";
import { useState } from "react";

import { useOrders } from "@/components/OrdersProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNaira, formatWeight } from "@/lib/money";
import { packingSummary } from "@/lib/packing";
import { isTerminal, statusLabel } from "@/lib/orders";
import type { Order } from "@/lib/orders";

import { Stat } from "../AdminShell";

/** The stages that still need someone to do something. */
const OPEN = ["pending_payment", "paid", "sourcing", "quality_checked", "preparing", "packed", "dispatched"];

type Filter = "open" | "weighing" | "done";

export function OrdersQueueClient() {
  const { orders, ready } = useOrders();
  const [filter, setFilter] = useState<Filter>("open");

  if (!ready) return <p className="text-[13px] text-ink-muted">Reading the queue…</p>;

  const open = orders.filter((o) => OPEN.includes(o.status));
  const weighing = orders.filter((o) => ["preparing", "packed"].includes(o.status));
  const done = orders.filter((o) => isTerminal(o.status) || o.status === "delivered");

  const shown = filter === "open" ? open : filter === "weighing" ? weighing : done;

  const needingOverride = orders.filter((o) => packingSummary(o).needsOverride);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3.5h9l4 4v13H6z" />
            <path d="M9 11h7M9 15h7" />
          </svg>
        }
        title="Nothing in the queue"
        body="Orders placed on the storefront land here. Place one and it will show up."
        actionLabel="Open the storefront"
        actionHref="/shop"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Waiting" value={String(open.length)} note="not yet delivered" />
        <Stat label="On the scale" value={String(weighing.length)} note="being prepared or packed" />
        <Stat
          label="Needs a supervisor"
          value={String(needingOverride.length)}
          note={needingOverride.length === 0 ? "every weight inside ±8%" : "a weight is outside ±8%"}
          tone={needingOverride.length > 0 ? "warn" : "good"}
        />
        <Stat label="Finished" value={String(done.length)} note="delivered or closed" />
      </div>

      <div role="group" aria-label="Filter orders" className="flex gap-2 overflow-x-auto pb-1">
        {([
          ["open", `Waiting ${open.length}`],
          ["weighing", `On the scale ${weighing.length}`],
          ["done", `Finished ${done.length}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`flex min-h-11 shrink-0 items-center rounded-control px-4 text-[12.5px] font-bold whitespace-nowrap transition-colors duration-[var(--m-fast)] ${
              filter === key ? "bg-abyss text-salt" : "border border-line bg-paper text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-paper px-4 py-8 text-center text-[13px] text-ink-muted">
          Nothing here right now.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((order) => (
            <QueueRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueRow({ order }: { order: Order }) {
  const summary = packingSummary(order);

  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className={`flex flex-col gap-3 rounded-card border bg-paper p-3.5 transition-transform duration-[var(--m-fast)] hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-4 ${
        summary.needsOverride ? "border-[1.5px] border-clay" : "border-line"
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[13px] font-bold tracking-tight">{order.id}</span>
          <span className="rounded-full bg-tint-teal px-2 py-0.5 text-[10.5px] font-bold text-lagoon">
            {statusLabel(order.status)}
          </span>
          {summary.needsOverride && (
            <span className="rounded-full bg-tint-clay px-2 py-0.5 text-[10.5px] font-bold text-clay">
              Needs a supervisor
            </span>
          )}
        </span>

        <span className="truncate text-[12px] text-ink-muted">
          {order.lines.map((l) => `${l.productName} · ${formatWeight(l.weightG)} ${l.prepName.toLowerCase()}`).join(" · ")}
        </span>

        <span className="text-[11.5px] text-ink-faint">
          {order.address.street} · {order.slotDate} · {order.slotWindowLabel}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-0.5">
        <span className="text-[15px] font-bold">{formatNaira(summary.totalKobo)}</span>
        <span className="text-[11px] text-ink-muted">
          {summary.weighed} of {summary.total} weighed
        </span>
      </span>
    </Link>
  );
}
