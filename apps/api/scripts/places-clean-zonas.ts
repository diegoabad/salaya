/**
 * Limpia places-registry-zonas.json:
 * - drop: bares, teatros, escuelas, clubs, fuera de BA/ruido extranjero
 * - keep: nombre con ensayo / sala+grabación / "Sala(s) …"
 * - review: estudios sin "ensayo", dudosos
 *
 * Reescribe registry solo con keep+review y guarda snapshot.
 *
 * Uso: pnpm exec tsx scripts/places-clean-zonas.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "out");
const REGISTRY_PATH = path.join(OUT_DIR, "places-registry-zonas.json");

type Details = {
  primaryType?: string | null;
  primaryTypeDisplayName?: string | null;
  phone?: string | null;
  formattedAddress?: string | null;
};

type Entry = {
  id: string;
  name: string | null;
  formattedAddress: string | null;
  types: string[];
  details?: Details | null;
  [k: string]: unknown;
};

type Registry = {
  updatedAt: string;
  places: Record<string, Entry>;
};

type Verdict = "keep" | "drop" | "review";

function addressOf(p: Entry): string {
  return (p.details?.formattedAddress ?? p.formattedAddress ?? "").trim();
}

function phoneOf(p: Entry): string {
  return (p.details?.phone ?? "").trim();
}

/** Fuera de GBA + interior BA (Chile, España, otras provincias, CABA). */
function isOutOfScope(p: Entry): boolean {
  const address = addressOf(p);
  const a = address.toLowerCase();
  const phone = phoneOf(p);
  const name = (p.name ?? "").toLowerCase();

  // Teléfonos extranjeros
  if (
    /^\+(56|34|506|51|52|57|58|595|598)\b/.test(phone)
  ) {
    return true;
  }

  // País al final de la dirección
  if (
    /,\s*(chile|españa|spain|uruguay|paraguay|per[uú]|costa rica|m[eé]xico)\s*$/i.test(
      address,
    )
  ) {
    return true;
  }

  // Otras provincias AR (ciudad/provincia en la dirección, no nombre de calle)
  if (
    /,\s*(mendoza|c[oó]rdoba|santa fe|rosario|neuqu[eé]n|salta|tucum[aá]n|entre r[ií]os|misiones|chubut|r[ií]o negro)\s*,/i.test(
      a,
    ) ||
    /,\s*(mendoza|c[oó]rdoba|rosario|santa fe)\s*,?\s*argentina\s*$/i.test(a)
  ) {
    return true;
  }
  // CP Mendoza M / Córdoba X / Santa Fe S (sin CP BA B)
  if (/\b[MXS]\d{4}[A-Z]{0,3}\b/.test(address) && !/\bB\d{4}/i.test(address)) {
    return true;
  }
  // Título que declara otra ciudad
  if (
    /\ben c[oó]rdoba\b|\brosario\b|\bmendoza\b|\bchile\b|\bper[uú]\b/.test(name) &&
    !/provincia de buenos aires/i.test(a)
  ) {
    return true;
  }

  // CABA (ya en places-registry.json). CP CABA ≈ C1xxx–C14xx, no C7000 Tandil.
  if (/ciudad aut[oó]noma de buenos aires|cdad\.?\s*aut[oó]noma/i.test(a)) {
    return true;
  }
  if (/\bC1[0-4]\d{2}[A-Z]{0,3}\b/i.test(address) && !/\bB\d{4}/i.test(address)) {
    return true;
  }

  return false;
}

function classify(p: Entry): { verdict: Verdict; reason: string } {
  if (p.cleanReason === "manual_ok") {
    return { verdict: "keep", reason: "manual_ok" };
  }

  const name = (p.name ?? "").trim();
  const n = name.toLowerCase();
  const types = (p.types ?? []).map((t) => t.toLowerCase());
  const typeStr = types.join(" ");
  const primary =
    (p.details?.primaryType ?? "").toLowerCase() ||
    types[0] ||
    "";
  const cat = (p.details?.primaryTypeDisplayName ?? "").toLowerCase();

  if (isOutOfScope(p)) {
    return { verdict: "drop", reason: "fuera_alcance" };
  }

  const hasEnsayo = /ensayo/.test(n);
  const hasSalaEstudio =
    /sala|estudio|\bstudios?\b|grabaci|record|home\s*studio/.test(n) ||
    /^salas?\b/i.test(name);

  // Categorías que nunca queremos (salvo nombre muy claro de ensayo → review)
  const hardNoiseCat =
    /\b(performing_arts_theater|restaurant|cafe|clothing_store|shopping_mall|museum|church|place_of_worship|tourist_attraction|sports_club|athletic_field|playground|lawyer|beauty_salon|hair_care|sculpture|park|lodging|hotel)\b/.test(
      primary,
    ) ||
    /\b(teatro|restaurante|tienda de ropa|atracci[oó]n tur[ií]stica|club deportivo|parque infantil|abogado|centro de est[eé]tica|escultura|hotel)\b/.test(
      cat,
    );

  if (hardNoiseCat) {
    return { verdict: "drop", reason: "ruido_categoria" };
  }

  // Bares / night clubs / lounges sin "ensayo" en el nombre
  const isBarish =
    /\b(bar|night_club|lounge)\b/.test(primary) ||
    /\b(bar|club nocturno|lounge)\b/.test(cat) ||
    (/\bbar\b/i.test(n) && !hasEnsayo);

  if (isBarish && !hasEnsayo) {
    return { verdict: "drop", reason: "bar_local" };
  }
  // Bar con "ensayo" en nombre → a veces es sala mal etiquetada
  if (isBarish && hasEnsayo) {
    return { verdict: "review", reason: "bar_con_ensayo" };
  }

  const noiseName =
    /\b(teatro|escuela|academia|conservatorio|shop|tienda|instrumentos|milonga|music store|club cultural|patio cultural|galp[oó]n art[ií]stico|ensambles de m[uú]sica|centro cultural|universidad|colegio|jard[ií]n maternal|yamaha|murga|jubilad|predio|country club)\b/i.test(
      n,
    );

  if (noiseName && !hasEnsayo) {
    return { verdict: "drop", reason: "ruido_nombre" };
  }

  const noiseType =
    /\b(school|university|secondary_school|primary_school|electronics_store|car_repair|auto_parts_store|real_estate|apartment_complex|housing_complex)\b/.test(
      typeStr,
    );
  if (noiseType && !hasEnsayo) {
    return { verdict: "drop", reason: "ruido_tipo" };
  }

  if (
    types.includes("store") &&
    !hasSalaEstudio &&
    !/^salas?\b/i.test(name)
  ) {
    return { verdict: "drop", reason: "store_generico" };
  }

  if (hasEnsayo) {
    return { verdict: "keep", reason: "nombre_ensayo" };
  }

  if (
    /grabaci[oó]n|records|recording/.test(n) &&
    /(sala|estudio|\bstudios?\b)/.test(n)
  ) {
    return { verdict: "keep", reason: "estudio_grabacion" };
  }

  if (
    /^salas?\b/i.test(name) &&
    !/teatro|cultural|independencia|duende|evento/i.test(n)
  ) {
    return { verdict: "keep", reason: "nombre_salas" };
  }

  if (/estudio|\bstudios?\b|home\s*studio/.test(n)) {
    return { verdict: "review", reason: "estudio_sin_ensayo" };
  }

  if (/cultural|espacio|club|fundaci[oó]n|galp[oó]n|instituto/i.test(n)) {
    return { verdict: "drop", reason: "espacio_cultural" };
  }

  return { verdict: "review", reason: "dudoso" };
}

