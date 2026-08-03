import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../client";
import { mpConexiones, pagos, webhookEvents } from "../schema";
import type { PagoEstado } from "@repo/shared";

export async function getMpConexion(db: Database, tenantId: string) {
  return db.query.mpConexiones.findFirst({
    where: eq(mpConexiones.tenantId, tenantId),
  });
}

export async function upsertMpConexion(
  db: Database,
  tenantId: string,
  input: {
    mpUserId?: string | null;
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
    expiresAt: Date;
  },
) {
  const existing = await getMpConexion(db, tenantId);
  if (existing) {
    const [row] = await db
      .update(mpConexiones)
      .set({
        mpUserId: input.mpUserId ?? existing.mpUserId,
        accessTokenEncrypted: input.accessTokenEncrypted,
        refreshTokenEncrypted: input.refreshTokenEncrypted,
        expiresAt: input.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(mpConexiones.id, existing.id))
      .returning();
    return row!;
  }
  const [row] = await db
    .insert(mpConexiones)
    .values({
      tenantId,
      mpUserId: input.mpUserId ?? null,
      accessTokenEncrypted: input.accessTokenEncrypted,
      refreshTokenEncrypted: input.refreshTokenEncrypted,
      expiresAt: input.expiresAt,
    })
    .returning();
  return row!;
}

export async function deleteMpConexion(db: Database, tenantId: string) {
  await db.delete(mpConexiones).where(eq(mpConexiones.tenantId, tenantId));
}

export async function insertPago(
  db: Database,
  values: typeof pagos.$inferInsert,
) {
  const [row] = await db.insert(pagos).values(values).returning();
  return row!;
}

export async function getPagoByExternalRef(db: Database, ref: string) {
  return db.query.pagos.findFirst({
    where: eq(pagos.externalReference, ref),
  });
}

export async function getPagoById(
  db: Database,
  tenantId: string,
  pagoId: string,
) {
  return db.query.pagos.findFirst({
    where: and(eq(pagos.tenantId, tenantId), eq(pagos.id, pagoId)),
  });
}

export async function updatePago(
  db: Database,
  pagoId: string,
  patch: Partial<{
    estado: PagoEstado;
    mpPreferenceId: string | null;
    mpPaymentId: string | null;
    paidAt: Date | null;
    marketplaceFee: string | null;
  }>,
) {
  const [row] = await db
    .update(pagos)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(pagos.id, pagoId))
    .returning();
  return row ?? null;
}

export async function tryInsertWebhookEvent(
  db: Database,
  provider: string,
  eventId: string,
  payload: string,
) {
  const rows = await db
    .insert(webhookEvents)
    .values({ provider, eventId, payload })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.eventId],
    })
    .returning();
  const row = rows[0];
  if (!row) return { inserted: false as const, row: null };
  return { inserted: true as const, row };
}

export async function markWebhookProcessed(db: Database, id: string) {
  await db
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(and(eq(webhookEvents.id, id), isNull(webhookEvents.processedAt)));
}
