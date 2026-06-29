import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { allowedDomains, isEmailAllowed } from "@/lib/auth/access";

// --- Type augmentation: per-user Fleet key lives in the JWT (server-only),
// never copied into the client-visible session. The session only exposes a
// boolean `hasFleetKey` so the UI can gate without seeing the value. ---
declare module "next-auth/jwt" {
  interface JWT {
    email?: string | null;
    /** The user's personal LangSmith key (lsv2_...). SERVER-ONLY — never sent to the client. */
    fleetKey?: string;
  }
}
declare module "next-auth" {
  interface Session {
    user: {
      email?: string | null;
      name?: string | null;
      image?: string | null;
      /** Whether this user has set their own Fleet API key. The value itself stays server-side. */
      hasFleetKey?: boolean;
    };
  }
}

// Whole-site auth: Google sign-in, restricted to the domains in
// ALLOWED_EMAIL_DOMAINS. The access policy lives in `@/lib/auth/access`;
// this file is just NextAuth wiring.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // `hd` pre-filters Google's account chooser to the primary allowed
          // domain — a UX hint only. The real enforcement is `signIn` below.
          hd: allowedDomains[0] ?? "*",
          prompt: "select_account",
        },
      },
    }),
  ],
  session: {
    maxAge: 24 * 60 * 60, // 24h
  },
  // Use our branded /login screen instead of NextAuth's default pages.
  // `error` points there too so AccessDenied (non-allowed domain) shows in-brand.
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Gate sign-in on the domain allowlist (verified email + exact domain).
    signIn: ({ profile }) => isEmailAllowed(profile),
    jwt({ token, user, trigger, session }) {
      if (user) token.email = user.email;
      // The /settings save action calls `update({ fleetKey })`, which arrives
      // here as a trigger==="update". We persist the (already-validated) key
      // into the JWT, or clear it when an empty value is sent (Remove).
      if (trigger === "update" && session && "fleetKey" in session) {
        const next = (session as { fleetKey?: string }).fleetKey;
        if (next) token.fleetKey = next;
        else delete token.fleetKey;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (token.email) session.user.email = token.email as string;
        // Expose only whether a key exists — never the key itself.
        session.user.hasFleetKey = Boolean(token.fleetKey);
      }
      return session;
    },
    // Gate every route via proxy.ts. /login must stay reachable while signed
    // out (otherwise NextAuth redirects to /login → blocked → loop). It is the
    // ONLY public app route; everything else requires an authenticated session.
    authorized({ auth, request }) {
      if (request.nextUrl.pathname === "/login") return true;
      return !!auth?.user;
    },
  },
});
