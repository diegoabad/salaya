import { getDb } from "@repo/db";
import {
  existsOutboxForReservaEvent,
  insertNotificationOutbox,
  listPendingNotifications,
  listReservasParaRecordatorio,
  markNotificationFailed,
  markNotificationSent,
} from "@repo/db/queries";
import type { NotificationChannel } from "@repo/shared";
import { fechaArFromUtc, formatHoraAr } from "./arTime";
import { cancelUrlForReserva, reprogramUrlForReserva } from "../crypto/cancelToken";
import { getLogger } from "../config/logger";
import { buildEmailFromOutbox, sendEmail } from "./email";

export async function enqueueNotification(input: {
  tenantId: string;
  eventType: string;
  channel?: NotificationChannel;
  payload: Record<string, unknown>;
}) {
  const channel = input.channel ?? "email";
  if (channel === "email") {
    const email = input.payload.email;
    if (typeof email !== "string" || !email.includes("@")) {
      return null;
    }
  }
  return insertNotificationOutbox(getDb(), {
    tenantId: input.tenantId,
    eventType: input.eventType,
    channel,
    payload: input.payload,
  });
}

export async function enqueueReservaConfirmada(input: {
  tenantId: string;
  reservaId: string;
  email: string | null | undefined;
  clienteNombre: string;
  salaNombre: string;
  sedeNombre?: string | null;
  startsAt: Date;
  endsAt: Date;
  codigo?: string;
}) {
  if (!input.email?.includes("@")) return null;
  return enqueueNotification({
    tenantId: input.tenantId,
    eventType: "reserva.confirmada",
    payload: {
      reservaId: input.reservaId,
      email: input.email,
      clienteNombre: input.clienteNombre,
      salaNombre: input.salaNombre,
      sedeNombre: input.sedeNombre ?? null,
      fecha: fechaArFromUtc(input.startsAt),
      horaInicio: formatHoraAr(input.startsAt),
      horaFin: formatHoraAr(input.endsAt),
      codigo: input.codigo ?? `SY-${input.reservaId.slice(0, 8).toUpperCase()}`,
      cancelUrl: cancelUrlForReserva(input.reservaId),
      reprogramUrl: reprogramUrlForReserva(input.reservaId),
    },
  });
}

/** Encola recordatorios para reservas que empiezan en las próximas `hoursAhead` horas */
export async function enqueueRecordatorios(hoursAhead = 24) {
  const db = getDb();
  const now = new Date();
  const until = new Date(now.getTime() + hoursAhead * 3600_000);
  const rows = await listReservasParaRecordatorio(db, now, until);
  let enqueued = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.clienteEmail?.includes("@")) {
      skipped += 1;
      continue;
    }
    const already = await existsOutboxForReservaEvent(
      db,
      "reserva.recordatorio",
      row.id,
    );
    if (already) {
      skipped += 1;
      continue;
    }
    await enqueueNotification({
      tenantId: row.tenantId,
      eventType: "reserva.recordatorio",
      payload: {
        reservaId: row.id,
        email: row.clienteEmail,
        clienteNombre: row.clienteNombre ?? "Hola",
        salaNombre: row.salaName,
        fecha: fechaArFromUtc(row.startsAt),
        horaInicio: formatHoraAr(row.startsAt),
        horaFin: formatHoraAr(row.endsAt),
        codigo: `SY-${row.id.slice(0, 8).toUpperCase()}`,
        cancelUrl: cancelUrlForReserva(row.id),
        reprogramUrl: reprogramUrlForReserva(row.id),
      },
    });
    enqueued += 1;
  }

  return { candidates: rows.length, enqueued, skipped };
}

export async function processNotificationOutbox(limit = 20) {
  const db = getDb();
  const pending = await listPendingNotifications(db, limit, "email");
  const results: {
    id: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
  }[] = [];

  for (const row of pending) {
    try {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        throw new Error("payload JSON inválido");
      }

      const message = buildEmailFromOutbox({
        eventType: row.eventType,
        payload,
      });
      if (!message) {
        await markNotificationFailed(db, row.id, "Sin email válido en payload");
        results.push({ id: row.id, status: "failed", error: "no_email" });
        continue;
      }

      await sendEmail(message);
      await markNotificationSent(db, row.id);
      results.push({ id: row.id, status: "sent" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      getLogger().warn({ err, id: row.id }, "notification failed");
      await markNotificationFailed(db, row.id, msg);
      results.push({ id: row.id, status: "failed", error: msg });
    }
  }

  return {
    processed: results.length,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}

/** Recordatorios + flush del outbox (cron / tick) */
export async function tickNotifications(input?: {
  limit?: number;
  hoursAhead?: number;
}) {
  const reminders = await enqueueRecordatorios(input?.hoursAhead ?? 24);
  const outbox = await processNotificationOutbox(input?.limit ?? 20);
  return { reminders, outbox };
}
