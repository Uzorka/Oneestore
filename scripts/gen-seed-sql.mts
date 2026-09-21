// Generate supabase/seed.sql from the same seed.ts the app ships with, so the
// two cannot drift.
import { writeFileSync } from "node:fs";

import { ZONES } from "../src/lib/delivery";
import { categories, products } from "../src/lib/seed";

const q = (s: unknown) => "'" + String(s).replace(/'/g, "''") + "'";
const arr = (a: readonly string[]) => "ARRAY[" + a.map(q).join(", ") + "]::text[]";

const lines: string[] = [];
lines.push(`-- ONEESTORE — the catalog, generated from src/lib/seed.ts.
--
-- Regenerate with: npm run seed:sql
-- Prices and stock here are PLACEHOLDERS. Set the real ones on the price
-- board once the shop is running; this file is only what a fresh project
-- starts from.

begin;
`);

lines.push("insert into categories (slug, name, sort) values");
lines.push(categories.map((c, i) => `  (${q(c.slug)}, ${q(c.name)}, ${i})`).join(",\n") + "\non conflict (slug) do nothing;\n");

lines.push("insert into delivery_zones (id, name, areas, fee_kobo) values");
lines.push(ZONES.map((z) => `  (${q(z.id)}, ${q(z.name)}, ${arr(z.areas)}, ${z.feeKobo})`).join(",\n") + "\non conflict (id) do nothing;\n");

lines.push("insert into products (slug, name, local_names, category_slug, description, price_per_kg_kobo, min_order_g, step_g, stock_g, availability, size_grade, origin, unit_weight_g) values");
lines.push(products.map((p) =>
  `  (${q(p.slug)}, ${q(p.name)}, ${arr(p.localNames)}, ${q(p.categorySlug)}, ${q(p.description ?? "")}, ` +
  `${p.pricePerKgKobo}, ${p.minOrderG}, ${p.stepG}, ${p.stockG}, ${q(p.availability)}, ` +
  `${q(p.sizeGrade ?? "")}, ${q(p.origin ?? "")}, ${p.unitWeightG ?? "null"})`
).join(",\n") + "\non conflict (slug) do nothing;\n");

// Preparations, attached to each product that offers them.
lines.push("insert into prep_options (product_id, key, name, surcharge_per_kg_kobo, yield_bps, sort)");
lines.push("select p.id, v.key, v.name, v.surcharge, v.yield_bps, v.sort from products p join (values");
const rows = [];
for (const p of products) {
  p.preps.forEach((prep, i) => {
    rows.push(`  (${q(p.slug)}, ${q(prep.id)}, ${q(prep.name)}, ${prep.surchargePerKgKobo}, ${prep.yieldBps}, ${i})`);
  });
}
lines.push(rows.join(",\n"));
lines.push(") as v(slug, key, name, surcharge, yield_bps, sort) on v.slug = p.slug");
lines.push("on conflict (product_id, key) do nothing;\n");
lines.push("commit;");

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), lines.join("\n") + "\n");
console.log("wrote supabase/seed.sql");
