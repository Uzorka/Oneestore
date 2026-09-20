# ONEESTORE — Product, Design & Build Plan

Scope: **Lagos only** for v1.
Date: 19 September 2026.

Screens and design system (private artifact, 18 artboards):
<https://claude.ai/artifact/6Y6YpV2c15UvhKHCiKy7ai>

---

## 1. Decisions locked

| Decision | Choice | Consequence |
|---|---|---|
| Codebase | **New separate repo** | Done — this repository. The earlier Bible Explained project is untouched in its own repo |
| v1 depth | **Full-stack, real orders** | Database, auth, payments and an admin dashboard from day one |
| Payments | **Paystack** | Card, bank transfer, USSD, Verve. Webhook-verified |
| Pricing | **Per kg, customer picks weight** | Weight-based cart, weight tolerance policy, actual-weight reconciliation |
| Design language | **Glass, OS-inspired, ONEESTORE identity** | UI/UX is architecture here, not a later polish pass — see §4 |

Pay-on-delivery is kept as a second rail because a meaningful share of Lagos
customers will not prepay a new vendor for perishables. It is a toggle, not a
rewrite — the order state machine supports both from the start.

---

## 2. The one hard problem: selling by weight

Everything unusual in this build comes from per-kg pricing. Fish is not a
widget: what you pack is never exactly what was ordered, and the market price
moves every morning.

**Rules the system enforces:**

1. **Money is integers.** All amounts stored in **kobo** (`BIGINT`). Never a
   float anywhere near a price. Weights stored in **grams** (`INTEGER`), never
   `2.5` as a float.
2. **Order weight vs packed weight.** Each order line carries
   `ordered_g` and, after packing, `actual_g`. The customer is charged on
   `actual_g`.
3. **Tolerance band: ±8%.** Packers cannot save a line outside the band without
   a supervisor override and a reason — that is the guardrail against shrinkage
   and against disputes.
4. **Reconciliation direction matters.**
   - Packed **under** → refund the difference to **store-credit wallet**
     (instant, no payment-gateway round-trip, and it brings the customer back).
     Cash refund on request.
   - Packed **over** → absorb it up to the 8% band. Never silently charge a
     card more than the authorised amount; that destroys trust and invites
     chargebacks.
5. **Price snapshot at order time.** `order_items.unit_price_kobo` is copied
   from the product at checkout. A price change tomorrow never re-prices
   yesterday's order.
6. **Stale-cart handling.** A cart holding a price older than today's publish
   shows a "today's price is ₦X" diff and requires an explicit re-accept before
   payment. Silent re-pricing at checkout is the fastest way to lose a customer.
7. **Prep surcharges are per-kg, not per-line.** Gutted & scaled, steaks,
   fillet each add a `surcharge_per_kg_kobo` to the effective unit price. The
   fillet yield loss is priced into the surcharge, not deducted from weight.
8. **Stock is in grams and reserved, not decremented.** Adding to cart places a
   soft reservation with a TTL (20 min); payment converts it to a hard
   decrement; expiry releases it. Without this, two customers buy the same last
   6 kg of prawns.

---

## 3. Lagos realities that shape the design

These are not garnish — each one changes a screen or a table.

| Reality | What it forces into the build |
|---|---|
| Cold chain is the whole product | Delivery **windows** not "3–5 days"; insulated-box messaging; a same-day **cut-off time** (11:00 AM) with a live countdown |
| Lagos geography is brutal | **Zone-based** delivery fees (Island / Lekki–Ajah / Mainland central / Outer), not distance maths. Third Mainland Bridge traffic makes promises unreliable |
| Addresses are unreliable | **Landmark field is required**, optional map pin, phone number required. A rider calls; they do not read a postcode |
| Phone-first, WhatsApp-native | **Phone OTP** as the primary auth; WhatsApp for order updates and support; click-to-chat everywhere |
| Nigerian fish names | Search must match **"apoda" → croaker, "titus" → mackerel, "ede" → shrimp, "panla" → hake, "osan" → red snapper, "shawa" → bonga, "isam" → periwinkle**. A synonym table, not just full-text search |
| Prepayment distrust | Reviews with verified-purchase badges, the weighing clip, a plain refund policy, and pay-on-delivery |
| Data is expensive, networks are slow | Aggressive image optimisation, PWA with an offline catalog, server-rendered pages, no heavy client bundles |
| Naira presentation | `₦` prefix, thousands separators, kobo hidden. `₦9,800/kg` |

