/**
 * Smoke T14: marketplace_fee en checkout de seña
 * Requiere API con MP_MOCK=true (fee se aplica también en mock).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { calcularMarketplaceFee } from "@repo/core";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `fee+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Fee Owner",
      email,
      password: "testpass123",
      businessName: `Fee Studio ${Date.now()}`,
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

  const status = await fetch(`${BASE}/mp/status`, { headers });
  if (!status.ok) throw new Error(`status ${status.status}`);
  const st = (await status.json()) as {
    marketplaceFeePercent: number;
    marketplaceFeeEnabled: boolean;
    mock: boolean;
  };
  if (typeof st.marketplaceFeePercent !== "number") {
    throw new Error("falta marketplaceFeePercent");
  }
  if (st.marketplaceFeeEnabled !== st.marketplaceFeePercent > 0) {
    throw new Error("marketplaceFeeEnabled inconsistente");
  }
  console.log(
    "OK mp status fee%",
    st.marketplaceFeePercent,
    "enabled=",
    st.marketplaceFeeEnabled,
  );

  // política con seña %
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
      zona: negBody.sede.zona ?? "Palermo",
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

  // Conectar tenant → fee aplica en marketplace (source tenant)
  const connect = await fetch(`${BASE}/mp/connect`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      accessToken: "APP_USR-TEST-TOKEN-FEE-1234567890",
      mpUserId: "fee-user",
    }),
  });
  if (!connect.ok) throw new Error(`connect ${connect.status}`);
  console.log("OK mp connect");

  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala Fee",
      categoria: "Música",
      precioHora: "5000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  const ar = new Date(Date.now() - 3 * 3600_000 + 24 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;
  const sessionId = `sess-fee-${Date.now()}-abcdef`;

  const put = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({ fecha, horas: ["16:00", "17:00"] }),
  });
  if (!put.ok) throw new Error(`hold ${put.status} ${await put.text()}`);

  const checkout = await fetch(
    `${BASE}/public/salas/${sala.id}/holds/checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hold-Session": sessionId,
      },
      body: JSON.stringify({
        clienteNombre: "Banda Fee",
        clienteTelefono: "11 7000-8888",
        clienteEmail: "banda.fee@test.local",
      }),
    },
  );
  if (!checkout.ok) {
    throw new Error(`checkout ${checkout.status} ${await checkout.text()}`);
  }
  const ch = (await checkout.json()) as {
    monto: number;
    marketplaceFee: number;
    marketplaceFeePercent: number;
    initPoint: string;
  };

  const expected = calcularMarketplaceFee(ch.monto, st.marketplaceFeePercent);
  if (ch.marketplaceFee !== expected) {
    throw new Error(
      `fee ${ch.marketplaceFee} !== expected ${expected} (monto ${ch.monto} % ${st.marketplaceFeePercent})`,
    );
  }
  if (ch.marketplaceFeePercent !== (expected > 0 ? st.marketplaceFeePercent : 0)) {
    throw new Error(`percent resp ${ch.marketplaceFeePercent}`);
  }
  if (!ch.initPoint) throw new Error("sin initPoint");
  console.log(
    "OK checkout fee",
    ch.marketplaceFee,
    "de",
    ch.monto,
    `(${st.marketplaceFeePercent}%)`,
  );

  // Sanity del helper
  if (calcularMarketplaceFee(10000, 5) !== 500) {
    throw new Error("core fee helper broken");
  }
  console.log("OK core calcularMarketplaceFee");

  console.log("PASS smoke-t14");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
