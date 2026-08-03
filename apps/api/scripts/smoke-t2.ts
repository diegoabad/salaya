/**
 * Smoke T2: público lee estudio/sala desde DB
 * Run: pnpm --filter api exec tsx scripts/smoke-t2.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { createDb, closeDb } from "@repo/db";
import {
  getEstudioPublicoBySlug,
  getSalaPublica,
  listDirectorioPublico,
} from "@repo/db/queries";

config({ path: resolve(process.cwd(), "../../.env") });

const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";
const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;

async function main() {
  const email = `pub+${Date.now()}@test.local`;
  const slugBase = `estudio-pub-${Date.now()}`;

  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Pub Owner",
      email,
      password: "testpass123",
      businessName: "Estudio Publico Test",
      slug: slugBase,
      zona: "Palermo",
    }),
  });
  if (!reg.ok) throw new Error(`register ${reg.status} ${await reg.text()}`);
  const { user, tenant } = (await reg.json()) as {
    user: { id: string };
    tenant: { id: string; slug: string };
  };

  const patch = await fetch(`${BASE}/negocio`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
      "x-user-id": user.id,
      "x-tenant-id": tenant.id,
    },
    body: JSON.stringify({
      tenantName: "Estudio Publico Test",
      sedeName: "Sede Palermo",
      zona: "Palermo",
      address: "Test 100",
      description: "Visible en público",
      amenidades: ["WiFi", "Grabación"],
      tagsDestacados: ["Grabación"],
      telefono: "1155559999",
    }),
  });
  if (!patch.ok) throw new Error(`negocio ${patch.status}`);

  const create = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
      "x-user-id": user.id,
      "x-tenant-id": tenant.id,
    },
    body: JSON.stringify({
      name: "Sala Publica A",
      categoria: "Música",
      tags: ["Música", "Rock"],
      capacity: 4,
      anchoMetros: 5,
      largoMetros: 4,
      precioHora: "2800.00",
      acustica: "Tratada",
      equipamiento: ["Piano"],
      noIncluido: ["Mic"],
      caracteristicas: ["Piano Yamaha"],
      photos: [],
    }),
  });
  if (!create.ok) throw new Error(`sala ${create.status} ${await create.text()}`);
  const sala = (await create.json()) as { slug: string };

  const db = createDb(process.env.DATABASE_URL!);
  try {
    const dir = await listDirectorioPublico(db);
    if (!dir.some((d) => d.slug === tenant.slug)) {
      throw new Error("directorio missing tenant slug");
    }
    console.log("OK directorio contains", tenant.slug);

    const estudio = await getEstudioPublicoBySlug(db, tenant.slug);
    if (!estudio) throw new Error("estudio not found");
    if (estudio.salas.length < 1) throw new Error("no salas");
    console.log("OK estudio publico", estudio.name, estudio.salas.length);

    const detalle = await getSalaPublica(db, tenant.slug, sala.slug);
    if (!detalle) throw new Error("sala detalle not found");
    console.log("OK sala publica", detalle.sala.name);

    console.log("\nSMOKE_T2_PASS");
  } finally {
    await closeDb();
  }
}

main().catch((e) => {
  console.error("SMOKE_T2_FAIL", e);
  process.exitCode = 1;
});
