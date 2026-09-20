"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAccount } from "@/components/AccountProvider";
import { useCart } from "@/components/CartProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatAddress, validateAddress } from "@/lib/address";
import type { AddressDraft, AddressErrors } from "@/lib/address";
import { isEmpty, priceCart } from "@/lib/cart";
import { ZONES, availableSlots, deliveryDays, deliveryFeeKobo, findZone } from "@/lib/delivery";
import { formatNaira, formatWeight } from "@/lib/money";
import { resendInSeconds } from "@/lib/otp";
import { formatNigerianMobile, maskNigerianMobile, phoneError, toE164 } from "@/lib/phone";
import { productMap } from "@/lib/seed";

/**
 * Checkout, in five progressive steps.
 *
 * Contact, Delivery and Schedule are live. Payment and Review are drawn but
 * inert, because Paystack is the next milestone — the step indicator shows
 * them so the customer can see how far they have to go, which is the whole
 * reason for splitting a long form into steps.
 *
 * What is typed survives moving between steps, and validation is inline: a
 * bad phone number says so when the customer leaves the field, not after they
 * have filled in everything else.
 */

const STEPS = ["Contact", "Delivery", "Schedule", "Payment", "Review"] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4;

const EMPTY_DRAFT: AddressDraft = {
  zoneId: "",
  street: "",
  landmark: "",
  recipientName: "",
  recipientPhone: "",
  instructions: "",
};

