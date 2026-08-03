/**
 * Smoke T1: register → negocio GET/PATCH → salas CRUD
 * Run: pnpm --filter api exec tsx scripts/smoke-t1.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

const email = `owner+${Date.now()}@test.local`;
const password = "testpass123";

async function req(
  path: string,
  init?: RequestInit & { userId?: string; tenantId?: string },
) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (init?.userId) {
    headers.set("x-internal-secret", SECRET);
    headers.set("x-user-id", init.userId);
  }
  if (init?.tenantId) headers.set("x-tenant-id", init.tenantId);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const health = await req("/health");
  assert(health.status === 200, `health ${health.status}`);
  console.log("OK health");

  const reg = await req("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "Dueño Test",
      email,
      password,
      businessName: `Estudio Smoke ${Date.now()}`,
      zona: "Palermo",
    }),
  });
  assert(reg.status === 201, `register ${reg.status} ${JSON.stringify(reg.body)}`);
  const userId = (reg.body as { user: { id: string } }).user.id;
  const tenantId = (reg.body as { tenant: { id: string } }).tenant.id;
  console.log("OK register", { userId, tenantId });

  const getNeg = await req("/negocio", { userId, tenantId });
  assert(getNeg.status === 200, `get negocio ${getNeg.status}`);
  console.log("OK get negocio");

  const patchNeg = await req("/negocio", {
    method: "PATCH",
    userId,
    tenantId,
    body: JSON.stringify({
      tenantName: "Estudio Smoke Editado",
      sedeName: "Sede Centro",
      zona: "Almagro",
      address: "Av. Test 123",
      description: "Sala de prueba",
      amenidades: ["WiFi", "Estacionamiento"],
      tagsDestacados: ["WiFi"],
      telefono: "11 5555-0000",
      holdMinutos: 5,
      senaModo: "siempre",
      senaTipo: "porcentaje",
      senaValor: "30",
    }),
  });
  assert(patchNeg.status === 200, `patch negocio ${patchNeg.status} ${JSON.stringify(patchNeg.body)}`);
  console.log("OK patch negocio");

  const createSala = await req("/salas", {
    method: "POST",
    userId,
    tenantId,
    body: JSON.stringify({
      name: "Sala A — Rock",
      categoria: "Música",
      tags: ["Música", "Rock"],
      capacity: 5,
      anchoMetros: 6,
      largoMetros: 4,
      precioHora: "3500.00",
      acustica: "Profesional",
      equipamiento: ["Batería", "Marshall 100W"],
      noIncluido: ["Platos"],
      caracteristicas: ["Batería Mapex", "Marshall 100W"],
      photos: [],
      popular: true,
      nueva: false,
    }),
  });
  assert(
    createSala.status === 201,
    `create sala ${createSala.status} ${JSON.stringify(createSala.body)}`,
  );
  const salaId = (createSala.body as { id: string }).id;
  console.log("OK create sala", salaId);

  const list = await req("/salas", { userId, tenantId });
  assert(list.status === 200, `list salas ${list.status}`);
  const salas = (list.body as { salas: unknown[] }).salas;
  assert(salas.length >= 1, "expected >=1 sala");
  console.log("OK list salas", salas.length);

  const toggle = await req(`/salas/${salaId}/active`, {
    method: "PATCH",
    userId,
    tenantId,
    body: JSON.stringify({ active: false }),
  });
  assert(toggle.status === 200, `toggle ${toggle.status}`);
  console.log("OK toggle sala");

  console.log("\nSMOKE_T1_PASS");
}

main().catch((e) => {
  console.error("SMOKE_T1_FAIL", e);
  process.exitCode = 1;
});
