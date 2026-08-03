/**
 * Colecta place_ids (Places API New) sin llamar Details.
 *
 * Filtro: palabra clave + barrio + businessStatus OPERATIONAL.
 * Persistencia: scripts/out/places-registry.json (dedupe global por id).
 *
 * Uso:
 *   GOOGLE_MAPS_API_KEY=... pnpm exec tsx scripts/places-collect-ids.ts "sala de ensayo" Flores
 *   GOOGLE_MAPS_API_KEY=... pnpm exec tsx scripts/places-collect-ids.ts "sala de musica" Caballito
 *
 * Key con restricción "Sitios web" → Referer localhost (PLACES_REFERER opcional).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEY =
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

if (!KEY) {
  console.error("Falta GOOGLE_MAPS_API_KEY (o NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)");
  process.exit(1);
}

const keyword = (process.argv[2]?.trim() || "sala de ensayo").replace(/\s+/g, " ");
const barrio = (process.argv[3]?.trim() || "").replace(/\s+/g, " ");

if (!barrio) {
  console.error(
    'Uso: pnpm exec tsx scripts/places-collect-ids.ts "<palabra clave>" <barrio>',
  );
  console.error('Ej:  pnpm exec tsx scripts/places-collect-ids.ts "sala de ensayo" Flores');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "out");
const REGISTRY_PATH = path.join(OUT_DIR, "places-registry.json");
const REFERER = process.env.PLACES_REFERER ?? "http://localhost:3000/";

type PlaceHit = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
};

type RegistryEntry = {
  id: string;
  name: string | null;
  formattedAddress: string | null;
  location: { latitude: number; longitude: number } | null;
  rating: number | null;
  userRatingCount: number | null;
  businessStatus: string | null;
  types: string[];
  /** Búsquedas que lo encontraron: "keyword|barrio" */
  queries: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  /** null hasta la pasada de details */
  details: Record<string, unknown> | null;
};

type Registry = {
  updatedAt: string;
  places: Record<string, RegistryEntry>;
};

const textQuery = `${keyword} ${barrio} CABA`;
const queryKey = `${keyword}|${barrio}|CABA`;

const SEARCH_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
].join(",");

function normalizeId(id: string): string {
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

function isOperational(status?: string): boolean {
  return status === "OPERATIONAL";
}

async function loadRegistry(): Promise<Registry> {
  try {
    const raw = await readFile(REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(raw) as Registry;
    if (!parsed.places || typeof parsed.places !== "object") {
      return { updatedAt: new Date().toISOString(), places: {} };
    }
    // migrate old shape (zonas → queries) if needed
    for (const p of Object.values(parsed.places)) {
      const anyP = p as RegistryEntry & { zonas?: string[] };
      if (!anyP.queries) anyP.queries = [];
      if (Array.isArray(anyP.zonas)) {
        for (const z of anyP.zonas) {
          const q = `legacy|${z}`;
          if (!anyP.queries.includes(q)) anyP.queries.push(q);
        }
        delete anyP.zonas;
      }
      if (anyP.businessStatus === undefined) anyP.businessStatus = null;
      if (anyP.details === undefined) anyP.details = null;
    }
    return parsed;
  } catch {
    return { updatedAt: new Date().toISOString(), places: {} };
  }
}

async function saveRegistry(registry: Registry): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  registry.updatedAt = new Date().toISOString();
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf8");
}

async function searchText(query: string): Promise<PlaceHit[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY!,
      "X-Goog-FieldMask": SEARCH_MASK,
      Referer: REFERER,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "es",
      regionCode: "AR",
      maxResultCount: 20,
    }),
  });

  const data = (await res.json()) as {
    places?: PlaceHit[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      `searchText "${query}": ${res.status} ${data.error?.message ?? JSON.stringify(data)}`,
    );
  }
  return data.places ?? [];
}

