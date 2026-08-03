/**
 * Smoke T4: clientes + caja (movimiento + listado)
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `caja+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Caja Owner",
      email,
      password: "testpass123",
      businessName: `Caja ${Date.now()}`,
      zona: "Palermo",
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

  const cli = await fetch(`${BASE}/clientes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      nombre: "Cliente Caja",
      telefono: "11 9999-1111",
      email: "cli@test.local",
    }),
  });
  if (!cli.ok) throw new Error(`cliente ${cli.status} ${await cli.text()}`);
  console.log("OK create cliente");

  const listCli = await fetch(`${BASE}/clientes`, { headers });
  if (!listCli.ok) throw new Error(`list clientes ${listCli.status}`);
  const { clientes } = (await listCli.json()) as { clientes: unknown[] };
  if (clientes.length < 1) throw new Error("clientes empty");
  console.log("OK list clientes", clientes.length);

  const mov = await fetch(`${BASE}/caja`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tipo: "ajuste",
      medioPago: "efectivo",
      monto: "1500.00",
      descripcion: "Ajuste smoke",
    }),
  });
  if (!mov.ok) throw new Error(`caja post ${mov.status} ${await mov.text()}`);
  console.log("OK create movimiento");

  const caja = await fetch(`${BASE}/caja`, { headers });
  if (!caja.ok) throw new Error(`caja get ${caja.status}`);
  const body = (await caja.json()) as { movimientos: unknown[]; total: number };
  if (body.movimientos.length < 1) throw new Error("caja empty");
  if (body.total < 1500) throw new Error(`total unexpected ${body.total}`);
  console.log("OK caja hoy", body.movimientos.length, "total", body.total);

  // reserva con seña → movimiento auto
  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala Caja",
      categoria: "Música",
      precioHora: "4000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  const hoy = new Date();
  const ar = new Date(hoy.getTime() - 3 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;

  const create = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      horaInicio: "10:00",
      horaFin: "12:00",
      clienteNombre: "Banda Seña",
      clienteTelefono: "11 8888-2222",
      precioTotal: "8000.00",
      senaMonto: "2000.00",
      senaPagada: true,
    }),
  });
  if (!create.ok) throw new Error(`reserva ${create.status} ${await create.text()}`);

  const caja2 = await fetch(`${BASE}/caja?fecha=${fecha}`, { headers });
  const body2 = (await caja2.json()) as { movimientos: { tipo: string }[]; total: number };
  const hasSena = body2.movimientos.some((m) => m.tipo === "sena");
  if (!hasSena) throw new Error("missing auto sena movimiento");
  console.log("OK auto seña en caja, total", body2.total);

  console.log("\nSMOKE_T4_PASS");
}

main().catch((e) => {
  console.error("SMOKE_T4_FAIL", e);
  process.exitCode = 1;
});
