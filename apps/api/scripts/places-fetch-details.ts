/**
 * Pide Details a Places API (New) para cada id del registry sin details.
 * Guarda progreso en el registry elegido.
 *
 * Uso:
 *   pnpm exec tsx scripts/places-fetch-details.ts
 *   pnpm exec tsx scripts/places-fetch-details.ts --zonas
 *   pnpm exec tsx scripts/places-fetch-details.ts --force   # re-pide todos
 *
 * Opcional:
 *   PLACES_DELAY_MS=400
 *   PLACES_REFERER=http://localhost:3000/
 *   PLACES_DETAILS_LIMIT=10  (solo N pendientes; útil para pruebas)
 *   PLACES_INSECURE_TLS=1
 */
import { config } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });
config({ path: path.resolve(__dirname, "../../app/.env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

const KEY =
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

if (!KEY) {
  console.error("Falta GOOGLE_MAPS_API_KEY (o NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)");
  process.exit(1);
}

// En algunos Windows (antivirus/proxy) el TLS de Node falla contra Google.
if (process.env.PLACES_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const FORCE = process.argv.includes("--force");
const USE_ZONAS = process.argv.includes("--zonas");
const USE_INTERIOR = process.argv.includes("--interior");
const DELAY_MS = Number(process.env.PLACES_DELAY_MS ?? 400);
const REFERER = process.env.PLACES_REFERER ?? "http://localhost:3000/";
const LIMIT = process.env.PLACES_DETAILS_LIMIT
  ? Number(process.env.PLACES_DETAILS_LIMIT)
  : Infinity;

const OUT_DIR = path.join(__dirname, "out");
const registryFile = USE_INTERIOR
  ? "places-registry-interior.json"
  : USE_ZONAS
    ? "places-registry-zonas.json"
    : "places-registry.json";
const REGISTRY_PATH = path.join(OUT_DIR, registryFile);

const DETAILS_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "rating",
  "userRatingCount",
  "regularOpeningHours",
  "currentOpeningHours",
  "businessStatus",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "editorialSummary",
].join(",");

type RegistryEntry = {
  id: string;
  name: string | null;
  formattedAddress: string | null;
  location: { latitude: number; longitude: number } | null;
  rating: number | null;
  userRatingCount: number | null;
  businessStatus: string | null;
  types: string[];
  queries: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  details: Record<string, unknown> | null;
  cleanReason?: string;
};

type Registry = {
  updatedAt: string;
  places: Record<string, RegistryEntry>;
};

function normalizeId(id: string): string {
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function barrioFromComponents(components: unknown): string | null {
  if (!Array.isArray(components)) return null;
  for (const c of components) {
    const types = (c as { types?: string[] }).types ?? [];
    if (
      types.includes("sublocality_level_1") ||
      types.includes("sublocality") ||
      types.includes("neighborhood")
    ) {
      return (c as { longText?: string }).longText ?? null;
    }
  }
  return null;
}

function pickRelevant(d: Record<string, unknown>) {
  const hours = d.regularOpeningHours as
    | { weekdayDescriptions?: string[]; openNow?: boolean }
    | undefined;
  const displayName = d.displayName as { text?: string } | undefined;
  const editorial = d.editorialSummary as { text?: string } | undefined;
  const primaryTypeDisplayName = d.primaryTypeDisplayName as
    | { text?: string; languageCode?: string }
    | string
    | undefined;
  const location = d.location as
    | { latitude?: number; longitude?: number }
    | undefined;

  const categoryLabel =
    typeof primaryTypeDisplayName === "string"
      ? primaryTypeDisplayName
      : (primaryTypeDisplayName?.text ?? null);

  return {
    id: normalizeId(String(d.id ?? "")),
    name: displayName?.text ?? null,
    formattedAddress: (d.formattedAddress as string | undefined) ?? null,
    barrio: barrioFromComponents(d.addressComponents),
    phone:
      (d.internationalPhoneNumber as string | undefined) ??
      (d.nationalPhoneNumber as string | undefined) ??
      null,
    website: (d.websiteUri as string | undefined) ?? null,
    mapsUrl: (d.googleMapsUri as string | undefined) ?? null,
    rating: (d.rating as number | undefined) ?? null,
    userRatingCount: (d.userRatingCount as number | undefined) ?? null,
    businessStatus: (d.businessStatus as string | undefined) ?? null,
    types: (d.types as string[] | undefined) ?? [],
    primaryType: (d.primaryType as string | undefined) ?? null,
    primaryTypeDisplayName: categoryLabel,
    editorialSummary: editorial?.text ?? null,
    openNow: hours?.openNow ?? null,
    weekdayHours: hours?.weekdayDescriptions ?? null,
    addressComponents: d.addressComponents ?? null,
    location:
      location?.latitude != null && location?.longitude != null
        ? { latitude: location.latitude, longitude: location.longitude }
        : null,
    fetchedAt: new Date().toISOString(),
  };
}

async function loadRegistry(): Promise<Registry> {
  const raw = await readFile(REGISTRY_PATH, "utf8");
  return JSON.parse(raw) as Registry;
}

async function saveRegistry(registry: Registry): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  registry.updatedAt = new Date().toISOString();
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf8");
}

async function placeDetails(placeId: string): Promise<Record<string, unknown>> {
  const resource = `places/${normalizeId(placeId)}`;
  const res = await fetch(`https://places.googleapis.com/v1/${resource}`, {
    headers: {
      "X-Goog-Api-Key": KEY!,
      "X-Goog-FieldMask": DETAILS_MASK,
      "Accept-Language": "es",
      Referer: REFERER,
    },
  });
  const data = (await res.json()) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      `details ${placeId}: ${res.status} ${data.error?.message ?? JSON.stringify(data)}`,
    );
  }
  return data;
}

async function main() {
  const registry = await loadRegistry();
  if (FORCE) {
    for (const p of Object.values(registry.places)) p.details = null;
  }
  const pending = Object.values(registry.places).filter((p) => !p.details);
  const already = Object.values(registry.places).length - pending.length;
  const toFetch = pending.slice(0, LIMIT);

  console.log(
    `→ Fetch Details${FORCE ? " (--force)" : ""}${USE_ZONAS ? " [--zonas]" : ""}${USE_INTERIOR ? " [--interior]" : ""}`,
  );
  console.log(`  registry: ${REGISTRY_PATH}`);
  console.log(`  con details: ${already}`);
  console.log(`  pendientes: ${pending.length}`);
  console.log(`  a pedir ahora: ${toFetch.length}`);
  console.log(`  delay: ${DELAY_MS}ms\n`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const entry = toFetch[i]!;
    process.stdout.write(
      `[${i + 1}/${toFetch.length}] ${entry.name ?? entry.id} … `,
    );
    try {
      const raw = await placeDetails(entry.id);
      const details = pickRelevant(raw);
      entry.details = details;
      // refrescar campos top-level útiles
      entry.name = details.name ?? entry.name;
      entry.formattedAddress =
        details.formattedAddress ?? entry.formattedAddress;
      entry.location = details.location ?? entry.location;
      entry.rating = details.rating ?? entry.rating;
      entry.userRatingCount =
        details.userRatingCount ?? entry.userRatingCount;
      entry.businessStatus =
        details.businessStatus ?? entry.businessStatus;
      entry.types = details.types.length ? details.types : entry.types;
      ok += 1;
      const cat = details.primaryTypeDisplayName ?? details.primaryType ?? "—";
      console.log(
        `OK · ${cat} · ${details.barrio ?? "sin barrio"} · ${details.phone ?? "sin tel"}`,
      );
    } catch (e) {
      fail += 1;
      console.log(`ERROR ${e instanceof Error ? e.message : e}`);
    }

    if ((i + 1) % 10 === 0 || i === toFetch.length - 1) {
      await saveRegistry(registry);
    }
    if (i < toFetch.length - 1) await sleep(DELAY_MS);
  }

  await saveRegistry(registry);

  const stillPending = Object.values(registry.places).filter(
    (p) => !p.details,
  ).length;
  console.log(`\n========== RESUMEN ==========`);
  console.log(`OK: ${ok} · fail: ${fail}`);
  console.log(`Pendientes restantes: ${stillPending}`);
  console.log(`✓ ${REGISTRY_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
