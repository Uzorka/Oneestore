-- ONEESTORE — what the app learned after the first schema was written.
--
-- Everything here came out of running `0001` against a real Postgres and
-- comparing it with what the code actually does. Four of the five items are
-- corrections rather than additions.

-- ---------------------------------------------------------------------------
-- 1. The wallet balance was in two places
-- ---------------------------------------------------------------------------
--
-- `wallet_ledger` carries the comment "Balance is the sum of the ledger, never
-- a field someone edits" — and `customers.wallet_balance_kobo` was exactly
-- such a field. Two sources of truth for money drift, and the one that drifts
-- is the one the customer is shown.
--
-- The column goes. The balance is derived, and `customer_wallet_balances` is
-- the only thing that should ever be read for it.

alter table customers drop column if exists wallet_balance_kobo;

create or replace view customer_wallet_balances as
  select
    c.id as customer_id,
    coalesce(sum(w.delta_kobo), 0)::bigint as balance_kobo,
    max(w.created_at) as last_movement_at
  from customers c
  left join wallet_ledger w on w.customer_id = c.id
  group by c.id;

-- The ledger's reasons are an enumeration in the code; make the database
-- agree, so a typo cannot invent a kind of money movement.
alter table wallet_ledger
  add constraint wallet_reason_known
  check (reason in ('short_weight', 'complaint_refund', 'spent', 'goodwill'));

-- A movement of nothing is not a movement, and it clutters a ledger whose
-- whole job is explaining a number.
alter table wallet_ledger
  add constraint wallet_delta_not_zero check (delta_kobo <> 0);

-- ---------------------------------------------------------------------------
-- 2. Order history had nowhere to live
-- ---------------------------------------------------------------------------
--
-- The status machine records every move with a timestamp and sometimes a note;
-- the schema kept only the current status, so "when did this get packed?" was
-- unanswerable the moment it moved on.

create table order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  status      text not null check (status in (
                'pending_payment','paid','sourcing','quality_checked','preparing',
                'packed','dispatched','delivered','cancelled','refunded','on_hold')),
  note        text not null default '',
  actor       text not null default '',
  created_at  timestamptz not null default now()
);

create index order_events_by_order on order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. Reconciliation needs the rate that was authorised
-- ---------------------------------------------------------------------------
--
-- `discount_kobo` says how much came off, but settling a packed weight needs
-- the *rate* it was charged at. Without it, a line packed exactly to weight
-- reconciles against the undiscounted value and reads as money we absorbed.
--
-- It is stored, never recomputed: if packing under drops the basket below a
-- tier we do not claw the discount back, because that charges more than the
-- customer approved.

alter table orders add column if not exists discount_bps int not null default 0
  check (discount_bps >= 0 and discount_bps <= 10000);

-- ---------------------------------------------------------------------------
-- 4. "Tell us within 2 hours" had nowhere to be said
-- ---------------------------------------------------------------------------

create table complaints (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  customer_id      uuid not null references customers(id) on delete cascade,
  kind             text not null check (kind in (
                     'not_fresh','wrong_weight','wrong_item','missing_item','late','other')),
  detail           text not null default '',
  -- Which lines it is about. Empty means the order as a whole.
  order_item_ids   uuid[] not null default '{}',
  photo_paths      text[] not null default '{}',
  delivered_at     timestamptz not null,
  raised_at        timestamptz not null default now(),
  -- Whether it arrived inside the promised window. Stored rather than
  -- recomputed: the promise was measured at the time it was made.
  within_window    boolean not null,
  status           text not null default 'open'
                     check (status in ('open','needs_review','refunded','declined')),
  refunded_kobo    bigint not null default 0 check (refunded_kobo >= 0),
  -- A complaint cannot be turned down silently: the customer reads this.
  resolution_note  text not null default '',
  resolved_at      timestamptz,
  constraint declined_needs_a_reason
    check (status <> 'declined' or length(trim(resolution_note)) > 0),
  constraint refunded_needs_an_amount
    check (status <> 'refunded' or refunded_kobo > 0)
);

create index complaints_open_first on complaints (status, raised_at desc);
create unique index one_complaint_per_order on complaints (order_id);

-- ---------------------------------------------------------------------------
-- 5. Six tables were readable by anyone holding the anon key
-- ---------------------------------------------------------------------------
--
-- A table in `public` without row-level security is world-readable in
-- Supabase. `riders` and `deliveries` carry names, phone numbers and
-- addresses; `audit_log` carries everything. This was found by asking the
-- database which tables had RLS off, which is a question worth asking before
-- every deploy.

alter table audit_log       enable row level security;
alter table deliveries      enable row level security;
alter table inventory_moves enable row level security;
alter table price_history   enable row level security;
alter table promos          enable row level security;
alter table riders          enable row level security;

alter table order_events    enable row level security;
alter table complaints      enable row level security;

-- No policy at all means no access except the service role, which bypasses
-- RLS. That is the correct default for operational tables: the shop reaches
-- them through the server, never from a browser holding the anon key.
--
-- The two exceptions are things a customer must be able to see about
-- themselves.

create policy "a customer sees their own order history" on order_events
  for select using (
    order_id in (
      select o.id from orders o
      join customers c on c.id = o.customer_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "a customer sees their own complaints" on complaints
  for select using (
    customer_id in (select id from customers where auth_user_id = auth.uid())
  );

-- Raising one is the customer's to do; settling it is not.
create policy "a customer can raise a complaint" on complaints
  for insert with check (
    customer_id in (select id from customers where auth_user_id = auth.uid())
  );

-- A promo the shop is running is public; the rest of the table is not.
create policy "running promos are world readable" on promos
  for select using (true);
