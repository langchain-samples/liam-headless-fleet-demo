// Browser-side Fleet client. Calls our OWN /api/fleet/* proxy — never the upstream directly,
// and never sees the API key. Works in client components and (via absolute base) server too.
import type { FleetError } from "./types";

export class FleetClientError extends Error {
  status: number;
  code?: string;
  detail?: string;
  constructor(status: number, body: Partial<FleetError> | string) {
    const detail = typeof body === "string" ? body : body.detail || body.message;
    super(detail || `Request failed (${status})`);
    this.status = status;
    this.detail = detail;
    this.code = typeof body === "string" ? undefined : body.code;
  }
}

/** Canonical error-message extractor for Fleet errors. Used across the UI. */
export function errMessage(e: unknown, fallback = "Something went wrong."): string {
  if (e instanceof FleetClientError) return e.detail || e.message || fallback;
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

export interface ApiOptions {
  method?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
}

function qs(query?: ApiOptions["query"]): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    // Fleet caps page_size at 1–100; clamp defensively so a too-large value
    // never turns into a 400 that silently empties a list.
    if (k === "page_size") {
      const n = Math.max(1, Math.min(100, Math.floor(Number(v) || 20)));
      sp.set(k, String(n));
      continue;
    }
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Call the Fleet API through our proxy.
 * `path` is the upstream path WITHOUT the /v1/fleet prefix, e.g. "agents" or `agents/${id}`.
 */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const clean = path.replace(/^\/+/, "");
  const res = await fetch(`/api/fleet/${clean}${qs(opts.query)}`, {
    method: opts.method || "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) throw new FleetClientError(res.status, (parsed as Partial<FleetError>) ?? `HTTP ${res.status}`);
  return parsed as T;
}

/** Open an SSE stream for a thread run. Returns the Response; caller reads response.body. */
export async function streamRun(thread_id: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(`/api/fleet/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id, body }),
    signal,
  });
}

/**
 * Parse an SSE byte stream into {event, data} records. Yields each event as it arrives.
 * Defensive: handles `event:`/`data:` lines and bare JSON lines.
 */
export async function* parseSSE(
  res: Response,
  signal?: AbortSignal,
): AsyncGenerator<{ event: string; data: string }> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Parse one SSE record (its lines already split). Lines may keep a trailing
  // \r when the stream uses CRLF; trim it. `:`-prefixed lines are comments
  // (e.g. `: heartbeat`) and are ignored.
  const toRecord = (raw: string): { event: string; data: string } | null => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      const l = line.replace(/\r$/, "");
      if (l.startsWith(":")) continue; // SSE comment / heartbeat
      if (l.startsWith("event:")) event = l.slice(6).trim();
      else if (l.startsWith("data:")) dataLines.push(l.slice(5).trim());
      else if (l) dataLines.push(l.trim());
    }
    return dataLines.length ? { event, data: dataLines.join("\n") } : null;
  };

  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      // Normalize CRLF -> LF so the blank-line record boundary is always "\n\n".
      // The upstream LangGraph runtime emits CRLF (\r\n\r\n); without this, no
      // record boundary is ever found and the whole stream buffers to the end.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let idx: number;
      // SSE records are separated by a blank line.
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const rec = toRecord(raw);
        if (rec) yield rec;
      }
    }
    const tail = buffer.trim();
    if (tail) {
      const rec = toRecord(tail);
      if (rec) yield rec;
    }
  } finally {
    reader.releaseLock();
  }
}
