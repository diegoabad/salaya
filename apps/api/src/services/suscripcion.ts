import { randomUUID } from "node:crypto";
import { getDb } from "@repo/db";
import {
  getSuscripcionPagoByExternalRef,
  getTenantSubscription,
  insertSuscripcionPago,
  syncDirectorioPlanForTenant,
  updateSuscripcionPago,
  updateTenantSubscription,
} from "@repo/db/queries";
import {
  getPlatformPlan,
  listPlatformPlans,
  SUBSCRIPTION_TRIAL_DAYS,
  canAccessPanel,
  mensajeBloqueoSuscripcion,
  subscriptionStatusEfectivo,
  type PlatformPlanCode,
  type SubscriptionStatus,
} from "@repo/shared";
import { z } from "zod";
import { getEnv } from "../config/env";
import { HttpError } from "../middlewares/errorHandler";

const PERIOD_MS = (days: number) => days * 24 * 3600_000;

export function trialEndsFromNow(now = new Date()) {
  return new Date(now.getTime() + PERIOD_MS(SUBSCRIPTION_TRIAL_DAYS));
}

export function subscriptionDefaultsNuevoTenant() {
  return {
    subscriptionStatus: "trialing" as const,
    subscriptionPlanCode: "starter",
    trialEndsAt: trialEndsFromNow(),
    subscriptionPeriodEnd: null as Date | null,
  };
}

/** Solo mock/dev: fuerza trial vencido para smokes. */
export async function forceTrialExpired(tenantId: string) {
  const env = getEnv();
  if (!env.mpMock && env.NODE_ENV === "production") {
    throw new HttpError(403, "FORBIDDEN", "Solo disponible en desarrollo/mock");
  }
  const past = new Date(Date.now() - 24 * 3600_000);
  await updateTenantSubscription(getDb(), tenantId, {
    subscriptionStatus: "trialing",
    subscriptionPlanCode: "starter",
    trialEndsAt: past,
    subscriptionPeriodEnd: null,
  });
  return getSuscripcionOverview(tenantId);
}

export async function getSuscripcionOverview(tenantId: string) {
  const env = getEnv();
  const row = await getTenantSubscription(getDb(), tenantId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Tenant no encontrado");

  const status = subscriptionStatusEfectivo({
    subscriptionStatus: row.subscriptionStatus as SubscriptionStatus,
    trialEndsAt: row.trialEndsAt,
    subscriptionPeriodEnd: row.subscriptionPeriodEnd,
  });

  const currentPlan = getPlatformPlan(row.subscriptionPlanCode);
  const plans = listPlatformPlans().map((p) => ({
    code: p.code,
    name: p.name,
    priceArs: p.priceArs,
    periodDays: p.periodDays,
    directorioPlan: p.directorioPlan,
    current: p.code === row.subscriptionPlanCode,
  }));

  const checkoutAvailable =
    status === "trialing" ||
    status === "expired" ||
    status === "canceled" ||
    status === "past_due" ||
    status === "active";

  return {
    status,
    planCode: row.subscriptionPlanCode,
    planName: currentPlan?.name ?? row.subscriptionPlanCode,
    priceArs: currentPlan?.priceArs ?? 0,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    periodEnd: row.subscriptionPeriodEnd?.toISOString() ?? null,
    plans,
    checkoutAvailable,
    canAccessPanel: canAccessPanel(status),
    blockedReason: canAccessPanel(status)
      ? null
      : mensajeBloqueoSuscripcion(status),
    mpPlatformConfigured: Boolean(env.MP_ACCESS_TOKEN) || env.mpMock,
    mock: env.mpMock,
  };
}

export const checkoutSuscripcionSchema = z.object({
  planCode: z.string().trim().min(2).max(40),
});

async function createPlatformPreference(input: {
  title: string;
  amount: number;
  externalReference: string;
  successUrl: string;
  failureUrl: string;
}) {
  const env = getEnv();
  if (env.mpMock || !env.MP_ACCESS_TOKEN) {
    if (!env.mpMock && !env.MP_ACCESS_TOKEN) {
      throw new HttpError(
        503,
        "MP_PLATFORM_TOKEN",
        "Falta MP_ACCESS_TOKEN de la plataforma para cobrar suscripciones",
      );
    }
    const prefId = `MOCK-SUB-${input.externalReference.slice(0, 10)}`;
    const initPoint = `${env.apiPublicUrl}/public/pagos/mock-pay?ref=${encodeURIComponent(input.externalReference)}`;
    return { id: prefId, initPoint };
  }

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: input.title,
          quantity: 1,
          currency_id: "ARS",
          unit_price: input.amount,
        },
      ],
      external_reference: input.externalReference,
      notification_url: `${env.apiPublicUrl}/webhooks/mercadopago`,
      back_urls: {
        success: input.successUrl,
        failure: input.failureUrl,
        pending: input.failureUrl,
      },
      auto_return: "approved",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(
      502,
      "MP_PREFERENCE_FAILED",
      `MP preference: ${text.slice(0, 200)}`,
    );
  }
  const body = (await res.json()) as {
    id: string;
    init_point?: string;
    sandbox_init_point?: string;
  };
  return {
    id: body.id,
    initPoint: body.init_point ?? body.sandbox_init_point ?? "",
  };
}

