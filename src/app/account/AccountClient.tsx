"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { useAccount } from "@/components/AccountProvider";
import { Button } from "@/components/ui/Button";
import { formatAddress, validateAddress } from "@/lib/address";
import type { AddressDraft, AddressErrors } from "@/lib/address";
import { ZONES, findZone } from "@/lib/delivery";
import { formatNigerianMobile } from "@/lib/phone";

/**
 * The account.
 *
 * Everything that belongs to the customer rather than to the shop lives here:
 * who they are, where they want things delivered, and what they have ordered.
 * Orders are a sub-section rather than a top-level destination, because an
 * order is something you own, not somewhere you browse.
 *
 * On a phone this is a single column. From `lg` up the sections become a
 * sidebar beside the content, which is how an account reads on a screen wide
 * enough to hold both.
 */

const SECTIONS = [
  { href: "/account", label: "Your details" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wallet", label: "Wallet" },
] as const;

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="lg:w-56 lg:shrink-0">
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {SECTIONS.map((s) => {
          const active = pathname === s.href;
          return (
            <li key={s.href} className="shrink-0 lg:shrink">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-control px-3.5 text-[13.5px] whitespace-nowrap transition-colors duration-[var(--m-fast)] lg:w-full ${
                  active
                    ? "bg-abyss font-bold text-salt"
                    : "border border-line bg-paper font-semibold text-ink-soft hover:bg-sand lg:border-transparent lg:bg-transparent"
                }`}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AccountShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
      <AccountNav />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <h1 className="font-display text-[26px] font-semibold md:text-[32px]">{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** Not signed in yet — say what signing in is for, not just that it is needed. */
function NotVerified({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-paper p-5">
      <h2 className="text-base font-bold">You are not signed in</h2>
      <p className="max-w-prose text-[13px] leading-relaxed text-ink-soft">
        Verify your phone number and {what}. It takes one code — the same number the rider calls.
      </p>
      <Button size="md" className="mt-1" onClick={() => undefined} disabled>
        Verify at checkout
      </Button>
      <span className="text-[11.5px] text-ink-muted">
        Verification currently happens during checkout. Add something to your basket to start.
      </span>
    </div>
  );
}

export function AccountDetails() {
  const { phone, verified, ready, signOut, book } = useAccount();

  if (!ready) return <div className="h-32 animate-pulse rounded-card bg-rule" />;
  if (!verified || phone === null) return <NotVerified what="your details are kept here" />;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-card border border-line bg-paper p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint-mint">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1C6B4A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8.5" r="3.8" />
              <path d="M4.5 20c1.4-4 4.1-5.5 7.5-5.5s6.1 1.5 7.5 5.5" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-display text-xl font-semibold">{formatNigerianMobile(phone)}</span>
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-reef">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              Verified by SMS
            </span>
          </div>
        </div>

        <p className="max-w-prose text-[12.5px] leading-relaxed text-ink-muted">
          This is the number the rider calls and where order updates go. Changing it means verifying
          the new one.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-paper p-5">
        <h2 className="text-base font-bold">At a glance</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Saved addresses" value={String(book.addresses.length)} />
          <Stat label="Orders" value="0" />
          <Stat label="Wallet" value="₦0" />
        </dl>
        <p className="text-[11.5px] leading-relaxed text-ink-muted">
          Orders are placed unpaid and settled with the rider. Wallet credit comes back when an order is packed under what you asked for.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11.5px] text-ink-muted">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

const EMPTY_DRAFT: AddressDraft = {
  zoneId: "",
  street: "",
  landmark: "",
  recipientName: "",
  recipientPhone: "",
  instructions: "",
};

export function AddressBook() {
  const { book, dispatchAddress, addAddress, phone, ready } = useAccount();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState(false);

  const errors: AddressErrors = validateAddress(draft);

  if (!ready) return <div className="h-32 animate-pulse rounded-card bg-rule" />;

  function save() {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    addAddress(draft);
    setDraft(EMPTY_DRAFT);
    setTouched(false);
    setAdding(false);
  }

  function startAdding() {
    setDraft({ ...EMPTY_DRAFT, recipientPhone: phone ?? "" });
    setAdding(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {book.addresses.length === 0 && !adding && (
        <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-paper p-5">
          <h2 className="text-base font-bold">No addresses saved</h2>
          <p className="max-w-prose text-[13px] leading-relaxed text-ink-soft">
            Save one and you will not type it again. A landmark is required — the rider will ask for
            one.
          </p>
          <Button size="md" className="mt-1" onClick={startAdding}>
            Add an address
          </Button>
        </div>
      )}

      {book.addresses.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {book.addresses.map((address) => {
            const selected = address.id === book.selectedId;
            const zone = findZone(address.zoneId);

            return (
              <div
                key={address.id}
                className={`flex flex-col gap-3 rounded-card p-4 ${
                  selected ? "border-[1.5px] border-lagoon bg-tint-mint" : "border border-line bg-paper"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-sm font-bold">{address.recipientName}</span>
                  {selected && (
                    <span className="shrink-0 rounded-full bg-lagoon px-2.5 py-1 text-[10.5px] font-bold text-white">
                      Default
                    </span>
                  )}
                </div>

                <p className="text-[12.5px] leading-relaxed text-ink-soft">{formatAddress(address)}</p>
                <span className="text-[11.5px] text-ink-muted">
                  {zone?.name} · {formatNigerianMobile(address.recipientPhone)}
                </span>

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {!selected && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => dispatchAddress({ type: "select", id: address.id })}
                    >
                      Use this one
                    </Button>
                  )}
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => dispatchAddress({ type: "remove", id: address.id })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <section className="animate-rise flex flex-col gap-4 rounded-card border border-line bg-paper p-5">
          <h2 className="text-base font-bold">New address</h2>

          <div className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold text-ink-muted">Area</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {ZONES.map((z) => {
                const on = z.id === draft.zoneId;
                return (
                  <button
                    key={z.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDraft((d) => ({ ...d, zoneId: z.id }))}
                    className={`flex min-h-14 flex-col justify-center gap-0.5 rounded-[13px] px-3.5 py-2.5 text-left ${
                      on ? "border-[1.5px] border-lagoon bg-tint-mint" : "border border-line bg-paper"
                    }`}
                  >
                    <span className="text-[13px] font-bold">{z.name}</span>
                    <span className="truncate text-[11px] text-ink-muted">{z.areas.join(", ")}</span>
                  </button>
                );
              })}
            </div>
            {touched && errors.zoneId !== undefined && <Err>{errors.zoneId}</Err>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Street and house number"
              value={draft.street}
              error={touched ? errors.street : undefined}
              placeholder="14B Fola Osibo Street"
              onChange={(v) => setDraft((d) => ({ ...d, street: v }))}
            />
            <Field
              label="Who should the rider ask for?"
              value={draft.recipientName}
              error={touched ? errors.recipientName : undefined}
              placeholder="Adaeze Okonkwo"
              onChange={(v) => setDraft((d) => ({ ...d, recipientName: v }))}
            />
          </div>

          <Field
            label="Nearest landmark"
            hint="Required — the rider will ask for one"
            value={draft.landmark}
            error={touched ? errors.landmark : undefined}
            placeholder="Opposite the blue mosque, after Shoprite"
            onChange={(v) => setDraft((d) => ({ ...d, landmark: v }))}
          />

          <div className="flex flex-wrap gap-2">
            <Button size="md" onClick={save}>
              Save address
            </Button>
            <Button variant="tertiary" size="md" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : (
        book.addresses.length > 0 && (
          <Button variant="secondary" size="md" className="self-start" onClick={startAdding}>
            Add another address
          </Button>
        )
      )}
    </div>
  );
}

function Err({ children }: { children: ReactNode }) {
  return <span className="text-[11.5px] font-semibold text-clay">{children}</span>;
}

function Field({
  label,
  hint,
  value,
  error,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  placeholder: string;
  onChange: (value: string) => void;
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
        className={`h-12 rounded-control border px-3.5 text-[14px] outline-none ${
          error === undefined ? "border-line" : "border-clay"
        }`}
      />
      {error !== undefined && <Err>{error}</Err>}
    </label>
  );
}
