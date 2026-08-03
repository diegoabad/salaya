/**
 * Smoke T12: gate de suscripción — trial vencido bloquea API salvo /suscripcion
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `gate+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Gate Owner",
      email,
      password: "testpass123",
      businessName: `Gate Studio ${Date.now()}`,
      zona: "Caballito",
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

  // Mientras trial válido, puede crear sala
  const salaOk = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala Gate",
      categoria: "Música",
      precioHora: "4000.00",
      capacity: 4,
    }),
  });
  if (!salaOk.ok) throw new Error(`sala ok ${salaOk.status}`);
  console.log("OK acceso con trial");

  const expire = await fetch(`${BASE}/suscripcion/dev/expire-trial`, {
    method: "POST",
    headers,
    body: "{}",
  });
  if (!expire.ok) {
    throw new Error(`expire ${expire.status} ${await expire.text()}`);
  }
  const expired = (await expire.json()) as {
    status: string;
    canAccessPanel: boolean;
  };
  if (expired.status !== "expired") throw new Error(`status ${expired.status}`);
  if (expired.canAccessPanel) throw new Error("canAccessPanel true");
  console.log("OK trial forzado a expired");

  const blocked = await fetch(`${BASE}/salas`, { headers });
  if (blocked.status !== 402) {
    throw new Error(`expected 402 got ${blocked.status}`);
  }
  const blockedBody = (await blocked.json()) as {
    error: { code: string };
  };
  if (blockedBody.error.code !== "SUBSCRIPTION_REQUIRED") {
    throw new Error(`code ${blockedBody.error.code}`);
  }
  console.log("OK API bloqueada 402");

  // /suscripcion sigue accesible
  const ov = await fetch(`${BASE}/suscripcion`, { headers });
  if (!ov.ok) throw new Error(`suscripcion ${ov.status}`);
  const o = (await ov.json()) as { status: string; canAccessPanel: boolean };
  if (o.status !== "expired" || o.canAccessPanel) {
    throw new Error("overview unexpected");
  }
  console.log("OK /suscripcion accesible");

  // Activar starter desbloquea
  const free = await fetch(`${BASE}/suscripcion/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ planCode: "starter" }),
  });
  if (!free.ok) throw new Error(`checkout ${free.status} ${await free.text()}`);
  console.log("OK reactivar starter");

  const salas = await fetch(`${BASE}/salas`, { headers });
  if (!salas.ok) throw new Error(`salas after ${salas.status}`);
  console.log("OK acceso restaurado");

  console.log("PASS smoke-t12");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
