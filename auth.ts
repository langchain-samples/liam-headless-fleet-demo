import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { allowedDomains, isEmailAllowed } from "@/lib/auth/access";

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
    jwt({ token, user }) {
      if (user) token.email = user.email;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email as string;
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
