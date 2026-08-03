/**
 * Limpia places-registry.json:
 * - drop: ruido (tiendas, teatros, escuelas, bares, etc.) o fuera de CABA
 * - keep: nombre con ensayo / sala+grabación
 * - review: dudosos (p.ej. "Salas X" sin "ensayo")
 *
 * Reescribe registry solo con keep+review y guarda snapshot.
 *
 * Uso: pnpm exec tsx scripts/places-clean-registry.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "out");
const REGISTRY_PATH = path.join(OUT_DIR, "places-registry.json");

type Entry = {
  id: string;
  name: string | null;
  formattedAddress: string | null;
  types: string[];
  [k: string]: unknown;
};

type Registry = {
  updatedAt: string;
  places: Record<string, Entry>;
};

type Verdict = "keep" | "drop" | "review";

function isOutsideCaba(address: string | null): boolean {
  if (!address) return false;
  const a = address.toLowerCase();
  if (a.includes("provincia de buenos aires")) return true;
  // CP provincia suele empezar con B (B1678, B1754…)
  if (/\bB\d{4}/i.test(address) && !/C\d{4}/i.test(address)) return true;
  if (
    /\b(caseros|avellaneda|san justo|ramos mej[ií]a|munro|san mart[ií]n|villa madero|la tablada|gerli|ciudadela|villa dominico|gregorio de laferrere|villa lynch)\b/i.test(
      a,
    )
  ) {
    return true;
  }
  return false;
}

function classify(p: Entry): { verdict: Verdict; reason: string } {
  // Aprobaciones manuales previas: no re-clasificar ni dropear
  if (p.cleanReason === "manual_ok") {
    return { verdict: "keep", reason: "manual_ok" };
  }

  const name = (p.name ?? "").trim();
  const n = name.toLowerCase();
  const types = (p.types ?? []).map((t) => t.toLowerCase());
  const typeStr = types.join(" ");
  const address = p.formattedAddress;

  if (isOutsideCaba(address)) {
    return { verdict: "drop", reason: "fuera_caba" };
  }

  const noiseName =
    /\b(teatro|escuela|academia|conservatorio|shop|tienda|instrumentos|milonga|music store|club cultural|patio cultural|galp[oó]n art[ií]stico|ensambles de m[uú]sica|centro cultural|universidad|colegio|jard[ií]n|yamaha)\b/i.test(
      n,
    ) ||
    (/\bbar\b/i.test(n) && !/ensayo/.test(n)) ||
    /rock bar|music shop|music store/i.test(n);

  if (noiseName && !/ensayo/.test(n)) {
    return { verdict: "drop", reason: "ruido_nombre" };
  }

  // tipos claramente no sala, salvo que diga ensayo
  const noiseType =
    /\b(school|university|secondary_school|primary_school|night_club|restaurant|cafe|clothing_store|shopping_mall|museum|church|tourist_attraction|electronics_store|car_repair|auto_parts_store)\b/.test(
      typeStr,
    );
  if (noiseType && !/ensayo/.test(n)) {
    return { verdict: "drop", reason: "ruido_tipo" };
  }

  // stores genéricos sin ensayo/sala/estudio/studio en el nombre
  if (
    types.includes("store") &&
    !/ensayo|sala|estudio|\bstudios?\b|grabaci|record/.test(n) &&
    !/^salas?\b/i.test(name)
  ) {
    return { verdict: "drop", reason: "store_generico" };
  }

  if (/ensayo/.test(n)) {
    return { verdict: "keep", reason: "nombre_ensayo" };
  }

  if (
    /grabaci[oó]n|records|recording/.test(n) &&
    /(sala|estudio|\bstudios?\b)/.test(n)
  ) {
    return { verdict: "keep", reason: "estudio_grabacion" };
  }

  // "Salas Foo" / "Sala Foo" suelen ser complejos de ensayo
  if (/^salas?\b/i.test(name) && !/teatro|cultural|independencia|duende/i.test(n)) {
    return { verdict: "keep", reason: "nombre_salas" };
  }

  if (
    (/estudio|\bstudios?\b/.test(n) || /\bhome\s*studio\b/.test(n)) &&
    !/from the garden|veintidos/i.test(n)
  ) {
    return { verdict: "review", reason: "estudio_sin_ensayo" };
  }

  if (/cultural|espacio|club|fundaci[oó]n|galp[oó]n/i.test(n)) {
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

  // backup + overwrite registry limpio (keep+review)
  await mkdir(OUT_DIR, { recursive: true });
  const backupPath = path.join(OUT_DIR, "places-registry.before-clean.json");
  await writeFile(backupPath, raw, "utf8");
  await writeFile(REGISTRY_PATH, JSON.stringify(cleaned, null, 2), "utf8");

  const report = {
    cleanedAt: cleaned.updatedAt,
    before: all.length,
    keep: buckets.keep.length,
    review: buckets.review.length,
    drop: buckets.drop.length,
    after: Object.keys(cleanedPlaces).length,
    dropped: buckets.drop.map(({ entry, reason }) => ({
      id: entry.id,
      name: entry.name,
      address: entry.formattedAddress,
      reason,
    })),
    review: buckets.review.map(({ entry, reason }) => ({
      id: entry.id,
      name: entry.name,
      address: entry.formattedAddress,
      reason,
    })),
    keepNames: buckets.keep
      .map(({ entry }) => entry.name)
      .sort((a, b) => (a ?? "").localeCompare(b ?? "", "es")),
  };

  const reportPath = path.join(OUT_DIR, "places-clean-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("========== LIMPIEZA ==========");
  console.log(`Antes:   ${report.before}`);
  console.log(`Keep:    ${report.keep}`);
  console.log(`Review:  ${report.review}`);
  console.log(`Drop:    ${report.drop}`);
  console.log(`Después: ${report.after} (keep+review)`);
  console.log(`\n✓ Backup: ${backupPath}`);
  console.log(`✓ Registry limpio: ${REGISTRY_PATH}`);
  console.log(`✓ Report: ${reportPath}`);

  console.log("\n--- DROP (muestra) ---");
  for (const d of report.dropped.slice(0, 25)) {
    console.log(`· [${d.reason}] ${d.name}`);
  }
  if (report.dropped.length > 25) {
    console.log(`… +${report.dropped.length - 25} más`);
  }

  console.log("\n--- REVIEW ---");
  for (const d of report.review) {
    console.log(`· [${d.reason}] ${d.name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
