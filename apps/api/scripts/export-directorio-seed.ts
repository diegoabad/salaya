/**
 * Exporta directorio seed (Places) a JSON de respaldo.
 * Uso: pnpm exec tsx scripts/export-directorio-seed.ts
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const { closeDb, getDb, directorioEntradas } = await import("@repo/db");

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "out");
const OUT_FILE = resolve(OUT_DIR, "directorio-seed-backup.json");

const db = getDb();
const rows = await db.query.directorioEntradas.findMany({
  where: eq(directorioEntradas.plan, "seed"),
  orderBy: (d, { asc }) => [asc(d.name)],
});

const payload = {
  exportedAt: new Date().toISOString(),
  count: rows.length,
  places: rows.map((r) => ({
    id: r.id,
    googlePlaceId: r.googlePlaceId,
    name: r.name,
    slug: r.slug,
    zona: r.zona,
    address: r.address,
    description: r.description,
    telefono: r.telefono,
    lat: r.lat,
    lng: r.lng,
    ratingAvg: r.ratingAvg,
    ratingCount: r.ratingCount,
    horarios: r.horarios,
    plan: r.plan,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  })),
};

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
console.log(`OK ${payload.count} seeds → ${OUT_FILE}`);
await closeDb();
