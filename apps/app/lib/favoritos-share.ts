import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  return (
    process.env.AUTH_SECRET ??
    process.env.SESSION_SECRET ??
    "dev-share-secret-change-me"
  );
}

/** Token compartible de favoritos: `{userId}.{sig}` */
export function signFavoritosShareToken(userId: string): string {
  const sig = createHmac("sha256", secret())
    .update(`favshare:${userId}`)
    .digest("base64url");
  return `${userId}.${sig}`;
}

export function parseFavoritosShareToken(token: string): string | null {
  const trimmed = token.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    return null;
  }
  const expected = createHmac("sha256", secret())
    .update(`favshare:${userId}`)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return userId;
}