async function main() {
  const raw = await readFile(REGISTRY_PATH, "utf8");
  const registry = JSON.parse(raw) as Registry;
  const all = Object.values(registry.places);

  const buckets: Record<Verdict, { entry: Entry; reason: string }[]> = {
    keep: [],
    drop: [],
    review: [],
  };

  for (const entry of all) {
    const { verdict, reason } = classify(entry);
    buckets[verdict].push({ entry, reason });
  }

  const cleanedPlaces: Record<string, Entry & { cleanReason?: string }> = {};
  for (const { entry, reason } of [...buckets.keep, ...buckets.review]) {
    cleanedPlaces[entry.id] = { ...entry, cleanReason: reason };
  }

  const cleaned: Registry = {
    updatedAt: new Date().toISOString(),
    places: cleanedPlaces,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const backupPath = path.join(
    OUT_DIR,
    "places-registry-zonas.before-clean.json",
  );
  await writeFile(backupPath, raw, "utf8");
  await writeFile(REGISTRY_PATH, JSON.stringify(cleaned, null, 2), "utf8");

  const dropReasons: Record<string, number> = {};
  for (const { reason } of buckets.drop) {
    dropReasons[reason] = (dropReasons[reason] ?? 0) + 1;
  }
  const reviewReasons: Record<string, number> = {};
  for (const { reason } of buckets.review) {
    reviewReasons[reason] = (reviewReasons[reason] ?? 0) + 1;
  }

  const report = {
    cleanedAt: cleaned.updatedAt,
    before: all.length,
    keep: buckets.keep.length,
    reviewCount: buckets.review.length,
    drop: buckets.drop.length,
    after: Object.keys(cleanedPlaces).length,
    dropReasons,
    reviewReasons,
    dropped: buckets.drop.map(({ entry, reason }) => ({
      id: entry.id,
      name: entry.name,
      address: addressOf(entry),
      category: entry.details?.primaryTypeDisplayName ?? null,
      reason,
    })),
    review: buckets.review.map(({ entry, reason }) => ({
      id: entry.id,
      name: entry.name,
      address: addressOf(entry),
      category: entry.details?.primaryTypeDisplayName ?? null,
      reason,
    })),
    keepNames: buckets.keep
      .map(({ entry }) => entry.name)
      .sort((a, b) => (a ?? "").localeCompare(b ?? "", "es")),
  };

  const reportPath = path.join(OUT_DIR, "places-clean-zonas-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("========== LIMPIEZA ZONAS ==========");
  console.log(`Antes:   ${report.before}`);
  console.log(`Keep:    ${report.keep}`);
  console.log(`Review:  ${report.reviewCount}`);
  console.log(`Drop:    ${report.drop}`);
  console.log(`Después: ${report.after} (keep+review)`);
  console.log(`\nDrop reasons:`, dropReasons);
  console.log(`Review reasons:`, reviewReasons);
  console.log(`\n✓ Backup: ${backupPath}`);
  console.log(`✓ Registry limpio: ${REGISTRY_PATH}`);
  console.log(`✓ Report: ${reportPath}`);

  console.log("\n--- DROP (muestra) ---");
  for (const d of report.dropped.slice(0, 30)) {
    console.log(`· [${d.reason}] ${d.name} · ${d.category ?? "—"}`);
  }
  if (report.dropped.length > 30) {
    console.log(`… +${report.dropped.length - 30} más`);
  }

  console.log("\n--- REVIEW ---");
  for (const d of report.review) {
    console.log(`· [${d.reason}] ${d.name} · ${d.category ?? "—"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
