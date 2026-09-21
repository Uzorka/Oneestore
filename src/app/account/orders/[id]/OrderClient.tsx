"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";

import { Artwork } from "@/components/Artwork";
import { useCatalog } from "@/components/CatalogProvider";
import { useComplaints } from "@/components/ComplaintsProvider";
import { useCart } from "@/components/CartProvider";
import { useOrders } from "@/components/OrdersProvider";
import { useToast } from "@/components/Toast";
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
import {
  formatTimeLeft,
  forOrder,
  isWithinWindow,
  kindLabel,
  statusLabel as complaintStatusLabel,
  timeLeftMs,
} from "@/lib/complaints";
import type { ComplaintKind } from "@/lib/complaints";
import { planReorder, stateNote, toCartLines } from "@/lib/reorder";
import { useRouter } from "next/navigation";
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

          <OrderAgain order={order} />

          <ReportProblem order={order} />
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

const KINDS: readonly ComplaintKind[] = [
  "not_fresh",
  "wrong_weight",
  "wrong_item",
  "missing_item",
  "late",
  "other",
];

/**
 * "Not right? Tell us within 2 hours."
 *
 * The home page has promised this since the first screen. The countdown is
 * shown because a promise with a deadline the customer cannot see is a trap,
 * and the form still opens after the window closes — it just says plainly
 * that it goes to a person instead of being settled on the spot. Shutting the
 * door on someone eleven minutes late with bad fish costs more than the fish.
 */
