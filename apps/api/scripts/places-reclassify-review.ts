/**
 * Segunda/tercera pasada sobre review: propone keep / drop / still_review.
 * Uso:
 *   pnpm exec tsx scripts/places-reclassify-review.ts
 *   pnpm exec tsx scripts/places-reclassify-review.ts --apply
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "out");
const APPLY = process.argv.includes("--apply");

const KEEP_DONE = new Set([
  "nombre_ensayo",
  "estudio_grabacion",
  "nombre_salas",
  "manual_ok",
]);

type Place = {
  id: string;
  name: string | null;
  cleanReason?: string;
  manualApprovedAt?: string;
  details?: {
    primaryTypeDisplayName?: string | null;
    primaryType?: string | null;
    editorialSummary?: string | null;
    website?: string | null;
    rating?: number | null;
    userRatingCount?: number | null;
  } | null;
  rating?: number | null;
  userRatingCount?: number | null;
};

type Row = {
  origen: string;
  file: string;
  id: string;
  name: string | null;
  cleanReason?: string;
  category: string | null;
  why: string;
  summary: string;
};

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function classify(p: Place): { v: "keep" | "drop" | "review"; why: string } {
  const name = p.name ?? "";
  const n = fold(name);
  const cat = p.details?.primaryTypeDisplayName ?? "";
  const summary = fold(p.details?.editorialSummary ?? "");
  const text = `${n} ${summary}`;

  const dropCats = new Set([
    "Complejo hotelero",
    "Centro de información turística",
    "Agencia de viajes",
    "Contabilidad",
    "Clínica dental",
    "Clínica ambulatoria",
    "Salud y bienestar",
    "Bancos y finanzas",
    "Lavandería",
    "Parada de autobús",
    "Casino",
    "Bed & Breakfast",
    "Casa rural",
    "Estancia en granjas",
    "Mirador",
    "Reserva natural",
    "Lugar de interés histórico",
    "Instituto de investigación",
    "Cuidados veterinarios",
    "Mercado",
    "Balneario público",
    "Polideportivo",
    "Escuela deportiva",
    "Barbería",
    "Cadena de televisión",
    "Aparcamiento",
    "Cine",
    "Body art service",
    "Asesor",
  ]);

  const hasStudio =
    /\b(estudio|estudios|\bstudio\b|\bstudios\b|home\s*studio)\b/.test(n);
  const hasRecording =
    /\b(grabaci[oó]n|grabacion|recording|records|record|mastering|mezcla|mix\b|produccion musical|producción musical|audio)\b/.test(
      n,
    );
  const hasEnsayo = /\bensayo\b/.test(n);
  const hasSala = /\bsalas?\b/.test(n);
  const strongKeep =
    hasEnsayo ||
    (hasStudio && hasRecording) ||
    /\b(sala de ensayo|salas de ensayo|recording studio|estudio de grabacion)\b/.test(
      n,
    );

  if (dropCats.has(cat) && !strongKeep && !hasEnsayo) {
    return { v: "drop", why: `cat_ruido:${cat}` };
  }

  // Ruido claro en nombre
  if (
    /\b(escribania|gestoria|odontolog|dental|hotel|hostal|hosteria|casino|turismo|turistic|terminal de omnibus|inta\b|juzgado|cementera|fotocopiad|lavander|feria franca|monumento|unidad carcelaria|planta experimental|cabalgata|informacion turistica|diario digital|canal\s*\d|fm\s*\d|\bradio\b|secretaria de cultura|subsecretaria|direccion de cultura|casa de la cultura|casa de la historia|centro de jub|sociedad rural|complejo termal|complejo turistico|punto digital|oficina de turismo|municipalidad|concejo|fotografic|estudio (contable|juridico|fotograf|grafico)|mbya estudio grafico|clases de (violin|guitarra|canto|piano|bateria|percusion)|escuela|academia|conservatorio|institucion educativa|ringo escuela|aural escuela|tecson)\b/.test(
      n,
    ) &&
    !hasEnsayo
  ) {
    return { v: "drop", why: "nombre_ruido" };
  }

  // Streaming / podcast / film / foto / TV sin música clara
  if (
    /\b(podcast|streaming|filmacion|filmación|audiovisual|television|televisi[oó]n|torrent cine|cine\b|fotograf|foto estudio|locutor|locuciones|doblajes)\b/.test(
      n,
    ) &&
    !hasEnsayo &&
    !/\b(musica|música|music|grabacion|grabación|recording|ensayo|banda|rock)\b/.test(
      text,
    )
  ) {
    return { v: "drop", why: "audiovisual_sin_musica" };
  }

  if (
    /\b(bar|club nocturno|lounge)\b/i.test(cat) &&
    !/\b(ensayo|grabaci|estudio|records|sala|studio)\b/.test(n)
  ) {
    return { v: "drop", why: "bar_sin_musica" };
  }

  if (p.cleanReason === "bar_con_ensayo" && /\bsala(s)? de ensayo\b/.test(n)) {
    return { v: "keep", why: "bar_pero_ensayo_claro" };
  }

  if (strongKeep) return { v: "keep", why: "nombre_fuerte" };
  if (hasEnsayo && (hasSala || hasStudio || hasRecording)) {
    return { v: "keep", why: "ensayo_en_nombre" };
  }

  // Estudio / Studio + señales musicales en nombre o summary
  if (
    hasStudio &&
    /\b(musica|music|audio|sound|grab|record|mix|master|banda|rock|hip\s*hop|rap|ensayo|rehearsal|produccion|producción)\b/.test(
      text,
    )
  ) {
    return { v: "keep", why: "estudio_musical" };
  }

  // "X Records" / "X Recording" / "Recording Studio"
  if (
    /\b(records|recording|recordings)\b/.test(n) &&
    !/\b(radio|tv|television|cine|foto)\b/.test(n)
  ) {
    return { v: "keep", why: "records_studio" };
  }

  // Solo "Estudio Foo" / "Foo Studio" sin más → keep suave si es comercio y no ruido
  if (
    (p.cleanReason === "estudio_sin_ensayo" || hasStudio) &&
    !/\b(danza|danzas|arte|foto|grafico|gráfico|contable|juridico|jurídico|oficina|streaming|podcast|cine|tv|television|escuela|clases|canto)\b/.test(
      n,
    ) &&
    (cat === "Comercio" ||
      cat === "Servicios" ||
      cat === "Fábrica" ||
      !cat)
  ) {
    return { v: "keep", why: "estudio_probable" };
  }

  if (
    /\b(casa de la cultura|centro cultural|clases de (musica|violin)|academia|escuela|conservatorio|orquesta|sindicato|municipal|punto joven)\b/.test(
      n,
    ) &&
    !hasEnsayo &&
    !hasRecording
  ) {
    return { v: "drop", why: "cultura_educacion" };
  }

  if (
    /\b(centro cultural|institucion educativa)\b/i.test(cat) &&
    !strongKeep &&
    !hasEnsayo &&
    !hasStudio &&
    !hasRecording
  ) {
    return { v: "drop", why: "cat_cultura" };
  }

  if (
    /\b(recinto para eventos|salon recreativo|salón recreativo)\b/i.test(cat) &&
    !hasEnsayo &&
    !hasStudio
  ) {
    return { v: "drop", why: "eventos" };
  }

  if (
    /\basociacion u organizacion\b/i.test(cat) &&
    !/\b(ensayo|grabaci|records|estudio|studio|musica|music)\b/.test(n)
  ) {
    return { v: "drop", why: "asociacion_sin_musica" };
  }

  // Dudosos con "Sala X" genérica sin ensayo → keep suave si parece sala musical
  if (
    /^la sala\b/.test(n) ||
    /^sala\b/.test(n) ||
    /\bsalasfusion\b/.test(n) ||
    /\bsala del\b/.test(n)
  ) {
    if (/\b(teatro|cultural|independencia|evento|fiesta|congreso)\b/.test(n)) {
      return { v: "drop", why: "sala_no_ensayo" };
    }
    return { v: "keep", why: "sala_probable" };
  }

  return { v: "review", why: "sigue_dudoso" };
}

const registries: Array<{ origen: string; file: string }> = [
  { origen: "caba", file: "places-registry.json" },
  { origen: "zonas", file: "places-registry-zonas.json" },
  { origen: "interior", file: "places-registry-interior.json" },
];

const buckets: Record<"keep" | "drop" | "review", Row[]> = {
  keep: [],
  drop: [],
  review: [],
};

const loaded: Array<{
  origen: string;
  file: string;
  path: string;
  reg: { places: Record<string, Place>; updatedAt?: string };
}> = [];

for (const { origen, file } of registries) {
  const p = resolve(OUT, file);
  const reg = JSON.parse(await readFile(p, "utf8")) as {
    places: Record<string, Place>;
    updatedAt?: string;
  };
  loaded.push({ origen, file, path: p, reg });
  for (const place of Object.values(reg.places ?? {})) {
    if (!place.cleanReason || KEEP_DONE.has(place.cleanReason)) continue;
    const { v, why } = classify(place);
    buckets[v].push({
      origen,
      file,
      id: place.id,
      name: place.name,
      cleanReason: place.cleanReason,
      category: place.details?.primaryTypeDisplayName ?? null,
      why,
      summary: (place.details?.editorialSummary ?? "").slice(0, 120),
    });
  }
}

const proposal = {
  generatedAt: new Date().toISOString(),
  applied: APPLY,
  counts: {
    input:
      buckets.keep.length + buckets.drop.length + buckets.review.length,
    keep: buckets.keep.length,
    drop: buckets.drop.length,
    still_review: buckets.review.length,
  },
  keepWhy: Object.fromEntries(
    [...new Set(buckets.keep.map((r) => r.why))].map((w) => [
      w,
      buckets.keep.filter((r) => r.why === w).length,
    ]),
  ),
  dropWhy: Object.fromEntries(
    [...new Set(buckets.drop.map((r) => r.why))].map((w) => [
      w,
      buckets.drop.filter((r) => r.why === w).length,
    ]),
  ),
  keep: buckets.keep,
  drop: buckets.drop,
  still_review: buckets.review,
};

await writeFile(
  resolve(OUT, "places-reclassify-proposal.json"),
  JSON.stringify(proposal, null, 2),
  "utf8",
);

const md: string[] = [
  `# Reclasificación review (${proposal.counts.input})`,
  "",
  `- Keep sugerido: **${proposal.counts.keep}**`,
  `- Drop sugerido: **${proposal.counts.drop}**`,
  `- Sigue dudoso: **${proposal.counts.still_review}**`,
  "",
  "## Keep por motivo",
  "",
];
for (const [w, n] of Object.entries(proposal.keepWhy)) {
  md.push(`- ${w}: ${n}`);
}
md.push("", "## Drop por motivo", "");
for (const [w, n] of Object.entries(proposal.dropWhy)) {
  md.push(`- ${w}: ${n}`);
}
md.push("", "## Keep (muestra)", "");
for (const r of buckets.keep.slice(0, 40)) {
  md.push(`- [${r.origen}] ${r.name} — ${r.why}`);
}
md.push("", "## Drop (muestra)", "");
for (const r of buckets.drop.slice(0, 40)) {
  md.push(`- [${r.origen}] ${r.name} — ${r.why}`);
}
md.push("", "## Sigue dudoso", "");
for (const r of buckets.review) {
  md.push(`- [${r.origen}] ${r.name} — ${r.category ?? "—"}`);
}
await writeFile(
  resolve(OUT, "places-reclassify-proposal.md"),
  md.join("\n") + "\n",
  "utf8",
);

if (APPLY) {
  const keepIds = new Set(buckets.keep.map((r) => r.id));
  const dropIds = new Set(buckets.drop.map((r) => r.id));
  const now = new Date().toISOString();
  let keepN = 0;
  let dropN = 0;

  for (const { path: p, reg } of loaded) {
    let changed = false;
    for (const place of Object.values(reg.places)) {
      if (keepIds.has(place.id)) {
        place.cleanReason = "manual_ok";
        place.manualApprovedAt = now;
        keepN++;
        changed = true;
      } else if (dropIds.has(place.id)) {
        delete reg.places[place.id];
        dropN++;
        changed = true;
      }
    }
    if (changed) {
      reg.updatedAt = now;
      await writeFile(p, JSON.stringify(reg, null, 2), "utf8");
    }
  }

  const logPath = resolve(OUT, "places-manual-approved.json");
  let prev: { places?: Array<{ id: string }> } = {};
  try {
    prev = JSON.parse(await readFile(logPath, "utf8"));
  } catch {
    /* empty */
  }
  const byId = new Map((prev.places ?? []).map((x) => [x.id, x]));
  for (const r of buckets.keep) {
    byId.set(r.id, {
      file: r.file,
      name: r.name,
      id: r.id,
      from: r.cleanReason,
      to: "manual_ok",
      via: "reclassify",
      why: r.why,
    });
  }
  const places = [...byId.values()];
  await writeFile(
    logPath,
    JSON.stringify({ updatedAt: now, count: places.length, places }, null, 2),
    "utf8",
  );

  console.log(`APPLIED keep=${keepN} drop=${dropN}`);
}

console.log(JSON.stringify(proposal.counts, null, 2));
console.log("keepWhy", proposal.keepWhy);
console.log("dropWhy", proposal.dropWhy);
console.log("→ scripts/out/places-reclassify-proposal.md");
if (!APPLY) {
  console.log(
    'Dry-run. Para aplicar: pnpm exec tsx scripts/places-reclassify-review.ts --apply',
  );
}
