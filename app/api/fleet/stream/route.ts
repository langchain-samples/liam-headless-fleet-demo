// SSE pass-through for streaming a thread run.
// POST { thread_id, body } -> upstream POST /threads/{thread_id}/runs/stream (text/event-stream),
// piped straight back to the browser as a streaming response.
import { NextRequest } from "next/server";
import { fleetRaw, isConfigured } from "@/lib/fleet/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return Response.json(
      { code: "not_configured", detail: "Server is not configured for Fleet.", status: 503 },
      { status: 503 },
    );
  }
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
    },
  });
}
