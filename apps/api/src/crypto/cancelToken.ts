import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "../config/env";

function hmac(reservaId: string) {
  return createHmac("sha256", getEnv().SESSION_SECRET)
    .update(`cancel:${reservaId}`)
    .digest("base64url");
}

/** Token opaco: `{reservaId}.{sig}` */
export function signCancelToken(reservaId: string): string {
  return `${reservaId}.${hmac(reservaId)}`;
}

export function parseCancelToken(token: string): string | null {
  const trimmed = token.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return null;
  const reservaId = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!reservaId || !sig) return null;
  // uuid v4 rough check
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      reservaId,
    )
  ) {
    return null;
  }
  const expected = hmac(reservaId);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return reservaId;
}

export function cancelUrlForReserva(reservaId: string): string {
  const base = getEnv().APP_URL.replace(/\/$/, "");
  return `${base}/cancelar?t=${encodeURIComponent(signCancelToken(reservaId))}`;
}

/** Mismo token que cancelar: identifica la reserva en el link del email */
export function reprogramUrlForReserva(reservaId: string): string {
  const base = getEnv().APP_URL.replace(/\/$/, "");
  return `${base}/reprogramar?t=${encodeURIComponent(signCancelToken(reservaId))}`;
}
