-- ONEESTORE — initial schema.
--
-- Two conventions hold throughout, and the check constraints enforce them:
--   * money is BIGINT kobo, never numeric naira
--   * weight is INTEGER grams, never a float kilogram
--
-- Every table that holds customer data has row-level security enabled. The
-- storefront reads with the anon key; anything that writes an order or a packed
-- weight runs server-side with the service role.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table categories (
  slug        text primary key,
  name        text not null,
  sort        int  not null default 0
);

create table products (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  name                text not null,
  -- Nigerian and Yoruba names people search with: apoda, titus, ede, panla.
  local_names         text[] not null default '{}',
  category_slug       text not null references categories(slug),
  description         text not null default '',
  price_per_kg_kobo   bigint not null check (price_per_kg_kobo > 0),
  min_order_g         int not null check (min_order_g > 0),
  step_g              int not null check (step_g > 0),
  stock_g             int not null default 0 check (stock_g >= 0),
  availability        text not null default 'today'
                        check (availability in ('today', 'tomorrow', 'hidden')),
  size_grade          text not null default '',
  origin              text not null default '',
  unit_weight_g       int check (unit_weight_g is null or unit_weight_g > 0),
  images              text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- A minimum that is not a whole number of steps can never be ordered.
  constraint min_order_is_whole_steps check (min_order_g % step_g = 0)
);

create index products_category_idx on products (category_slug) where availability <> 'hidden';
create index products_local_names_idx on products using gin (local_names);

create table prep_options (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null references products(id) on delete cascade,
  key                     text not null,
  name                    text not null,
  surcharge_per_kg_kobo   bigint not null default 0 check (surcharge_per_kg_kobo >= 0),
  -- Share of raw weight left after preparation, in basis points.
  yield_bps               int not null default 10000 check (yield_bps between 1 and 10000),
  sort                    int not null default 0,
  unique (product_id, key)
);

-- Every published price, kept forever. Price changes are the operation most
-- likely to need explaining later.
create table price_history (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references products(id) on delete cascade,
  price_per_kg_kobo   bigint not null check (price_per_kg_kobo > 0),
  effective_date      date not null,
  published_by        uuid,
  published_at        timestamptz not null default now(),
  unique (product_id, effective_date)
);

create table inventory_moves (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  delta_g     int not null,
  reason      text not null,
  order_id    uuid,
  actor_id    uuid,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table customers (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid unique,
  phone               text unique not null,
  phone_verified_at   timestamptz,
  email               text,
  name                text,
  wallet_balance_kobo bigint not null default 0,
  created_at          timestamptz not null default now()
);

create table delivery_zones (
  id                    text primary key,
  name                  text not null,
  areas                 text[] not null default '{}',
  fee_kobo              bigint not null check (fee_kobo >= 0),
  free_threshold_kobo   bigint not null default 10000000,
  is_active             boolean not null default true
);

create table addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  zone_id      text not null references delivery_zones(id),
  street       text not null,
  -- Required, not optional: a Lagos rider calls and asks for the landmark.
  landmark     text not null,
  lat          double precision,
  lng          double precision,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Append-only. Balance is the sum of the ledger, never a field someone edits.
create table wallet_ledger (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  delta_kobo   bigint not null,
  reason       text not null,
  order_id     uuid,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table orders (
  id                   uuid primary key default gen_random_uuid(),
  code                 text unique not null,
  customer_id          uuid references customers(id),
  address_id           uuid references addresses(id),
  zone_id              text references delivery_zones(id),
  delivery_date        date,
  delivery_window      text,
  status               text not null default 'pending_payment' check (status in (
                         'pending_payment','paid','sourcing','quality_checked','preparing',
                         'packed','dispatched','delivered','cancelled','refunded','on_hold')),
  goods_kobo           bigint not null default 0,
  prep_kobo            bigint not null default 0,
  delivery_kobo        bigint not null default 0,
  discount_kobo        bigint not null default 0,
  wallet_applied_kobo  bigint not null default 0,
  total_kobo           bigint not null default 0,
  payment_method       text check (payment_method in ('paystack','on_delivery')),
  delivery_otp         text,
  placed_at            timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index orders_status_idx on orders (status, delivery_date);

create table order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id) on delete cascade,
  product_id            uuid not null references products(id),
  prep_option_id        uuid references prep_options(id),
  product_name          text not null,
  prep_name             text not null default '',
  ordered_g             int not null check (ordered_g > 0),
  -- Filled in at packing. Until then the order is priced on ordered_g.
  actual_g              int check (actual_g > 0),
  -- Snapshot: tomorrow's market never re-prices yesterday's order.
  unit_price_per_kg_kobo bigint not null check (unit_price_per_kg_kobo > 0),
  line_total_kobo       bigint not null check (line_total_kobo >= 0),
  -- A packed weight outside ±8% needs a supervisor, recorded here.
  override_reason       text,
  override_by           uuid
);

create table payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  provider      text not null default 'paystack',
  provider_ref  text unique,
  amount_kobo   bigint not null check (amount_kobo >= 0),
  status        text not null default 'pending'
                  check (status in ('pending','success','failed','refunded')),
  raw_webhook   jsonb,
  verified_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table riders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  vehicle    text,
  plate      text,
  is_active  boolean not null default true
);

