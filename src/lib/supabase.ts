import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The database connection, when there is one.
 *
 * Everything the shop holds — orders, the wallet, complaints, the price board
 * — currently lives in one browser's localStorage. That is not a decision, it
 * is a placeholder: a customer's wallet credit exists only on the device they
 * used, and a price published on a phone at the jetty never reaches anyone.
 *
 * This is the seam. With `NEXT_PUBLIC_SUPABASE_URL` and
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` set, `supabase()` returns a client; without
 * them it returns null and the app stays on its local stand-in rather than
 * crashing or, worse, silently losing writes.
 *
 * **The anon key is public** — it ships in the browser bundle and is meant to.
 * What protects the data is row-level security, which is why the migration
 * leaves no table in `public` without it. The *service* key is a different
 * thing entirely: it bypasses RLS, must never reach the browser, and is not
 * read here.
 */

let client: SupabaseClient | null = null;
let attempted = false;

export interface SupabaseConfig {
  readonly url: string;
  readonly anonKey: string;
}

export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof url !== "string" || url.trim() === "") return null;
  if (typeof anonKey !== "string" || anonKey.trim() === "") return null;

  return { url, anonKey };
}

export function isConfigured(): boolean {
  return supabaseConfig() !== null;
}

/**
 * The shared client, or null when the project is not configured.
 *
 * Created once: a new client per call opens a new realtime socket and a new
 * auth listener, which is how a page ends up holding forty of them.
 */
export function supabase(): SupabaseClient | null {
  if (attempted) return client;
  attempted = true;

  const config = supabaseConfig();
  if (config === null) return null;

  client = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return client;
}

/** Where the app is currently keeping things, in words for a screen. */
export function storageMode(): "supabase" | "this-browser" {
  return isConfigured() ? "supabase" : "this-browser";
}
