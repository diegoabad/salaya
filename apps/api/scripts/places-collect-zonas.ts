/**
 * Colecta place_ids en GBA + interior BA × 2 keywords.
 * Sin Details. Registry aparte: places-registry-zonas.json (no mezcla CABA).
 *
 * Keywords:
 *   - sala de ensayo
 *   - sala de ensayo y grabación
 *   - estudio de grabación
 *
 * Query: "<keyword> <localidad>"
 *
 * Uso:
 *   pnpm exec tsx scripts/places-collect-zonas.ts
 *   pnpm exec tsx scripts/places-collect-zonas.ts --keyword="estudio de grabación"
 *
 * Opcional:
 *   PLACES_DELAY_MS=350
 *   PLACES_INSECURE_TLS=1
 *   PLACES_REFERER=http://localhost:3000/
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

if (process.env.PLACES_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const DELAY_MS = Number(process.env.PLACES_DELAY_MS ?? 350);
const REFERER = process.env.PLACES_REFERER ?? "http://localhost:3000/";

const ALL_KEYWORDS = [
  "sala de ensayo",
  "sala de ensayo y grabación",
  "estudio de grabación",
] as const;

const keywordArg = process.argv
  .find((a) => a.startsWith("--keyword="))
  ?.slice("--keyword=".length)
  .trim();
const KEYWORDS = (
  keywordArg
    ? ALL_KEYWORDS.filter((k) => k === keywordArg)
    : [...ALL_KEYWORDS]
) as string[];
if (keywordArg && KEYWORDS.length === 0) {
  console.error(`Keyword no reconocida: "${keywordArg}"`);
  console.error(`Opciones: ${ALL_KEYWORDS.join(" · ")}`);
  process.exit(1);
}

const ZONAS: Record<string, readonly string[]> = {
  "zona-oeste": [
    "Ramos Mejía",
    "San Justo",
    "Morón",
    "Castelar",
    "Ituzaingó",
    "Hurlingham",
    "El Palomar",
    "Caseros",
    "Ciudadela",
    "San Martín",
    "Villa Ballester",
    "San Miguel",
    "Merlo",
    "Moreno",
    "Haedo",
    "Villa Sarmiento",
    "Lomas del Mirador",
    "Tapiales",
    "Isidro Casanova",
    "Gregorio de Laferrere",
    "González Catán",
    "Rafael Castillo",
    "Ciudad Jardín",
    "Santos Lugares",
    "Villa Bosch",
    "Martín Coronado",
    "Muñiz",
    "Bella Vista",
    "José C. Paz",
    "Paso del Rey",
    "San Antonio de Padua",
  ],
  "zona-sur": [
    "Avellaneda",
    "Lanús",
    "Lomas de Zamora",
    "Banfield",
    "Temperley",
    "Adrogué",
    "Monte Grande",
    "Quilmes",
    "Bernal",
    "Berazategui",
    "Florencio Varela",
    "Ezeiza",
    "Wilde",
    "Sarandí",
    "Gerli",
    "Remedios de Escalada",
    "Valentín Alsina",
    "Turdera",
    "Llavallol",
    "Burzaco",
    "Rafael Calzada",
    "Longchamps",
    "Glew",
    "Ezpeleta",
    "San Francisco Solano",
    "Hudson",
    "Canning",
  ],
  "zona-norte": [
    "Vicente López",
    "Olivos",
    "San Isidro",
    "Martínez",
    "San Fernando",
    "Tigre",
    "General Pacheco",
    "Don Torcuato",
    "Pilar",
    "Escobar",
    "Florida",
    "Munro",
    "Villa Martelli",
    "La Lucila",
    "Beccar",
    "Boulogne",
    "Acassuso",
    "Victoria",
    "Virreyes",
    "Benavídez",
    "Rincón de Milberg",
    "Del Viso",
    "Manuel Alberti",
    "Garín",
    "Ingeniero Maschwitz",
  ],
  "la-plata": [
    "La Plata",
    "City Bell",
    "Manuel B. Gonnet",
    "Villa Elisa",
    "Tolosa",
    "Los Hornos",
    "San Carlos",
    "Ringuelet",
    "Melchor Romero",
    "Berisso",
    "Ensenada",
  ],
  costa: [
    "Mar del Plata",
    "Bahía Blanca",
    "Necochea",
    "Villa Gesell",
    "Pinamar",
    "Miramar",
    "Punta Alta",
    "Cariló",
    "Santa Teresita",
    "San Bernardo",
    "Mar de Ajó",
    "San Clemente del Tuyú",
    "Monte Hermoso",
    "Santa Clara del Mar",
    "Batán",
    "General Madariaga",
    "Tres Arroyos",
  ],
};

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlySet = onlyArg
  ? new Set(
      onlyArg
        .slice("--only=".length)
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null;

const LOCALIDADES = Object.entries(ZONAS)
  .flatMap(([zona, locs]) => locs.map((localidad) => ({ zona, localidad })))
  .filter((x) => (onlySet ? onlySet.has(x.localidad) : true));

if (onlySet && LOCALIDADES.length === 0) {
  console.error("Ninguna localidad matcheó --only=...");
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, "out");
const REGISTRY_PATH = path.join(OUT_DIR, "places-registry-zonas.json");

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
  queries: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  details: Record<string, unknown> | null;
};

type Registry = {
  updatedAt: string;
  places: Record<string, RegistryEntry>;
};

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadRegistry(): Promise<Registry> {
  try {
    const raw = await readFile(REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(raw) as Registry;
    if (!parsed.places || typeof parsed.places !== "object") {
      return { updatedAt: new Date().toISOString(), places: {} };
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
  queryKey: string,
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
    existing.businessStatus = hit.businessStatus ?? existing.businessStatus;
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
  const totalRuns = LOCALIDADES.length * KEYWORDS.length;
  const registry = await loadRegistry();
  const knownBefore = Object.keys(registry.places).length;

  console.log(`→ Collect GBA + interior (sin Details)`);
  console.log(`  localidades: ${LOCALIDADES.length}`);
  console.log(`  keywords: ${KEYWORDS.length} → ${KEYWORDS.join(" · ")}`);
  console.log(`  corridas: ${totalRuns}`);
  console.log(`  query: "<kw> <localidad>"`);
  console.log(`  delay: ${DELAY_MS}ms`);
  console.log(`  registry previo: ${knownBefore} ids\n`);

  let run = 0;
  let apiHits = 0;
  let operationalHits = 0;
  let nuevosTotal = 0;
  let knownTotal = 0;
  let errors = 0;

  const perZona: Record<
    string,
    { api: number; operational: number; nuevos: number; known: number }
  > = {};
  const perLocalidad: Record<
    string,
    {
      zona: string;
      api: number;
      operational: number;
      nuevos: number;
      known: number;
    }
  > = {};

  for (const { zona, localidad } of LOCALIDADES) {
    if (!perZona[zona]) {
      perZona[zona] = { api: 0, operational: 0, nuevos: 0, known: 0 };
    }
    perLocalidad[localidad] = {
      zona,
      api: 0,
      operational: 0,
      nuevos: 0,
      known: 0,
    };

    for (const keyword of KEYWORDS) {
      run += 1;
      const textQuery = `${keyword} ${localidad}`;
      const queryKey = `${keyword}|${localidad}|${zona}`;
      const now = new Date().toISOString();

      process.stdout.write(
        `[${run}/${totalRuns}] ${keyword} · ${localidad} … `,
      );

      try {
        const rows = await searchText(textQuery);
        const operational = rows.filter(
          (p) => p.businessStatus === "OPERATIONAL",
        );
        apiHits += rows.length;
        operationalHits += operational.length;
        perZona[zona]!.api += rows.length;
        perZona[zona]!.operational += operational.length;
        perLocalidad[localidad]!.api += rows.length;
        perLocalidad[localidad]!.operational += operational.length;

        let nuevos = 0;
        let known = 0;
        const seen = new Set<string>();
        for (const hit of operational) {
          if (!hit.id) continue;
          const id = normalizeId(hit.id);
          if (seen.has(id)) continue;
          seen.add(id);
          const status = upsertHit(registry, { ...hit, id }, queryKey, now);
          if (status === "new") {
            nuevos += 1;
            nuevosTotal += 1;
          } else {
            known += 1;
            knownTotal += 1;
          }
        }
        perZona[zona]!.nuevos += nuevos;
        perZona[zona]!.known += known;
        perLocalidad[localidad]!.nuevos += nuevos;
        perLocalidad[localidad]!.known += known;

        console.log(
          `api=${rows.length} op=${operational.length} +${nuevos} known=${known}`,
        );
      } catch (e) {
        errors += 1;
        console.log(`ERROR ${e instanceof Error ? e.message : e}`);
      }

      if (run % 8 === 0) {
        await saveRegistry(registry);
      }

      if (run < totalRuns) await sleep(DELAY_MS);
    }
  }

  await saveRegistry(registry);

  const summary = {
    ranAt: new Date().toISOString(),
    localidades: LOCALIDADES.length,
    keywords: [...KEYWORDS],
    totalRuns,
    apiHits,
    operationalHits,
    nuevosTotal,
    knownTotal,
    errors,
    registryTotal: Object.keys(registry.places).length,
    knownBefore,
    perZona,
    perLocalidad,
  };

  const summaryPath = path.join(
    OUT_DIR,
    `collect-zonas-${summary.ranAt.slice(0, 10)}.json`,
  );
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`\n========== RESUMEN ==========`);
  console.log(`Corridas: ${totalRuns} · errores: ${errors}`);
  console.log(`Hits API: ${apiHits} · OPERATIONAL: ${operationalHits}`);
  console.log(`Nuevos: ${nuevosTotal} · ya conocidos: ${knownTotal}`);
  console.log(
    `Registry zonas: ${knownBefore} → ${Object.keys(registry.places).length} ids únicos`,
  );
  console.log(`\nPor zona (hits OPERATIONAL / nuevos):`);
  for (const [z, s] of Object.entries(perZona)) {
    console.log(`  ${z}: op=${s.operational} +${s.nuevos}`);
  }
  console.log(`✓ ${REGISTRY_PATH}`);
  console.log(`✓ ${summaryPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
