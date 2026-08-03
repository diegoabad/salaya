/**
 * Smoke T13: outbox email — cancelar → pending → tick → sent (mock)
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `mail+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Mail Owner",
      email,
      password: "testpass123",
      businessName: `Mail Studio ${Date.now()}`,
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

  await fetch(`${BASE}/internal/jobs/notifications/mock-clear`, {
    method: "POST",
    headers: { "x-internal-secret": SECRET },
  });

  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala Mail",
      categoria: "Música",
      precioHora: "5000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  const cli = await fetch(`${BASE}/clientes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      nombre: "Cliente Mail",
      telefono: "11 6000-2222",
      email: "cliente.mail@test.local",
    }),
  });
  if (!cli.ok) throw new Error(`cliente ${cli.status} ${await cli.text()}`);
  console.log("OK cliente con email");

  const ar = new Date(Date.now() - 3 * 3600_000 + 2 * 24 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;

  const create = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      horaInicio: "15:00",
      horaFin: "17:00",
      clienteNombre: "Cliente Mail",
      clienteTelefono: "11 6000-2222",
      precioTotal: "10000.00",
      senaMonto: "0",
      senaPagada: false,
    }),
  });
  if (!create.ok) {
    throw new Error(`reserva ${create.status} ${await create.text()}`);
  }
  const reserva = (await create.json()) as { id: string };
  console.log("OK reserva", reserva.id);

  const cancel = await fetch(`${BASE}/reservas/${reserva.id}/cancelar`, {
    method: "POST",
    headers,
    body: JSON.stringify({ motivo: "Smoke T13" }),
  });
  if (!cancel.ok) {
    throw new Error(`cancel ${cancel.status} ${await cancel.text()}`);
  }
  console.log("OK cancelar → outbox pending");

  const tick1 = await fetch(`${BASE}/internal/jobs/notifications/tick`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
    },
    body: JSON.stringify({ limit: 10 }),
  });
  if (!tick1.ok) throw new Error(`tick ${tick1.status} ${await tick1.text()}`);
  const t1 = (await tick1.json()) as {
    sent: number;
    failed: number;
    processed: number;
  };
  if (t1.sent < 1) {
    throw new Error(`expected sent>=1 got ${JSON.stringify(t1)}`);
  }
  console.log("OK tick sent", t1.sent);

  const mock = await fetch(`${BASE}/internal/jobs/notifications/mock-sent`, {
    headers: { "x-internal-secret": SECRET },
  });
  if (!mock.ok) throw new Error(`mock-sent ${mock.status}`);
  const mockBody = (await mock.json()) as {
    emails: { to: string; subject: string }[];
  };
  const foundMail = mockBody.emails.find(
    (e) =>
      e.to === "cliente.mail@test.local" &&
      e.subject.toLowerCase().includes("cancel"),
  );
  if (!foundMail) {
    throw new Error(`email cancel no en mock: ${JSON.stringify(mockBody)}`);
  }
  console.log("OK mock email", foundMail.subject);

  console.log("PASS smoke-t13");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
