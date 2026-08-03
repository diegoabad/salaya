/**
 * Compara keywords en un barrio: solape + relevancia heurística por nombre.
 * Uso: pnpm exec tsx scripts/places-compare-keywords.ts Flores
 */
const KEY =
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
if (!KEY) {
  console.error("Falta GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

const barrio = (process.argv[2]?.trim() || "Flores").replace(/\s+/g, " ");
const REFERER = process.env.PLACES_REFERER ?? "http://localhost:3000/";
const keywords = [
  "sala de ensayo",
  "salas de ensayo",
  "estudio de ensayo",
  "sala de ensayo y grabación",
];
const MASK =
  "places.id,places.displayName,places.formattedAddress,places.businessStatus,places.rating,places.types";

type Hit = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  businessStatus?: string;
};

async function search(q: string): Promise<Hit[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY!,
      "X-Goog-FieldMask": MASK,
      Referer: REFERER,
    },
    body: JSON.stringify({
      textQuery: q,
      languageCode: "es",
      regionCode: "AR",
      maxResultCount: 20,
    }),
  });
  const data = (await res.json()) as { places?: Hit[]; error?: { message?: string } };
  if (!res.ok) throw new Error(JSON.stringify(data));
  return (data.places ?? []).filter((p) => p.businessStatus === "OPERATIONAL");
}

function nid(id: string) {
  return id.startsWith("places/") ? id.slice(7) : id;
}

function relevant(name: string): "relevante" | "dudoso" | "ruido" {
  const n = name.toLowerCase();
  const noise =
    /\bteatro\b/.test(n) ||
    /\bescuela\b/.test(n) ||
    /\bacademia\b/.test(n) ||
    /\bshop\b/.test(n) ||
    /\btienda\b/.test(n) ||
    /\binstrumentos\b/.test(n) ||
    /\bmilonga\b/.test(n) ||
    /\bmusic store\b/.test(n) ||
    /\bbar\b/.test(n) ||
    /\bclub cultural\b/.test(n) ||
    /\bpatio cultural\b/.test(n);
  const ensayo = n.includes("ensayo");
  const grab = /grabaci[oó]n|records|recording/.test(n);
  if (ensayo) return "relevante";
  if (grab && (n.includes("sala") || n.includes("estudio"))) return "relevante";
  if (noise) return "ruido";
  if (n.includes("estudio") || n.includes("sala")) return "dudoso";
  return "ruido";
}

async function main() {
  const byKw = new Map<string, Map<string, Hit>>();

  for (const kw of keywords) {
    const q = `${kw} ${barrio} Buenos Aires`;
    const rows = await search(q);
    const m = new Map<string, Hit>();
    for (const p of rows) {
      const id = nid(p.id);
      if (!m.has(id)) m.set(id, { ...p, id });
    }
    byKw.set(kw, m);
    console.log(`## ${kw} → ${m.size}`);
  }

  type Entry = {
    name: string;
    address: string;
    kws: string[];
    rel: ReturnType<typeof relevant>;
  };
  const all = new Map<string, Entry>();

  for (const [kw, m] of byKw) {
    for (const [id, p] of m) {
      const name = p.displayName?.text ?? "—";
      const cur = all.get(id);
      if (!cur) {
        all.set(id, {
          name,
          address: p.formattedAddress ?? "—",
          kws: [kw],
          rel: relevant(name),
        });
      } else {
        cur.kws.push(kw);
      }
    }
  }

  console.log("\n========== POR KEYWORD ==========");
  for (const kw of keywords) {
    const m = byKw.get(kw)!;
    let rel = 0;
    let dud = 0;
    let ruido = 0;
    const exclusivos: string[] = [];
    for (const [id, p] of m) {
      const name = p.displayName?.text ?? "";
      const r = relevant(name);
      if (r === "relevante") rel++;
      else if (r === "dudoso") dud++;
      else ruido++;
      if ((all.get(id)?.kws.length ?? 0) === 1) exclusivos.push(name);
    }
    const exclRel = exclusivos.filter((n) => relevant(n) === "relevante");
    console.log(`\n${kw}`);
    console.log(
      `  total=${m.size} | relevante≈${rel} | dudoso≈${dud} | ruido≈${ruido}`,
    );
    console.log(
      `  solo esta kw: ${exclusivos.length} | exclusivos relevantes: ${exclRel.length}`,
    );
    if (exclRel.length) {
      for (const n of exclRel) console.log(`    + ${n}`);
    }
    if (exclusivos.filter((n) => relevant(n) !== "relevante").length) {
      console.log("  exclusivos no relevantes:");
      for (const n of exclusivos.filter((n) => relevant(n) !== "relevante")) {
        console.log(`    · [${relevant(n)}] ${n}`);
      }
    }
  }

  const base = byKw.get("sala de ensayo")!;
  console.log("\n========== SOLAPE vs 'sala de ensayo' ==========");
  for (const kw of keywords.slice(1)) {
    const m = byKw.get(kw)!;
    let overlap = 0;
    for (const id of m.keys()) if (base.has(id)) overlap++;
    const pct = m.size ? Math.round((overlap / m.size) * 100) : 0;
    console.log(`${kw}: ${overlap}/${m.size} también en singular (${pct}%)`);
  }

  // coverage if we keep only subset
  const keep = ["sala de ensayo", "estudio de ensayo", "sala de ensayo y grabación"];
  const keepIds = new Set<string>();
  for (const kw of keep) {
    for (const id of byKw.get(kw)!.keys()) keepIds.add(id);
  }
  const allRel = [...all.entries()].filter(([, e]) => e.rel === "relevante");
  const coveredRel = allRel.filter(([id]) => keepIds.has(id)).length;
  console.log(
    `\nSi usamos solo: ${keep.join(" + ")} → cubre ${coveredRel}/${allRel.length} relevantes`,
  );

  console.log("\n========== LISTADO ==========");
  const sorted = [...all.values()].sort(
    (a, b) => a.rel.localeCompare(b.rel) || a.name.localeCompare(b.name, "es"),
  );
  for (const e of sorted) {
    console.log(`[${e.rel}] ${e.name}`);
    console.log(`   ${e.kws.join(" · ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
