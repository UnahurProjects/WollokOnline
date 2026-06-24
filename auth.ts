import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { resolveRole } from "@/lib/auth/roles";

/**
 * Auth.js (NextAuth v5) — login con GitHub OAuth, SOLO para identidad.
 *
 * Estrategia JWT (sin adapter): la sesión no depende de Supabase. Se persisten
 * github_id y github_username en el token y se exponen en la sesión junto al
 * rol resuelto por configuración (TEACHERS).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      // `profile` solo está presente en el login inicial.
      if (profile) {
        token.githubId = profile.id != null ? String(profile.id) : token.githubId;
        token.githubUsername =
          (profile.login as string | undefined) ?? token.githubUsername;
      }
      return token;
    },
    async session({ session, token }) {
      const githubId = typeof token.githubId === "string" ? token.githubId : "";
      const githubUsername =
        typeof token.githubUsername === "string" ? token.githubUsername : "";
      session.user.githubId = githubId;
      session.user.githubUsername = githubUsername;
      session.user.role = resolveRole(githubUsername);
      return session;
    },
  },
});
