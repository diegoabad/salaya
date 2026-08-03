/**
 * Importa registry → directorio_entradas (plan=seed).
 * Solo entradas "keep" (cleanReason de sala/ensayo). Upsert por google_place_id.
 *
 * Uso (desde apps/api):
 *   pnpm exec tsx scripts/places-import-directorio.ts
 *   pnpm exec tsx scripts/places-import-directorio.ts --zonas
 *   pnpm exec tsx scripts/places-import-directorio.ts --interior
 *   pnpm exec tsx scripts/places-import-directorio.ts --all   # incluye review
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import {
  formatAddressClean,
  compText,
  type AddressComponent,
} from "./lib/format-address.js";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const { closeDb, getDb, directorioEntradas } = await import("@repo/db");

const __dirname = dirname(fileURLToPath(import.meta.url));
const useZonas = process.argv.includes("--zonas");
const useInterior = process.argv.includes("--interior");
const REGISTRY_PATH = resolve(
  __dirname,
  useInterior
    ? "out/places-registry-interior.json"
    : useZonas
      ? "out/places-registry-zonas.json"
      : "out/places-registry.json",
);
const includeReview = process.argv.includes("--all");
const addressRegion = useInterior
  ? ("interior" as const)
  : useZonas
    ? ("zonas" as const)
    : ("caba" as const);

const KEEP_REASONS = new Set([
  "nombre_ensayo",
  "estudio_grabacion",
  "nombre_salas",
  "manual_ok",
]);

type Details = {
  id?: string;
  name?: string | null;
  formattedAddress?: string | null;
  barrio?: string | null;
  phone?: string | null;
  website?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  businessStatus?: string | null;
  editorialSummary?: string | null;
  weekdayHours?: string[] | null;
  location?: { latitude: number; longitude: number } | null;
  addressComponents?: AddressComponent[] | null;
  addressClean?: string | null;
};

type RegistryEntry = {
  id: string;
  name: string | null;
  formattedAddress: string | null;
  location: { latitude: number; longitude: number } | null;
  rating: number | null;
  userRatingCount: number | null;
  businessStatus: string | null;
  cleanReason?: string;
  details: Details | null;
  queries?: string[];
};

type Registry = { places: Record<string, RegistryEntry> };

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function zonaFromEntry(e: RegistryEntry): string | null {
  const d = e.details;
  if (d?.barrio?.trim()) return d.barrio.trim();
  const locality = compText(
    d?.addressComponents,
    "locality",
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "administrative_area_level_2",
  );
  if (locality && !/^[A-Z]?\d{4}/i.test(locality)) return locality;
  // fallback: query "kw|Localidad|zona"
  const qs = e.queries ?? [];
  for (let i = qs.length - 1; i >= 0; i--) {
    const parts = qs[i]!.split("|");
    if (parts.length >= 2 && parts[1] && parts[1] !== "CABA") {
      return parts[1]!;
    }
  }
  return null;
}

function descriptionFromDetails(d: Details | null): string | null {
  if (!d) return null;
  const parts: string[] = [];
  if (d.editorialSummary?.trim()) parts.push(d.editorialSummary.trim());
  if (d.website?.trim()) parts.push(`Web: ${d.website.trim()}`);
  return parts.length ? parts.join("\n\n") : null;
}

/** 0=domingo … 6=sábado (igual que Date#getDay / horarios_atencion) */
const DAY_NAME_TO_DOW: Record<string, number> = {
  domingo: 0,
  sunday: 0,
  lunes: 1,
  monday: 1,
  martes: 2,
  tuesday: 2,
  miercoles: 3,
  wednesday: 3,
  jueves: 4,
  thursday: 4,
  viernes: 5,
  friday: 5,
  sabado: 6,
  saturday: 6,
};

function normalizeDayKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "lunes: 10:00–23:00" → { dayOfWeek, startTime, endTime }; cerrado se omite */
function parseWeekdayHours(
  lines: string[] | null | undefined,
): Array<{ dayOfWeek: number; startTime: string; endTime: string }> {
  if (!lines?.length) return [];
  const out: Array<{ dayOfWeek: number; startTime: string; endTime: string }> =
    [];

  for (const line of lines) {
    const m = line.match(/^([^:]+):\s*(.+)$/);
    if (!m) continue;
    const dow = DAY_NAME_TO_DOW[normalizeDayKey(m[1]!)];
    if (dow === undefined) continue;

    const rest = m[2]!.trim();
    const restNorm = normalizeDayKey(rest);
    if (/cerrado|closed/.test(restNorm)) continue;
    if (/24\s*horas|open\s*24|abierto\s*24/.test(restNorm)) {
      out.push({ dayOfWeek: dow, startTime: "00:00", endTime: "23:59" });
      continue;
    }

    const tm = rest.match(
      /(\d{1,2}):(\d{2})\s*(?:[–\-]|a)\s*(\d{1,2}):(\d{2})/i,
    );
    if (!tm) continue;
    const sh = Number(tm[1]);
    const sm = Number(tm[2]);
    const eh = Number(tm[3]);
    const em = Number(tm[4]);
    if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) continue;
    out.push({
      dayOfWeek: dow,
      startTime: `${pad2(sh)}:${pad2(sm)}`,
      endTime: `${pad2(eh)}:${pad2(em)}`,
    });
  }

  return out.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

async function main() {
  const raw = await readFile(REGISTRY_PATH, "utf8");
  const registry = JSON.parse(raw) as Registry;
  const all = Object.values(registry.places);

  const candidates = all.filter((e) => {
    if (!e.details) return false;
    if (e.details.businessStatus && e.details.businessStatus !== "OPERATIONAL") {
      return false;
    }
    if (includeReview) return true;
    return KEEP_REASONS.has(e.cleanReason ?? "");
  });

  console.log(
    `→ Import directorio seed${useInterior ? " [--interior]" : useZonas ? " [--zonas]" : ""}`,
  );
  console.log(`  registry: ${REGISTRY_PATH}`);
  console.log(`  registry total: ${all.length}`);
  console.log(`  a importar: ${candidates.length}${includeReview ? " (keep+review)" : " (solo keep)"}`);

  const db = getDb();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const e of candidates) {
    const d = e.details!;
    const name = (d.name ?? e.name ?? "").trim();
    if (!name) {
      skipped += 1;
      continue;
    }

    const googlePlaceId = e.id;
    const slugBase = slugify(name) || "sala";
    const slug = `${slugBase}-${googlePlaceId.slice(-8).toLowerCase()}`;
    const zona = zonaFromEntry(e);
    const address =
      d.addressClean?.trim() ||
      formatAddressClean(d, {
        region: addressRegion,
        barrioHint: zona,
      });
    const telefono = d.phone ?? null;
    const lat = d.location?.latitude ?? e.location?.latitude ?? null;
    const lng = d.location?.longitude ?? e.location?.longitude ?? null;
    const ratingAvg = d.rating ?? e.rating;
    const ratingCount = d.userRatingCount ?? e.userRatingCount ?? 0;
    const description = descriptionFromDetails(d);
    const horarios = parseWeekdayHours(d.weekdayHours);

    const existing = await db.query.directorioEntradas.findFirst({
      where: eq(directorioEntradas.googlePlaceId, googlePlaceId),
    });

    const values = {
      name,
      slug,
      zona,
      address,
      description,
      telefono,
      photoUrl: null as string | null,
      lat: lat != null ? String(lat) : null,
      lng: lng != null ? String(lng) : null,
      ratingAvg: ratingAvg != null ? String(ratingAvg) : null,
      ratingCount,
      plan: "seed" as const,
      tenantId: null as string | null,
      optOut: false,
      googlePlaceId,
      horarios,
      cantidadSalas: 1,
      tagsDestacados: [] as string[],
      equipamiento: [] as string[],
      updatedAt: new Date(),
    };

    if (existing) {
      // no pisar fichas ya reclamadas (tienen tenant)
      if (existing.tenantId) {
        skipped += 1;
        continue;
      }
      await db
        .update(directorioEntradas)
        .set(values)
        .where(eq(directorioEntradas.id, existing.id));
      updated += 1;
      console.log(`~ ${name} (${zona ?? "sin zona"})`);
    } else {
      await db.insert(directorioEntradas).values({
        ...values,
        createdAt: new Date(),
      });
      inserted += 1;
      console.log(`+ ${name} (${zona ?? "sin zona"})`);
    }
  }

  console.log(`\n========== RESUMEN ==========`);
  console.log(`Insertados: ${inserted}`);
  console.log(`Actualizados: ${updated}`);
  console.log(`Omitidos: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
