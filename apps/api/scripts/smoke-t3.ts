/**
 * Smoke T3: crear reserva panel + listar agenda hoy
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `res+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Agenda Owner",
      email,
      password: "testpass123",
      businessName: `Agenda ${Date.now()}`,
      zona: "Caballito",
    }),
  });
  if (!reg.ok) throw new Error(`register ${reg.status}`);
  const { user, tenant } = (await reg.json()) as {
    user: { id: string };
    tenant: { id: string };
  };

  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
      "x-user-id": user.id,
      "x-tenant-id": tenant.id,
    },
    body: JSON.stringify({
      name: "Sala Agenda",
      categoria: "Música",
      precioHora: "3000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status} ${await salaRes.text()}`);
  const sala = (await salaRes.json()) as { id: string };

  const hoy = new Date();
  // AR approx
  const ar = new Date(hoy.getTime() - 3 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;

  const create = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
      "x-user-id": user.id,
      "x-tenant-id": tenant.id,
    },
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      horaInicio: "15:00",
      horaFin: "17:00",
      clienteNombre: "Banda Test",
      clienteTelefono: "11 4444-3333",
      precioTotal: "6000.00",
      senaMonto: "1800.00",
      senaPagada: true,
    }),
  });
  if (!create.ok) throw new Error(`reserva ${create.status} ${await create.text()}`);
  console.log("OK create reserva");

  const agenda = await fetch(`${BASE}/reservas/hoy?fecha=${fecha}`, {
    headers: {
      "x-internal-secret": SECRET,
      "x-user-id": user.id,
      "x-tenant-id": tenant.id,
    },
  });
  if (!agenda.ok) throw new Error(`agenda ${agenda.status}`);
  const body = (await agenda.json()) as { reservas: unknown[] };
  if (body.reservas.length < 1) throw new Error("agenda empty");
  console.log("OK agenda hoy", body.reservas.length);
  console.log("\nSMOKE_T3_PASS");
}

main().catch((e) => {
  console.error("SMOKE_T3_FAIL", e);
  process.exitCode = 1;
});
