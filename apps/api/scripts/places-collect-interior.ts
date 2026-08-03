/**
 * Colecta place_ids en ciudades del interior AR × 2 keywords.
 * Registry aparte: places-registry-interior.json (no mezcla CABA/GBA).
 *
 * Query: "<keyword> <Ciudad, Provincia>"
 *
 * Uso:
 *   pnpm exec tsx scripts/places-collect-interior.ts
 *   pnpm exec tsx scripts/places-collect-interior.ts --tier=1
 *   pnpm exec tsx scripts/places-collect-interior.ts --tier=2
 *   pnpm exec tsx scripts/places-collect-interior.ts --tier=3
 *   pnpm exec tsx scripts/places-collect-interior.ts --only="Rosario, Santa Fe|Mendoza Capital, Mendoza"
 *   pnpm exec tsx scripts/places-collect-interior.ts --keyword="estudio de grabación"
 *
 * Opcional: PLACES_DELAY_MS=350  PLACES_INSECURE_TLS=1
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
  console.error("Falta GOOGLE_MAPS_API_KEY");
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

/** Prioridad / capitales y ciudades grandes */
const TIER1 = [
  "Córdoba Capital, Córdoba",
  "Río Cuarto, Córdoba",
  "Villa María, Córdoba",
  "Villa Carlos Paz, Córdoba",
  "San Francisco, Córdoba",
  "Rosario, Santa Fe",
  "Santa Fe Capital, Santa Fe",
  "Rafaela, Santa Fe",
  "Venado Tuerto, Santa Fe",
  "Mendoza Capital, Mendoza",
  "Godoy Cruz, Mendoza",
  "Guaymallén, Mendoza",
  "Las Heras, Mendoza",
  "Maipú, Mendoza",
  "San Rafael, Mendoza",
  "San Miguel de Tucumán, Tucumán",
  "Yerba Buena, Tucumán",
  "Tafí Viejo, Tucumán",
  "Banda del Río Salí, Tucumán",
  "Concepción, Tucumán",
  "Salta Capital, Salta",
  "San Ramón de la Nueva Orán, Salta",
  "Tartagal, Salta",
  "San José de Metán, Salta",
  "Paraná, Entre Ríos",
  "Concordia, Entre Ríos",
  "Gualeguaychú, Entre Ríos",
  "Concepción del Uruguay, Entre Ríos",
  "Posadas, Misiones",
  "Oberá, Misiones",
  "Eldorado, Misiones",
  "Puerto Iguazú, Misiones",
  "Corrientes Capital, Corrientes",
  "Goya, Corrientes",
  "Paso de los Libres, Corrientes",
  "Mercedes, Corrientes",
  "Resistencia, Chaco",
  "Presidencia Roque Sáenz Peña, Chaco",
  "Barranqueras, Chaco",
  "Villa Ángela, Chaco",
  "Santiago del Estero Capital, Santiago del Estero",
  "La Banda, Santiago del Estero",
  "Termas de Río Hondo, Santiago del Estero",
  "Añatuya, Santiago del Estero",
  "San Juan Capital, San Juan",
  "Rawson, San Juan",
  "Rivadavia, San Juan",
  "Chimbas, San Juan",
  "Santa Lucía, San Juan",
  "Pocito, San Juan",
  "San Salvador de Jujuy, Jujuy",
  "Palpalá, Jujuy",
  "San Pedro de Jujuy, Jujuy",
  "Libertador General San Martín, Jujuy",
  "Perico, Jujuy",
  "Neuquén Capital, Neuquén",
  "Plottier, Neuquén",
  "Centenario, Neuquén",
  "Cutral Có, Neuquén",
  "Zapala, Neuquén",
  "San Martín de los Andes, Neuquén",
  "San Carlos de Bariloche, Río Negro",
  "Cipolletti, Río Negro",
  "General Roca, Río Negro",
  "Viedma, Río Negro",
  "Villa Regina, Río Negro",
  "Comodoro Rivadavia, Chubut",
  "Puerto Madryn, Chubut",
  "Trelew, Chubut",
  "Rawson, Chubut",
  "Esquel, Chubut",
  "San Luis Capital, San Luis",
  "Villa Mercedes, San Luis",
  "Merlo, San Luis",
  "Formosa Capital, Formosa",
  "Clorinda, Formosa",
  "La Rioja Capital, La Rioja",
  "Chilecito, La Rioja",
  "San Fernando del Valle de Catamarca, Catamarca",
  "Santa Rosa, La Pampa",
  "General Pico, La Pampa",
  "Río Gallegos, Santa Cruz",
  "Caleta Olivia, Santa Cruz",
  "Río Grande, Tierra del Fuego",
  "Ushuaia, Tierra del Fuego",
] as const;