---

## 4. UI/UX architecture

UI/UX is a primary requirement, so it is specified here alongside the data model
rather than left to implementation taste. Nothing below is decoration; each rule
exists because it makes a customer's path shorter or clearer.

**The target feeling:** simple, intuitive, premium, clean, fast, calm,
responsive, touch-friendly, consistent. A first-time customer should be able to
shop without instructions.

### 4.1 The glass rule

The design language is glass-based and operating-system-inspired, in ONEESTORE's
own identity — never a copy of another company's interface, icons or layouts.

**Glass only ever sits over content.** Navigation, floating controls, the bottom
nav, the cart drawer, customization panels, filters, modals, bottom sheets, order
tracking controls, selected states. Content areas — product grids, copy, tables,
forms — stay opaque and quiet so they can be scanned.

| Surface | Background | Blur | Border |
|---|---|---|---|
| Glass light | `rgba(247,245,240,.72)` | `blur(24px) saturate(160%)` | `1px rgba(255,255,255,.68)` |
| Glass dark | `rgba(11,43,46,.76)` | `blur(24px) saturate(140%)` | `1px rgba(255,255,255,.14)` |
| Sheet | `rgba(255,255,255,.86)` | `blur(32px) saturate(150%)` | top `1px rgba(255,255,255,.85)` |

Plus layered depth (`0 10px 34px rgba(11,43,46,.14)`) and an inset top highlight.
Where `backdrop-filter` is unsupported, opacity rises to `.96`. **Glass never
reduces readability** — text on glass stays full-opacity ink and is checked at
4.5:1 against the lightest thing that can pass behind it. Glass does not carry
body copy, and it is not applied everywhere.

### 4.2 Colour and type

| Token | Hex | Use |
|---|---|---|
| Salt | `#F7F5F0` | page ground |
| Abyss | `#0B2B2E` | ink, dark glass, nav |
| Lagoon | `#0F5D57` | selection, links, icons |
| Clay | `#C64A26` | the one primary action |
| Reef | `#1C6B4A` | available, confirmed |
| Amber | `#92500C` on `#FBEFD8` | cut-off, weight policy |
| Line | `#E2DED4` | borders |

**Fraunces** (display serif) for headings and storefront prices; **Plus Jakarta
Sans** for body, UI and every admin numeral. The wordmark is sans, wide-tracked.

### 4.3 Action hierarchy

Every screen has one obvious primary action. Buttons are never equal weight.

- **Primary** — filled Clay, elevated. One per screen. (`Add to Basket`)
- **Secondary** — outlined, ink. (`Save`)
- **Tertiary** — text only, Lagoon. (`Ask about this seafood`)

Six facts must read fast wherever they are relevant: **price, availability,
weight, preparation, delivery, total.**

### 4.4 Navigation

**Desktop:** ONEESTORE logo · Shop · Build Your Box · Shop by Meal · Fresh
Promise · Search · Account · Cart.

**Mobile:** a floating glass bottom bar — **Home · Shop · Search · Orders ·
Cart**. Not the desktop list shrunk; the rest lives in bottom sheets and
contextual menus. Important actions sit within thumb reach, never stacked at the
top of a tall screen.

Bottom sheets carry filters, customization, delivery date, cart preview, address
selection, sort and quick actions. Their desktop equivalents are popovers,
drawers and dialogs — desktop patterns are never forced onto mobile.

