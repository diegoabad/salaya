import type { Database } from "../client";
import { analyticsEvents } from "../schema";

export async function insertAnalyticsEvent(
  db: Database,
  input: {
    eventType: string;
    directorioEntradaId?: string | null;
    tenantId?: string | null;
    salaId?: string | null;
    reservaId?: string | null;
    sessionId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  const [row] = await db
    .insert(analyticsEvents)
    .values({
      eventType: input.eventType,
      directorioEntradaId: input.directorioEntradaId ?? null,
      tenantId: input.tenantId ?? null,
      salaId: input.salaId ?? null,
      reservaId: input.reservaId ?? null,
      sessionId: input.sessionId ?? null,
      payload: input.payload ?? {},
    })
    .returning({ id: analyticsEvents.id });
  return row ?? null;
}
