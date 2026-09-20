# ONEESTORE

Fresh seafood, sold by the kilogram at the morning's market price, cleaned the
way you ask and delivered across Lagos the same day.

Built with **Next.js (App Router) + TypeScript + Tailwind 4**, with the
pricing engine as a pure, tested module underneath.

Design canvas (18 artboards, private):
<https://claude.ai/artifact/6Y6YpV2c15UvhKHCiKy7ai>
Product, design and build plan: [`docs/plan.md`](docs/plan.md)

---

## Running it

```bash
npm install        # honours the committed lockfile
npm run dev        # http://localhost:3000
```

```bash
npm run check      # typecheck + tests — run this before every push
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

No environment variables are needed to run it: the storefront reads a seed
catalog, the basket and address book live in localStorage, and phone
verification uses a stand-in that shows the code on screen instead of sending
an SMS. `.env.example` lists what M4 onwards will need.

### Deploying it

No environment variables are required — the app runs entirely on seed data.

At <https://vercel.com/new>, import this repository and deploy. There is
nothing to configure: `vercel.json` names the framework, `main` is the
production branch, and the committed lockfile means every build resolves the
same dependency tree.

---

## The one thing to understand before changing anything

**Money is an integer count of kobo. Weight is an integer count of grams.**

Never a float, never naira, never `2.5` kilograms. Every field that carries one
says so in its name — `pricePerKgKobo`, `weightG` — so a float cannot slip
through review unnoticed.

Everything unusual in this codebase follows from selling by weight at a price
that moves every morning:

| Rule | Where it lives |
|---|---|
| Weight snaps to the product's step and clamps to stock | `normalizeWeight` |
| Preparation surcharges are per kilogram, not per line | `priceLine` |
| Filleting loses about half the weight, and we say so up front | `PrepOption.yieldBps` |
| Tomorrow's price never re-prices yesterday's order | `CartLine.unitPricePerKgKoboSnapshot`, `priceDrift` |
| Packed weight must land within ±8% of what was ordered | `TOLERANCE_BPS`, `isWithinTolerance` |
| Packed under → wallet credit. Packed over → we absorb it | `reconcileLine` |
| A card is **never** charged above the authorised amount | `reconcileLine` |
| Two lines of the same fish cannot outsell its stock between them | `remainingStockG`, `cartReducer` |
| A saved basket is restored with its prices, not today's | `restore`, never replayed adds |
| Four ways of typing a Lagos number are one account | `toE164` |
| An address without a landmark is never saved | `validateAddress` |
| Code limits are enforced in the verifier, not the form | `otp.ts` |

That last rule is not a preference. Charging a card above what the customer
approved collects chargebacks and destroys the trust the whole proposition
rests on, so the engine has no code path that can do it.

`src/lib/pricing.ts` and `src/lib/cart.ts` are pure — no I/O, no React, no
framework. They are covered by 102 tests, several of which assert the exact
figures used in the design so the screens and the maths cannot drift apart.
`CartProvider` is a thin wrapper that only holds state and talks to
localStorage; no rule lives in it.

---

## Layout

```
src/
  app/                    routes (App Router)
    page.tsx              home
    shop/                 catalog by category
    product/[slug]/       product + the three-step customizer (client)
    search/               live search, matches local names
    basket/               the basket, priced by the engine
    checkout/             five steps; contact, delivery and schedule are live
    orders/               honest empty state until orders exist
    globals.css           design tokens, glass, motion
  components/
    ui/                   Button, Badge, Price, Selectors, Skeleton, EmptyState…
    BottomNav.tsx         floating glass nav, live basket badge
    AccountProvider.tsx   verified phone + address book
    CartProvider.tsx      React wrapper over the cart reducer
    Toast.tsx             confirmations that never interrupt
    TopBar.tsx            glass header
    ProductCard.tsx
    CutoffBanner.tsx      same-day countdown (client — it depends on the minute)
  lib/
    types.ts              Kobo, Grams, Product, CartLine…
    phone.ts              Nigerian number normalisation and validation
    otp.ts                verification rules + the one SMS seam
    address.ts            address validation and the address book
    money.ts              kobo/gram helpers and formatting
    pricing.ts            THE ENGINE — weight, prices, tolerance, box, meals
    cart.ts               basket reducer, aggregate stock, persistence
    delivery.ts           zones, fees, cut-off, slots
    seed.ts               placeholder catalog
supabase/migrations/      schema with RLS
```

### Design language

Glass only ever sits **over content** — navigation, floating controls, sheets,
drawers. Content areas stay opaque so they can be scanned, and glass never
carries body copy. Where `backdrop-filter` is unsupported the opacity rises
until readability is safe.

Motion runs on seven shared tokens (`--m-fast` … `--m-exit`) defined in
`globals.css`. No component invents its own timing, only `transform` and
`opacity` are animated, and `prefers-reduced-motion` collapses every token to
an 80ms opacity fade — state still confirms, nothing travels.

---

## Where this is up to

**Done — M0, M1, M2, M3.**

- M0: design tokens, motion system, component library.
- M1: pricing and delivery engines; storefront read path — home, shop, product
  with working weight and preparation selection, live search over local names.
- M2: the basket. Add from the product page without navigating away, a toast
  that confirms it, a live badge, per-line weight stepping, removal, delivery
  zone selection with the free-delivery threshold, price-drift acceptance, and
  persistence across reloads. Aggregate stock is enforced across lines, so two
  preparations of the same fish cannot outsell it between them.

- M3: phone verification with real expiry, attempt and resend limits; an
  address book that refuses an address without a landmark; and delivery
  scheduling that explains every closed day. Checkout runs as five progressive
  steps, of which the first three are live.

**Not done yet:** payment. The checkout's pay button is drawn, priced and
inert, and says so on screen. Build Your Box and Shop by Meal have tested
engine support (`priceBox`, `mealQuantities`) and designs, but no screens.

**Two things are stand-ins, both clearly marked on screen.** Verification
codes are shown in the page rather than sent, behind the `SmsSender` interface
that Termii implements. The catalog is `seed.ts` rather than Supabase, behind
the same types. Neither is a rewrite — each is one object to replace.

**Next — M4:** Paystack with webhook verification, and the order state
machine.

All catalog data is **placeholder**. Prices, stock, ratings, the ±8% band, zone
fees, the 11 AM cut-off and the box tiers need your real numbers before launch,
and every image is a labelled placeholder until the photography exists.

---
