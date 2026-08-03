/**
 * Smoke T9: formularios panel — cliente, cobro, regla, reseña (+ toggle)
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `forms+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Forms Owner",
      email,
      password: "testpass123",
      businessName: `Forms ${Date.now()}`,
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

  const cli = await fetch(`${BASE}/clientes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      nombre: "Cliente Forms",
      telefono: "11 7000-1111",
    }),
  });
  if (!cli.ok) throw new Error(`cliente ${cli.status} ${await cli.text()}`);
  console.log("OK create cliente");

  const mov = await fetch(`${BASE}/caja`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tipo: "ajuste",
      medioPago: "efectivo",
      monto: "2000.00",
      descripcion: "Cobro smoke T9",
    }),
  });
  if (!mov.ok) throw new Error(`caja ${mov.status} ${await mov.text()}`);
  console.log("OK create cobro");

  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala Forms",
      categoria: "Música",
      precioHora: "4500.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  const regla = await fetch(`${BASE}/precios/reglas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      scope: "sala",
      scopeId: sala.id,
      tipo: "continuo",
      nombre: "Happy hour T9",
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: "14:00",
      endTime: "18:00",
      precioPorHora: "3500.00",
      descuentoPorcentaje: "15.00",
    }),
  });
  if (!regla.ok) throw new Error(`regla ${regla.status} ${await regla.text()}`);
  console.log("OK create regla");

  const precios = await fetch(`${BASE}/precios`, { headers });
  if (!precios.ok) throw new Error(`precios ${precios.status}`);
  const preciosBody = (await precios.json()) as { reglas: unknown[] };
  if (preciosBody.reglas.length < 1) throw new Error("reglas empty");
  console.log("OK list precios", preciosBody.reglas.length);

  const ar = new Date(Date.now() - 3 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;

  const reserva = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      horaInicio: "19:00",
      horaFin: "21:00",
      clienteNombre: "Reserva Forms",
      clienteTelefono: "11 7000-2222",
      precioTotal: "9000.00",
      senaMonto: "0",
      senaPagada: false,
    }),
  });
  if (!reserva.ok)
    throw new Error(`reserva ${reserva.status} ${await reserva.text()}`);
  console.log("OK create reserva panel");

  const resena = await fetch(`${BASE}/resenas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      authorName: "Músico Test",
      rating: 5,
      body: "Excelente sala, buen sonido y puntualidad.",
      published: true,
    }),
  });
  if (!resena.ok) throw new Error(`resena ${resena.status} ${await resena.text()}`);
  const resenaBody = (await resena.json()) as { id: string; published: boolean };
  if (!resenaBody.published) throw new Error("resena not published");
  console.log("OK create reseña", resenaBody.id);

  const list = await fetch(`${BASE}/resenas`, { headers });
  if (!list.ok) throw new Error(`list resenas ${list.status}`);
  const listBody = (await list.json()) as {
    ratingAvg: number | null;
    ratingCount: number;
    resenas: { id: string }[];
  };
  if (listBody.ratingCount < 1) throw new Error("ratingCount 0");
  if (listBody.resenas.length < 1) throw new Error("resenas empty");
  console.log("OK list reseñas avg", listBody.ratingAvg);

  const hide = await fetch(`${BASE}/resenas/${resenaBody.id}/published`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ published: false }),
  });
  if (!hide.ok) throw new Error(`toggle ${hide.status} ${await hide.text()}`);
  const hideBody = (await hide.json()) as { published: boolean };
  if (hideBody.published) throw new Error("still published");
  console.log("OK toggle ocultar");

  console.log("PASS smoke-t9");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
