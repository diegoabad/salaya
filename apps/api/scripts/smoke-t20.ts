/**
 * Smoke T20: email confirmada + recordatorio (mock outbox)
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `mail20+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Mail20 Owner",
      email,
      password: "testpass123",
      businessName: `Mail20 Studio ${Date.now()}`,
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
      name: "Sala Mail20",
      categoria: "Música",
      precioHora: "5000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  // Reserva mañana 15–17 AR → dentro de hoursAhead=48
  const ar = new Date(Date.now() - 3 * 3600_000 + 24 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;
  const horaInicio = "15:00";
  const horaFin = "17:00";

  const create = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha,
      horaInicio,
      horaFin,
      clienteNombre: "Cliente Confirm",
      clienteTelefono: "11 7000-2222",
      clienteEmail: "cliente.confirm@test.local",
      precioTotal: "10000.00",
      senaMonto: "0",
      senaPagada: false,
    }),
  });
  if (!create.ok) {
    throw new Error(`reserva ${create.status} ${await create.text()}`);
  }
  console.log("OK reserva con email");

  const tick1 = await fetch(`${BASE}/internal/jobs/notifications/tick`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
    },
    body: JSON.stringify({ limit: 20, hoursAhead: 48 }),
  });
  if (!tick1.ok) throw new Error(`tick ${tick1.status} ${await tick1.text()}`);
  const t1 = (await tick1.json()) as {
    sent: number;
    reminders?: { enqueued: number };
  };
  if (t1.sent < 1) {
    throw new Error(`expected sent>=1 got ${JSON.stringify(t1)}`);
  }
  console.log("OK tick", t1.sent, "reminders", t1.reminders);

  const mock = await fetch(`${BASE}/internal/jobs/notifications/mock-sent`, {
    headers: { "x-internal-secret": SECRET },
  });
  if (!mock.ok) throw new Error(`mock-sent ${mock.status}`);
  const mockBody = (await mock.json()) as {
    emails: { to: string; subject: string }[];
  };
  const confirm = mockBody.emails.find(
    (e) =>
      e.to === "cliente.confirm@test.local" &&
      e.subject.toLowerCase().includes("confirm"),
  );
  if (!confirm) {
    throw new Error(`confirm email missing: ${JSON.stringify(mockBody)}`);
  }
  console.log("OK email confirmada", confirm.subject);

  const reminder = mockBody.emails.find(
    (e) =>
      e.to === "cliente.confirm@test.local" &&
      e.subject.toLowerCase().includes("recordatorio"),
  );
  if (!reminder) {
    throw new Error(`reminder missing: ${JSON.stringify(mockBody)}`);
  }
  console.log("OK email recordatorio", reminder.subject);

  // Idempotencia: segundo tick no duplica recordatorio
  await fetch(`${BASE}/internal/jobs/notifications/mock-clear`, {
    method: "POST",
    headers: { "x-internal-secret": SECRET },
  });
  const tick2 = await fetch(`${BASE}/internal/jobs/notifications/tick`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
    },
    body: JSON.stringify({ limit: 20, hoursAhead: 48 }),
  });
  const t2 = (await tick2.json()) as {
    reminders?: { enqueued: number };
    sent: number;
  };
  if ((t2.reminders?.enqueued ?? 0) !== 0) {
    throw new Error(`expected no new reminders ${JSON.stringify(t2)}`);
  }
  console.log("OK idempotencia recordatorio");

  console.log("PASS smoke-t20");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
