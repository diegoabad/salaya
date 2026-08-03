import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { notificationOutbox } from "../schema";
import type { NotificationChannel, NotificationStatus } from "@repo/shared";

export async function insertNotificationOutbox(
  db: Database,
  input: {
    tenantId: string | null;
    eventType: string;
    channel: NotificationChannel;
    payload: Record<string, unknown> | string;
  },
) {
  const [row] = await db
    .insert(notificationOutbox)
    .values({
      tenantId: input.tenantId,
      eventType: input.eventType,
      channel: input.channel,
      payload:
        typeof input.payload === "string"
          ? input.payload
          : JSON.stringify(input.payload),
      status: "pending",
    })
    .returning();
  return row!;
}

export async function listPendingNotifications(
  db: Database,
  limit = 20,
  channel?: NotificationChannel,
) {
  const conditions = [eq(notificationOutbox.status, "pending")];
  if (channel) conditions.push(eq(notificationOutbox.channel, channel));
  return db
    .select()
    .from(notificationOutbox)
    .where(and(...conditions))
    .orderBy(asc(notificationOutbox.createdAt))
    .limit(limit);
}

export async function markNotificationSent(db: Database, id: string) {
  const [row] = await db
    .update(notificationOutbox)
    .set({
      status: "sent" as NotificationStatus,
      sentAt: new Date(),
      error: null,
    })
    .where(eq(notificationOutbox.id, id))
    .returning();
  return row ?? null;
}

export async function markNotificationFailed(
  db: Database,
  id: string,
  error: string,
) {
  const [row] = await db
    .update(notificationOutbox)
    .set({
      status: "failed" as NotificationStatus,
      error: error.slice(0, 2000),
    })
    .where(eq(notificationOutbox.id, id))
    .returning();
  return row ?? null;
}

export async function getNotificationById(db: Database, id: string) {
  return db.query.notificationOutbox.findFirst({
    where: eq(notificationOutbox.id, id),
  });
}

/** Idempotencia: ya hay outbox (pending/sent) para este evento+reserva */
export async function existsOutboxForReservaEvent(
  db: Database,
  eventType: string,
  reservaId: string,
) {
  const needle = `%"reservaId":"${reservaId}"%`;
  const rows = await db
    .select({ id: notificationOutbox.id })
    .from(notificationOutbox)
    .where(
      and(
        eq(notificationOutbox.eventType, eventType),
        sql`${notificationOutbox.payload} like ${needle}`,
        inArray(notificationOutbox.status, ["pending", "sent"]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function countNotificationsByStatus(
  db: Database,
  tenantId: string,
  statuses: NotificationStatus[],
) {
  const rows = await db
    .select()
    .from(notificationOutbox)
    .where(
      and(
        eq(notificationOutbox.tenantId, tenantId),
        inArray(notificationOutbox.status, statuses),
      ),
    );
  return rows.length;
}
