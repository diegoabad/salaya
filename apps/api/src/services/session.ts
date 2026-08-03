import { randomBytes } from "node:crypto";
import { getDb, sessions } from "@repo/db";
import { eq, lt } from "drizzle-orm";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 días

export async function createSession(userId: string): Promise<{
  id: string;
  expiresAt: Date;
}> {
  const db = getDb();
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function deleteSession(sessionId: string) {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function getSessionUserId(
  sessionId: string,
): Promise<string | null> {
  const db = getDb();
  const row = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }
  return row.userId;
}

export async function purgeExpiredSessions() {
  const db = getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