function upsertHit(
  registry: Registry,
  hit: PlaceHit,
  now: string,
): "new" | "known" {
  const id = normalizeId(hit.id);
  const existing = registry.places[id];
  if (existing) {
    existing.lastSeenAt = now;
    if (!existing.queries.includes(queryKey)) existing.queries.push(queryKey);
    existing.name = hit.displayName?.text ?? existing.name;
    existing.formattedAddress =
      hit.formattedAddress ?? existing.formattedAddress;
    existing.location = hit.location ?? existing.location;
    existing.rating = hit.rating ?? existing.rating;
    existing.userRatingCount =
      hit.userRatingCount ?? existing.userRatingCount;
    existing.businessStatus =
      hit.businessStatus ?? existing.businessStatus;
    existing.types = hit.types?.length ? hit.types : existing.types;
    return "known";
  }

  registry.places[id] = {
    id,
    name: hit.displayName?.text ?? null,
    formattedAddress: hit.formattedAddress ?? null,
    location: hit.location ?? null,
    rating: hit.rating ?? null,
    userRatingCount: hit.userRatingCount ?? null,
    businessStatus: hit.businessStatus ?? null,
    types: hit.types ?? [],
    queries: [queryKey],
    firstSeenAt: now,
    lastSeenAt: now,
    details: null,
  };
  return "new";
}

async function main() {
  const registry = await loadRegistry();
  const knownBefore = Object.keys(registry.places).length;

  console.log(`→ Collect IDs (sin Details)`);
  console.log(`  keyword: ${keyword}`);
  console.log(`  barrio:  ${barrio}`);
  console.log(`  filtro:  OPERATIONAL`);
  console.log(`  query:  ${textQuery}`);
  console.log(`  registry (${knownBefore} ids): ${REGISTRY_PATH}\n`);

  const rows = await searchText(textQuery);
  const operational = rows.filter((p) => isOperational(p.businessStatus));
  const skippedClosed = rows.length - operational.length;

  console.log(`  API → ${rows.length} resultados`);
  console.log(`  OPERATIONAL → ${operational.length}`);
  if (skippedClosed > 0) {
    console.log(`  omitidos (no operational) → ${skippedClosed}`);
  }

  const now = new Date().toISOString();
  const nuevos: PlaceHit[] = [];
  const repetidos: PlaceHit[] = [];
  const seen = new Set<string>();

  for (const hit of operational) {
    if (!hit.id) continue;
    const id = normalizeId(hit.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const status = upsertHit(registry, { ...hit, id }, now);
    if (status === "new") nuevos.push(hit);
    else repetidos.push(hit);
  }

  console.log(
    `\n→ Únicos OPERATIONAL en esta búsqueda: ${seen.size}` +
      ` · ${nuevos.length} nuevos · ${repetidos.length} ya en registry`,
  );

  if (nuevos.length > 0) {
    console.log("\nNuevos ids:");
    for (const p of nuevos) {
      console.log(
        `  + ${normalizeId(p.id)} | ${p.displayName?.text ?? "—"} | ${p.formattedAddress ?? "—"} | ★${p.rating ?? "?"}`,
      );
    }
  } else {
    console.log("\nNo hay ids nuevos.");
  }

  await saveRegistry(registry);

  const slug = `${keyword}-${barrio}`
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9áéíóúñü-]/gi, "");
  const runPath = path.join(OUT_DIR, `collect-${slug}-${now.slice(0, 10)}.json`);
  await writeFile(
    runPath,
    JSON.stringify(
      {
        keyword,
        barrio,
        textQuery,
        ranAt: now,
        apiCount: rows.length,
        operationalCount: operational.length,
        skippedNotOperational: skippedClosed,
        newIds: nuevos.map((p) => normalizeId(p.id)),
        knownIds: repetidos.map((p) => normalizeId(p.id)),
        note: "Sin Details en esta pasada. details queda null hasta la pasada posterior.",
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `\n✓ Registry: ${Object.keys(registry.places).length} ids → ${REGISTRY_PATH}`,
  );
  console.log(`✓ Snapshot → ${runPath}`);
  console.log("✓ Details: no se llamó (pasada posterior).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
