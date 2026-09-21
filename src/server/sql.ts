import { Pool } from "pg";
import type { PoolConfig } from "pg";

/**
 * Talking to Postgres.
 *
 * The repository never holds a connection — it is handed something that can
 * run a query. That is the whole point of `SqlExecutor`: in production it is a
 * `pg.Pool` against Supabase, and in the tests it is the same `pg.Pool` against
 * an in-process Postgres. The code under test is therefore the code that runs,
 * down to the wire protocol and the parameter binding, rather than a mock that
 * agrees with whatever the author assumed.
 *
 * This is server-only. `DATABASE_URL` is a secret and must never be prefixed
 * `NEXT_PUBLIC_`; importing this file from a component that runs in the browser
 * is a mistake the bundler will not catch for you.
 */

export interface SqlExecutor {
  query<T = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

/**
 * A transaction.
 *
 * Placing an order writes the order, its lines, its first event and possibly a
 * wallet movement. Half of that is worse than none of it: a customer whose
 * wallet was emptied by an order that did not save has lost money twice.
 */
export async function inTransaction<T>(
  pool: Pool,
  run: (tx: SqlExecutor) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

let cached: Pool | null = null;
let attempted = false;

export function databaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return typeof url === "string" && url.trim() !== "";
}

/**
 * The shared pool, or null when no database is configured.
 *
 * Created once. A pool per request exhausts Postgres' connection limit long
 * before it exhausts anything else, and Supabase's limit is not generous.
 */
export function pool(config: PoolConfig = {}): Pool | null {
  if (attempted) return cached;
  attempted = true;

  if (!databaseConfigured()) return null;

  cached = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase terminates idle connections; keeping a small pool with a short
    // idle timeout avoids handing out a socket the server has already closed.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ...config,
  });

  return cached;
}

/** For tests, which bring their own database. */
export function resetPool(): void {
  cached = null;
  attempted = false;
}
