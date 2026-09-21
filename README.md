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
| An order is a snapshot; the catalog cannot rewrite it later | `createOrder` |
| An order cannot skip a stage, or move backwards | `ORDER_FLOW`, `advance` |
| An order already with the rider cannot be cancelled by a button | `ORDER_FLOW` |
| The wallet is a ledger with reasons, never a bare balance | `wallet.ts` |
| A wallet cannot go negative, or pay the same shortfall twice | `spend`, `credit` |
| Credit never expires | no expiry exists to be called |
| A late complaint goes to a person; the door does not shut | `raise` |
| A complaint cannot be declined without a reason | `decline` |
| The volume discount belongs to the basket's weight, not to the screen that filled it | `priceBasket`, `volumeDiscount` |
| A discount is authorised once and never clawed back by a light pack | `reconcileLine`'s `discountBps` |
| Totals never owe kobo | the discount floors to whole naira |

That last rule is not a preference. Charging a card above what the customer
approved collects chargebacks and destroys the trust the whole proposition
rests on, so the engine has no code path that can do it.

`src/lib/pricing.ts` and `src/lib/cart.ts` are pure — no I/O, no React, no
framework. They are covered by 155 tests, several of which assert the exact
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
    box/                  Build Your Box — live tier progress (client)
    meals/                Shop by Meal, and a builder per dish (client)
    basket/               the basket, priced by the engine
    account/orders/       order history, one order, and reporting a problem
    account/wallet/       the ledger, and why each movement happened
    admin/                operations — today, the board, the packing queue
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
    orders.ts             order snapshot + the status machine
    packing.ts            scale readings -> wallet credit, absorb, override
    wallet.ts             the credit ledger — append-only, never negative
    complaints.ts         the 2-hour window and how one is settled
    catalog.ts            the morning board: draft, publish, overlay
    lagos.ts              the 20 LGAs, their areas, and the zone each falls in
    reorder.ts            ordering the same thing at today's prices
    rows.ts               database rows <-> domain objects
    supabase.ts           the browser client, when a project is configured
  server/
    sql.ts                the executor seam and the connection pool
    repository.ts         every read and write, as SQL
supabase/migrations/      the schema, applied and tested on every run
supabase/seed.sql         the catalog, generated from seed.ts
    seed.ts               placeholder catalog
