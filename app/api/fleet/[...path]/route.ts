// Authenticated proxy: browser -> /api/fleet/<upstream path> -> Fleet API (+ secret headers).
// The API key only exists server-side (lib/fleet/server). The client never sees it.
import { NextRequest } from "next/server";
import { fleetRaw, isConfigured } from "@/lib/fleet/server";

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
