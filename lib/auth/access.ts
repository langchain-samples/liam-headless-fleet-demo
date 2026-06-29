// Server-only access-control policy for Google OAuth sign-in.
//
// This module owns the single question "is this Google account allowed in?".
// Keeping it out of `auth.ts` makes the policy explicit, unit-testable, and
// impossible to bundle into client code (the `server-only` import below will
// fail the build if anything client-side imports it).
//
// Security invariants (do not weaken without review):
//   1. Fail closed — if ALLOWED_EMAIL_DOMAINS is unset/empty, deny everyone.
//   2. Require a Google-verified email — an unverified address is
//      attacker-controllable, so the domain alone proves nothing.
//   3. Exact domain match — compare the full host after "@", never a
//      substring/suffix, so `evil-langchain.dev` and `langchain.dev.evil.com`
//      are both rejected.
import "server-only";

/** The subset of a Google OIDC profile this policy depends on. */
export interface OAuthProfile {
  email?: string | null;
  email_verified?: boolean | null;
}

/**
 * Domains allowed to sign in, parsed once at module load from the
 * comma-separated ALLOWED_EMAIL_DOMAINS env var (e.g. "langchain.dev").
 * Normalized to lowercase, trimmed, with empties dropped. An empty list
 * means "deny everyone" (fail closed).
 */
export const allowedDomains: readonly string[] = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

/** Extract the lowercased domain from an email, or "" if there isn't exactly one. */
function emailDomain(email: string | null | undefined): string {
  const parts = (email ?? "").toLowerCase().split("@");
  // A valid address has exactly one "@"; anything else is rejected as "".
  return parts.length === 2 ? parts[1] : "";
}

/**
 * Decide whether a Google account may sign in. Returns true only for a
 * verified email whose domain is on {@link allowedDomains}. See the module
 * header for the invariants this enforces.
 */
export function isEmailAllowed(profile: OAuthProfile | null | undefined): boolean {
  if (profile?.email_verified !== true) return false;
  const domain = emailDomain(profile.email);
  return domain !== "" && allowedDomains.includes(domain);
}
