// SSE pass-through for streaming a thread run.
// POST { thread_id, body } -> upstream POST /threads/{thread_id}/runs/stream (text/event-stream),
// piped straight back to the browser as a streaming response. Runs as the
// logged-in user via their personal Fleet key (from the session JWT).
import { NextRequest } from "next/server";
import { fleetRaw, isConfigured } from "@/lib/fleet/server";
import { requireUserFleetKey } from "@/lib/fleet/userKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return Response.json(
      { code: "not_configured", detail: "Server is not configured for Fleet.", status: 503 },
      { status: 503 },
    );
  }

  const { apiKey, errorResponse } = await requireUserFleetKey(req);
  if (errorResponse) return errorResponse;

  const { thread_id, body } = (await req.json()) as {
    thread_id: string;
    body: unknown;
  };
  if (!thread_id) {
    return Response.json({ code: "bad_request", detail: "thread_id is required", status: 400 }, { status: 400 });
  }

  const upstream = await fleetRaw(`threads/${encodeURIComponent(thread_id)}/runs/stream`, {
    method: "POST",
    body: body ?? {},
    accept: "text/event-stream",
    signal: req.signal,
    apiKey,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(text || null, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Defeat any reverse-proxy/CDN buffering so SSE chunks flush immediately.
      "x-accel-buffering": "no",
    },
  });
}
