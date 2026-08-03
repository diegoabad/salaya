import { config } from "dotenv";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const { pingDb, closeDb, getDb } = await import("@repo/db");

try {
  console.log("DATABASE_URL set:", Boolean(process.env.DATABASE_URL));
  await pingDb();
  console.log("PING_OK");
  const db = getDb();
  const rows = await db.execute(
    sql`select id, hash, created_at from drizzle.__drizzle_migrations order by created_at`,
  );
  const list = (rows as { rows?: unknown[] }).rows ?? rows;
  console.log("count", Array.isArray(list) ? list.length : "?");
  console.log(JSON.stringify(list, null, 2));

  const invites = await db.execute(
    sql`select to_regclass('public.tenant_invites') as exists`,
  );
  console.log("tenant_invites", JSON.stringify((invites as { rows?: unknown[] }).rows ?? invites));
} catch (e) {
  console.error("ERR", e);
  process.exitCode = 1;
} finally {
  await closeDb();
}
