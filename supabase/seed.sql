-- ONEESTORE — the catalog, generated from src/lib/seed.ts.
--
-- Regenerate with: npm run seed:sql
-- Prices and stock here are PLACEHOLDERS. Set the real ones on the price
-- board once the shop is running; this file is only what a fresh project
-- starts from.

begin;

insert into categories (slug, name, sort) values
  ('fresh-fish', 'Fresh Fish', 0),
  ('prawns-shrimp', 'Prawns & Shrimp', 1),
  ('shellfish', 'Shellfish', 2),
  ('smoked-dried', 'Smoked & Dried', 3)
on conflict (slug) do nothing;

insert into delivery_zones (id, name, areas, fee_kobo) values
  ('island', 'Lagos Island', ARRAY['Victoria Island', 'Ikoyi', 'Lekki Phase 1']::text[], 250000),
  ('lekki-ajah', 'Lekki – Ajah', ARRAY['Sangotedo', 'Awoyaya', 'Ajah']::text[], 350000),
  ('mainland-central', 'Mainland central', ARRAY['Ikeja', 'Yaba', 'Surulere', 'Maryland']::text[], 200000),
  ('outer', 'Outer Lagos', ARRAY['Ikorodu', 'Alimosho', 'Epe', 'Badagry']::text[], 450000)
on conflict (id) do nothing;

insert into products (slug, name, local_names, category_slug, description, price_per_kg_kobo, min_order_g, step_g, stock_g, availability, size_grade, origin, unit_weight_g) values
  ('croaker', 'Croaker', ARRAY['apoda']::text[], 'fresh-fish', 'Firm white flesh with a mild, slightly sweet taste — the Lagos standard for pepper soup, and it holds together on the grill.', 980000, 500, 250, 24000, 'today', '0.8–1.4 kg each', 'Epe jetty', 1100),
  ('red-snapper', 'Red Snapper', ARRAY['eja osan', 'osan']::text[], 'fresh-fish', 'Line-caught, sweet and clean. The fish to use when the dish is meant to impress.', 1250000, 500, 250, 11000, 'today', '1–2 kg each', 'Badagry', 1400),
  ('titus', 'Titus', ARRAY['mackerel', 'shawa titus']::text[], 'fresh-fish', 'Rich, oily mackerel. Grills beautifully and forgives a hot pan.', 620000, 500, 250, 70000, 'today', 'Grade A', 'Atlantic, frozen at sea', 450),
  ('catfish', 'Catfish', ARRAY['point and kill', 'obokun']::text[], 'fresh-fish', 'Live until you order it. The backbone of a proper catfish pepper soup.', 540000, 500, 250, 32000, 'today', '1–1.8 kg each', 'Ikorodu ponds', 1400),
  ('tilapia', 'Tilapia', ARRAY['epiya']::text[], 'fresh-fish', 'Mild and lean, farmed in Ikorodu. Good for anyone who finds mackerel too strong.', 590000, 500, 250, 18000, 'today', '0.5–0.9 kg each', 'Ikorodu ponds', 700),
  ('tiger-prawns', 'Tiger Prawns', ARRAY['ede', 'jumbo prawns']::text[], 'prawns-shrimp', 'Head-on jumbo prawns. Sweet, meaty, and the reason people order seafood at all.', 1850000, 500, 250, 6000, 'today', 'Jumbo, head-on', 'Lagos lagoon', null),
  ('brown-shrimps', 'Brown Shrimps', ARRAY['ede', 'shrimps']::text[], 'prawns-shrimp', 'Small, intensely flavoured shrimps. What okra soup is actually asking for.', 1100000, 500, 250, 14000, 'today', 'Small', 'Makoko', null),
  ('blue-crab', 'Blue Crab', ARRAY['akan', 'crab']::text[], 'shellfish', 'Live lagoon crab. Sweet meat, and the shells make the stock worth making.', 840000, 500, 250, 9000, 'today', 'Medium', 'Lagos lagoon', 220),
  ('panla', 'Panla', ARRAY['hake', 'stockfish', 'panla gbigbe']::text[], 'smoked-dried', 'Dried hake, split and ready for the pot. Keeps for weeks in a dry cupboard.', 760000, 500, 250, 26000, 'today', 'Split', 'Dried in Lagos', null),
  ('bonga', 'Bonga', ARRAY['shawa', 'smoked shawa']::text[], 'smoked-dried', 'Smoked over firewood the traditional way. Deep, smoky, and ready to eat.', 890000, 500, 250, 4000, 'tomorrow', 'Medium', 'Makoko smokehouse', 300)
on conflict (slug) do nothing;

insert into prep_options (product_id, key, name, surcharge_per_kg_kobo, yield_bps, sort)
select p.id, v.key, v.name, v.surcharge, v.yield_bps, v.sort from products p join (values
  ('croaker', 'whole', 'Whole', 0, 10000, 0),
  ('croaker', 'cleaned', 'Cleaned', 50000, 8800, 1),
  ('croaker', 'filleted', 'Filleted', 120000, 5200, 2),
  ('croaker', 'steak-cut', 'Steak Cut', 70000, 8500, 3),
  ('red-snapper', 'whole', 'Whole', 0, 10000, 0),
  ('red-snapper', 'cleaned', 'Cleaned', 50000, 8800, 1),
  ('red-snapper', 'filleted', 'Filleted', 120000, 5200, 2),
  ('red-snapper', 'steak-cut', 'Steak Cut', 70000, 8500, 3),
  ('titus', 'whole', 'Whole', 0, 10000, 0),
  ('titus', 'cleaned', 'Cleaned', 50000, 8800, 1),
  ('catfish', 'whole', 'Whole', 0, 10000, 0),
  ('catfish', 'cleaned', 'Cleaned', 50000, 8800, 1),
  ('catfish', 'steak-cut', 'Steak Cut', 70000, 8500, 2),
  ('tilapia', 'whole', 'Whole', 0, 10000, 0),
  ('tilapia', 'cleaned', 'Cleaned', 50000, 8800, 1),
  ('tilapia', 'filleted', 'Filleted', 120000, 5200, 2),
  ('tiger-prawns', 'shell-on', 'Shell on', 0, 10000, 0),
  ('tiger-prawns', 'peeled', 'Peeled & deveined', 90000, 6000, 1),
  ('tiger-prawns', 'whole', 'Whole', 0, 10000, 2),
  ('brown-shrimps', 'shell-on', 'Shell on', 0, 10000, 0),
  ('brown-shrimps', 'peeled', 'Peeled & deveined', 90000, 6000, 1),
  ('blue-crab', 'whole', 'Whole', 0, 10000, 0),
  ('blue-crab', 'cleaned', 'Cleaned', 50000, 8800, 1),
  ('panla', 'whole', 'Whole', 0, 10000, 0),
  ('bonga', 'whole', 'Whole', 0, 10000, 0)
) as v(slug, key, name, surcharge, yield_bps, sort) on v.slug = p.slug
on conflict (product_id, key) do nothing;

commit;
