/**
 * Smoke T8: asistencia + cobrar saldo + cancelar
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `ops+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ops Owner",
      email,
      password: "testpass123",
      businessName: `Ops ${Date.now()}`,
      zona: "Recoleta",
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
      name: "Sala Ops",
      categoria: "Música",
      precioHora: "5000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  // Ayer AR para poder cerrar asistencia
  const ar = new Date(Date.now() - 3 * 3600_000 - 24 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;

  const create = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      horaInicio: "10:00",
      horaFin: "12:00",
      clienteNombre: "Cliente Past",
      clienteTelefono: "11 2222-3333",
      precioTotal: "10000.00",
      senaMonto: "3000.00",
      senaPagada: true,
    }),
  });
  if (!create.ok) throw new Error(`reserva ${create.status} ${await create.text()}`);
  const reserva = (await create.json()) as { id: string };
  console.log("OK reserva pasada", reserva.id);

  const asist = await fetch(`${BASE}/reservas/${reserva.id}/asistencia`, {
    method: "POST",
    headers,
    body: JSON.stringify({ asistio: true }),
  });
  if (!asist.ok) throw new Error(`asist ${asist.status} ${await asist.text()}`);
  const asistBody = (await asist.json()) as { estado: string };
  if (asistBody.estado !== "completada") throw new Error(`estado ${asistBody.estado}`);
  console.log("OK asistió → completada");

  const cobrar = await fetch(`${BASE}/reservas/${reserva.id}/cobrar`, {
    method: "POST",
    headers,
    body: JSON.stringify({ medioPago: "efectivo" }),
  });
  if (!cobrar.ok) throw new Error(`cobrar ${cobrar.status} ${await cobrar.text()}`);
  const cob = (await cobrar.json()) as { saldoPendiente: number; cobrado: number };
  if (cob.saldoPendiente !== 0) throw new Error(`saldo ${cob.saldoPendiente}`);
  if (cob.cobrado !== 7000) throw new Error(`cobrado ${cob.cobrado}`);
  console.log("OK cobró saldo", cob.cobrado);

  // Segunda reserva → no-show
  const create2 = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      horaInicio: "14:00",
      horaFin: "15:00",
      clienteNombre: "Cliente Noshow",
      clienteTelefono: "11 4444-5555",
      precioTotal: "5000.00",
      senaMonto: "0",
      senaPagada: false,
    }),
  });
  if (!create2.ok) throw new Error(`reserva2 ${create2.status}`);
  const r2 = (await create2.json()) as { id: string };

  const noshow = await fetch(`${BASE}/reservas/${r2.id}/asistencia`, {
    method: "POST",
    headers,
    body: JSON.stringify({ asistio: false }),
  });
  if (!noshow.ok) throw new Error(`noshow ${noshow.status} ${await noshow.text()}`);
  const ns = (await noshow.json()) as { estado: string; incrementarNoShow: boolean };
  if (ns.estado !== "ausente" || !ns.incrementarNoShow) {
    throw new Error(`noshow body ${JSON.stringify(ns)}`);
  }
  console.log("OK no-show → ausente");

  const clientes = await fetch(`${BASE}/clientes`, { headers });
  const cliBody = (await clientes.json()) as {
    clientes: { telefono: string; noShowCount: number }[];
  };
  const noshowCli = cliBody.clientes.find((c) => c.telefono.includes("4444"));
  if (!noshowCli || noshowCli.noShowCount < 1) {
    throw new Error("noShowCount not incremented");
  }
  console.log("OK no_show_count", noshowCli.noShowCount);

  // Cancelar futura
  const arHoy = new Date(Date.now() - 3 * 3600_000);
  const fechaHoy = `${arHoy.getUTCFullYear()}-${String(arHoy.getUTCMonth() + 1).padStart(2, "0")}-${String(arHoy.getUTCDate()).padStart(2, "0")}`;
  const create3 = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha: fechaHoy,
      horaInicio: "20:00",
      horaFin: "21:00",
      clienteNombre: "Cliente Cancel",
      clienteTelefono: "11 6666-7777",
      precioTotal: "5000.00",
      senaMonto: "1500.00",
      senaPagada: true,
    }),
  });
  if (!create3.ok) throw new Error(`reserva3 ${create3.status} ${await create3.text()}`);
  const r3 = (await create3.json()) as { id: string };

  const cancel = await fetch(`${BASE}/reservas/${r3.id}/cancelar`, {
    method: "POST",
    headers,
    body: JSON.stringify({ motivo: "Prueba smoke" }),
  });
  if (!cancel.ok) throw new Error(`cancel ${cancel.status} ${await cancel.text()}`);
  const cBody = (await cancel.json()) as { estado: string };
  if (cBody.estado !== "cancelada") throw new Error(`cancel estado ${cBody.estado}`);
  console.log("OK cancelada");

  console.log("\nSMOKE_T8_PASS");
}

main().catch((e) => {
  console.error("SMOKE_T8_FAIL", e);
  process.exitCode = 1;
});
