/**
 * Smoke T19: ABM horarios de atención + hold fuera de franja del día
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

function fechaMananaAR(): string {
  const hoy = new Date();
  const ar = new Date(hoy.getTime() - 3 * 3600_000);
  ar.setUTCDate(ar.getUTCDate() + 1);
  return `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;
}

function dayOfWeekAR(fecha: string): number {
  // fecha YYYY-MM-DD interpretada como mediodía AR ≈ 15:00 UTC
  const [y, m, d] = fecha.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d!, 15, 0, 0);
  return new Date(utc).getUTCDay();
}

async function main() {
  const email = `horarios+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Horarios Owner",
      email,
      password: "testpass123",
      businessName: `Horarios Studio ${Date.now()}`,
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
      name: "Sala Horarios",
      categoria: "Música",
      precioHora: "4000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status} ${await salaRes.text()}`);
  const sala = (await salaRes.json()) as { id: string };

  const fecha = fechaMananaAR();
  const dow = dayOfWeekAR(fecha);

  // Solo el día de mañana abierto 14:00–18:00; resto cerrado
  const put = await fetch(`${BASE}/negocio/horarios`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      horarios: [
        { dayOfWeek: dow, startTime: "14:00", endTime: "18:00" },
        ...[0, 1, 2, 3, 4, 5, 6]
          .filter((d) => d !== dow)
          .map((d) => ({ dayOfWeek: d, closed: true })),
      ],
    }),
  });
  if (!put.ok) throw new Error(`put horarios ${put.status} ${await put.text()}`);
  const negocio = (await put.json()) as {
    horarios: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  };
  if (negocio.horarios.length !== 1 || negocio.horarios[0]?.dayOfWeek !== dow) {
    throw new Error(`horarios unexpected ${JSON.stringify(negocio.horarios)}`);
  }
  console.log("OK PUT horarios (1 día abierto)");

  const pol = await fetch(`${BASE}/public/salas/${sala.id}/holds`);
  if (!pol.ok) throw new Error(`politica ${pol.status}`);
  const polBody = (await pol.json()) as {
    horarios?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  };
  if (!polBody.horarios?.some((h) => h.dayOfWeek === dow && h.startTime === "14:00")) {
    throw new Error(`politica horarios ${JSON.stringify(polBody.horarios)}`);
  }
  console.log("OK política pública incluye horarios");

  const sessionId = `sess-hor-${Date.now()}-abcdef`;

  // Fuera de franja del día (10:00 con atención 14–18)
  const fuera = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({ fecha, horas: ["10:00"] }),
  });
  if (fuera.status !== 400) {
    throw new Error(`fuera expected 400 got ${fuera.status} ${await fuera.text()}`);
  }
  const fueraBody = (await fuera.json()) as { error?: { code?: string } };
  if (fueraBody.error?.code !== "FUERA_DE_HORARIO") {
    throw new Error(`fuera code ${fueraBody.error?.code}`);
  }
  console.log("OK FUERA_DE_HORARIO 10:00");

  // Dentro de franja
  const ok = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": `${sessionId}-ok`,
    },
    body: JSON.stringify({ fecha, horas: ["15:00", "16:00"] }),
  });
  if (!ok.ok) throw new Error(`hold ok ${ok.status} ${await ok.text()}`);
  console.log("OK hold dentro de franja");

  // Día cerrado: usar un día que no sea dow (buscar fecha +N)
  let fechaCerrada = fecha;
  let closedDow = dow;
  for (let i = 2; i <= 8; i++) {
    const [y, m, d] = fecha.split("-").map(Number);
    const utc = Date.UTC(y!, m! - 1, d! + i, 15, 0, 0);
    const dt = new Date(utc);
    closedDow = dt.getUTCDay();
    if (closedDow !== dow) {
      fechaCerrada = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
      break;
    }
  }
  const cerrado = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": `${sessionId}-closed`,
    },
    body: JSON.stringify({ fecha: fechaCerrada, horas: ["15:00"] }),
  });
  if (cerrado.status !== 400) {
    throw new Error(
      `cerrado expected 400 got ${cerrado.status} ${await cerrado.text()}`,
    );
  }
  const cerradoBody = (await cerrado.json()) as { error?: { code?: string } };
  if (cerradoBody.error?.code !== "FUERA_DE_HORARIO") {
    throw new Error(`cerrado code ${cerradoBody.error?.code}`);
  }
  console.log(`OK día cerrado (${fechaCerrada} dow=${closedDow})`);

  console.log("PASS smoke-t19");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
