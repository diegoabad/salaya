/**
 * Extrae las entradas "review" del places-registry a un JSON aparte.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "out");
const REGISTRY = resolve(OUT, "places-registry.json");
const REPORT = resolve(OUT, "places-clean-report.json");
const DEST = resolve(OUT, "places-review-pendientes.json");

const KEEP = new Set([
  "nombre_ensayo",
  "estudio_grabacion",
  "nombre_salas",
  "manual_ok",
]);

const registry = JSON.parse(await readFile(REGISTRY, "utf8"));
const places = Object.values(registry.places ?? {}) as Array<{
  id: string;
  name: string | null;
  cleanReason?: string;
  details: unknown;
  formattedAddress?: string | null;
}>;

const review = places.filter((p) => !KEEP.has(p.cleanReason ?? ""));

let reportReview: unknown[] = [];
try {
  const report = JSON.parse(await readFile(REPORT, "utf8"));
  reportReview = report.review ?? [];
  console.log("clean-report.review:", reportReview.length);
} catch {
  console.log("(sin clean-report)");
}

const payload = {
  exportedAt: new Date().toISOString(),
  note: "Dudosos del scrape: no están en la DB. Revisar a mano antes de importar.",
  count: review.length,
  places: review.map((p) => {
    const d = p.details as {
      primaryType?: string | null;
      primaryTypeDisplayName?: string | null;
      rating?: number | null;
      userRatingCount?: number | null;
    } | null;
    return {
      id: p.id,
      name: p.name,
      cleanReason: p.cleanReason ?? null,
      formattedAddress: p.formattedAddress ?? null,
      primaryType: d?.primaryType ?? null,
      primaryTypeDisplayName: d?.primaryTypeDisplayName ?? null,
      rating: d?.rating ?? null,
      userRatingCount: d?.userRatingCount ?? null,
      details: p.details,
    };
  }),
};

await mkdir(OUT, { recursive: true });
await writeFile(DEST, JSON.stringify(payload, null, 2), "utf8");
console.log(`registry total: ${places.length}`);
console.log(`review extraídas: ${review.length} → ${DEST}`);
console.log(
  "reasons:",
  Object.fromEntries(
    [...new Set(review.map((p) => p.cleanReason ?? "?"))].map((r) => [
      r,
      review.filter((p) => (p.cleanReason ?? "?") === r).length,
    ]),
  ),
);