supabase/migrations/      schema with RLS
```

### Photographs

Drop a file in and it appears — `public/images/products/<slug>.jpg`,
`public/images/meals/<slug>.jpg`. No code change: with no file there the
request 404s, `Artwork` catches it, and the drawn artwork underneath stays, so
photographs can arrive one at a time. `public/images/README.md` lists the slugs
and what the shots need to be.

Until then each product is drawn rather than photographed, per species — a
prawn as a prawn, a catfish with barbels, a mackerel striped — so a catalog
reads as a shelf instead of ten copies of one placeholder. **No stock
photography is shipped, deliberately.** A photo of a fish we did not catch,
sold under a promise about the fish we did, is the one thing here that would
be a lie.

### The schema

`supabase/migrations/` is applied to a real Postgres (PGlite, in-process) by
`npm test`, and then asked questions. Running it for the first time found four
things:

- **An extension it did not need.** `pgcrypto` for `gen_random_uuid()`, which
  has been built in since Postgres 13. Asking for it needs privileges the
  migration should not want.
- **The wallet balance in two places.** `wallet_ledger` carried the comment
  "Balance is the sum of the ledger, never a field someone edits" — and
  `customers.wallet_balance_kobo` was exactly such a field. Two sources of
  truth for money drift, and the one that drifts is the one the customer sees.
  The column is gone; `customer_wallet_balances` derives it.
- **Six tables with row-level security off.** In Supabase a table in `public`
  without RLS is world-readable through the anon key, and `riders` and
  `deliveries` hold names, phone numbers and addresses. A test now fails if any
  table in `public` has it off.
- **A line with nowhere to point.** `order_items.product_id` is a non-null
  foreign key; the mapper was not setting it. Found by writing a real order
  through the real schema rather than by reading the code.

The tests also hold the database and the code together: the order statuses in
`ORDER_FLOW` and the ones the `orders` check constraint allows must be the same
set, or a packer's write fails at six in the morning.

### The database layer

`src/server/repository.ts` holds every read and write as SQL. It never holds a
connection — it is handed a `SqlExecutor`, which in production is a `pg.Pool`
against Supabase and in the tests is the same `pg.Pool` against an in-process
Postgres served over a TCP socket. The code under test is therefore the code
that runs, down to the wire protocol, the parameter binding and the
constraints. The only line the tests do not cover is the connection string.

Running it found three more things:

- **The address had nowhere to put the recipient.** Checkout asks "who should
  the rider ask for?" as a required field, and `addresses` had no column for
  it, nor for the recipient's number or the delivery instructions. `0003` adds
  them — and moves "an address without a landmark is never saved" out of a
  validation function and into a check constraint, where it cannot be
  bypassed.
- **A parameter the statement never used.** Postgres cannot infer its type and
  rejects the whole query. It only appears when the query is run.
- **A rating multiplied by the number of preparations.** Joining reviews
  alongside `prep_options` inflates every average, and the result still looks
  like a plausible rating.

Money moves in a transaction: placing an order writes the order, its lines, its
first event and any wallet spend, or none of it. There is a test that throws
half way through and asserts the wallet is untouched — a customer whose credit
was spent by an order that did not save has lost money twice.

### Connecting a project

```bash
cp .env.example .env.local     # fill in the two NEXT_PUBLIC_ values
supabase db push               # or paste supabase/migrations/*.sql into the SQL editor
psql "$DATABASE_URL" -f supabase/seed.sql
```

Without those values the app runs entirely on seed data and browser storage,
and `/admin` says so at the top of every screen — everything works, but each
device is its own shop.

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

- M3.5: Build Your Box and Shop by Meal. Both compose a basket rather than a
  separate kind of order, so the volume discount they show is the one the
  basket charges — `priceBox` is now `priceBasket` under another name. Meal
  quantities scale with the serving count while hand-adjustments survive it.

- M4: orders. Checkout places a real order, unpaid, settled with the rider on
  delivery — which is how most of Lagos buys fish. An order is a *snapshot*:
  names and prices are copied into it, so tomorrow's price rise cannot rewrite
  yesterday's receipt. Every legal status move is declared in `ORDER_FLOW`, so
  an order cannot skip from `sourcing` to `delivered` because a screen called
  the wrong function. The tracker shows five stages, not all nine we run.

**Not done yet:** payment, deliberately. `pending_payment -> paid` is already a
legal move; connecting a gateway is a fifth checkout step and nothing else.

**Two things are stand-ins, both clearly marked on screen.** Verification
codes are shown in the page rather than sent, behind the `SmsSender` interface
that Termii implements. The catalog is `seed.ts` rather than Supabase, behind
the same types. Neither is a rewrite — each is one object to replace.

- M5: the packing room, at `/admin`. Three screens, built for a phone at a
  jetty rather than a shrunken desktop table: **Today** (what is blocking, what
  is running out), **Prices & stock** (the morning board), and the **packing
  queue** with the weighing screen.

  The weighing screen is what the pricing engine was written for. Every rule it
  has enforced in tests since the first milestone happens there against a real
  number off a scale: the ±8% band, wallet credit for an underpack, absorbing
  an overpack, and never charging above the authorised amount. Nothing is
  clamped — a weight outside the band is saved and flagged, because correcting
  it silently would hide the mistake and change what the shop believes it sent.
  An order cannot be dispatched until every line has been weighed.

  Prices stage into a draft and go live in one act. A morning's pricing is a
  single piece of judgement, and you do not want half of it on the storefront
  while someone is still deciding about the prawns.

- M6: making good. Two promises the screens had been making since the first
  milestone finally work.

  **The wallet.** Packing an order under what was ordered credits the
  difference on delivery, and it comes off the next order automatically —
  opting in to being given back what you are owed is a way of hoping the
  customer forgets. It is a ledger rather than a balance, because the first
  question anyone asks about money that appeared without them paying it in is
  *where did this come from?* Credits are idempotent per order, so correcting
  a weight and delivering again does not pay twice.

  **Complaints.** "Not right? Tell us within 2 hours" now has somewhere to be
  said, with the countdown visible — a deadline the customer cannot see is a
  trap. Past the window the form still opens; it goes to a person instead of
  being settled on the spot, because turning away someone eleven minutes late
  with bad fish costs more than the fish. Refunding pays the wallet and
  records the complaint in one action, and declining demands a reason the
  customer reads.

- M7: the database, as far as it goes without a project. The migrations are no
  longer a file nobody had run — they are applied to a real Postgres in the
  test suite, which found four things worth finding. See **The schema** below.

- M8: the second order. Checkout was writing to the address book and never
  reading it, so a weekly customer retyped their street and landmark every
  time; it now opens on the address they used last. **Order again** re-prices
  the old basket against today's board and shows what moved before anything is
  added — a shop whose prices change every morning cannot just put the lines
  back and surprise someone at checkout.

- M9: the repository. Every read and write the shop needs, written as SQL
  against the migrations and **run** in the tests through the same `pg` driver
  that will talk to Supabase — see **The database layer** below.

- M10: the screens read the database. With `DATABASE_URL` set, orders, the
  wallet and complaints come from Postgres; without it the browser stand-in
  still works, so a fresh clone runs with nothing configured. Proved by
  running the app against a real database and driving two separate browsers:
  a customer places an order on one, the shop sees it on the other, weighs it
  short, delivers it — and the credit lands in the customer's wallet.

- M11: where in Lagos. The customer was being asked to choose a *pricing
  zone* — the shop's own vocabulary, and not something anyone knows about
  their own house. They now pick their area and local government from a
  searchable list of all twenty LGAs, and the zone and the delivery fee follow
  from it.

  **There are no streets in that list, deliberately.** Lagos has tens of
  thousands and this repository has none of them; a dropdown of invented
  street names is worse than a text field, because the customer either picks
  one that does not exist or cannot find theirs and leaves. Streets are typed,
  and the landmark underneath is what the rider actually uses. Real street
  data means a geocoding service — Google Places or similar — and an API key.

**Next:** the catalog and the price board still live in the browser overlay,
so a price published on one device is published only there. Same pattern,
`loadCatalog` and `publishPrices` are already written and tested. Paystack
after that.

All catalog data is **placeholder**. Prices, stock, ratings, the ±8% band, zone
fees, the 11 AM cut-off, the box tiers (3 kg → 5%, 5 kg → 10%) and the per-serving
meal quantities need your real numbers and margins before launch,
and every image is a labelled placeholder until the photography exists.

---
