import { getDb } from "@repo/db";
import { insertAnalyticsEvent } from "@repo/db/queries";
import { getLogger } from "../config/logger";

export async function trackEvent(input: {
  eventType: string;
  directorioEntradaId?: string | null;
  tenantId?: string | null;
  salaId?: string | null;
  reservaId?: string | null;
  sessionId?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    await insertAnalyticsEvent(getDb(), input);
  } catch (err) {
    getLogger().warn({ err, eventType: input.eventType }, "analytics track failed");
  }
}
