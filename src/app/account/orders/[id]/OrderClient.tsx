"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use } from "react";

import { Artwork } from "@/components/Artwork";
import { useCatalog } from "@/components/CatalogProvider";
import { useOrders } from "@/components/OrdersProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { formatAddress } from "@/lib/address";
import { formatNaira, formatWeight } from "@/lib/money";
import {
  CUSTOMER_STAGES,
  ORDER_FLOW,
  stageIndex,
  statusExplanation,
  statusLabel,
} from "@/lib/orders";
import type { Order } from "@/lib/orders";
import { artKindFor, productPhoto } from "@/lib/seed";
import type { OrderStatus } from "@/lib/types";

/**
 * One order.
 *
 * Doubles as the confirmation screen — arriving straight from checkout adds a
 * banner and nothing else. A separate "thank you" page would be a page the
 * customer can never find again, and the thing they actually want on it,
 * where is my fish, is already here.
 */
export function OrderClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { byId, ready, move } = useOrders();
  const search = useSearchParams();
  const justPlaced = search.get("placed") === "1";

  const { productMap: catalog } = useCatalog();
  const order = byId(id);

  if (!ready) {
    return (
      <div className="flex flex-col gap-3">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </div>
    );
  }

  if (order === undefined) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v5M12 16.5v.5" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        }
        title="We cannot find that order"
        body="Orders are kept on the device they were placed on until accounts move to the server."
        actionLabel="Your orders"
        actionHref="/account/orders"
      />
    );
  }

  const current = stageIndex(order.status);
  const exceptional = current === -1;

  return (
    <div className="flex flex-col gap-5">
      {justPlaced && (
        <section className="animate-rise flex gap-3 rounded-card bg-abyss p-4 md:p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#7FD3C4]/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7FD3C4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-display text-[19px] font-semibold text-white md:text-[22px]">
              That is in. We are on it.
            </span>
            <span className="text-[12px] leading-snug text-[#A8C4C0]">
              Order <strong className="font-bold text-white">{order.id}</strong>. We will call the
              number you verified if anything about the catch changes.
            </span>
          </span>
        </section>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <section className="flex flex-col gap-4 rounded-card border border-line bg-paper p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-mono text-[15px] font-bold tracking-tight">{order.id}</h2>
              <span className="flex-1 text-[11.5px] text-ink-muted">
                Placed {new Date(order.placedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>

            {exceptional ? (
              <div className="flex flex-col gap-1 rounded-xl bg-tint-clay px-3.5 py-3">
                <span className="text-[13px] font-bold text-clay">{statusLabel(order.status)}</span>
                <span className="text-[11.5px] leading-snug text-clay">
                  {statusExplanation(order.status)}
                </span>
              </div>
            ) : (
              <Timeline order={order} current={current} />
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-card border border-line bg-paper p-4">
            <h2 className="text-[15px] font-bold">What is coming</h2>

            <div className="flex flex-col gap-2.5">
              {order.lines.map((line) => {
                const product = catalog.get(line.productId);

                return (
                  <div key={`${line.productId}:${line.prepId}`} className="flex items-center gap-3">
                    {product !== undefined && (
                      <Artwork
                        kind={artKindFor(product)}
                        src={productPhoto(product)}
                        alt={line.productName}
                        seed={line.productId}
                        className="size-14 shrink-0 rounded-xl"
                      />
                    )}

                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-bold">{line.productName}</span>
                      <span className="text-[11.5px] text-ink-muted">
                        {line.prepName} · {formatWeight(line.weightG)}
                      </span>
                      {line.preparedWeightG < line.weightG && (
                        <span className="text-[11px] text-ink-faint">
                          ≈ {formatWeight(line.preparedWeightG)} after preparation
                        </span>
                      )}
                    </span>

                    <span className="shrink-0 text-sm font-bold">{formatNaira(line.totalKobo)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[112px] lg:w-[340px] lg:shrink-0">
          <section className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-4">
            <Row label="Seafood" value={formatNaira(order.subtotalKobo)} />
            {order.discountKobo > 0 && (
              <Row
                label={`Volume discount (${order.discountBps / 100}%)`}
                value={`−${formatNaira(order.discountKobo)}`}
              />
            )}
            <Row
              label="Delivery"
              value={order.deliveryKobo === 0 ? "Free" : formatNaira(order.deliveryKobo)}
            />

            <div className="h-px bg-rule" />

            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-sm font-bold">To pay on delivery</span>
              <span className="font-display text-[21px] font-semibold">
                {formatNaira(order.totalKobo)}
              </span>
            </div>

            <span className="text-[11px] leading-snug text-ink-muted">
              Cash or transfer to the rider, once you have seen the weight. The final amount follows
              the real packed weight.
            </span>
          </section>

          <section className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-4">
            <h2 className="text-[13px] font-bold">Delivering to</h2>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">{formatAddress(order.address)}</p>
            <p className="text-[12px] text-ink-muted">
              {order.slotDate} · {order.slotWindowLabel}
            </p>
          </section>

          <DemoControls order={order} onMove={move} />

          <Link
            href="/account/orders"
            className="flex min-h-11 items-center justify-center text-[12.5px] font-bold text-lagoon"
          >
            All your orders
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Timeline({ order, current }: { order: Order; current: number }) {
  return (
    <ol className="flex flex-col">
      {CUSTOMER_STAGES.map((stage, index) => {
        const done = index < current;
        const now = index === current;
        const event = [...order.history].reverse().find((e) => stageIndex(e.status) === index);

        return (
          <li key={stage} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  done
                    ? "border-reef bg-reef"
                    : now
                      ? "border-lagoon bg-paper"
                      : "border-line bg-paper"
                }`}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : now ? (
                  <span className="size-2 animate-pulse rounded-full bg-lagoon" />
                ) : null}
              </span>

              {index < CUSTOMER_STAGES.length - 1 && (
                <span className={`w-0.5 flex-1 ${done ? "bg-reef" : "bg-line"}`} />
              )}
            </span>

            <span className={`flex flex-col gap-0.5 pb-5 ${index === CUSTOMER_STAGES.length - 1 ? "pb-0" : ""}`}>
              <span className={`text-[13px] ${now ? "font-bold text-abyss" : done ? "font-semibold text-ink-soft" : "text-ink-faint"}`}>
                {statusLabel(stage)}
              </span>

              {(now || done) && (
                <span className="text-[11.5px] leading-snug text-ink-muted">
                  {statusExplanation(stage)}
                </span>
              )}

              {event !== undefined && (
                <span className="text-[10.5px] text-ink-faint">
                  {new Date(event.at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                  {event.note !== undefined && ` · ${event.note}`}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A stand-in for the packing room.
 *
 * There is no admin yet and no server, so nothing can move an order along —
 * which would leave every order frozen at "Order placed" and the tracker
 * impossible to actually look at. This walks it forward by hand, and is
 * labelled as what it is rather than dressed up as a feature.
 */
function DemoControls({
  order,
  onMove,
}: {
  order: Order;
  onMove: (id: string, to: OrderStatus) => void;
}) {
  const next = ORDER_FLOW[order.status];
  if (next.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-card border border-dashed border-line bg-sand p-3.5">
      <span className="text-[11px] font-bold tracking-[0.06em] text-ink-muted uppercase">
        Stand-in for the packing room
      </span>
      <span className="text-[11.5px] leading-snug text-ink-muted">
        Until there is an admin screen, nothing moves an order along. These buttons do it by hand so
        the tracker above can be seen working.
      </span>

      <div className="flex flex-wrap gap-2 pt-0.5">
        {next.map((status) => (
          <Button key={status} variant="secondary" size="sm" onClick={() => onMove(order.id, status)}>
            {statusLabel(status)}
          </Button>
        ))}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex-1 text-[13px] text-ink-soft">{label}</span>
      <span className="text-[13.5px] font-semibold">{value}</span>
    </div>
  );
}
