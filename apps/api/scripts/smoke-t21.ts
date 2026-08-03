/**
 * Smoke T21: cancelación pública por link (email) + política
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `cancel21+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cancel Owner",
      email,
      password: "testpass123",
      businessName: `Cancel Studio ${Date.now()}`,
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

  // Política: 24h, seña a crédito
  const neg = await fetch(`${BASE}/negocio`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      tenantName: "Cancel Studio",
      sedeName: "Sede",
      zona: "Palermo",
      amenidades: [],
      tagsDestacados: [],
      cancelacionVentanaHoras: 24,
      senaDestinoCancelacion: "credito",
      permiteReprogramar: true,
      senaModo: "siempre",
      senaTipo: "porcentaje",
      senaValor: "30",
    }),
  });
  if (!neg.ok) throw new Error(`negocio ${neg.status} ${await neg.text()}`);
  console.log("OK política cancelación (crédito / 24h)");

  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala Cancel",
      categoria: "Música",
      precioHora: "5000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  // Política pública expuesta
  const pol = await fetch(`${BASE}/public/salas/${sala.id}/holds`);
  const polBody = (await pol.json()) as {
    cancelacionVentanaHoras?: number;
    senaDestinoCancelacion?: string;
  };
  if (polBody.cancelacionVentanaHoras !== 24) {
    throw new Error(`ventana ${polBody.cancelacionVentanaHoras}`);
  }
  if (polBody.senaDestinoCancelacion !== "credito") {
    throw new Error(`destino ${polBody.senaDestinoCancelacion}`);
  }
  console.log("OK política pública en holds");

  await fetch(`${BASE}/internal/jobs/notifications/mock-clear`, {
    method: "POST",
    headers: { "x-internal-secret": SECRET },
  });

  // Reserva en 2 días (dentro de ventana)
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
      clienteNombre: "Cliente Cancel",
      clienteTelefono: "11 8000-3333",
      clienteEmail: "cliente.cancel@test.local",
      precioTotal: "10000.00",
      senaMonto: "3000.00",
      senaPagada: true,
    }),
  });
  if (!create.ok) throw new Error(`reserva ${create.status} ${await create.text()}`);
  const reserva = (await create.json()) as { id: string };
  console.log("OK reserva", reserva.id);

  const tick = await fetch(`${BASE}/internal/jobs/notifications/tick`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
    },
    body: JSON.stringify({ limit: 20, hoursAhead: 1 }),
  });
  if (!tick.ok) throw new Error(`tick ${tick.status}`);

  const mock = await fetch(`${BASE}/internal/jobs/notifications/mock-sent`, {
    headers: { "x-internal-secret": SECRET },
  });
  const mockBody = (await mock.json()) as {
    emails: { to: string; subject: string; text: string; html?: string }[];
  };
  const mail = mockBody.emails.find(
    (e) =>
      e.to === "cliente.cancel@test.local" &&
      e.subject.toLowerCase().includes("confirm"),
  );
  if (!mail) throw new Error(`no confirm email ${JSON.stringify(mockBody)}`);
  const match = (mail.html ?? mail.text).match(/\/cancelar\?t=([^"'\s]+)/);
  if (!match?.[1]) throw new Error(`no cancel link in ${mail.text}`);
  const token = decodeURIComponent(match[1]);
  console.log("OK link cancelación en email");

  const preview = await fetch(
    `${BASE}/public/reservas/cancel?t=${encodeURIComponent(token)}`,
  );
  if (!preview.ok) {
    throw new Error(`preview ${preview.status} ${await preview.text()}`);
  }
  const prev = (await preview.json()) as {
    permitida: boolean;
    destinoSena: string;
    politicaTexto: string;
  };
  if (!prev.permitida) throw new Error("expected permitida");
  if (prev.destinoSena !== "credito") {
    throw new Error(`destino preview ${prev.destinoSena}`);
  }
  if (!prev.politicaTexto.toLowerCase().includes("cancel")) {
    throw new Error(`politicaTexto ${prev.politicaTexto}`);
  }
  console.log("OK preview", prev.destinoSena);

  const confirm = await fetch(`${BASE}/public/reservas/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ t: token, confirm: true }),
  });
  if (!confirm.ok) {
    throw new Error(`confirm ${confirm.status} ${await confirm.text()}`);
  }
  const conf = (await confirm.json()) as {
    estado: string;
    destinoSena: string;
    creditoAplicado: number;
  };
  if (conf.estado !== "cancelada") throw new Error(`estado ${conf.estado}`);
  if (conf.destinoSena !== "credito") throw new Error(`dest ${conf.destinoSena}`);
  if (conf.creditoAplicado !== 3000) {
    throw new Error(`credito ${conf.creditoAplicado}`);
  }
  console.log("OK cancelada con crédito", conf.creditoAplicado);

  // Fuera de ventana: reserva mañana con ventana 48h
  await fetch(`${BASE}/negocio`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      tenantName: "Cancel Studio",
      sedeName: "Sede",
      amenidades: [],
      tagsDestacados: [],
      cancelacionVentanaHoras: 48,
      senaDestinoCancelacion: "perder",
    }),
  });

  const ar2 = new Date(Date.now() - 3 * 3600_000 + 24 * 3600_000);
  const fecha2 = `${ar2.getUTCFullYear()}-${String(ar2.getUTCMonth() + 1).padStart(2, "0")}-${String(ar2.getUTCDate()).padStart(2, "0")}`;
  const create2 = await fetch(`${BASE}/reservas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      salaId: sala.id,
      fecha: fecha2,
      horaInicio: "16:00",
      horaFin: "17:00",
      clienteNombre: "Cliente Late",
      clienteTelefono: "11 8000-4444",
      clienteEmail: "cliente.late@test.local",
      precioTotal: "5000.00",
      senaMonto: "0",
      senaPagada: false,
    }),
  });
  if (!create2.ok) throw new Error(`reserva2 ${create2.status}`);
  const r2 = (await create2.json()) as { id: string };

  // Firmar token vía segundo email o construyendo con mismo secret no disponible —
  // usamos preview tras tick y extracción, o endpoint con token de email2
  await fetch(`${BASE}/internal/jobs/notifications/mock-clear`, {
    method: "POST",
    headers: { "x-internal-secret": SECRET },
  });
  await fetch(`${BASE}/internal/jobs/notifications/tick`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
    },
    body: JSON.stringify({ limit: 20, hoursAhead: 1 }),
  });
  const mock2 = await fetch(`${BASE}/internal/jobs/notifications/mock-sent`, {
    headers: { "x-internal-secret": SECRET },
  });
  const mock2Body = (await mock2.json()) as {
    emails: { to: string; text: string; html?: string }[];
  };
  const mail2 = mock2Body.emails.find((e) => e.to === "cliente.late@test.local");
  if (!mail2) throw new Error("no late email");
  const m2 = (mail2.html ?? mail2.text).match(/\/cancelar\?t=([^"'\s]+)/);
  if (!m2?.[1]) throw new Error("no token late");
  const token2 = decodeURIComponent(m2[1]);

  const prev2 = await fetch(
    `${BASE}/public/reservas/cancel?t=${encodeURIComponent(token2)}`,
  );
  const p2 = (await prev2.json()) as { permitida: boolean; error?: string };
  if (p2.permitida) {
    throw new Error(`expected blocked for ${r2.id}: ${JSON.stringify(p2)}`);
  }
  console.log("OK bloqueada fuera de ventana", p2.error);

  console.log("PASS smoke-t21");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
