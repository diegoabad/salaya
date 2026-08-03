/**
 * Exporta TODAS las review (CABA + zonas + interior) con links Maps.
 * Uso: pnpm exec tsx scripts/export-places-review-all.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "out");
const KEEP = new Set([
  "nombre_ensayo",
  "estudio_grabacion",
  "nombre_salas",
  "manual_ok",
]);

type Place = {
  id: string;
  name: string | null;
  cleanReason?: string;
  formattedAddress?: string | null;
  details?: {
    primaryType?: string | null;
    primaryTypeDisplayName?: string | null;
    rating?: number | null;
    userRatingCount?: number | null;
    phone?: string | null;
    barrio?: string | null;
    mapsUrl?: string | null;
    website?: string | null;
    formattedAddress?: string | null;
  } | null;
  queries?: string[];
};

function loadReview(
  registry: { places?: Record<string, Place> },
  origen: string,
): Array<Place & { origen: string }> {
  return Object.values(registry.places ?? {})
    .filter((p) => p.cleanReason && !KEEP.has(p.cleanReason))
    .map((p) => ({ ...p, origen }));
}

const registries: Array<{ file: string; origen: string }> = [
  { file: "places-registry.json", origen: "caba" },
  { file: "places-registry-zonas.json", origen: "zonas" },
  { file: "places-registry-interior.json", origen: "interior" },
];

const byId = new Map<string, Place & { origen: string }>();
for (const { file, origen } of registries) {
  const registry = JSON.parse(await readFile(resolve(OUT, file), "utf8"));
  for (const p of loadReview(registry, origen)) {
    const prev = byId.get(p.id);
    if (!prev) {
      byId.set(p.id, p);
      continue;
    }
    // preferir origen más específico: caba > zonas > interior
    const rank = { caba: 0, zonas: 1, interior: 2 } as Record<string, number>;
    if ((rank[p.origen] ?? 9) < (rank[prev.origen] ?? 9)) byId.set(p.id, p);
  }
}

const review = [...byId.values()].sort((a, b) =>
  (a.name ?? "").localeCompare(b.name ?? "", "es"),
);

function zonaHint(p: Place & { origen: string }): string | null {
  if (p.details?.barrio?.trim()) return p.details.barrio.trim();
  const qs = p.queries ?? [];
  for (let i = qs.length - 1; i >= 0; i--) {
    const parts = qs[i]!.split("|");
    if (parts[1] && parts[1] !== "CABA" && parts[1] !== "interior") {
      return parts[1]!;
    }
  }
  return null;
}

const rows = review.map((p, i) => {
  const maps =
    p.details?.mapsUrl ||
    `https://www.google.com/maps/place/?q=place_id:${p.id}`;
  return {
    n: i + 1,
    origen: p.origen,
    cleanReason: p.cleanReason ?? "?",
    name: p.name,
    zona: zonaHint(p),
    category: p.details?.primaryTypeDisplayName ?? null,
    rating: p.details?.rating ?? null,
    reviews: p.details?.userRatingCount ?? null,
    phone: p.details?.phone ?? null,
    address:
      p.details?.formattedAddress ?? p.formattedAddress ?? null,
    mapsUrl: maps,
    id: p.id,
  };
});

const payload = {
  exportedAt: new Date().toISOString(),
  note: "Pendientes de verificar (review). NO importar hasta confirmar.",
  count: rows.length,
  byOrigen: Object.fromEntries(
    ["caba", "zonas", "interior"].map((o) => [
      o,
      rows.filter((r) => r.origen === o).length,
    ]),
  ),
  places: rows,
};

await mkdir(OUT, { recursive: true });
const destJson = resolve(OUT, "places-a-verificar.json");
const destMd = resolve(OUT, "places-a-verificar.md");
const destTxt = resolve(OUT, "places-a-verificar-links.txt");

await writeFile(destJson, JSON.stringify(payload, null, 2), "utf8");

const mdLines = [
  `# Salas a verificar (${rows.length})`,
  "",
  `Exportado: ${payload.exportedAt}`,
  "",
  `Por origen: CABA ${payload.byOrigen.caba} · Zonas ${payload.byOrigen.zonas} · Interior ${payload.byOrigen.interior}`,
  "",
  "| # | Origen | Motivo | Nombre | Zona | Categoría | Rating | Maps |",
  "|---|--------|--------|--------|------|-----------|--------|------|",
];
for (const r of rows) {
  const rating =
    r.rating != null ? `${r.rating} (${r.reviews ?? 0})` : "—";
  const name = (r.name ?? "—").replace(/\|/g, "/");
  mdLines.push(
    `| ${r.n} | ${r.origen} | ${r.cleanReason} | ${name} | ${r.zona ?? "—"} | ${r.category ?? "—"} | ${rating} | [ver](${r.mapsUrl}) |`,
  );
}
await writeFile(destMd, mdLines.join("\n") + "\n", "utf8");

const txt = rows
  .map(
    (r) =>
      `${r.n}. [${r.origen}/${r.cleanReason}] ${r.name ?? "—"} — ${r.zona ?? "sin zona"}\n   ${r.mapsUrl}`,
  )
  .join("\n\n");
await writeFile(destTxt, txt + "\n", "utf8");

console.log(`OK ${rows.length} a verificar`);
console.log(`→ ${destMd}`);
console.log(`→ ${destTxt}`);
console.log(`→ ${destJson}`);
console.log("por origen:", payload.byOrigen);
