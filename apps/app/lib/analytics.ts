import { apiBaseUrl } from "./holds-api";

const SESSION_KEY = "salaya:analytics-session";

function analyticsSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export type AnalyticsEventType =
  | "guia.contacto_abrir"
  | "guia.contacto_llamar"
  | "reserva.hold_creado"
  | "reserva.confirmada"
  | "reserva.senada";

/** Fire-and-forget: no bloquea UI si falla */
export function trackAnalytics(input: {
  eventType: AnalyticsEventType;
  directorioEntradaId?: string | null;
  tenantId?: string | null;
  salaId?: string | null;
  reservaId?: string | null;
  payload?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;
  const body = {
    ...input,
    sessionId: analyticsSessionId() || null,
  };
  void fetch(`${apiBaseUrl()}/public/analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    /* ignore */
  });
}
