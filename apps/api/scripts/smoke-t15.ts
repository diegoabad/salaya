/**
 * Smoke T15: crear adicional (grupo + stock) y listar
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `adic+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Adic Owner",
      email,
      password: "testpass123",
      businessName: `Adic Studio ${Date.now()}`,
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

  const create = await fetch(`${BASE}/adicionales`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Micrófono SM58",
      grupoName: "Audio",
      precioBase: "2500.00",
      modalidad: "por_reserva",
      stock: 4,
      active: true,
    }),
  });
  if (!create.ok) {
    throw new Error(`create ${create.status} ${await create.text()}`);
  }
  const item = (await create.json()) as {
    id: string;
    name: string;
    precio: number;
    stock: number | null;
  };
  if (item.name !== "Micrófono SM58") throw new Error("name");
  if (item.precio !== 2500) throw new Error(`precio ${item.precio}`);
  if (item.stock !== 4) throw new Error(`stock ${item.stock}`);
  console.log("OK create adicional", item.id);

  const create2 = await fetch(`${BASE}/adicionales`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Agua mineral",
      grupoName: "Bebidas",
      precioBase: "800.00",
      modalidad: "por_reserva",
    }),
  });
  if (!create2.ok) throw new Error(`create2 ${create2.status}`);
  console.log("OK create sin stock");

  const list = await fetch(`${BASE}/adicionales`, { headers });
  if (!list.ok) throw new Error(`list ${list.status}`);
  const body = (await list.json()) as {
    adicionales: { id: string; grupo: string; name: string }[];
  };
  if (body.adicionales.length < 2) {
    throw new Error(`count ${body.adicionales.length}`);
  }
  const grupos = new Set(body.adicionales.map((a) => a.grupo));
  if (!grupos.has("Audio") || !grupos.has("Bebidas")) {
    throw new Error(`grupos ${[...grupos].join(",")}`);
  }
  console.log("OK list", body.adicionales.length, "grupos", [...grupos]);

  console.log("PASS smoke-t15");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