function ReportProblem({ order }: { order: Order }) {
  const { complaints, raiseComplaint, ready } = useComplaints();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ComplaintKind>("not_fresh");
  const [detail, setDetail] = useState("");
  const [, tick] = useState(0);

  const deliveredAt = [...order.history].reverse().find((e) => e.status === "delivered")?.at ?? null;

  // The countdown is derived at render and the interval only forces a
  // repaint, so it cannot drift or reset itself.
  useEffect(() => {
    if (deliveredAt === null) return;
    const timer = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [deliveredAt]);

  if (!ready || deliveredAt === null) return null;

  const existing = forOrder(complaints, order.id);

  if (existing !== undefined) {
    return (
      <section className="flex flex-col gap-2 rounded-card border border-line bg-paper p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[15px] font-bold">You told us about this order</h2>
          <span className="rounded-full bg-tint-teal px-2 py-0.5 text-[10.5px] font-bold text-lagoon">
            {complaintStatusLabel(existing.status)}
          </span>
        </div>

        <p className="text-[12.5px] text-ink-soft">
          <strong className="font-bold">{kindLabel(existing.kind)}.</strong> {existing.detail}
        </p>

        {existing.status === "refunded" && (
          <p className="rounded-xl bg-tint-mint px-3 py-2.5 text-[11.5px] leading-snug text-reef">
            {formatNaira(existing.refundedKobo)} went back to your wallet. {existing.resolutionNote}
          </p>
        )}

        {existing.status === "declined" && (
          <p className="rounded-xl bg-sand px-3 py-2.5 text-[11.5px] leading-snug text-ink-soft">
            {existing.resolutionNote}
          </p>
        )}

        {(existing.status === "open" || existing.status === "needs_review") && (
          <p className="text-[11.5px] leading-snug text-ink-muted">
            {existing.withinWindow
              ? "We are on it. You will get a call on the number you verified."
              : "This came in after the 2-hour window, so someone is looking at it by hand."}
          </p>
        )}
      </section>
    );
  }

  const left = timeLeftMs(deliveredAt, Date.now());
  const inWindow = isWithinWindow(deliveredAt, Date.now());

  if (!open) {
    return (
      <section className="flex flex-col gap-2 rounded-card border border-line bg-paper p-4">
        <h2 className="text-[15px] font-bold">Something not right?</h2>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          {inWindow
            ? `Tell us within 2 hours of delivery and we refund it. ${formatTimeLeft(left)} left.`
            : "The 2-hour window has closed, but you can still tell us — it goes to a person rather than being settled on the spot."}
        </p>
        <Button variant="secondary" onClick={() => setOpen(true)} className="sm:w-fit">
          Report a problem
        </Button>
      </section>
    );
  }

  return (
    <section className="animate-rise flex flex-col gap-3 rounded-card border border-line bg-paper p-4">
      <h2 className="text-[15px] font-bold">What went wrong?</h2>

      <div role="group" aria-label="What went wrong" className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`flex min-h-11 items-center rounded-control px-3.5 text-[12.5px] font-semibold transition-colors duration-[var(--m-fast)] ${
              kind === k
                ? "border-[1.5px] border-lagoon bg-tint-mint text-lagoon"
                : "border border-line bg-paper text-ink-soft"
            }`}
          >
            {kindLabel(k)}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold text-ink-muted">
          Tell us what you saw
        </span>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          placeholder="The snapper smells off and the eyes are cloudy."
          className="rounded-control border border-line bg-white px-3.5 py-2.5 text-[13.5px] outline-none"
        />
      </label>

      <p className="text-[11px] leading-snug text-ink-muted">
        Photographs are how these get settled fastest. Uploading them is not built yet — send them on
        the number you verified and we will match them to {order.id}.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          disabled={detail.trim().length < 4}
          onClick={() => {
            raiseComplaint({ orderId: order.id, deliveredAt, kind, detail });
            setOpen(false);
          }}
        >
          Send it
        </Button>
        <Button variant="tertiary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

/**
 * Ordering the same thing again.
 *
 * Not a button that silently refills the basket: prices here move every
 * morning and stock moves with them, so what has changed is shown first.
 * Someone who tapped this on a ₦19,600 basket and met ₦22,400 at checkout
 * would be right to feel tricked, and would be right not to come back.
 */
function OrderAgain({ order }: { order: Order }) {
  const { productMap, ready } = useCatalog();
  const { dispatch, remainingG } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!ready) return null;

  const plan = planReorder(order, productMap, { remainingG: (id) => remainingG(id) });

  function add() {
    for (const line of toCartLines(plan)) {
      dispatch({
        type: "add",
        productId: line.productId,
        prepId: line.prepId,
        weightG: line.weightG,
      });
    }

    toast.show({
      title: "Back in your basket",
      detail: `${toCartLines(plan).length} items · ${formatNaira(plan.totalKobo)}`,
      href: "/basket",
      actionLabel: "View basket",
    });

    router.push("/basket");
  }

  if (!open) {
    return (
      <section className="flex flex-col gap-2 rounded-card border border-line bg-paper p-4">
        <h2 className="text-[15px] font-bold">Want this again?</h2>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          {plan.anyAvailable
            ? "We will check today's board first and show you anything that has changed."
            : "Nothing from this order is on the board today."}
        </p>
        {plan.anyAvailable && (
          <Button variant="secondary" onClick={() => setOpen(true)} className="sm:w-fit">
            Order again
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="animate-rise flex flex-col gap-3 rounded-card border border-line bg-paper p-4">
      <h2 className="text-[15px] font-bold">
        {plan.changed ? "Some of this has changed" : "Everything is as it was"}
      </h2>

      <div className="flex flex-col gap-2">
        {plan.lines.map((line) => {
          const note = stateNote(line);
          const gone = line.state === "unavailable";

          return (
            <div
              key={`${line.productId}:${line.prepId}`}
              className={`flex items-center gap-3 rounded-[13px] border px-3.5 py-2.5 ${
                gone ? "border-line bg-sand opacity-70" : note === null ? "border-line" : "border-[1.5px] border-lagoon bg-tint-teal"
              }`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px] font-bold">{line.productName}</span>
                <span className="text-[11.5px] text-ink-muted">
                  {line.prepName} ·{" "}
                  {gone ? formatWeight(line.previousWeightG) : formatWeight(line.weightG)}
                  {line.state === "reduced" && ` (you ordered ${formatWeight(line.previousWeightG)})`}
                </span>
                {note !== null && (
                  <span className="text-[11px] font-semibold text-lagoon">{note}</span>
                )}
              </span>

              <span className="flex shrink-0 flex-col items-end gap-0.5">
                {gone ? (
                  <span className="text-[12px] font-bold text-ink-muted">—</span>
                ) : (
                  <>
                    <span className="text-[13.5px] font-bold">{formatNaira(line.totalKobo)}</span>
                    {line.totalKobo !== line.previousTotalKobo && (
                      <span className="text-[11px] text-ink-muted line-through">
                        {formatNaira(line.previousTotalKobo)}
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline gap-2 pt-0.5">
        <span className="flex-1 text-[13px] font-bold">Today</span>
        {plan.totalKobo !== plan.previousTotalKobo && (
          <span className="text-[12px] text-ink-muted line-through">
            {formatNaira(plan.previousTotalKobo)}
          </span>
        )}
        <span className="font-display text-[19px] font-semibold">{formatNaira(plan.totalKobo)}</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={!plan.anyAvailable} onClick={add}>
          Add to basket
        </Button>
        <Button variant="tertiary" onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>
    </section>
  );
}
