import { users } from "@repo/db";
import { listMemberships } from "@repo/db/queries";
import { loginSchema } from "@repo/shared";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { createAuthAdapter } from "./lib/auth-adapter";
import { getAppDb } from "./lib/db";

async function loadSessionExtras(userId: string) {
  const db = getAppDb();
  const [memberships, user] = await Promise.all([
    listMemberships(db, userId),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { passwordHash: true },
    }),
  ]);
  const primary = memberships[0] ?? null;
  return {
    memberships,
    tenantId: primary?.tenantId ?? null,
    role: primary?.role ?? null,
    tenantName: primary?.tenantName ?? null,
    tenantSlug: primary?.tenantSlug ?? null,
    hasPassword: Boolean(user?.passwordHash),
  };
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter: createAuthAdapter(),
  session: { strategy: "jwt" },
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const db = getAppDb();
        const email = parsed.data.email.toLowerCase();
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.sub = user.id;
      }
      const userId = token.sub;
      if (!userId) return token;

      if (user || trigger === "update" || token.tenantId === undefined) {
        const extras = await loadSessionExtras(userId);
        token.tenantId = extras.tenantId;
        token.role = extras.role;
        token.tenantName = extras.tenantName;
        token.tenantSlug = extras.tenantSlug;
        token.hasPassword = extras.hasPassword;
        token.memberships = extras.memberships;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.tenantId =
          typeof token.tenantId === "string" ? token.tenantId : null;
        session.user.role =
          token.role === "owner" || token.role === "employee"
            ? token.role
            : null;
        session.user.tenantName =
          typeof token.tenantName === "string" ? token.tenantName : null;
        session.user.tenantSlug =
          typeof token.tenantSlug === "string" ? token.tenantSlug : null;
        session.user.hasPassword = Boolean(token.hasPassword);
        session.user.memberships = Array.isArray(token.memberships)
          ? token.memberships
          : [];
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id || user.name) return;
      const fallback = user.email?.split("@")[0] ?? "Usuario";
      await getAppDb()
        .update(users)
        .set({ name: fallback })
        .where(eq(users.id, user.id));
    },
  },
});
