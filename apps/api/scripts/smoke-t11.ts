/**
 * Smoke T11: suscripción plataforma — trial, plan gratis, checkout Pro + mock-pay
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

async function main() {
  const email = `sub+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Sub Owner",
      email,
      password: "testpass123",
      businessName: `Sub Studio ${Date.now()}`,
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

  const ov0 = await fetch(`${BASE}/suscripcion`, { headers });
  if (!ov0.ok) throw new Error(`overview ${ov0.status} ${await ov0.text()}`);
  const o0 = (await ov0.json()) as {
    status: string;
    planCode: string;
    plans: { code: string }[];
    trialEndsAt: string | null;
  };
  if (o0.status !== "trialing") throw new Error(`status ${o0.status}`);
  if (o0.planCode !== "starter") throw new Error(`plan ${o0.planCode}`);
  if (!o0.trialEndsAt) throw new Error("sin trial");
  if (o0.plans.length < 3) throw new Error("planes incompletos");
  console.log("OK trial starter", o0.trialEndsAt);

  const free = await fetch(`${BASE}/suscripcion/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ planCode: "starter" }),
  });
  if (!free.ok) throw new Error(`free ${free.status} ${await free.text()}`);
  const freeBody = (await free.json()) as {
    free: boolean;
    planCode: string;
  };
  if (!freeBody.free) throw new Error("esperaba free");
  console.log("OK activar starter gratis");

  const ov1 = await fetch(`${BASE}/suscripcion`, { headers });
  const o1 = (await ov1.json()) as { status: string; periodEnd: string | null };
  if (o1.status !== "active") throw new Error(`status after free ${o1.status}`);
  if (!o1.periodEnd) throw new Error("sin periodEnd");
  console.log("OK active starter", o1.periodEnd);

  const checkout = await fetch(`${BASE}/suscripcion/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ planCode: "pro" }),
  });
  if (!checkout.ok) {
    throw new Error(`checkout ${checkout.status} ${await checkout.text()}`);
  }
  const ch = (await checkout.json()) as {
    free: boolean;
    externalReference: string;
    initPoint: string;
    monto: number;
  };
  if (ch.free) throw new Error("pro no debería ser free");
  if (!ch.externalReference?.startsWith("sy-sub-")) {
    throw new Error(`ref ${ch.externalReference}`);
  }
  if (!ch.initPoint) throw new Error("sin initPoint");
  if (ch.monto !== 19999) throw new Error(`monto ${ch.monto}`);
  console.log("OK checkout pro", ch.externalReference);

  const pay = await fetch(`${BASE}/public/pagos/mock-pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ externalReference: ch.externalReference }),
  });
  if (!pay.ok) throw new Error(`mock-pay ${pay.status} ${await pay.text()}`);
  console.log("OK mock-pay suscripción");

  const ov2 = await fetch(`${BASE}/suscripcion`, { headers });
  const o2 = (await ov2.json()) as {
    status: string;
    planCode: string;
    planName: string;
    priceArs: number;
  };
  if (o2.status !== "active") throw new Error(`status ${o2.status}`);
  if (o2.planCode !== "pro") throw new Error(`plan ${o2.planCode}`);
  if (o2.priceArs !== 19999) throw new Error(`price ${o2.priceArs}`);
  console.log("OK plan pro activo", o2.planName);

  // Idempotencia webhook
  const wh = await fetch(`${BASE}/webhooks/mercadopago`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: `evt-sub-${ch.externalReference}`,
      type: "payment",
      external_reference: ch.externalReference,
      data: { id: `pay-sub-${Date.now()}` },
    }),
  });
  if (!wh.ok) throw new Error(`webhook ${wh.status}`);
  console.log("OK webhook idempotente");

  console.log("PASS smoke-t11");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
