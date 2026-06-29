// Server-only helper: resolve the logged-in user's personal Fleet key from the
// NextAuth JWT. The key lives ONLY in the encrypted session cookie / JWT — it is
// never in the client-visible session object — so route handlers read it here.
//
// Policy: each user must set their own key (Settings) before using the action
// proxy. We do NOT fall back to the shared FLEET_API_KEY for user actions, so a
// run is always attributed to the real caller. (The analytics/cost route is the
// one exception and uses the shared admin key directly, not this helper.)
import "server-only";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export interface FleetKeyResult {
  apiKey?: string;
  /** When apiKey is absent, a ready-to-return 401 telling the client to set a key. */
  errorResponse?: Response;
}

const NO_KEY_BODY = {
  code: "no_fleet_key",
  detail: "Set your LangSmith API key in Settings to use the Fleet.",
  status: 401,
};

export async function requireUserFleetKey(req: NextRequest): Promise<FleetKeyResult> {
  // getToken decrypts the JWT cookie with AUTH_SECRET/NEXTAUTH_SECRET and gives
  // us the raw claims (including fleetKey), unlike auth() which returns the
  // trimmed, client-safe session.
  //
  // In production over HTTPS, Auth.js prefixes the cookie name with `__Secure-`
  // (e.g. `__Secure-authjs.session-token`). getToken must be told to look for
  // the secure cookie, or it finds nothing in prod and every call 401s even
  // though the user is logged in. Detect HTTPS from the proxied request.
  const isHttps =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https";

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: isHttps,
  });
  const key = typeof token?.fleetKey === "string" ? token.fleetKey : "";
  if (!key) {
    return { errorResponse: Response.json(NO_KEY_BODY, { status: 401 }) };
  }
  return { apiKey: key };
}