### 4.5 Search

Tapping Search opens a focused overlay, glass over the page behind it.

- **Idle:** search field, recent searches, popular seafood, categories.
- **Typing:** suggestions appear immediately with image, name, price, category.
  Typing `praw` surfaces Tiger Prawns, King Prawns, Brown Shrimps and the
  *Prawns & Shrimp* category.
- Matching runs over local names too — apoda, titus, ede, panla, osan.
- States cross-fade; the overlay never blanks between them.

### 4.6 Product customization — visual and progressive

No long form. Three numbered steps, each responding visibly:

1. **Choose weight** — `500g` `1kg` `2kg` `Custom`. Custom reveals a stepper.
2. **How should we prepare it?** — Whole · Cleaned · Filleted · Steak Cut, each
   showing its per-kg surcharge on the option itself, never revealed later.
3. **Anything else?** — head included, skin removed, scored for grilling. Free,
   and labelled as free.

Price, **prepared-weight estimate** and order summary update in real time.
Add to Cart stays reachable throughout via a sticky glass purchase bar.

**Quick-add** is silent only where a product needs no mandatory choice. Anything
requiring weight or preparation opens the customization bottom sheet instead of
adding an arbitrary configuration.

### 4.7 Adding to basket

Adding never redirects. The item animates into the cart, the badge responds, and
a lightweight toast — *Added to your basket* — offers *Continue Shopping* or
*View Basket*. Desktop uses a cart drawer; mobile a bottom sheet or full-screen
basket depending on space. Totals animate on quantity change.

### 4.8 Build Your Box — signature interaction

The box is drawn and fills as products go in: cells light up, the progress bar
moves, item count and total update, and the price tier changes (3 kg → 5%,
5 kg → 10%). Movement is spring-based and subtle. Drag is offered only where it
genuinely helps; **tap controls always exist as the accessible path**.

### 4.9 Shop by Meal

Large photography — Seafood Okra, Seafood Pasta, Pepper Soup, Seafood Boil.
Opening a meal reveals recommended seafood, serving estimate, quantities and an
estimated total, with **Build This Meal** as the primary action. The customer
edits the recommendation before anything reaches the basket.

### 4.10 Checkout

Five progressive steps, never one huge form: **Contact → Delivery → Schedule →
Payment → Review**, with progress shown and completed steps ticked. Entered
information survives moving between steps. Validation is inline and immediate,
never held back until submit.

Scheduling is a real date selector, not an HTML date input: a row of day cells
showing availability, with the active state animating and **unavailable days
explaining why** rather than silently greying out.

### 4.11 Order tracking

Seven stages: Order Confirmed → Sourcing Seafood → Quality Checked → Preparing →
Packed → Out for Delivery → Delivered. The current stage is visually distinct,
completed stages carry timestamps, and a status change animates the progress
rather than replacing the screen.

### 4.12 Motion system

One shared set of tokens, not per-component invention.

| Token | Duration | Easing | For |
|---|---|---|---|
| `--m-fast` | 120ms | `cubic-bezier(.2,0,0,1)` | press, toggle, pill snap, hover |
| `--m-standard` | 220ms | `cubic-bezier(.2,0,0,1)` | selection, badge, inline validation |
| `--m-page` | 320ms | `cubic-bezier(.32,.72,0,1)` | card → detail, cart → checkout |
| `--m-spring` | 420ms | `cubic-bezier(.34,1.56,.64,1)` | box fill, cart badge, confirm pulse |
| `--m-modal` | 280ms | `cubic-bezier(.32,.72,0,1)` | dialog, search overlay |
| `--m-sheet` | 300ms | `cubic-bezier(.32,.72,0,1)` | bottom sheet, drawer |
| `--m-exit` | 160ms | `cubic-bezier(.4,0,1,1)` | every dismissal |

