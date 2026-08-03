"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type PlanDto = {
  code: string;
  name: string;
  priceArs: number;
  periodDays: number;
  directorioPlan: string;
  current: boolean;
};

export type SuscripcionDto = {
  status: string;
  planCode: string;
  planName: string;
  priceArs: number;
  trialEndsAt: string | null;
  periodEnd: string | null;
  plans: PlanDto[];
  checkoutAvailable: boolean;
  canAccessPanel: boolean;
  blockedReason: string | null;
  mpPlatformConfigured: boolean;
  mock: boolean;
};

export async function fetchSuscripcion() {
  const res = await panelApiFetch<SuscripcionDto>("/suscripcion");
  return res.ok ? res.data : null;
}

export async function checkoutPlanAction(
  planCode: string,
): Promise<
  | { ok: true; free: true; planCode: string; periodEnd: string }
  | { ok: true; free: false; initPoint: string }
  | { ok: false; error: string }
> {
  const res = await panelApiFetch<{
    free: boolean;
    initPoint?: string | null;
    planCode?: string;
    periodEnd?: string;
  }>("/suscripcion/checkout", {
    method: "POST",
    body: JSON.stringify({ planCode }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/plan");
  if (res.data.free) {
    return {
      ok: true,
      free: true,
      planCode: res.data.planCode ?? planCode,
      periodEnd: res.data.periodEnd ?? "",
    };
  }
  if (!res.data.initPoint) {
    return { ok: false, error: "No se recibió link de pago" };
  }
  return { ok: true, free: false, initPoint: res.data.initPoint };
}
