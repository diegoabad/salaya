/**
 * Smoke T7: connect MP (mock) + checkout hold → mock-pay → reserva senada + caja
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });
process.env.MP_MOCK = "true";

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `mp+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "MP Owner",
      email,
      password: "testpass123",
      businessName: `MP Studio ${Date.now()}`,
      zona: "Núñez",
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

  // política con seña
  const neg = await fetch(`${BASE}/negocio`, { headers });
  const negBody = (await neg.json()) as {
    tenant: { name: string };
    sede: {
      name: string;
      zona: string | null;
      address: string | null;
      description: string | null;
      photoUrl: string | null;
      amenidades: string[];
    };
    directorio: { telefono: string | null };
  };
  const patch = await fetch(`${BASE}/negocio`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      tenantName: negBody.tenant.name,
      sedeName: negBody.sede.name,
      zona: negBody.sede.zona ?? "Núñez",
      address: negBody.sede.address ?? "",
      description: negBody.sede.description ?? "",
      photoUrl: negBody.sede.photoUrl ?? "",
      telefono: negBody.directorio?.telefono ?? "",
      amenidades: negBody.sede.amenidades ?? [],
      tagsDestacados: [],
      senaModo: "siempre",
      senaTipo: "porcentaje",
      senaValor: "30",
    }),
  });
  if (!patch.ok) throw new Error(`negocio ${patch.status} ${await patch.text()}`);

  const connect = await fetch(`${BASE}/mp/connect`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      accessToken: "APP_USR-TEST-TOKEN-SMOKE-1234567890",
      mpUserId: "12345",
    }),
  });
  if (!connect.ok) throw new Error(`connect ${connect.status} ${await connect.text()}`);
  console.log("OK mp connect (encrypted)");

  const status = await fetch(`${BASE}/mp/status`, { headers });
  const st = (await status.json()) as { connected: boolean; tenantConnected: boolean };
  if (!st.tenantConnected) throw new Error("not tenant connected");
  console.log("OK mp status");

  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala MP",
      categoria: "Música",
      precioHora: "4000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  const ar = new Date(Date.now() - 3 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;
  const sessionId = `sess-mp-${Date.now()}-abcdef`;

  const put = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({ fecha, horas: ["16:00", "17:00"] }),
  });
  if (!put.ok) throw new Error(`hold ${put.status} ${await put.text()}`);
  console.log("OK hold");

  const checkout = await fetch(`${BASE}/public/salas/${sala.id}/holds/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({
      clienteNombre: "Banda MP",
      clienteTelefono: "11 3333-4444",
      clienteEmail: "banda@mp.test",
    }),
  });
  if (!checkout.ok) {
    throw new Error(`checkout ${checkout.status} ${await checkout.text()}`);
  }
  const ch = (await checkout.json()) as {
    externalReference: string;
    initPoint: string;
    monto: number;
    mock: boolean;
  };
  if (!ch.externalReference || !ch.initPoint) throw new Error("checkout incomplete");
  console.log("OK checkout", ch.monto, "mock=", ch.mock);

  const pay = await fetch(`${BASE}/public/pagos/mock-pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ externalReference: ch.externalReference }),
  });
  if (!pay.ok) throw new Error(`mock-pay ${pay.status} ${await pay.text()}`);
  console.log("OK mock-pay");

  // Idempotencia: mismo payment no debe fallar el webhook
  const wh1 = await fetch(`${BASE}/webhooks/mercadopago`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: `evt-${ch.externalReference}`,
      type: "payment",
      external_reference: ch.externalReference,
      data: { id: `pay-${Date.now()}` },
    }),
  });
  if (!wh1.ok) throw new Error(`webhook1 ${wh1.status} ${await wh1.text()}`);
  const wh2 = await fetch(`${BASE}/webhooks/mercadopago`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: `evt-${ch.externalReference}`,
      type: "payment",
      external_reference: ch.externalReference,
      data: { id: `pay-${Date.now()}` },
    }),
  });
  if (!wh2.ok) throw new Error(`webhook2 ${wh2.status} ${await wh2.text()}`);
  const w2 = (await wh2.json()) as { duplicate?: boolean };
  if (!w2.duplicate) throw new Error("expected duplicate webhook");
  console.log("OK webhook idempotent");

  const agenda = await fetch(`${BASE}/reservas/hoy?fecha=${fecha}`, { headers });
  const ag = (await agenda.json()) as {
    reservas: { clienteNombre: string; estado: string }[];
  };
  const found = ag.reservas.find((r) => r.clienteNombre === "Banda MP");
  if (!found || found.estado !== "senada") {
    throw new Error(`agenda ${JSON.stringify(found)}`);
  }
  console.log("OK agenda senada");

  const caja = await fetch(`${BASE}/caja?fecha=${fecha}`, { headers });
  const cajaBody = (await caja.json()) as { movimientos: { tipo: string; medioPago: string }[] };
  const sena = cajaBody.movimientos.find(
    (m) => m.tipo === "sena" && m.medioPago === "mercadopago",
  );
  if (!sena) throw new Error("caja missing mp sena");
  console.log("OK caja seña MP");

  console.log("\nSMOKE_T7_PASS");
}

main().catch((e) => {
  console.error("SMOKE_T7_FAIL", e);
  process.exitCode = 1;
});
