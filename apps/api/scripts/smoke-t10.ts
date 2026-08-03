/**
 * Smoke T10: OAuth MP (mock local) — link → callback → tokens cifrados → disconnect
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `oauth+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "OAuth Owner",
      email,
      password: "testpass123",
      businessName: `OAuth ${Date.now()}`,
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

  const status0 = await fetch(`${BASE}/mp/status`, { headers });
  if (!status0.ok) throw new Error(`status ${status0.status}`);
  const s0 = (await status0.json()) as {
    oauthAvailable: boolean;
    tenantConnected: boolean;
    mock: boolean;
  };
  if (!s0.oauthAvailable) {
    throw new Error("oauthAvailable debería ser true en MP_MOCK");
  }
  console.log("OK status oauthAvailable", s0.mock ? "(mock)" : "");

  const link = await fetch(`${BASE}/mp/oauth/link`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      returnTo: "http://localhost:3000/panel/configuracion",
    }),
  });
  if (!link.ok) throw new Error(`link ${link.status} ${await link.text()}`);
  const { url } = (await link.json()) as { url: string };
  if (!url.includes("state=")) throw new Error(`url sin state: ${url}`);
  console.log("OK oauth link");

  const cb = await fetch(url, { redirect: "manual" });
  if (cb.status !== 302) {
    throw new Error(`callback status ${cb.status}`);
  }
  const loc = cb.headers.get("location") ?? "";
  if (!loc.includes("mp_linked=1")) {
    throw new Error(`callback redirect unexpected: ${loc}`);
  }
  console.log("OK oauth callback → mp_linked");

  const status1 = await fetch(`${BASE}/mp/status`, { headers });
  const s1 = (await status1.json()) as {
    tenantConnected: boolean;
    mpUserId: string | null;
  };
  if (!s1.tenantConnected) throw new Error("tenant not connected after oauth");
  if (s1.mpUserId !== "mock-mp-user") {
    throw new Error(`mpUserId ${s1.mpUserId}`);
  }
  console.log("OK tenant connected", s1.mpUserId);

  // Forzar refresh: token con vencimiento cercano + refresh mock
  const reconnect = await fetch(`${BASE}/mp/connect`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      accessToken: "MOCK-OAUTH-AT-old",
      refreshToken: "MOCK-OAUTH-RT-smoke",
      mpUserId: "mock-mp-user",
      expiresInDays: 1,
    }),
  });
  if (!reconnect.ok) {
    throw new Error(`reconnect ${reconnect.status}`);
  }

  // resolveAccessToken se dispara en checkout; crear sala + hold mínimo
  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala OAuth",
      categoria: "Música",
      precioHora: "5000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  const ar = new Date(Date.now() - 3 * 3600_000 + 2 * 24 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;
  const sessionId = `sess-oauth-${Date.now()}-abcdef`;

  const hold = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({ fecha, horas: ["10:00", "11:00"] }),
  });
  if (!hold.ok) throw new Error(`hold ${hold.status} ${await hold.text()}`);

  const checkout = await fetch(
    `${BASE}/public/salas/${sala.id}/holds/checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hold-Session": sessionId,
      },
      body: JSON.stringify({
        clienteNombre: "OAuth Cliente",
        clienteTelefono: "11 8888-0000",
      }),
    },
  );
  if (!checkout.ok) {
    throw new Error(`checkout ${checkout.status} ${await checkout.text()}`);
  }
  const chk = (await checkout.json()) as { initPoint: string };
  if (!chk.initPoint) throw new Error("sin initPoint");
  console.log("OK checkout tras refresh path");

  const status2 = await fetch(`${BASE}/mp/status`, { headers });
  const s2 = (await status2.json()) as { expiresAt: string | null };
  if (!s2.expiresAt) throw new Error("sin expiresAt");
  const expiresMs = Date.parse(s2.expiresAt);
  // Tras refresh mock → ~30 días
  if (expiresMs - Date.now() < 7 * 24 * 3600_000) {
    throw new Error(`expiresAt no renovado: ${s2.expiresAt}`);
  }
  console.log("OK token refreshed", s2.expiresAt);

  const disc = await fetch(`${BASE}/mp/connect`, {
    method: "DELETE",
    headers,
  });
  if (!disc.ok) throw new Error(`disconnect ${disc.status}`);
  const s3 = (await disc.json()) as { tenantConnected: boolean };
  if (s3.tenantConnected) throw new Error("still connected");
  console.log("OK disconnect");

  console.log("PASS smoke-t10");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
