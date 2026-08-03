/**
 * Smoke T17: bloqueos ABM + ocupación + hold rechazado
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `bloq+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bloq Owner",
      email,
      password: "testpass123",
      businessName: `Bloq Studio ${Date.now()}`,
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
      name: "Sala Bloqueo",
      categoria: "Música",
      precioHora: "4500.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status} ${await salaRes.text()}`);
  const sala = (await salaRes.json()) as { id: string };

  const hoy = new Date();
  const ar = new Date(hoy.getTime() - 3 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;

  const create = await fetch(`${BASE}/bloqueos`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      startTime: "15:00",
      endTime: "17:00",
      motivo: "Mantenimiento",
    }),
  });
  if (!create.ok) {
    throw new Error(`create bloqueo ${create.status} ${await create.text()}`);
  }
  const bloq = (await create.json()) as { id: string; startTime: string };
  if (bloq.startTime !== "15:00") throw new Error(`start ${bloq.startTime}`);
  console.log("OK create bloqueo", bloq.id);

  const list = await fetch(`${BASE}/bloqueos`, { headers });
  if (!list.ok) throw new Error(`list ${list.status}`);
  const listBody = (await list.json()) as { bloqueos: { id: string }[] };
  if (!listBody.bloqueos.some((b) => b.id === bloq.id)) {
    throw new Error("list missing bloqueo");
  }
  console.log("OK list", listBody.bloqueos.length);

  const ocup = await fetch(
    `${BASE}/public/salas/${sala.id}/holds/ocupacion?fecha=${fecha}`,
  );
  if (!ocup.ok) throw new Error(`ocupacion ${ocup.status}`);
  const ocupBody = (await ocup.json()) as { horas: string[] };
  if (!ocupBody.horas.includes("15:00") || !ocupBody.horas.includes("16:00")) {
    throw new Error(`ocupacion horas ${ocupBody.horas.join(",")}`);
  }
  console.log("OK ocupacion con bloqueo", ocupBody.horas.join(","));

  const sessionId = `sess-bloq-${Date.now()}-abcdef`;
  const put = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({ fecha, horas: ["15:00"] }),
  });
  if (put.status !== 409) {
    throw new Error(`expected BLOQUEO 409 got ${put.status} ${await put.text()}`);
  }
  const err = (await put.json()) as { error?: { code?: string } };
  if (err.error?.code !== "BLOQUEO") {
    throw new Error(`code ${err.error?.code}`);
  }
  console.log("OK hold rechazado BLOQUEO");

  const del = await fetch(`${BASE}/bloqueos/${bloq.id}`, {
    method: "DELETE",
    headers,
  });
  if (del.status !== 204) {
    throw new Error(`delete ${del.status}`);
  }
  console.log("OK delete bloqueo");

  const put2 = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({ fecha, horas: ["15:00"] }),
  });
  if (!put2.ok) {
    throw new Error(`hold after delete ${put2.status} ${await put2.text()}`);
  }
  console.log("OK hold tras quitar bloqueo");

  console.log("PASS smoke-t17");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