/** Ciudades medianas / complementarias */
const TIER2 = [
  "Alta Gracia, Córdoba",
  "Río Tercero, Córdoba",
  "Jesús María, Córdoba",
  "Villa Allende, Córdoba",
  "Bell Ville, Córdoba",
  "Marcos Juárez, Córdoba",
  "Villa Dolores, Córdoba",
  "Santo Tomé, Santa Fe",
  "Villa Gobernador Gálvez, Santa Fe",
  "San Lorenzo, Santa Fe",
  "Reconquista, Santa Fe",
  "Esperanza, Santa Fe",
  "Casilda, Santa Fe",
  "Cañada de Gómez, Santa Fe",
  "Firmat, Santa Fe",
  "Luján de Cuyo, Mendoza",
  "General San Martín, Mendoza",
  "Rivadavia, Mendoza",
  "Tunuyán, Mendoza",
  "General Alvear, Mendoza",
  "Junín, Mendoza",
  "Malargüe, Mendoza",
  "Alderetes, Tucumán",
  "Monteros, Tucumán",
  "Aguilares, Tucumán",
  "Famaillá, Tucumán",
  "Lules, Tucumán",
  "Bella Vista, Tucumán",
  "General Güemes, Salta",
  "Rosario de la Frontera, Salta",
  "Cafayate, Salta",
  "Joaquín V. González, Salta",
  "Embarcación, Salta",
  "Victoria, Entre Ríos",
  "Villaguay, Entre Ríos",
  "Colón, Entre Ríos",
  "Chajarí, Entre Ríos",
  "Federación, Entre Ríos",
  "Gualeguay, Entre Ríos",
  "Nogoyá, Entre Ríos",
  "Apóstoles, Misiones",
  "Puerto Rico, Misiones",
  "Montecarlo, Misiones",
  "Leandro N. Alem, Misiones",
  "Jardín América, Misiones",
  "San Vicente, Misiones",
  "Curuzú Cuatiá, Corrientes",
  "Bella Vista, Corrientes",
  "Santo Tomé, Corrientes",
  "Ituzaingó, Corrientes",
  "Esquina, Corrientes",
  "Monte Caseros, Corrientes",
  "Charata, Chaco",
  "General José de San Martín, Chaco",
  "Juan José Castelli, Chaco",
  "Quitilipi, Chaco",
  "Las Breñas, Chaco",
  "Frías, Santiago del Estero",
  "Fernández, Santiago del Estero",
  "Quimilí, Santiago del Estero",
  "Loreto, Santiago del Estero",
  "Suncho Corral, Santiago del Estero",
  "Caucete, San Juan",
  "Albardón, San Juan",
  "9 de Julio, San Juan",
  "San Martín, San Juan",
  "Media Agua, San Juan",
  "Humahuaca, Jujuy",
  "Tilcara, Jujuy",
  "El Carmen, Jujuy",
  "Monterrico, Jujuy",
  "La Quiaca, Jujuy",
  "Junín de los Andes, Neuquén",
  "Villa La Angostura, Neuquén",
  "Chos Malal, Neuquén",
  "Rincón de los Sauces, Neuquén",
  "Senillosa, Neuquén",
  "Allen, Río Negro",
  "El Bolsón, Río Negro",
  "Cinco Saltos, Río Negro",
  "Choele Choel, Río Negro",
  "Catriel, Río Negro",
  "Ingeniero Huergo, Río Negro",
  "Rada Tilly, Chubut",
  "Sarmiento, Chubut",
  "Trevelin, Chubut",
  "Gaiman, Chubut",
  "Dolavon, Chubut",
  "La Punta, San Luis",
  "Juana Koslay, San Luis",
  "Justo Daract, San Luis",
  "La Toma, San Luis",
  "Quines, San Luis",
  "Pirané, Formosa",
  "Las Lomitas, Formosa",
  "Chamical, La Rioja",
  "Aimogasta, La Rioja",
  "Valle Viejo, Catamarca",
  "Andalgalá, Catamarca",
  "Belén, Catamarca",
  "Toay, La Pampa",
  "General Acha, La Pampa",
  "El Calafate, Santa Cruz",
  "Pico Truncado, Santa Cruz",
  "Puerto Deseado, Santa Cruz",
  "Tolhuin, Tierra del Fuego",
] as const;

/** Ciudades chicas / complemento */
const TIER3 = [
  "Villa Constitución, Santa Fe",
  "Granadero Baigorria, Santa Fe",
  "Capitán Bermúdez, Santa Fe",
  "Pérez, Santa Fe",
  "Sunchales, Santa Fe",
  "Cosquín, Córdoba",
  "La Falda, Córdoba",
  "Unquillo, Córdoba",
  "Río Ceballos, Córdoba",
  "Cruz del Eje, Córdoba",
  "Tupungato, Mendoza",
  "Palmira, Mendoza",
  "Crespo, Entre Ríos",
  "San José, Entre Ríos",
  "Garupá, Misiones",
  "Candelaria, Misiones",
  "Fontana, Chaco",
  "Puerto Vilelas, Chaco",
  "Jáchal, San Juan",
  "Las Grutas, Río Negro",
  "San Antonio Oeste, Río Negro",
  "Dina Huapi, Río Negro",
  "Lago Puelo, Chubut",
  "Potrero de los Funes, San Luis",
  "Tinogasta, Catamarca",
  "Santa María, Catamarca",
  "Villa Unión, La Rioja",
  "El Colorado, Formosa",
  "Eduardo Castex, La Pampa",
  "Las Heras, Santa Cruz",
  "Puerto San Julián, Santa Cruz",
] as const;

