"use client";

import Link from "next/link";
import { use, useState } from "react";

import { Artwork } from "@/components/Artwork";
import { useCatalog } from "@/components/CatalogProvider";
import { useComplaints } from "@/components/ComplaintsProvider";
import { useOrders } from "@/components/OrdersProvider";
import { useWallet } from "@/components/WalletProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatAddress } from "@/lib/address";
import { formatNaira, formatWeight } from "@/lib/money";
import { ORDER_FLOW, statusLabel } from "@/lib/orders";
import {
  chargedForLine,
  overrideReason,
  packingState,
  packingSummary,
  recordPackedWeight,
  valueOfPackedWeight,
} from "@/lib/packing";
import type { Order } from "@/lib/orders";
import type { PackedLineState } from "@/lib/packing";
import { forOrder, kindLabel, statusLabel as complaintStatusLabel } from "@/lib/complaints";
import { artKindFor, productPhoto } from "@/lib/seed";

import { Stat } from "../../AdminShell";

/**
 * Weighing an order.
 *
 * This is the screen the whole pricing engine was written for. Everything it
 * has been enforcing in tests since the first milestone — the ±8% band, wallet
 * credit for an underpack, absorbing an overpack, never charging above what
 * the customer authorised — happens here, against a real number off a scale.
 *
 * Two things are deliberate:
 *
 *  - **The figure updates as the weight is typed.** A packer should see what a
 *    reading costs the shop before they accept it, not after.
 *  - **Nothing is clamped.** A weight outside the band is saved and flagged,
 *    not quietly corrected. Correcting it would hide a mistake and change what
 *    the shop believes it sent.
 */
export function PackClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { byId, ready, replace, move } = useOrders();
  const { productMap } = useCatalog();
  const { credit } = useWallet();
  const { complaints, refundComplaint, declineComplaint } = useComplaints();

  const order = byId(id);

  if (!ready) return <p className="text-[13px] text-ink-muted">Reading the order…</p>;

  if (order === undefined) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16.5v.5" />
          </svg>
        }
        title="No such order"
        body="Orders live in the browser they were placed in until this moves to the server."
        actionLabel="Back to the queue"
        actionHref="/admin/orders"
      />
    );
  }

  const states = packingState(order);
  const summary = packingSummary(order);
  const next = ORDER_FLOW[order.status];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Status" value={statusLabel(order.status)} note={`${order.slotDate} · ${order.slotWindowLabel}`} />
        <Stat label="Weighed" value={`${summary.weighed} of ${summary.total}`} note={summary.complete ? "all lines on the scale" : "still to do"} />
        <Stat
          label="Back to wallet"
          value={formatNaira(summary.walletCreditKobo)}
          note={summary.walletCreditKobo > 0 ? "packed under what was ordered" : "nothing owed back"}
          tone={summary.walletCreditKobo > 0 ? "warn" : "default"}
        />
        <Stat
          label="We absorb"
          value={formatNaira(summary.absorbedKobo)}
          note={summary.absorbedKobo > 0 ? "packed over — never billed on" : "nothing given away"}
          tone={summary.absorbedKobo > 0 ? "warn" : "default"}
        />
      </div>

      {summary.needsOverride && (
        <div className="flex gap-2.5 rounded-card border-[1.5px] border-clay bg-tint-clay p-3.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C64A26" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
            <path d="M12 8.5v4.5M12 16.5v.5" />
            <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <span className="text-[12px] leading-snug text-clay">
            <strong className="font-bold">A weight is outside the ±8% band.</strong> This order cannot
            go out until a supervisor agrees to it. The customer is never charged above what they
            authorised, whatever the scale says.
          </span>
        </div>
      )}

      <ComplaintPanel
        orderId={order.id}
        complaint={forOrder(complaints, order.id)}
        maxRefundKobo={summary.totalKobo}
        onRefund={(amountKobo, note) => {
          const complaint = forOrder(complaints, order.id);
          if (complaint === undefined) return;

          // The refund lands in the wallet, which is the only place the
          // customer can actually see it. Recording it on the complaint
          // without paying it would be a note saying we paid.
          refundComplaint(complaint.id, amountKobo, note);
          credit({
            amountKobo,
            reason: "complaint_refund",
            orderId: order.id,
            note: `Refund on ${order.id}`,
          });
        }}
        onDecline={(note) => {
          const complaint = forOrder(complaints, order.id);
          if (complaint !== undefined) declineComplaint(complaint.id, note);
        }}
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-[15px] font-bold">On the scale</h2>

          {states.map((state) => (
            <PackLine
              key={state.key}
              state={state}
              order={order}
              product={productMap.get(state.line.productId)}
              onWeigh={(actualG) => replace(recordPackedWeight(order, state.key, actualG))}
            />
          ))}
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[96px] lg:w-[330px] lg:shrink-0">
          <section className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-4">
            <Row label="Ordered" value={formatNaira(order.subtotalKobo - order.discountKobo)} />
            <Row label="After weighing" value={formatNaira(summary.goodsKobo)} />
            <Row label="Delivery" value={order.deliveryKobo === 0 ? "Free" : formatNaira(order.deliveryKobo)} />

            <div className="h-px bg-rule" />

            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-sm font-bold">Rider collects</span>
              <span className="font-display text-[21px] font-semibold">{formatNaira(summary.totalKobo)}</span>
            </div>

            <span className="text-[11px] leading-snug text-ink-muted">
              Cash or transfer on delivery. Never more than the {formatNaira(order.totalKobo)} the
              customer approved.
            </span>
          </section>

          <section className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-4">
            <h2 className="text-[13px] font-bold">Delivering to</h2>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">{formatAddress(order.address)}</p>
            <p className="text-[12px] text-ink-muted">{order.phone}</p>
          </section>

          {next.length > 0 && (
            <section className="flex flex-col gap-2 rounded-card border border-line bg-paper p-4">
              <h2 className="text-[13px] font-bold">Move it along</h2>
              <div className="flex flex-wrap gap-2">
                {next.map((status) => {
                  // Dispatching an order nobody has weighed is how a customer
                  // gets billed for fish that was never on a scale.
                  const blocked =
                    (status === "dispatched" && !summary.complete) || summary.needsOverride;

                  return (
                    <Button
                      key={status}
                      variant="secondary"
                      size="sm"
                      disabled={blocked}
                      onClick={() => {
                        /*
                          Delivering is when the money settles. Anything we
                          packed under goes back to the customer here — the
                          promise made on the basket and the order page. The
                          credit is keyed to the order, so correcting a weight
                          and delivering again replaces it rather than paying
                          twice.
                        */
                        if (status === "delivered" && summary.walletCreditKobo > 0) {
                          credit({
                            amountKobo: summary.walletCreditKobo,
                            reason: "short_weight",
                            orderId: order.id,
                            note: `Packed under on ${order.id}`,
                          });
                        }
                        move(order.id, status);
                      }}
                    >
                      {statusLabel(status)}
                    </Button>
                  );
                })}
              </div>

              {!summary.complete && (
                <span className="text-[11px] leading-snug text-ink-muted">
                  Weigh every line before dispatch.
                </span>
              )}
            </section>
          )}

          <Link href="/admin/orders" className="flex min-h-11 items-center justify-center text-[12.5px] font-bold text-lagoon">
            Back to the queue
          </Link>
        </aside>
      </div>
    </div>
  );
}