Motion serves state change, navigation, selection, feedback, hierarchy and
continuity — never decoration. **Only `transform` and `opacity`.** Under
`prefers-reduced-motion` every token collapses to an 80ms opacity fade: state
still confirms, nothing travels. Motion is tested on a low-powered Android
handset, not only on a laptop.

Micro-interactions are owed to buttons, tabs, product selection, weight and
preparation selection, favourites, cart, quantity controls, search, filters,
checkout, order status and form validation — and none of them may feel slow.

### 4.13 Feedback and states

Buttons carry **default, hover, pressed, focus, loading, success, disabled**.
Submitting shows its own progression — `Place Order → Processing… → Order
Confirmed` — and duplicate submission is blocked. No full-screen spinners:
skeleton product and order cards, progress indicators, and optimistic updates
where safe, with layout held steady so nothing jumps.

Transitions between related views are subtle and quick: product card → details,
product → customization, cart → checkout, order list → order details, meal →
meal builder. Nothing theatrical.

Gestures — swipe to close a drawer or sheet, horizontal category and date
browsing — are supported but **never required**; a visible control always exists.
Since web haptics are unreliable, the same reassurance is carried visually: a
small scale response, a selection snap, a confirmation pulse. No unsupported
browser hacks.

### 4.14 Context-aware interface

Show controls only when they are useful. No cart → no checkout controls. Prep
required → prep options appear. Unavailable zone → explain it and offer
alternatives. Returning customer → *Order Again*, saved address, usual
preparation. New customer → discovery and guidance. **Never preselect a paid
option without making it obvious.**

Customers never see internal complexity — procurement, supplier management,
preparation workflow. ONEESTORE absorbs that.

### 4.15 Empty, error and success states

Empty states move the customer forward: *"Your basket is empty. Fresh seafood is
waiting." → Browse Seafood.* Favourites: *"Nothing saved yet. Save seafood you
love and find it here later."* Errors say what happened and what to do —
*"We couldn't confirm this delivery address. Check the address or select another
Lagos delivery area"*, never `Error 422` — and input is preserved. Order
completion gets a proper confirmation screen: order number, delivery date,
amount, delivery location, *Track Order*, *Continue Shopping*.

### 4.16 Components

Built once, reused, variants documented: `Button`, `IconButton`, `Card`,
`GlassSurface`, `BottomSheet`, `Drawer`, `Dialog`, `ProductCard`, `Price`,
`Badge`, `SegmentedControl`, `QuantitySelector`, `WeightSelector`,
`PreparationSelector`, `DateSelector`, `Timeline`, `EmptyState`, `Skeleton`,
`Toast`, `SearchOverlay`.

Product cards stay simple — image, name, price, unit, availability — and are not
overcrowded. Hover reveals secondary actions on devices that support it; tapping
stays predictable on mobile.

### 4.17 Admin, held to the same standard

Admin answers five questions fast: what needs attention, what needs sourcing,
what needs preparation, what goes out today, are there customer problems.
Actionable information over decorative charts. Command-style quick actions —
Add Product, Update Prices, Find Order, Create Delivery Zone, View Procurement.
**Admin works on a phone**: complex tables become cards, not shrunken tables,
with the important actions still reachable.

### 4.18 Responsive review protocol

No screen is complete until reviewed at **375, 430, 768, 1024 and 1440**,
checking overflow, touch targets, text wrapping, spacing, images, navigation,
sticky elements, bottom sheets, forms, loading states and animations.

### 4.19 Photography

The make-or-break asset. Seafood shot on ice, overhead, in daylight, consistent
crop, one treatment across the catalog. Every image area in the mockups is a
labelled placeholder. Budget a shoot before launch — stock photos of salmon
fillets would actively undermine the Fresh Promise.

### 4.20 Screen inventory

Every screen below is drawn on the canvas. Six are live prototypes — their
controls work, so the interaction can be judged rather than imagined.