async function activatePlan(
  tenantId: string,
  planCode: PlatformPlanCode,
  opts?: { fromPago?: boolean },
) {
  const plan = getPlatformPlan(planCode);
  if (!plan) throw new HttpError(400, "PLAN_INVALID", "Plan desconocido");

  const periodEnd = new Date(Date.now() + PERIOD_MS(plan.periodDays));
  await updateTenantSubscription(getDb(), tenantId, {
    subscriptionStatus: "active",
    subscriptionPlanCode: planCode,
    subscriptionPeriodEnd: periodEnd,
    trialEndsAt: null,
  });
  await syncDirectorioPlanForTenant(getDb(), tenantId, plan.directorioPlan);

  return {
    ok: true as const,
    planCode,
    periodEnd: periodEnd.toISOString(),
    free: plan.priceArs === 0 && !opts?.fromPago,
  };
}

/** Activa plan gratuito (starter) sin MP */
export async function activarPlanGratis(
  tenantId: string,
  planCode: string,
) {
  const plan = getPlatformPlan(planCode);
  if (!plan) throw new HttpError(400, "PLAN_INVALID", "Plan desconocido");
  if (plan.priceArs > 0) {
    throw new HttpError(
      400,
      "PLAN_NOT_FREE",
      "Este plan requiere pago. Usá checkout.",
    );
  }
  return activatePlan(tenantId, plan.code);
}

export async function checkoutSuscripcion(
  tenantId: string,
  input: z.infer<typeof checkoutSuscripcionSchema>,
) {
  const plan = getPlatformPlan(input.planCode);
  if (!plan) throw new HttpError(400, "PLAN_INVALID", "Plan desconocido");

  if (plan.priceArs === 0) {
    const act = await activarPlanGratis(tenantId, plan.code);
    return {
      ...act,
      free: true as const,
      initPoint: null as string | null,
      externalReference: null as string | null,
    };
  }

  const env = getEnv();
  const externalReference = `sy-sub-${randomUUID()}`;
  const pago = await insertSuscripcionPago(getDb(), {
    tenantId,
    planCode: plan.code,
    externalReference,
    estado: "pendiente",
    monto: plan.priceArs.toFixed(2),
  });

  const successUrl = `${env.APP_URL}/panel/plan?sub=ok&ref=${externalReference}`;
  const failureUrl = `${env.APP_URL}/panel/plan?sub=fail&ref=${externalReference}`;

  const pref = await createPlatformPreference({
    title: `SalaYa · ${plan.name}`,
    amount: plan.priceArs,
    externalReference,
    successUrl,
    failureUrl,
  });

  await updateSuscripcionPago(getDb(), pago.id, {
    mpPreferenceId: pref.id,
  });

  return {
    free: false as const,
    pagoId: pago.id,
    externalReference,
    monto: plan.priceArs,
    initPoint: pref.initPoint,
    mock: env.mpMock,
    planCode: plan.code,
  };
}

export async function applySuscripcionPagoAprobado(input: {
  externalReference: string;
  mpPaymentId?: string | null;
}) {
  const db = getDb();
  const pago = await getSuscripcionPagoByExternalRef(
    db,
    input.externalReference,
  );
  if (!pago) {
    throw new HttpError(404, "SUB_PAGO_NOT_FOUND", "Pago de suscripción no encontrado");
  }
  if (pago.estado === "aprobado") {
    return { already: true as const, tenantId: pago.tenantId, planCode: pago.planCode };
  }

  await updateSuscripcionPago(db, pago.id, {
    estado: "aprobado",
    mpPaymentId: input.mpPaymentId ?? pago.mpPaymentId,
    paidAt: new Date(),
  });

  const plan = getPlatformPlan(pago.planCode);
  if (!plan) {
    throw new HttpError(500, "PLAN_MISSING", `Plan ${pago.planCode} no existe`);
  }
  await activatePlan(pago.tenantId, plan.code, { fromPago: true });

  return {
    already: false as const,
    tenantId: pago.tenantId,
    planCode: pago.planCode,
  };
}

export function isSuscripcionExternalRef(ref: string) {
  return ref.startsWith("sy-sub-");
}
