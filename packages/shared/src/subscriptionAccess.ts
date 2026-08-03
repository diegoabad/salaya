import type { SubscriptionStatus } from "./constants";

export type SubscriptionAccessInput = {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | string | null;
  subscriptionPeriodEnd: Date | string | null;
};

function toMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** Estado efectivo (trial/periodo vencido → expired). */
export function subscriptionStatusEfectivo(
  input: SubscriptionAccessInput,
): SubscriptionStatus {
  const now = Date.now();
  const status = input.subscriptionStatus;

  if (status === "exempt") return "exempt";
  if (status === "canceled") return "canceled";

  if (status === "trialing") {
    const ends = toMs(input.trialEndsAt);
    if (ends != null && ends < now) return "expired";
    return "trialing";
  }

  if (status === "active") {
    const ends = toMs(input.subscriptionPeriodEnd);
    if (ends != null && ends < now) return "expired";
    return "active";
  }

  if (status === "past_due") return "past_due";
  if (status === "expired") return "expired";
  return status;
}

/** Puede usar el panel (ABM, agenda, etc.). */
export function canAccessPanel(status: SubscriptionStatus): boolean {
  return (
    status === "trialing" ||
    status === "active" ||
    status === "past_due" ||
    status === "exempt"
  );
}

export function mensajeBloqueoSuscripcion(status: SubscriptionStatus): string {
  if (status === "expired") {
    return "Tu período de prueba terminó o venció el plan. Elegí un plan para seguir usando el panel.";
  }
  if (status === "canceled") {
    return "Tu suscripción está cancelada. Elegí un plan para volver a usar el panel.";
  }
  return "No tenés acceso al panel con tu plan actual.";
}
