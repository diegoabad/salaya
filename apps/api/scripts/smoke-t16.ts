/**
 * Smoke T16: adicionales en hold/checkout público + stock
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `adic16+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Adic16 Owner",
      email,
      password: "testpass123",
      businessName: `Adic16 Studio ${Date.now()}`,
      zona: "Palermo",
    }),
  });
  if (!reg.ok) throw new Error(`register ${reg.status} ${await reg.text()}`);
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
      name: "Sala Extras",
      categoria: "Música",
      precioHora: "5000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status} ${await salaRes.text()}`);
  const sala = (await salaRes.json()) as { id: string };

  const mic = await fetch(`${BASE}/adicionales`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Mic SM58",
      grupoName: "Audio",
      precioBase: "2000.00",
      modalidad: "por_reserva",
      stock: 1,
      active: true,
    }),
  });
  if (!mic.ok) throw new Error(`mic ${mic.status} ${await mic.text()}`);
  const micItem = (await mic.json()) as { id: string };

  const agua = await fetch(`${BASE}/adicionales`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Agua",
      grupoName: "Bebidas",
      precioBase: "500.00",
      modalidad: "por_reserva",
      active: true,
    }),
  });
  if (!agua.ok) throw new Error(`agua ${agua.status}`);
  const aguaItem = (await agua.json()) as { id: string };
  console.log("OK adicionales", micItem.id, aguaItem.id);

  const cat = await fetch(
    `${BASE}/public/salas/${sala.id}/holds/adicionales`,
  );
  if (!cat.ok) throw new Error(`catalog ${cat.status}`);
  const catBody = (await cat.json()) as {
    grupos: { name: string; items: { id: string }[] }[];
  };
  if (catBody.grupos.length < 2) throw new Error("grupos missing");
  console.log("OK catalog público", catBody.grupos.length);

  const hoy = new Date();
  const ar = new Date(hoy.getTime() - 3 * 3600_000);
  const fecha = `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}-${String(ar.getUTCDate()).padStart(2, "0")}`;
  const sessionId = `sess-t16-${Date.now()}-abcdef`;

  const put = await fetch(`${BASE}/public/salas/${sala.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": sessionId,
    },
    body: JSON.stringify({
      fecha,
      horas: ["20:00"],
      adicionales: [
        { id: micItem.id, cantidad: 1 },
        { id: aguaItem.id, cantidad: 2 },
      ],
    }),
  });
  if (!put.ok) throw new Error(`hold put ${put.status} ${await put.text()}`);
  const { hold } = (await put.json()) as {
    hold: {
      id: string;
      precioSala: number;
      precioAdicionales: number;
      precioTotal: number;
    };
  };
  // sala 5000 + mic 2000 + agua 1000 = 8000
  if (hold.precioSala !== 5000) throw new Error(`precioSala ${hold.precioSala}`);
  if (hold.precioAdicionales !== 3000) {
    throw new Error(`precioAdicionales ${hold.precioAdicionales}`);
  }
  if (hold.precioTotal !== 8000) throw new Error(`precioTotal ${hold.precioTotal}`);
  console.log("OK hold con extras", hold.precioTotal);

  const confirm = await fetch(
    `${BASE}/public/salas/${sala.id}/holds/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hold-Session": sessionId,
      },
      body: JSON.stringify({
        clienteNombre: "Músico Test",
        clienteTelefono: "1199887766",
        clienteEmail: "musico@test.local",
        pagoOk: true,
      }),
    },
  );
  if (!confirm.ok) {
    throw new Error(`confirm ${confirm.status} ${await confirm.text()}`);
  }
  const conf = (await confirm.json()) as { precioTotal: number };
  if (conf.precioTotal !== 8000) {
    throw new Error(`confirm total ${conf.precioTotal}`);
  }
  console.log("OK confirm", conf.precioTotal);

  // Otra sala, mismo horario: stock del mic = 1 ya usado → STOCK_ADICIONAL
  const sala2Res = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sala B",
      categoria: "Música",
      precioHora: "4000.00",
      capacity: 3,
    }),
  });
  if (!sala2Res.ok) throw new Error(`sala2 ${sala2Res.status}`);
  const sala2 = (await sala2Res.json()) as { id: string };

  const session3 = `sess-t16c-${Date.now()}-abcdef`;
  const put3 = await fetch(`${BASE}/public/salas/${sala2.id}/holds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hold-Session": session3,
    },
    body: JSON.stringify({
      fecha,
      horas: ["20:00"],
      adicionales: [{ id: micItem.id, cantidad: 1 }],
    }),
  });
  if (put3.status !== 409) {
    throw new Error(`expected STOCK 409 got ${put3.status} ${await put3.text()}`);
  }
  const errBody = (await put3.json()) as { error?: { code?: string } };
  if (errBody.error?.code !== "STOCK_ADICIONAL") {
    throw new Error(`code ${errBody.error?.code}`);
  }
  console.log("OK stock insuficiente", errBody.error?.code);

  console.log("PASS smoke-t16");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
