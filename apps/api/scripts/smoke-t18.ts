/**
 * Smoke T18: assertDisponible en holds (horario + duración)
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `disp+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Disp Owner",
      email,
      password: "testpass123",
      businessName: `Disp Studio ${Date.now()}`,
      zona: "Palermo",
    }),
  });
  if (!reg.ok) throw new Error(`register ${reg.status} ${await reg.text()}`);
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
      name: "Sala Disp",
      categoria: "Música",
      precioHora: "4000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status} ${await salaRes.text()}`);
  const sala = (await salaRes.json()) as { id: string };

  const hoy = new Date();
  const ar = new Date(hoy.getTime() - 3 * 3600_000);
  // Usar mañana para no chocar con "pasado" en UI; API no filtra pasado
  ar.setUTCDate(ar.getUTCDate() + 1);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;

  const sessionId = `sess-disp-${Date.now()}-abcdef`;

  // Fuera de horario (seed 10–23)
  const fuera = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({ fecha, horas: ["08:00"] }),
  });
  if (fuera.status !== 400) {
    throw new Error(`fuera expected 400 got ${fuera.status} ${await fuera.text()}`);
  }
  const fueraBody = (await fuera.json()) as { error?: { code?: string } };
  if (fueraBody.error?.code !== "FUERA_DE_HORARIO") {
    throw new Error(`fuera code ${fueraBody.error?.code}`);
  }
  console.log("OK FUERA_DE_HORARIO 08:00");

  // Duración > max (default 240 min = 4h) → 5 horas
  const dur = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": `${sessionId}-b`,
    },
    body: JSON.stringify({
      fecha,
      horas: ["10:00", "11:00", "12:00", "13:00", "14:00"],
    }),
  });
  if (dur.status !== 400) {
    throw new Error(`duracion expected 400 got ${dur.status} ${await dur.text()}`);
  }
  const durBody = (await dur.json()) as { error?: { code?: string } };
  if (durBody.error?.code !== "DURACION_INVALIDA") {
    throw new Error(`duracion code ${durBody.error?.code}`);
  }
  console.log("OK DURACION_INVALIDA 5h");

  // Hold válido 2h
  const ok = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": `${sessionId}-ok`,
    },
    body: JSON.stringify({ fecha, horas: ["18:00", "19:00"] }),
  });
  if (!ok.ok) throw new Error(`hold ok ${ok.status} ${await ok.text()}`);
  console.log("OK hold válido");

  // Panel reserva fuera de horario
  const panel = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      horaInicio: "07:00",
      horaFin: "08:00",
      clienteNombre: "Test",
      clienteTelefono: "1199998877",
      precioTotal: "4000.00",
    }),
  });
  if (panel.status !== 400) {
    throw new Error(`panel expected 400 got ${panel.status} ${await panel.text()}`);
  }
  const panelBody = (await panel.json()) as { error?: { code?: string } };
  if (panelBody.error?.code !== "FUERA_DE_HORARIO") {
    throw new Error(`panel code ${panelBody.error?.code}`);
  }
  console.log("OK panel FUERA_DE_HORARIO");

  console.log("PASS smoke-t18");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
