import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export type Database = ReturnType<typeof createDb>;

let pool: pg.Pool | null = null;

export function createPool(connectionString: string, max = 10): pg.Pool {
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function createDb(connectionString: string, max = 10) {
  const p = createPool(connectionString, max);
  return drizzle(p, { schema });
}

/** Singleton para el proceso largo de `apps/api`. */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    pool = createPool(url);
  }
  return drizzle(pool, { schema });
}

export async function pingDb() {
  const db = getDb();
  await db.execute(sql`select 1`);
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