function PackLine({
  state,
  order,
  product,
  onWeigh,
}: {
  state: PackedLineState;
  order: Order;
  product: ReturnType<ReturnType<typeof useCatalog>["productMap"]["get"]>;
  onWeigh: (actualG: number | null) => void;
}) {
  const { line, actualG, band } = state;
  const [text, setText] = useState<string | null>(null);

  const typed = text === null ? null : Number.parseFloat(text);
  const previewG = typed !== null && Number.isFinite(typed) ? Math.round(typed * 1000) : actualG;

  const charged = chargedForLine(line, order.discountBps);
  const previewValue = previewG === null ? null : valueOfPackedWeight(line, previewG, order.discountBps);
  const warning = previewG === null ? null : overrideReason(line, previewG);

  const commit = () => {
    if (text === null) return;
    const parsed = Number.parseFloat(text);
    setText(null);
    onWeigh(text.trim() === "" ? null : Number.isFinite(parsed) ? Math.round(parsed * 1000) : null);
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-card border bg-paper p-3.5 ${
        warning !== null ? "border-[1.5px] border-clay" : actualG !== null ? "border-[1.5px] border-reef" : "border-line"
      }`}
    >
      <div className="flex items-center gap-3">
        {product !== undefined && (
          <Artwork
            kind={artKindFor(product)}
            src={productPhoto(product)}
            alt={line.productName}
            seed={line.productId}
            className="size-12 shrink-0 rounded-xl"
          />
        )}

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[14px] font-bold">{line.productName}</span>
          <span className="text-[11.5px] text-ink-muted">
            {line.prepName} · ordered {formatWeight(line.weightG)} · {formatNaira(charged)}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">
            Off the scale
          </span>
          <span className="flex h-12 items-center gap-1.5 rounded-control border border-line bg-white px-3">
            <input
              type="text"
              inputMode="decimal"
              value={text ?? (actualG === null ? "" : (actualG / 1000).toFixed(2))}
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              placeholder={(line.weightG / 1000).toFixed(2)}
              className="w-full min-w-0 bg-transparent font-display text-[19px] font-semibold tabular-nums outline-none"
            />
            <span className="shrink-0 text-[12px] text-ink-muted">kg</span>
          </span>
        </label>

        <span className="flex flex-col gap-0.5 sm:w-36 sm:text-right">
          <span className="text-[10.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">
            Worth
          </span>
          <span className="font-display text-[19px] font-semibold tabular-nums">
            {previewValue === null ? "—" : formatNaira(Math.min(previewValue, charged))}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] text-ink-muted">
          Acceptable: {formatWeight(band.minG)} – {formatWeight(band.maxG)}
        </span>

        {actualG !== null && (
          <button
            type="button"
            onClick={() => { setText(null); onWeigh(null); }}
            className="flex min-h-11 items-center text-[11.5px] font-bold text-ink-muted"
          >
            Clear
          </button>
        )}
      </div>

      {warning !== null && (
        <p className="rounded-xl bg-tint-clay px-3 py-2.5 text-[11.5px] leading-snug text-clay">
          {warning}
        </p>
      )}

      {warning === null && state.reconciliation !== null && state.reconciliation.walletCreditKobo > 0 && (
        <p className="rounded-xl bg-tint-mint px-3 py-2.5 text-[11.5px] leading-snug text-reef">
          Packed under — {formatNaira(state.reconciliation.walletCreditKobo)} goes back to the
          customer&rsquo;s wallet.
        </p>
      )}

      {warning === null && state.reconciliation !== null && state.reconciliation.absorbedKobo > 0 && (
        <p className="rounded-xl bg-sand px-3 py-2.5 text-[11.5px] leading-snug text-ink-soft">
          Packed over — we absorb {formatNaira(state.reconciliation.absorbedKobo)}. The customer is
          not billed for it.
        </p>
      )}
    </div>
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

/**
 * A complaint against this order.
 *
 * Refunding pays the wallet and records the complaint in one action, because
 * doing only the second is a note claiming we paid. Declining demands a
 * reason: "declined" with nothing after it is how a complaint becomes a
 * chargeback, and the customer reads whatever is typed here.
 */
function ComplaintPanel({
  orderId,
  complaint,
  maxRefundKobo,
  onRefund,
  onDecline,
}: {
  orderId: string;
  complaint: ReturnType<typeof forOrder>;
  maxRefundKobo: number;
  onRefund: (amountKobo: number, note: string) => void;
  onDecline: (note: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  if (complaint === undefined) return null;

  const settled = complaint.status === "refunded" || complaint.status === "declined";
  const typed = Number.parseFloat(amount);
  const refundKobo = Number.isFinite(typed) ? Math.round(typed * 100) : 0;

  return (
    <section
      className={`flex flex-col gap-3 rounded-card border-[1.5px] p-4 ${
        settled ? "border-line bg-paper" : "border-clay bg-tint-clay"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[14px] font-bold">
          {kindLabel(complaint.kind)} — {orderId}
        </h2>
        <span className="rounded-full bg-paper px-2 py-0.5 text-[10.5px] font-bold">
          {complaintStatusLabel(complaint.status)}
        </span>
        {!complaint.withinWindow && (
          <span className="text-[11px] font-semibold text-ink-muted">
            came in after the 2-hour window
          </span>
        )}
      </div>

      <p className="text-[12.5px] leading-relaxed">{complaint.detail}</p>

      {settled ? (
        <p className="text-[11.5px] leading-snug text-ink-muted">
          {complaint.status === "refunded"
            ? `${formatNaira(complaint.refundedKobo)} paid to the wallet. ${complaint.resolutionNote}`
            : complaint.resolutionNote}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[10.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">
                Refund (₦)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={(maxRefundKobo / 100).toFixed(0)}
                className="h-12 rounded-control border border-line bg-white px-3 text-[15px] font-bold tabular-nums outline-none"
              />
            </label>

            <label className="flex flex-[2] flex-col gap-1">
              <span className="text-[10.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">
                What you are telling them
              </span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Photo shows it clearly. Refunded in full."
                className="h-12 rounded-control border border-line bg-white px-3 text-[13.5px] outline-none"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              disabled={refundKobo <= 0 || note.trim() === ""}
              onClick={() => onRefund(Math.min(refundKobo, maxRefundKobo), note.trim())}
            >
              Refund to wallet
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={note.trim() === ""}
              onClick={() => onDecline(note.trim())}
            >
              Decline, with this reason
            </Button>
          </div>

          <span className="text-[11px] leading-snug text-ink-muted">
            A refund is paid into the customer&rsquo;s wallet immediately. Declining needs a reason —
            they read it.
          </span>
        </>
      )}
    </section>
  );
}
