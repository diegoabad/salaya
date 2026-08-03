import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "../config/env";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hmac(tenantId: string, clienteId: string) {
  return createHmac("sha256", getEnv().SESSION_SECRET)
    .update(`resena-invite:${tenantId}:${clienteId}`)
    .digest("base64url");
}

/** Token opaco: `{tenantId}.{clienteId}.{sig}` */
export function signResenaInviteToken(tenantId: string, clienteId: string) {
  return `${tenantId}.${clienteId}.${hmac(tenantId, clienteId)}`;
}

export function parseResenaInviteToken(
  token: string,
): { tenantId: string; clienteId: string } | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [tenantId, clienteId, sig] = parts;
  if (!tenantId || !clienteId || !sig) return null;
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(clienteId)) return null;
  const expected = hmac(tenantId, clienteId);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { tenantId, clienteId };
}

export function resenaInviteUrl(tenantId: string, clienteId: string) {
  const base = getEnv().APP_URL.replace(/\/$/, "");
  const t = signResenaInviteToken(tenantId, clienteId);
  return `${base}/resenar?t=${encodeURIComponent(t)}`;
}
