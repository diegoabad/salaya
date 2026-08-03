import { accounts, users } from "@repo/db";
import { and, eq } from "drizzle-orm";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import { getAppDb } from "./db";

function toAdapterUser(row: typeof users.$inferSelect): AdapterUser {
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.emailVerified,
    name: row.name || null,
    image: row.image,
  };
}

/**
 * Adapter mínimo para Auth.js con strategy JWT.
 * Evita DrizzleAdapter()`is(db, PgDatabase)` que falla con Proxy / bundling de Next.
 */
export function createAuthAdapter(): Adapter {
  return {
    async createUser(data) {
      const db = getAppDb();
      const [row] = await db
        .insert(users)
        .values({
          email: data.email!.toLowerCase(),
          name: data.name ?? "",
          emailVerified: data.emailVerified,
          image: data.image,
        })
        .returning();
      return toAdapterUser(row!);
    },

    async getUser(id) {
      const db = getAppDb();
      const row = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      return row ? toAdapterUser(row) : null;
    },

    async getUserByEmail(email) {
      const db = getAppDb();
      const row = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });
      return row ? toAdapterUser(row) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const db = getAppDb();
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId),
        ),
        with: { user: true },
      });
      return account?.user ? toAdapterUser(account.user) : null;
    },

    async updateUser(data) {
      const db = getAppDb();
      const [row] = await db
        .update(users)
        .set({
          name: data.name ?? undefined,
          email: data.email ?? undefined,
          emailVerified: data.emailVerified,
          image: data.image,
          updatedAt: new Date(),
        })
        .where(eq(users.id, data.id))
        .returning();
      if (!row) throw new Error("User not found");
      return toAdapterUser(row);
    },

    async linkAccount(account) {
      const db = getAppDb();
      await db.insert(accounts).values({
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token,
        access_token: account.access_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
        session_state: account.session_state as string | undefined,
      });
      return account as AdapterAccount;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const db = getAppDb();
      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.providerAccountId, providerAccountId),
          ),
        );
    },

    // Session methods no se usan con strategy: "jwt"
    async createSession() {
      throw new Error("JWT sessions: createSession no aplica");
    },
    async getSessionAndUser() {
      return null;
    },
    async updateSession() {
      throw new Error("JWT sessions: updateSession no aplica");
    },
    async deleteSession() {
      return;
    },

    async createVerificationToken(token) {
      return token;
    },
    async useVerificationToken() {
      return null;
    },

    async deleteUser(userId) {
      const db = getAppDb();
      await db.delete(users).where(eq(users.id, userId));
    },
  };
}