| Group | Screens |
|---|---|
| Foundations | Design system (glass, motion, components, states) |
| Shop | Home · **Search** · Shop · **Filters sheet** · **Product** · **Quick-add sheet** |
| Box & meals | **Build Your Box** · Shop by Meal · **Meal builder** |
| Buy | Basket · Checkout (5 steps) · Order confirmed · Order tracking (7 stages) |
| Desktop | Storefront · Cart drawer with toast |
| Operations | Prices, stock & packing queue · Admin on a phone |

**Bold** = live prototype. Flow is wired end to end: Home → Shop → Filters →
Product → Basket → Checkout → Order confirmed → Tracking, with Build Your Box
and Shop by Meal → Meal builder as the two alternative entry paths.

### 4.20 The bar

The finished product should make buying seafood simpler than a phone call, a
WhatsApp message, an Instagram DM or a trip to the market. A customer should
quickly know what is available, what it costs, how much they are buying, how it
will be prepared, when it will arrive, and what stage their order is at.

---

## 5. Function map

### Must have to take a real order (v1)

**Signature experiences**
- **Build Your Box** — box state, weight tiers (3 kg → 5%, 5 kg → 10%), live fill
- **Shop by Meal** — meals with recommended seafood and serving maths, editable
  before it reaches the basket
- **Fresh Promise** — the trust page the whole proposition rests on
- **Search overlay** — recent, popular, categories, live suggestions over local names

**Catalog & pricing**
- Products with `price_per_kg_kobo`, `min_order_g`, `step_g`, `stock_g`
- Prep variants with per-kg surcharge; size grades
- Categories; search with a Nigerian-name synonym table
- Daily price publish with full `price_history` and an audit trail
- Availability states: available today / pre-order tomorrow / hidden

**Cart & checkout**
- Weight-based cart; guest carts (cookie) and persisted carts (DB)
- **Guest checkout** — never force signup before a first order
- Zone-based delivery fee engine; free delivery threshold
- Slot picker with same-day cut-off and per-zone capacity
- Stock reservation with TTL
- Paystack: initialise → pay → **webhook-verified** → order created
- Pay on delivery, gated behind a verified phone number
- Idempotency keys on order creation (double-tap on 3G is guaranteed)

