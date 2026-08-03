import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Config edge-compatible (sin bcrypt ni DB).
 * Usada por middleware.
 */
export const authConfig = {
  providers: [
    Google({
      // Vincula Google al usuario existente con el mismo email
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isPanel = path.startsWith("/panel") || path.startsWith("/onboarding");
      if (isPanel) return !!auth?.user;
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
