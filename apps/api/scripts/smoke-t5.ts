/**
 * Smoke T5: adicionales + reglas de precio
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `prec+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Precios Owner",
      email,
      password: "testpass123",
      businessName: `Precios ${Date.now()}`,
      zona: "Belgrano",
    }),
  });
  if (!reg.ok) throw new Error(`register ${reg.status}`);
  const { user, tenant } = (await reg.json()) as {
    user: { id: string };
    tenant: { id: string };
  };

  const headers = {
    "Content-Type": "application/json",
    "x-internal-secret": SECRET,
    "x-user-id": user.id,
    "x-tenant-id": tenant.id,
  };

  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala Promo",
      categoria: "Música",
      precioHora: "5000.00",
      capacity: 5,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  const ad = await fetch(`${BASE}/adicionales`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      grupoName: "Audio",
      name: "Mic SM58",
      precioBase: "800.00",
      modalidad: "por_reserva",
      stock: 3,
    }),
  });
  if (!ad.ok) throw new Error(`adicional ${ad.status} ${await ad.text()}`);
  console.log("OK create adicional");

  const listAd = await fetch(`${BASE}/adicionales`, { headers });
  const { adicionales } = (await listAd.json()) as { adicionales: unknown[] };
  if (adicionales.length < 1) throw new Error("adicionales empty");
  console.log("OK list adicionales", adicionales.length);

  const regla = await fetch(`${BASE}/precios/reglas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      scope: "sala",
      scopeId: sala.id,
      tipo: "continuo",
      nombre: "Happy hour",
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: "14:00",
      endTime: "18:00",
      precioPorHora: "3500.00",
      descuentoPorcentaje: "30.00",
    }),
  });
  if (!regla.ok) throw new Error(`regla ${regla.status} ${await regla.text()}`);
  console.log("OK create regla");

  const precios = await fetch(`${BASE}/precios`, { headers });
  if (!precios.ok) throw new Error(`precios ${precios.status}`);
  const body = (await precios.json()) as {
    salas: unknown[];
    reglas: unknown[];
  };
  if (body.salas.length < 1) throw new Error("salas empty in precios");
  if (body.reglas.length < 1) throw new Error("reglas empty");
  console.log("OK precios bundle", body.salas.length, body.reglas.length);

  console.log("\nSMOKE_T5_PASS");
}

main().catch((e) => {
  console.error("SMOKE_T5_FAIL", e);
  process.exitCode = 1;
});