const tierArg = process.argv.find((a) => a.startsWith("--tier="));
const tier = tierArg ? Number(tierArg.slice("--tier=".length)) : 0;
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

let CITIES: string[] =
  tier === 1
    ? [...TIER1]
    : tier === 2
      ? [...TIER2]
      : tier === 3
        ? [...TIER3]
        : [...TIER1, ...TIER2, ...TIER3];

if (onlySet) {
  CITIES = CITIES.filter((c) => onlySet.has(c));
  if (!CITIES.length) {
    console.error("Ninguna ciudad matcheó --only=");
    process.exit(1);
  }
}

const OUT_DIR = path.join(__dirname, "out");
const REGISTRY_PATH = path.join(OUT_DIR, "places-registry-interior.json");

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

function provinciaOf(city: string): string {
  const i = city.lastIndexOf(",");
  return i >= 0 ? city.slice(i + 1).trim() : "?";
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
  const totalRuns = CITIES.length * KEYWORDS.length;
  const registry = await loadRegistry();
  const knownBefore = Object.keys(registry.places).length;

  console.log(`→ Collect interior AR (sin Details)`);
  console.log(`  ciudades: ${CITIES.length}${tier ? ` (tier ${tier})` : " (tier 1+2)"}`);
  console.log(`  keywords: ${KEYWORDS.length} → ${KEYWORDS.join(" · ")}`);
  console.log(`  corridas: ${totalRuns}`);
  console.log(`  delay: ${DELAY_MS}ms`);
  console.log(`  registry previo: ${knownBefore} ids\n`);

  let run = 0;
  let apiHits = 0;
  let operationalHits = 0;
  let nuevosTotal = 0;
  let knownTotal = 0;
  let errors = 0;
  const perProvincia: Record<
    string,
    { api: number; operational: number; nuevos: number; known: number }
  > = {};

  for (const city of CITIES) {
    const provincia = provinciaOf(city);
    if (!perProvincia[provincia]) {
      perProvincia[provincia] = {
        api: 0,
        operational: 0,
        nuevos: 0,
        known: 0,
      };
    }

    for (const keyword of KEYWORDS) {
      run += 1;
      const textQuery = `${keyword} ${city}`;
      const queryKey = `${keyword}|${city}|interior`;
      const now = new Date().toISOString();

      process.stdout.write(`[${run}/${totalRuns}] ${keyword} · ${city} … `);

      try {
        const rows = await searchText(textQuery);
        const operational = rows.filter(
          (p) => p.businessStatus === "OPERATIONAL",
        );
        apiHits += rows.length;
        operationalHits += operational.length;
        perProvincia[provincia]!.api += rows.length;
        perProvincia[provincia]!.operational += operational.length;

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
        perProvincia[provincia]!.nuevos += nuevos;
        perProvincia[provincia]!.known += known;

        console.log(
          `api=${rows.length} op=${operational.length} +${nuevos} known=${known}`,
        );
      } catch (e) {
        errors += 1;
        console.log(`ERROR ${e instanceof Error ? e.message : e}`);
      }

      if (run % 10 === 0) await saveRegistry(registry);
      if (run < totalRuns) await sleep(DELAY_MS);
    }
  }

  await saveRegistry(registry);

  const summary = {
    ranAt: new Date().toISOString(),
    tier: tier || "all",
    cities: CITIES.length,
    keywords: [...KEYWORDS],
    totalRuns,
    apiHits,
    operationalHits,
    nuevosTotal,
    knownTotal,
    errors,
    registryTotal: Object.keys(registry.places).length,
    knownBefore,
    perProvincia,
  };

  const summaryPath = path.join(
    OUT_DIR,
    `collect-interior-${summary.ranAt.slice(0, 10)}.json`,
  );
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`\n========== RESUMEN ==========`);
  console.log(`Corridas: ${totalRuns} · errores: ${errors}`);
  console.log(`Hits API: ${apiHits} · OPERATIONAL: ${operationalHits}`);
  console.log(`Nuevos: ${nuevosTotal} · ya conocidos: ${knownTotal}`);
  console.log(
    `Registry interior: ${knownBefore} → ${Object.keys(registry.places).length} ids`,
  );
  console.log(`\nPor provincia (op / nuevos):`);
  for (const [p, s] of Object.entries(perProvincia).sort((a, b) =>
    a[0].localeCompare(b[0], "es"),
  )) {
    console.log(`  ${p}: op=${s.operational} +${s.nuevos}`);
  }
  console.log(`✓ ${REGISTRY_PATH}`);
  console.log(`✓ ${summaryPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
