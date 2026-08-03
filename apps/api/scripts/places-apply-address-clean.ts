/**
 * Aplica addressClean (Calle Nro, Localidad, CABA|Provincia) a todos los places
 * con details en los 3 registries.
 *
 * Uso: pnpm exec tsx scripts/places-apply-address-clean.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatAddressClean,
  streetAndNumber,
  type AddressRegion,
} from "./lib/format-address.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "out");

const FILES: Array<{ file: string; region: AddressRegion }> = [
  { file: "places-registry.json", region: "caba" },
  { file: "places-registry-zonas.json", region: "zonas" },
  { file: "places-registry-interior.json", region: "interior" },
];

type Place = {
  id: string;
  name: string | null;
  details?: {
    formattedAddress?: string | null;
    barrio?: string | null;
    addressComponents?: unknown;
    addressClean?: string | null;
  } | null;
};

for (const { file, region } of FILES) {
  const path = resolve(OUT, file);
  const reg = JSON.parse(await readFile(path, "utf8")) as {
    updatedAt?: string;
    places: Record<string, Place>;
  };
  let ok = 0;
  let withNumber = 0;
  let noStreet = 0;
  const samples: string[] = [];

  for (const p of Object.values(reg.places)) {
    if (!p.details) continue;
    const clean = formatAddressClean(p.details, {
      region,
      barrioHint: p.details.barrio,
    });
    p.details.addressClean = clean;
    ok++;
    const sn = streetAndNumber(p.details);
    if (sn && /\d/.test(sn)) withNumber++;
    else noStreet++;
    if (samples.length < 5 && clean) {
      samples.push(
        `${p.name}\n  RAW: ${p.details.formattedAddress}\n  CLEAN: ${clean}`,
      );
    }
  }

  reg.updatedAt = new Date().toISOString();
  await writeFile(path, JSON.stringify(reg, null, 2), "utf8");
  console.log(`\n=== ${region} (${file}) ===`);
  console.log(`  con details: ${ok}`);
  console.log(`  calle+número: ${withNumber}`);
  console.log(`  sin número/calle: ${noStreet}`);
  for (const s of samples) console.log(s);
}

console.log("\n✓ addressClean aplicado en los 3 registries");
