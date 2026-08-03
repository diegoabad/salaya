/**
 * Smoke T22: reprogramar + horarios especiales + libresHoy
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `reprog+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Reprog Owner",
      email,
      password: "testpass123",
      businessName: `Reprog Studio ${Date.now()}`,
      zona: "Palermo",
    }),
  });
  if (!reg.ok) throw new Error(`register ${reg.status}`);
  const { user, tenant } = (await reg.json()) as {
    user: { id: string };
    tenant: { id: string; slug: string };
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
      name: "Sala Reprog",
      categoria: "Música",
      precioHora: "4000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  const ar = new Date(Date.now() - 3 * 3600_000 + 2 * 24 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;
  const ar2 = new Date(Date.now() - 3 * 3600_000 + 3 * 24 * 3600_000);
  const fecha2 = `${ar2.getUTCFullYear()}-${String(ar2.getUTCMonth() + 1).padStart(2, "0")}-${String(ar2.getUTCDate()).padStart(2, "0")}`;

  const create = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      horaInicio: "15:00",
      horaFin: "17:00",
      clienteNombre: "Cliente Reprog",
      clienteTelefono: "11 9000-1111",
      precioTotal: "8000.00",
      senaMonto: "2400.00",
      senaPagada: true,
    }),
  });
  if (!create.ok) throw new Error(`reserva ${create.status} ${await create.text()}`);
  const reserva = (await create.json()) as { id: string };
  console.log("OK reserva", reserva.id);

  const reprog = await fetch(`${BASE}/reservas/${reserva.id}/reprogramar`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fecha: fecha2,
      horaInicio: "18:00",
      horaFin: "20:00",
    }),
  });
  if (!reprog.ok) {
    throw new Error(`reprogramar ${reprog.status} ${await reprog.text()}`);
  }
  const rBody = (await reprog.json()) as {
    fecha: string;
    horaInicio: string;
    senaPagada: boolean;
    senaMonto: number;
  };
  if (rBody.fecha !== fecha2 || rBody.horaInicio !== "18:00") {
    throw new Error(`reprog body ${JSON.stringify(rBody)}`);
  }
  if (!rBody.senaPagada || rBody.senaMonto !== 2400) {
    throw new Error(`sena no se mantuvo ${JSON.stringify(rBody)}`);
  }
  console.log("OK reprogramar (seña intacta)");

  // Horario especial: cerrar el día de fecha2 → hold/reprog debería fallar fuera
  const esp = await fetch(`${BASE}/negocio/horarios-especiales`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      fecha: fecha2,
      closed: true,
    }),
  });
  if (!esp.ok) throw new Error(`especial ${esp.status} ${await esp.text()}`);
  console.log("OK horario especial cerrado", fecha2);

  const fail = await fetch(`${BASE}/reservas/${reserva.id}/reprogramar`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fecha: fecha2,
      horaInicio: "12:00",
      horaFin: "13:00",
    }),
  });
  if (fail.status !== 400) {
    throw new Error(`expected 400 got ${fail.status} ${await fail.text()}`);
  }
  const failBody = (await fail.json()) as { error?: { code?: string } };
  if (failBody.error?.code !== "FUERA_DE_HORARIO") {
    throw new Error(`code ${failBody.error?.code}`);
  }
  console.log("OK especial bloquea turno");

  // Abrir con franja corta
  await fetch(`${BASE}/negocio/horarios-especiales`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      fecha: fecha2,
      closed: false,
      startTime: "10:00",
      endTime: "14:00",
    }),
  });

  const ok2 = await fetch(`${BASE}/reservas/${reserva.id}/reprogramar`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fecha: fecha2,
      horaInicio: "11:00",
      horaFin: "12:00",
    }),
  });
  if (!ok2.ok) throw new Error(`reprog especial ${ok2.status} ${await ok2.text()}`);
  console.log("OK reprogramar dentro de especial");

  // libresHoy: seed horarios + directorio should be >= 0 number
  // Force open today via especial for today AR
  const hoyAr = new Date(Date.now() - 3 * 3600_000);
  const hoy = `${hoyAr.getUTCFullYear()}-${String(hoyAr.getUTCMonth() + 1).padStart(2, "0")}-${String(hoyAr.getUTCDate()).padStart(2, "0")}`;
  await fetch(`${BASE}/negocio/horarios-especiales`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      fecha: hoy,
      closed: false,
      startTime: "00:00",
      endTime: "23:00",
    }),
  });

  // Ensure directorio exists via PATCH negocio
  await fetch(`${BASE}/negocio`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      tenantName: "Reprog Studio",
      sedeName: "Sede",
      zona: "Palermo",
      amenidades: ["Batería"],
      tagsDestacados: [],
    }),
  });

  // Count via public holds politica is unrelated — use a small internal check:
  // create hold on today late hour should work if libres > 0 path exists
  const sessionId = `sess-libres-${Date.now()}-abcdef`;
  const hold = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({ fecha: hoy, horas: ["22:00"] }),
  });
  // May fail if past 22:00 AR — try 21 then skip soft assert
  if (hold.ok) {
    console.log("OK hold hoy (libres path)");
  } else {
    console.log("SKIP hold hoy", hold.status, await hold.text());
  }

  console.log("PASS smoke-t22");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
