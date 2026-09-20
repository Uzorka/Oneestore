"use client";

import Link from "next/link";

import { useCatalog } from "@/components/CatalogProvider";
import { useOrders } from "@/components/OrdersProvider";
import { formatNaira, formatWeight } from "@/lib/money";
import { changeCount } from "@/lib/catalog";
import { isBeforeCutoff, timeToCutoff } from "@/lib/delivery";
import { packingSummary } from "@/lib/packing";
import { statusLabel } from "@/lib/orders";

import { Stat } from "./AdminShell";

/**
 * Today.
 *
 * What someone opening this at six in the morning needs to know, in the order
 * they need it: what is blocking, what is running out, what is waiting. Not a
 * dashboard of charts — a list of things to do.
 */
export function TodayClient() {
  const { orders, ready: ordersReady } = useOrders();
  const { draft, state, ready: catalogReady } = useCatalog();

  if (!ordersReady || !catalogReady) {
    return <p className="text-[13px] text-ink-muted">Opening up…</p>;
  }

  const now = new Date();
  const left = isBeforeCutoff(now) ? timeToCutoff(now) : null;
  const open = orders.filter((o) => !["delivered", "cancelled", "refunded"].includes(o.status));
  const needingOverride = orders.filter((o) => packingSummary(o).needsOverride);
  const unweighed = orders.filter((o) => {
    const s = packingSummary(o);
    return ["preparing", "packed"].includes(o.status) && !s.complete;
  });

  const live = draft.filter((p) => p.availability !== "hidden");
  const lowStock = live.filter((p) => p.stockG > 0 && p.stockG <= 6000);
  const soldOut = live.filter((p) => p.stockG <= 0);
  const unpublished = changeCount(state);

  const takings = orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + packingSummary(o).totalKobo, 0);

  const alerts = [
    needingOverride.length > 0 && {
      tone: "critical" as const,
      title: `${needingOverride.length} ${needingOverride.length === 1 ? "order is" : "orders are"} outside the ±8% band`,
      body: "A weight is too far from what was ordered. These cannot go out until a supervisor agrees to them.",
      cta: "Open the queue",
      href: "/admin/orders",
    },
    unweighed.length > 0 && {
      tone: "warning" as const,
      title: `${unweighed.length} ${unweighed.length === 1 ? "order has" : "orders have"} lines still to weigh`,
      body: "Nothing is dispatched until every line has been on the scale.",
      cta: "Weigh them",
      href: "/admin/orders",
    },
    soldOut.length > 0 && {
      tone: "warning" as const,
      title: `${soldOut.map((p) => p.name).join(", ")} sold out`,
      body: "Still on the board at zero stock. Take it off or put a weight against it.",
      cta: "Open the board",
      href: "/admin/pricing",
    },
    lowStock.length > 0 && {
      tone: "info" as const,
      title: `${lowStock.map((p) => p.name).join(", ")} running low`,
      body: "Under 6 kg left. Raise the price, cap it, or take it off the board.",
      cta: "Open the board",
      href: "/admin/pricing",
    },
    unpublished > 0 && {
      tone: "info" as const,
      title: `${unpublished} price ${unpublished === 1 ? "change is" : "changes are"} unpublished`,
      body: "Customers are still seeing the last published board.",
      cta: "Review and publish",
      href: "/admin/pricing",
    },
  ].filter((a): a is Exclude<typeof a, false> => a !== false);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Same-day cut-off"
          value={left === null ? "Passed" : `${left.hours}h ${left.minutes}m`}
          note={left === null ? "orders now are for tomorrow" : "left to order for today"}
          tone={left === null ? "warn" : "default"}
        />
        <Stat label="Open orders" value={String(open.length)} note="not yet delivered" />
        <Stat label="Stock on the board" value={formatWeight(live.reduce((s, p) => s + p.stockG, 0))} note={`${live.length} kinds listed`} />
        <Stat label="Delivered" value={formatNaira(takings)} note="collected on delivery" tone="good" />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="flex-1 text-[15px] font-bold">Needs attention</h2>
          <span className="text-[12px] text-ink-muted">{alerts.length}</span>
        </div>

        {alerts.length === 0 ? (
          <p className="rounded-card border border-line bg-tint-mint px-4 py-6 text-center text-[13px] text-reef">
            Nothing is blocking. Every weight is inside the band and the board is published.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.title}
                className={`flex flex-col gap-2 rounded-card border p-3.5 sm:flex-row sm:items-center sm:gap-4 ${
                  alert.tone === "critical"
                    ? "border-[#F3D9CF] bg-[#FDF0EC]"
                    : alert.tone === "warning"
                      ? "border-[#F0DFBE] bg-[#FBEFD8]"
                      : "border-line bg-paper"
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13.5px] font-bold">{alert.title}</span>
                  <span className="text-[12px] leading-snug text-ink-soft">{alert.body}</span>
                </span>

                <Link
                  href={alert.href}
                  className="flex min-h-11 shrink-0 items-center justify-center rounded-control bg-abyss px-4 text-[12.5px] font-bold text-salt"
                >
                  {alert.cta}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {open.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="flex-1 text-[15px] font-bold">Packing queue</h2>
            <Link href="/admin/orders" className="flex min-h-11 items-center text-[12.5px] font-bold text-lagoon">
              See all {open.length}
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            {open.slice(0, 5).map((order) => {
              const summary = packingSummary(order);
              return (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center gap-3 rounded-card border border-line bg-paper p-3.5"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-mono text-[13px] font-bold tracking-tight">{order.id}</span>
                    <span className="truncate text-[11.5px] text-ink-muted">
                      {statusLabel(order.status)} · {summary.weighed} of {summary.total} weighed
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-bold">{formatNaira(summary.totalKobo)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