create table deliveries (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  rider_id        uuid references riders(id),
  dispatched_at   timestamptz,
  delivered_at    timestamptz,
  proof_photo_url text
);

-- ---------------------------------------------------------------------------
-- Trust and growth
-- ---------------------------------------------------------------------------

create table reviews (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references products(id) on delete cascade,
  customer_id          uuid references customers(id),
  order_id             uuid references orders(id),
  rating               int not null check (rating between 1 and 5),
  body                 text,
  photos               text[] not null default '{}',
  is_verified_purchase boolean not null default false,
  created_at           timestamptz not null default now()
);

create table promos (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  kind            text not null check (kind in ('percent','fixed','free_delivery')),
  value           int not null default 0,
  min_order_kobo  bigint not null default 0,
  uses            int not null default 0,
  max_uses        int,
  expires_at      timestamptz
);

-- Price edits and weight overrides are exactly what needs explaining later.
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table customers     enable row level security;
alter table addresses     enable row level security;
alter table orders        enable row level security;
alter table order_items   enable row level security;
alter table wallet_ledger enable row level security;
alter table payments      enable row level security;
alter table reviews       enable row level security;

-- The catalog is public to read; only the service role writes it.
alter table products      enable row level security;
alter table categories    enable row level security;
alter table prep_options  enable row level security;
alter table delivery_zones enable row level security;

create policy "catalog is world readable" on products
  for select using (availability <> 'hidden');
create policy "categories are world readable" on categories
  for select using (true);
create policy "prep options are world readable" on prep_options
  for select using (true);
create policy "active zones are world readable" on delivery_zones
  for select using (is_active);

create policy "a customer sees only themselves" on customers
  for select using (auth_user_id = auth.uid());

create policy "a customer sees only their addresses" on addresses
  for all using (
    customer_id in (select id from customers where auth_user_id = auth.uid())
  );

create policy "a customer sees only their orders" on orders
  for select using (
    customer_id in (select id from customers where auth_user_id = auth.uid())
  );

create policy "a customer sees only their order items" on order_items
  for select using (
    order_id in (
      select o.id from orders o
      join customers c on c.id = o.customer_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "a customer sees only their wallet" on wallet_ledger
  for select using (
    customer_id in (select id from customers where auth_user_id = auth.uid())
  );

create policy "a customer sees only their payments" on payments
  for select using (
    order_id in (
      select o.id from orders o
      join customers c on c.id = o.customer_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "reviews are world readable" on reviews
  for select using (true);
