/**
 * Smoke T6: hold persistente + confirm checkout → reserva en DB + agenda
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `hold+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Hold Owner",
      email,
      password: "testpass123",
      businessName: `Hold Studio ${Date.now()}`,
      zona: "Villa Crespo",
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

  // política con seña — actualizar via SQL-ish: PATCH completo no; forzar en confirm
  // Creamos hold y al confirmar usamos politica de DB. Si sena=nunca, esperamos confirmada.
  // Forzamos seña actualizando politica con GET+PATCH.
  const neg = await fetch(`${BASE}/negocio`, { headers });
  if (!neg.ok) throw new Error(`negocio get ${neg.status}`);
  const negBody = (await neg.json()) as {
    tenant: { name: string };
    sede: { name: string; zona: string | null; address: string | null; description: string | null; photoUrl: string | null; amenidades: string[] };
    directorio: { telefono: string | null } | null;
    politica: { holdMinutos: number } | null;
  };
  const patch = await fetch(`${BASE}/negocio`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      tenantName: negBody.tenant.name,
      sedeName: negBody.sede.name,
      zona: negBody.sede.zona ?? "Villa Crespo",
      address: negBody.sede.address ?? "",
      description: negBody.sede.description ?? "",
      photoUrl: negBody.sede.photoUrl ?? "",
      telefono: negBody.directorio?.telefono ?? "",
      instagramUrl: "",
      websiteUrl: "",
      amenidades: negBody.sede.amenidades ?? [],
      tagsDestacados: [],
      senaModo: "siempre",
      senaTipo: "porcentaje",
      senaValor: "30",
      holdMinutos: 5,
    }),
  });
  if (!patch.ok) throw new Error(`negocio patch ${patch.status} ${await patch.text()}`);

  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala Hold",
      categoria: "Música",
      precioHora: "4000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status} ${await salaRes.text()}`);
  const sala = (await salaRes.json()) as { id: string };

  const hoy = new Date();
  const ar = new Date(hoy.getTime() - 3 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;
  const sessionId = `sess-${Date.now()}-abcdef`;

  const put = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({ fecha, horas: ["18:00", "19:00"] }),
  });
  if (!put.ok) throw new Error(`hold put ${put.status} ${await put.text()}`);
  const { hold } = (await put.json()) as { hold: { id: string; horas: string[] } };
  if (hold.horas.length !== 2) throw new Error("hold horas mismatch");
  console.log("OK hold persistido", hold.id);

  const list = await fetch(`${BASE}/public/salas/${sala.id}/holds?fecha=${fecha}`);
  const listed = (await list.json()) as { holds: unknown[] };
  if (listed.holds.length < 1) throw new Error("holds list empty");
  console.log("OK list holds", listed.holds.length);

  const ocup = await fetch(
    `${BASE}/public/salas/${sala.id}/holds/ocupacion?fecha=${fecha}`,
  );
  const ocupBody = (await ocup.json()) as { horas: string[] };
  if (!ocupBody.horas.includes("18:00")) throw new Error("ocupacion missing");
  console.log("OK ocupacion", ocupBody.horas.join(","));

  const confirm = await fetch(`${BASE}/public/salas/${sala.id}/holds/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({
      clienteNombre: "Banda Publica",
      clienteTelefono: "11 7777-6666",
      clienteEmail: "banda@test.local",
      pagoOk: true,
    }),
  });
  if (!confirm.ok) {
    throw new Error(`confirm ${confirm.status} ${await confirm.text()}`);
  }
  const confirmed = (await confirm.json()) as {
    codigo: string;
    estado: string;
    senaPagada: boolean;
  };
  if (confirmed.estado !== "senada") throw new Error(`estado ${confirmed.estado}`);
  if (!confirmed.senaPagada) throw new Error("sena not paid");
  console.log("OK confirm", confirmed.codigo, confirmed.estado);

  const agenda = await fetch(`${BASE}/reservas/hoy?fecha=${fecha}`, { headers });
  const ag = (await agenda.json()) as {
    reservas: { estado: string; clienteNombre: string }[];
  };
  const found = ag.reservas.find((r) => r.clienteNombre === "Banda Publica");
  if (!found) throw new Error("agenda missing confirmed reserva");
  console.log("OK agenda tiene reserva", found.estado);

  const caja = await fetch(`${BASE}/caja?fecha=${fecha}`, { headers });
  const cajaBody = (await caja.json()) as { movimientos: { tipo: string }[] };
  if (!cajaBody.movimientos.some((m) => m.tipo === "sena")) {
    throw new Error("caja missing sena");
  }
  console.log("OK caja tiene seña");

  console.log("\nSMOKE_T6_PASS");
}

main().catch((e) => {
  console.error("SMOKE_T6_FAIL", e);
  process.exitCode = 1;
});
