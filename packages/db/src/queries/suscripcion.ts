import { eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  directorioEntradas,
  suscripcionPagos,
  tenants,
} from "../schema";
import type { PagoEstado, SubscriptionStatus } from "@repo/shared";

export async function getTenantSubscription(db: Database, tenantId: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: {
      id: true,
      name: true,
      slug: true,
      subscriptionStatus: true,
      subscriptionPlanCode: true,
      subscriptionPeriodEnd: true,
      trialEndsAt: true,
    },
  });
}

export async function updateTenantSubscription(
  db: Database,
  tenantId: string,
  patch: {
    subscriptionStatus?: SubscriptionStatus;
    subscriptionPlanCode?: string;
    subscriptionPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
  },
) {
  const [row] = await db
    .update(tenants)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning({
      id: tenants.id,
      subscriptionStatus: tenants.subscriptionStatus,
      subscriptionPlanCode: tenants.subscriptionPlanCode,
      subscriptionPeriodEnd: tenants.subscriptionPeriodEnd,
      trialEndsAt: tenants.trialEndsAt,
    });
  return row ?? null;
}

export async function insertSuscripcionPago(
  db: Database,
  values: typeof suscripcionPagos.$inferInsert,
) {
  const [row] = await db.insert(suscripcionPagos).values(values).returning();
  return row!;
}

export async function getSuscripcionPagoByExternalRef(db: Database, ref: string) {
  return db.query.suscripcionPagos.findFirst({
    where: eq(suscripcionPagos.externalReference, ref),
  });
}

export async function updateSuscripcionPago(
  db: Database,
  id: string,
  patch: Partial<{
    estado: PagoEstado;
    mpPreferenceId: string | null;
    mpPaymentId: string | null;
    paidAt: Date | null;
  }>,
) {
  const [row] = await db
    .update(suscripcionPagos)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(suscripcionPagos.id, id))
    .returning();
  return row ?? null;
}

export async function syncDirectorioPlanForTenant(
  db: Database,
  tenantId: string,
  plan: "seed" | "cliente" | "destacado",
) {
  await db
    .update(directorioEntradas)
    .set({ plan, updatedAt: new Date() })
    .where(eq(directorioEntradas.tenantId, tenantId));
}
