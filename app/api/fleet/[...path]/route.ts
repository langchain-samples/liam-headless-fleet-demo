// Authenticated proxy: browser -> /api/fleet/<upstream path> -> Fleet API (+ secret headers).
// Each request acts AS the logged-in user, using their personal Fleet key from
// the session JWT (never the shared key, and never exposed to the client).
import { NextRequest } from "next/server";
import { fleetRaw, isConfigured } from "@/lib/fleet/server";
import { requireUserFleetKey } from "@/lib/fleet/userKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Org/identity-scoped Fleet paths that must NOT carry X-Tenant-Id.
function isTenantScoped(path: string): boolean {
  if (path.startsWith("orgs/")) return false; // /orgs/{id}/tenants
  if (path === "users/current") return false;
  if (path.startsWith("tenants/")) return false; // /tenants/{tid}/users/{id}
  return true;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!isConfigured()) {
    return Response.json(
      { code: "not_configured", detail: "FLEET_API_KEY / FLEET_TENANT_ID are not set on the server.", status: 503 },
      { status: 503 },
    );
  }

  // Require the caller's own key — no fallback to the shared key for actions.
  const { apiKey, errorResponse } = await requireUserFleetKey(req);
  if (errorResponse) return errorResponse;

  const { path } = await ctx.params;
  const upstreamPath = path.join("/");
  const query = req.nextUrl.search; // includes leading ?
  const method = req.method.toUpperCase();

  let body: unknown = undefined;
  if (method !== "GET" && method !== "DELETE") {
    const text = await req.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
  }

  const res = await fleetRaw(upstreamPath, {
    method,
    query,
    body,
    tenantScoped: isTenantScoped(upstreamPath),
    apiKey,
  });

  // Pass status + JSON (or text) straight back.
  const respText = await res.text();
  const contentType = res.headers.get("content-type") || "application/json";
  return new Response(respText || null, {
    status: res.status,
    headers: { "content-type": contentType },
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
