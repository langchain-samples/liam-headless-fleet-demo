"use server";

// Server action: validate a user-supplied LangSmith key before it's persisted
// into their session. Validation happens server-side (the key is used to make a
// real Fleet call); we never log the value. Persisting into the JWT is done
// client-side via useSession().update() after this returns ok — see the
// settings page. Being a server action, this is CSRF-protected by Next.
import { fleetJson } from "@/lib/fleet/server";

const KEY_RE = /^lsv2_(pt|sk)_[a-f0-9]{32}_[a-f0-9]{10}$/;

export interface ValidateResult {
  ok: boolean;
  error?: string;
}

export async function validateFleetKey(key: string): Promise<ValidateResult> {
  const trimmed = (key ?? "").trim();
  if (!KEY_RE.test(trimmed)) {
    return { ok: false, error: "That doesn't look like a LangSmith key (expected lsv2_…)." };
  }
  try {
    // Cheapest workspace-scoped call that exercises the key + tenant. 200 => good.
    await fleetJson("/agents?page_size=1", { apiKey: trimmed, tenantScoped: true });
    return { ok: true };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return { ok: false, error: "That key was rejected by Fleet (401/403). Check it and try again." };
    }
    return { ok: false, error: "Couldn't validate the key against Fleet. Try again." };
  }
}