**Accounts**
- Phone OTP (Termii or Africa's Talking), email/password fallback, Google OAuth
- Address book with landmark + optional geo pin
- Order history, one-tap reorder
- Wallet / store-credit ledger (append-only)

**Orders & ops**
- State machine: `pending_payment → paid → packing → packed → dispatched →
  delivered`, plus `cancelled`, `refunded`, `on_hold`
- Packed-weight capture → automatic price adjustment → wallet credit
- Packing slips and a rider manifest
- Delivery OTP confirmation
- Notifications at each state: WhatsApp Cloud API, SMS fallback, email
- Quality complaint with photo upload, 2-hour window

**Design system (built before the screens that use it)**
- Tokens: colour, type, spacing, radii, glass surfaces, motion
- The 20 components in §4.16, with documented variants
- `prefers-reduced-motion` handling and the `backdrop-filter` fallback

**Admin**
- Role-based access: owner / manager / packer / rider
- The daily price & stock board
- Packing queue and order management
- Audit log on every price and order mutation

### Second wave (weeks after launch)

Reviews with verified-purchase badges and photos · recipe/blog content for SEO ·
loyalty points · referral links · abandoned-cart WhatsApp nudge · bundles and
subscriptions ("2 kg croaker every Friday") · restaurant/B2B
accounts with invoice terms · rider live location · multi-hub inventory ·
Flutterwave as a second gateway · Lagos-wide → Ibadan/Abuja expansion.

### Non-functional

- SEO: `Product` + `LocalBusiness` schema, sitemap, per-product pages
- PWA with offline catalog; images in AVIF/WebP with explicit sizes
- Rate limiting on OTP and checkout endpoints; CSP; RLS on every table
- Analytics: Vercel Analytics + PostHog funnels
- Tests: **unit tests on the pricing and fee engine are non-negotiable**
  (this is where money bugs live), Playwright e2e on the checkout path
- Error tracking: Sentry

---

## 6. Data model (first cut)

```
products            id, slug, name, local_names[], category_id, description,
                    price_per_kg_kobo, min_order_g, step_g, stock_g,
                    size_grade, origin, is_live, availability, images[]
prep_options        id, product_id, name, surcharge_per_kg_kobo, sort
categories          id, slug, name, icon, sort
price_history       id, product_id, price_per_kg_kobo, effective_date,
                    published_by, published_at
inventory_moves     id, product_id, delta_g, reason, order_id, actor_id, at

customers           id, phone (unique), phone_verified_at, email, name,
                    wallet_balance_kobo
addresses           id, customer_id, zone_id, street, landmark, lat, lng,
                    is_default
wallet_ledger       id, customer_id, delta_kobo, reason, order_id, at

delivery_zones      id, name, areas[], fee_kobo, free_threshold_kobo, is_active
delivery_slots      id, zone_id, date, window, capacity, booked, cutoff_at

carts               id, customer_id, session_token, expires_at
cart_items          id, cart_id, product_id, prep_option_id, weight_g,
                    unit_price_kobo_snapshot, reserved_until

orders              id, code, customer_id, address_id, slot_id, status,
                    subtotal_kobo, prep_kobo, delivery_kobo, discount_kobo,
                    wallet_applied_kobo, total_kobo, payment_method,
                    delivery_otp, placed_at
order_items         id, order_id, product_id, prep_option_id,
                    ordered_g, actual_g, unit_price_kobo, line_total_kobo
payments            id, order_id, provider, provider_ref, amount_kobo,
                    status, raw_webhook jsonb, verified_at
deliveries          id, order_id, rider_id, dispatched_at, delivered_at,
                    proof_photo_url
riders              id, name, phone, vehicle, plate, is_active

boxes               id, customer_id, cart_id, capacity_g, tier_discount_pct
box_items           id, box_id, product_id, prep_option_id, weight_g
meals               id, slug, name, hero_image, serves, description
meal_items          id, meal_id, product_id, suggested_g_per_serving, is_optional
saved_items         id, customer_id, product_id, saved_at
customer_prefs      id, customer_id, product_id, prep_option_id, options jsonb

reviews             id, product_id, customer_id, order_id, rating, body,
                    photos[], is_verified_purchase
promos              id, code, kind, value, min_order_kobo, uses, max_uses,
                    expires_at
admin_users         id, email, role
audit_log           id, actor_id, action, entity, entity_id, before, after, at
```

Two notes: `local_names[]` is what makes "apoda" find croaker, and
`audit_log` exists because price edits and weight overrides are exactly the
operations that will need explaining later.

---

## 7. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server rendering for SEO and slow networks; one deployable for storefront + admin + API routes |
| Styling | **Tailwind CSS** | Fast, and the token set above maps cleanly to a config |
| Database | **Supabase Postgres** with RLS | Managed Postgres, auth, storage and realtime in one; RLS keeps customer data isolated |
| Auth | Supabase Auth + phone OTP via **Termii** | Termii has better Nigerian SMS deliverability than generic providers |
| Payments | **Paystack** (inline + webhooks) | Nigerian rails, good docs, reliable webhooks |
| Images | Supabase Storage + Next `<Image>` | AVIF/WebP, sized variants |
| Messaging | **WhatsApp Cloud API**, SMS fallback | Where Lagos customers actually read updates |
| Hosting | **Vercel** | Zero-config for Next.js; the repo already has a Vercel setup pattern |
| Errors / analytics | Sentry + PostHog | |

Paystack webhooks must be verified by HMAC signature and processed
idempotently. An order is only `paid` when the webhook says so — never on the
client's success callback.

---

## 8. Milestones

| # | Deliverable | Notes |
|---|---|---|
| **M0** | Repo, Next.js + Tailwind + Supabase skeleton, **design tokens and the component library** (§4.16), motion tokens, glass surfaces | The system is built first — §4 is the spec. Every component reviewed at all five breakpoints |
| **M1** | Storefront read path: home, catalog, product with 3-step customization, search overlay with synonyms | Real data from Supabase, no writes |
| **M2** | Weight cart + pricing engine + **unit tests on the money maths** | The engine is pure and tested before any UI depends on it |
| **M3** | Auth (phone OTP), addresses, zones, slots, cut-off logic | |
| **M4** | Checkout + Paystack + webhooks + order state machine + emails | First real order possible at the end of this |
| **M5** | Admin: price & stock board, packing queue with weight capture, wallet refunds, rider manifest | The business cannot operate without M5 |
| **M6** | Build Your Box, Shop by Meal, Fresh Promise page | The signature experiences, once the engine underneath them is proven |
| **M6b** | WhatsApp/SMS notifications, reviews, promos, wallet UI | |
| **M7** | SEO, recipe content, PWA, load testing, launch hardening | |

M2 before M3 is deliberate: the pricing engine is the highest-risk code in the
project and it needs to be correct in isolation, not debugged through a UI.
M0 before everything is the other deliberate choice — the brief is explicit that
the experience is architecture, and a component library retrofitted after the
screens is how interfaces end up inconsistent.

---

## 9. Off-code work that blocks launch

Flagging these because they gate go-live regardless of how the code goes:

- **CAC registration** — Paystack needs a registered business (with a corporate
  bank account) for a full business account and settlements. The starter tier
  works for testing; do not discover this in launch week.
- **Lagos State food-handling permit** for the cold room / packing space.
  (NAFDAC registration applies to packaged processed products, not fresh fish
  retail — worth confirming with a consultant if you later sell packaged
  smoked fish.)
- **Cold room + certified weighing scale.** The scale is a product feature, not
  just equipment; the trust story depends on it being calibrated.
- **Supply relationships** at Epe / Badagry / Makoko, and a daily price-discovery
  routine — someone has to walk the market or call by 5:30 AM.
- **Rider capacity** — own riders or a partner, plus a cash-reconciliation
  process for pay-on-delivery.
- **NDPR / Nigeria Data Protection Act 2023** compliance: privacy policy,
  lawful basis, and a data-protection filing if you cross the threshold.
- **Terms, refund and quality-guarantee policies**, written before the first
  complaint rather than after.
- **Product photography** — half a day, consistent lighting, every SKU.

---

## 10. Open questions

1. **Repo name** for the new repository.
2. **Delivery fleet**: own riders, or a partner (Gokada/Kwik-style) for v1?
   This changes the rider and delivery tables.
3. **Fee values**: the zone fees, ±8% band, 11:00 AM cut-off and ₦100,000
   free-delivery threshold in the mockups are plausible placeholders. Your real
   numbers should replace them before M1.
4. **B2B from the start?** Restaurants and party caterers are the highest-value
   segment, but invoice terms and bulk pricing add real scope. Currently
   scheduled as second-wave.
5. **Catalog breadth at launch** — 14 kinds is shown. Fewer SKUs done reliably
   beats a wide catalog that is half out of stock.
6. **Box tiers** — 3 kg → 5% and 5 kg → 10% are placeholders. They need to come
   out of your real margins before Build Your Box ships.
7. **Meal list** — Seafood Okra, Pasta, Pepper Soup and Boil are a starting set.
   Which meals actually sell in Lagos is your call, and the serving maths per
   meal needs your input.

---

*All figures, product names, prices, ratings and customer details in the
mockups and in this document are placeholder sample data for design purposes.*