export function CheckoutClient() {
  const { state, dispatch, ready: cartReady } = useCart();
  const account = useAccount();
  const catalog = useMemo(() => productMap(), []);

  const [step, setStep] = useState<StepIndex>(0);

  // Contact
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [, tick] = useState(0);

  // Delivery
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState<Partial<Record<keyof AddressDraft, boolean>>>({});

  // Schedule
  const [slotDate, setSlotDate] = useState<string | null>(null);
  const [slotWindow, setSlotWindow] = useState<string | null>(null);

  const totals = priceCart(state, catalog);
  const zone = draft.zoneId === "" ? undefined : findZone(draft.zoneId);
  const deliveryKobo = zone === undefined ? 0 : deliveryFeeKobo(zone, totals.goodsKobo);
  const totalKobo = totals.subtotalKobo + deliveryKobo;

  const errors: AddressErrors = validateAddress(draft);
  const cooldown = resendInSeconds(account.challenge, Date.now());
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => deliveryDays(now, 5), [now]);
  const slots = useMemo(() => availableSlots(now, 5), [now]);
  const closedReasons = useMemo(
    () => [...new Set(days.filter((d) => !d.available).map((d) => d.unavailableReason ?? ""))].filter((r) => r !== ""),
    [days],
  );

  /*
   * The resend cooldown is derived at render from the challenge itself, and
   * the interval exists only to re-render once a second.
   *
   * Holding it in state instead meant the countdown was stale until the next
   * tick, and worse, the interval restarted whenever the challenge changed —
   * so a wrong code reset the timer and briefly offered a resend that the
   * verifier would have refused.
   */
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Once verified, the contact step is done — move on rather than making them
  // press a second button to acknowledge their own success.
  useEffect(() => {
    if (account.verified && step === 0) setStep(1);
  }, [account.verified, step]);

  // Prefill the recipient from the verified number.
  useEffect(() => {
    if (account.phone !== null && draft.recipientPhone === "") {
      setDraft((d) => ({ ...d, recipientPhone: account.phone as string }));
    }
  }, [account.phone, draft.recipientPhone]);

  // The basket already knows the zone; carry it rather than asking twice.
  useEffect(() => {
    if (state.zoneId !== null && draft.zoneId === "") {
      setDraft((d) => ({ ...d, zoneId: state.zoneId as string }));
    }
  }, [state.zoneId, draft.zoneId]);

  if (!cartReady || !account.ready) {
    return <div className="h-40 animate-pulse rounded-card bg-rule" />;
  }

  if (isEmpty(state)) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h2l2.2 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L21 9H7" />
            <circle cx="10.5" cy="20" r="1.3" />
            <circle cx="18" cy="20" r="1.3" />
          </svg>
        }
        title="Nothing to check out"
        body="Your basket is empty — there is fresh seafood waiting."
        actionLabel="Browse Seafood"
        actionHref="/shop"
      />
    );
  }

  async function sendCode() {
    const message = phoneError(phoneInput);
    if (message !== null) {
      setPhoneMsg(message);
      return;
    }

    const e164 = toE164(phoneInput);
    if (e164 === null) {
      setPhoneMsg("That number does not look right.");
      return;
    }

    setSending(true);
    setPhoneMsg(null);
    const issued = await account.requestCode(e164);
    setSending(false);

    if (!issued.ok) setPhoneMsg(issued.message);
    else setCodeMsg(null);
  }

  function checkCode(value: string) {
    setCodeInput(value);
    if (value.replace(/\D/g, "").length < 4) {
      setCodeMsg(null);
      return;
    }
    const result = account.submitCode(value);
    setCodeMsg(result.ok ? null : result.message);
  }

  function saveAddress() {
    setTouched({ zoneId: true, street: true, landmark: true, recipientName: true, recipientPhone: true });
    if (Object.keys(errors).length > 0) return;

    account.addAddress(draft);
    dispatch({ type: "setZone", zoneId: draft.zoneId });
    setStep(2);
  }

  const chosenSlot = slots.find((s) => s.isoDate === slotDate && s.windowId === slotWindow);

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex items-center gap-1.5">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                className={`h-[3px] rounded-full ${done ? "bg-reef" : current ? "bg-clay" : "bg-line"}`}
              />
              <span
                className={`flex items-center gap-1 text-[9.5px] ${
                  done ? "font-semibold text-reef" : current ? "font-bold text-clay" : "font-medium text-ink-faint"
                }`}
              >
                {done && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* 1 — Contact */}
      {step === 0 && (
        <section className="animate-rise flex flex-col gap-4 rounded-card border border-line bg-paper p-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[19px] font-semibold">What is your number?</h2>
            <p className="text-[12.5px] leading-snug text-ink-muted">
              The rider calls it, and your order updates go to it on WhatsApp.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-ink-muted">Phone number</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneInput}
              disabled={account.challenge !== null}
              onChange={(e) => {
                setPhoneInput(e.target.value);
                if (phoneMsg !== null) setPhoneMsg(null);
              }}
              onBlur={() => setPhoneMsg(phoneError(phoneInput))}
              placeholder="0803 412 8890"
              className={`h-12 rounded-control border px-3.5 text-[15px] outline-none disabled:bg-sand ${
                phoneMsg === null ? "border-line" : "border-clay"
              }`}
            />
            {phoneMsg !== null && <span className="text-[11.5px] font-semibold text-clay">{phoneMsg}</span>}
          </label>

          {account.challenge === null ? (
            <Button size="lg" fullWidth loading={sending} onClick={sendCode}>
              Send me a code
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-ink-muted">
                  Enter the 4-digit code sent to {maskNigerianMobile(account.phone ?? "")}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={9}
                  value={codeInput}
                  onChange={(e) => checkCode(e.target.value)}
                  placeholder="1 2 3 4"
                  className={`h-14 rounded-control border px-3.5 text-center font-display text-2xl tracking-[0.3em] outline-none ${
                    codeMsg === null ? "border-line" : "border-clay"
                  }`}
                />
                {codeMsg !== null && <span className="text-[11.5px] font-semibold text-clay">{codeMsg}</span>}
              </label>

              {/*
                The stand-in sender hands the code back instead of sending an
                SMS. This block is the only place it is ever shown, and it is
                labelled so nobody mistakes it for a real message.
              */}
              {account.devCode !== null && (
                <div className="flex items-start gap-2.5 rounded-xl bg-tint-amber px-3 py-2.5">
                  <span className="text-[11.5px] leading-snug text-amber">
                    <strong className="font-bold">No SMS provider connected yet.</strong> Your code is{" "}
                    <strong className="font-bold tracking-[0.15em]">{account.devCode}</strong>. Termii
                    replaces this before launch.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="tertiary"
                  size="sm"
                  disabled={cooldown > 0 || sending}
                  onClick={sendCode}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Send another code"}
                </Button>
                <span className="flex-1" />
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => {
                    account.signOut();
                    setCodeInput("");
                    setCodeMsg(null);
                  }}
                >
                  Change number
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Contact, once done */}
      {step > 0 && account.verified && (
        <section className="flex items-center gap-3 rounded-[15px] border border-line bg-paper px-3.5 py-3">
          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-tint-mint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1C6B4A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-bold">{formatNigerianMobile(account.phone ?? "")}</span>
            <span className="text-[11.5px] text-ink-muted">Verified by SMS</span>
          </span>
          <Button variant="tertiary" size="sm" onClick={() => { account.signOut(); setStep(0); }}>
            Change
          </Button>
        </section>
      )}

      {/* 2 — Delivery */}
      {step === 1 && (
        <section className="animate-rise flex flex-col gap-4 rounded-card border border-line bg-paper p-4">
          <h2 className="font-display text-[19px] font-semibold">Where are we delivering?</h2>

          <div className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold text-ink-muted">Area</span>
            <div className="flex flex-col gap-2">
              {ZONES.map((z) => {
                const on = z.id === draft.zoneId;
                return (
                  <button
                    key={z.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDraft((d) => ({ ...d, zoneId: z.id }))}
                    className={`flex min-h-14 items-center gap-3 rounded-[13px] px-3.5 py-3 text-left ${
                      on ? "border-[1.5px] border-lagoon bg-tint-mint" : "border border-line bg-paper"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[13px] font-bold">{z.name}</span>
                      <span className="truncate text-[11px] text-ink-muted">{z.areas.join(", ")}</span>
                    </span>
                    <span className="shrink-0 text-[12.5px] font-bold">
                      {deliveryFeeKobo(z, totals.goodsKobo) === 0 ? "Free" : formatNaira(z.feeKobo)}
                    </span>
                  </button>
                );
              })}
            </div>
            {touched.zoneId === true && errors.zoneId !== undefined && (
              <span className="text-[11.5px] font-semibold text-clay">{errors.zoneId}</span>
            )}
          </div>

          <Field
            label="Street and house number"
            value={draft.street}
            error={touched.street === true ? errors.street : undefined}
            placeholder="14B Fola Osibo Street"
            onChange={(v) => setDraft((d) => ({ ...d, street: v }))}
            onBlur={() => setTouched((t) => ({ ...t, street: true }))}
          />

          <Field
            label="Nearest landmark"
            hint="Required — the rider will ask for one"
            value={draft.landmark}
            error={touched.landmark === true ? errors.landmark : undefined}
            placeholder="Opposite the blue mosque, after Shoprite"
            onChange={(v) => setDraft((d) => ({ ...d, landmark: v }))}
            onBlur={() => setTouched((t) => ({ ...t, landmark: true }))}
          />

          <Field
            label="Who should the rider ask for?"
            value={draft.recipientName}
            error={touched.recipientName === true ? errors.recipientName : undefined}
            placeholder="Adaeze Okonkwo"
            onChange={(v) => setDraft((d) => ({ ...d, recipientName: v }))}
            onBlur={() => setTouched((t) => ({ ...t, recipientName: true }))}
          />

          <Button size="lg" fullWidth onClick={saveAddress}>
            Continue to scheduling
          </Button>
        </section>
      )}

      {step > 1 && (
        <section className="flex items-start gap-3 rounded-[15px] border border-line bg-paper px-3.5 py-3">
          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-tint-mint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1C6B4A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] leading-snug font-bold">
              {formatAddress({ ...draft, id: "draft", isDefault: false })}
            </span>
            <span className="text-[11.5px] text-ink-muted">Ask for {draft.recipientName}</span>
          </span>
          <Button variant="tertiary" size="sm" onClick={() => setStep(1)}>
            Change
          </Button>
        </section>
      )}

      {/* 3 — Schedule */}
      {step === 2 && (
        <section className="animate-rise flex flex-col gap-4 rounded-card border border-line bg-paper p-4">
          <h2 className="font-display text-[19px] font-semibold">When should it arrive?</h2>

          <div className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold text-ink-muted">Day</span>
            <div className="flex gap-2">
              {days.map((day) => {
                const on = day.isoDate === slotDate;
                const dow = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][day.weekday];
                return (
                  <button
                    key={day.isoDate}
                    type="button"
                    disabled={!day.available}
                    aria-pressed={on}
                    onClick={() => {
                      setSlotDate(day.isoDate);
                      setSlotWindow(null);
                    }}
                    className={`flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[13px] ${
                      !day.available
                        ? "cursor-not-allowed border border-dashed border-line bg-sand"
                        : on
                          ? "border border-abyss bg-abyss shadow-[0_5px_14px_rgb(11_43_46_/_0.24)]"
                          : "border border-line bg-paper"
                    }`}
                  >
                    <span
                      className={`text-[9.5px] font-semibold tracking-[0.06em] ${
                        !day.available ? "text-ink-faint" : on ? "text-[#7FD3C4]" : "text-ink-muted"
                      }`}
                    >
                      {dow}
                    </span>
                    <span
                      className={`text-[17px] font-bold ${
                        !day.available ? "text-ink-faint" : on ? "text-white" : "text-ink"
                      }`}
                    >
                      {day.dayOfMonth}
                    </span>
                  </button>
                );
              })}
            </div>

            {/*
              Every closed day says why. Days close for different reasons —
              today's cut-off having passed is not the same as a Monday — so
              each distinct reason is listed rather than only the first, which
              would explain one greyed-out day and leave the other a mystery.
            */}
            {closedReasons.map((reason) => (
              <span
                key={reason}
                className="flex items-center gap-2 rounded-lg bg-tint-amber px-2.5 py-2 text-[11px] text-amber"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 8.2v.2M12 11.5v4.3" />
                </svg>
                {reason}
              </span>
            ))}
          </div>

          {slotDate !== null && (
            <div className="animate-rise flex flex-col gap-2">
              <span className="text-[11.5px] font-semibold text-ink-muted">Window</span>
              {slots
                .filter((s) => s.isoDate === slotDate)
                .map((s) => {
                  const on = s.windowId === slotWindow;
                  return (
                    <button
                      key={s.windowId}
                      type="button"
                      disabled={!s.available}
                      aria-pressed={on}
                      onClick={() => setSlotWindow(s.windowId)}
                      className={`flex min-h-14 items-center gap-3 rounded-[13px] px-3.5 py-3 text-left ${
                        !s.available
                          ? "cursor-not-allowed border border-dashed border-line bg-sand"
                          : on
                            ? "border-[1.5px] border-lagoon bg-tint-mint"
                            : "border border-line bg-paper"
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={`text-[13px] font-bold ${s.available ? "" : "text-ink-faint"}`}>
                          {s.windowLabel}
                        </span>
                        {s.unavailableReason !== null && (
                          <span className="text-[11px] text-ink-muted">{s.unavailableReason}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}

          <Button size="lg" fullWidth disabled={chosenSlot === undefined} onClick={() => setStep(3)}>
            {chosenSlot === undefined ? "Pick a day and window" : "Continue to payment"}
          </Button>
        </section>
      )}

      {/* 4 and 5 — Payment and Review, next milestone */}
      {step === 3 && (
        <section className="animate-rise flex flex-col gap-3 rounded-card border border-line bg-paper p-4">
          <h2 className="font-display text-[19px] font-semibold">Payment</h2>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            Paystack — card, bank transfer, USSD — and pay-on-delivery are the next milestone.
            Everything up to this point is real: your number is verified, your address is saved, and
            your slot is held.
          </p>

          <div className="flex flex-col gap-2 rounded-xl bg-sand p-3">
            <SummaryRow label="Delivering to" value={formatAddress({ ...draft, id: "d", isDefault: false })} />
            <SummaryRow
              label="Arriving"
              value={chosenSlot === undefined ? "—" : `${slotDate} · ${chosenSlot.windowLabel}`}
            />
            <SummaryRow label="Seafood" value={`${formatWeight(totals.totalWeightG)} · ${formatNaira(totals.subtotalKobo)}`} />
            <SummaryRow label="Delivery" value={deliveryKobo === 0 ? "Free" : formatNaira(deliveryKobo)} />
          </div>

          <div className="flex items-baseline gap-2 pt-1">
            <span className="flex-1 text-sm font-bold">To pay</span>
            <span className="font-display text-[23px] font-semibold">{formatNaira(totalKobo)}</span>
          </div>

          <Button size="lg" fullWidth disabled>
            Pay {formatNaira(totalKobo)}
          </Button>
          <span className="text-center text-[10.5px] text-ink-muted">
            Paystack is not connected yet — no money moves.
          </span>

          <Button variant="tertiary" size="sm" onClick={() => setStep(2)}>
            Back to scheduling
          </Button>
        </section>
      )}

      <Link href="/basket" className="flex min-h-11 items-center justify-center text-[12.5px] font-semibold text-lagoon">
        Back to basket
      </Link>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  error,
  placeholder,
  onChange,
  onBlur,
}: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  placeholder: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold text-ink-muted">
        {label}
        {hint !== undefined && <span className="font-medium text-ink-faint"> — {hint}</span>}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`h-12 rounded-control border px-3.5 text-[14px] outline-none ${
          error === undefined ? "border-line" : "border-clay"
        }`}
      />
      {error !== undefined && <span className="text-[11.5px] font-semibold text-clay">{error}</span>}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="shrink-0 text-[11.5px] text-ink-muted">{label}</span>
      <span className="flex-1 text-right text-[12px] font-semibold">{value}</span>
    </div>
  );
}
