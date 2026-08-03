/**
 * Restaura directorio seed desde out/directorio-seed-backup.json
 * Uso (apps/api): pnpm exec tsx scripts/import-directorio-seed-backup.ts
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const { closeDb, getDb, directorioEntradas } = await import("@repo/db");

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP = resolve(__dirname, "out/directorio-seed-backup.json");

type Row = {
  googlePlaceId: string | null;
  name: string;
  slug: string | null;
  zona: string | null;
  address: string | null;
  description: string | null;
  telefono: string | null;
  lat: string | null;
  lng: string | null;
  ratingAvg: string | null;
  ratingCount: number;
  horarios: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
};

const raw = JSON.parse(await readFile(BACKUP, "utf8")) as {
  count: number;
  places: Row[];
};

console.log(`→ Restore seed backup (${raw.places.length})`);

const db = getDb();
let inserted = 0;
let updated = 0;
let skipped = 0;

for (const p of raw.places) {
  if (!p.name?.trim()) {
    skipped += 1;
    continue;
  }
  if (!p.googlePlaceId) {
    skipped += 1;
    continue;
  }

  const existing = await db.query.directorioEntradas.findFirst({
    where: eq(directorioEntradas.googlePlaceId, p.googlePlaceId),
  });

  const values = {
    name: p.name.trim(),
    slug: p.slug,
    zona: p.zona,
    address: p.address,
    description: p.description,
    telefono: p.telefono,
    photoUrl: null as string | null,
    lat: p.lat,
    lng: p.lng,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount ?? 0,
    plan: "seed" as const,
    tenantId: null as string | null,
    optOut: false,
    googlePlaceId: p.googlePlaceId,
    horarios: p.horarios ?? [],
    cantidadSalas: 1,
    tagsDestacados: [] as string[],
    equipamiento: [] as string[],
    updatedAt: new Date(),
  };

  if (existing) {
    if (existing.tenantId) {
      skipped += 1;
      continue;
    }
    await db
      .update(directorioEntradas)
      .set(values)
      .where(eq(directorioEntradas.id, existing.id));
    updated += 1;
  } else {
    await db.insert(directorioEntradas).values({
      ...values,
      createdAt: new Date(),
    });
    inserted += 1;
  }
}

console.log(`Insertados: ${inserted}`);
console.log(`Actualizados: ${updated}`);
console.log(`Omitidos: ${skipped}`);
await closeDb();
