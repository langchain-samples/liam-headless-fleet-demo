"use client";
// Shared helpers for the Threads UI: message normalization, SSE event interpretation,
// thread-status presentation, and small formatting utilities. Kept defensive because the
// Fleet runtime types thread `values` and run/stream payloads loosely (`object`).
import type { ThreadStatus } from "@/lib/fleet/types";

export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Marks a bubble that is still receiving streamed deltas. */
  streaming?: boolean;
  /** Tool / function name when role === "tool" (best-effort). */
  name?: string;
  /** Deep-agent tool steps surfaced during streaming, for status chips. */
  steps?: string[];
}

/* --------------------------- status presentation --------------------------- */

export const STATUS_TONE: Record<ThreadStatus, "neutral" | "navy" | "good" | "warn" | "bad" | "accent"> = {
  idle: "neutral",
  busy: "navy",
  interrupted: "warn",
  error: "bad",
};

export const STATUS_LABEL: Record<ThreadStatus, string> = {
  idle: "Idle",
  busy: "Busy",
  interrupted: "Interrupted",
  error: "Error",
};

/* --------------------------- formatting --------------------------- */

export function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* --------------------------- content coercion --------------------------- */

/**
 * Message content can be a plain string, or an array of content "parts"
 * (e.g. `[{type:"text", text:"..."}]`), or a structured object. Flatten to text.
 */
export function coerceContent(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const p = part as Record<string, unknown>;
          if (typeof p.text === "string") return p.text;
          if (typeof p.content === "string") return p.content;
          if (p.type === "text" && typeof p.text === "string") return p.text;
        }
        return "";
      })
      .join("");
  }
  if (typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (o.content !== undefined && o.content !== content) return coerceContent(o.content);
  }
  return "";
}

function normalizeRole(role: unknown, type?: unknown): ChatRole {
  const r = String(role ?? type ?? "").toLowerCase();
  if (r === "human" || r === "user") return "user";
  if (r === "ai" || r === "assistant") return "assistant";
  if (r === "tool" || r === "function") return "tool";
  if (r === "system") return "system";
  // LangChain message classes sometimes arrive as {type:"human"|"ai"|...}
  return "assistant";
}

/** Best-effort: pull a messages array out of an arbitrary `values`-like object. */
export function extractMessages(values: unknown): ChatMessage[] {
  if (!values || typeof values !== "object") return [];
  const v = values as Record<string, unknown>;
  // Common shapes: {messages:[...]}, or the value itself being an array.
  const arr: unknown =
    (Array.isArray(v.messages) && v.messages) ||
    (Array.isArray(v.message) && v.message) ||
    (Array.isArray(values) ? values : undefined);
  if (!Array.isArray(arr)) return [];
  const out: ChatMessage[] = [];
  (arr as unknown[]).forEach((m, i) => {
    if (m == null) return;
    if (typeof m === "string") {
      out.push({ id: `m-${i}`, role: "assistant", content: m });
      return;
    }
    if (typeof m !== "object") return;
    const o = m as Record<string, unknown>;
    const role = normalizeRole(o.role, o.type);
    const content = coerceContent(o.content ?? o.text ?? o.data);
    // Skip empty tool/system noise but keep anything with text.
    if (!content && role !== "user") return;
    out.push({
      id: typeof o.id === "string" ? o.id : `m-${i}`,
      role,
      content,
      name: typeof o.name === "string" ? o.name : undefined,
    });
  });
  return out;
}

/* --------------------------- SSE event interpretation --------------------------- */

/** Humanize a deep-agent tool step for a status chip. */
export function humanizeTool(name: string, arg?: string): string {
  const base = (() => {
    switch (name) {
      case "read_file": return "Reading";
      case "write_file": return "Writing";
      case "edit_file": return "Editing";
      case "ls":
      case "list_files": return "Browsing files";
      case "enter_agent_generator_mode": return "Designing the agent";
      case "exit_agent_generator_mode": return "Finalizing the agent";
      case "message_user": return "Asking a question";
      case "task": return "Delegating to a subagent";
      case "tavily_web_search":
      case "exa_web_search": return "Searching the web";
      default: return name.replace(/_/g, " ");
    }
  })();
  if (arg && (name === "read_file" || name === "write_file" || name === "edit_file")) {
    return `${base} ${arg.replace(/^\//, "")}`;
  }
  return base;
}

export interface StreamPiece {
  /** Text to append to (delta) or replace (snapshot) the current assistant turn. */
  text?: string;
  /** When true, `text` is a full snapshot of the assistant message, not an increment. */
  snapshot?: boolean;
  /** A surfaced error string from the run. */
  error?: string;
  /** True when the stream signals the run is finished. */
  done?: boolean;
  /** A tool step the agent is taking (deep-agent activity), for status chips. */
  tool?: { name: string; arg?: string };
  /** Workspace files from a `values` snapshot (deep-agent file outputs). */
  files?: Record<string, { content?: string; type?: string }>;
}

let __snapshotLen = 0;

/** Reset accumulator state between runs. */
export function resetStreamState() {
  __snapshotLen = 0;
}

function lastAiContent(payload: unknown): string | undefined {
  // payload may be {messages:[...]} (values mode) or a single message object.
  const msgs = extractMessages(payload);
  if (msgs.length) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant" && msgs[i].content) return msgs[i].content;
    }
  }
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const c = coerceContent(o.content ?? o.text);
    if (c) return c;
  }
  return undefined;
}

/** Pull the first arg-ish value (e.g. file_path) out of a tool call for a status chip. */
function toolArg(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const a = args as Record<string, unknown>;
  for (const k of ["file_path", "path", "filename", "name", "query", "url"]) {
    if (typeof a[k] === "string" && a[k]) return a[k] as string;
  }
  return undefined;
}

/**
 * Interpret a `messages-tuple` event: data is `[chunk, metadata]` where chunk is an
 * AIMessageChunk. Emits text token deltas and/or a tool-activity step.
 */
function interpretMessageChunk(data: unknown): StreamPiece | null {
  const chunk = Array.isArray(data) ? data[0] : data;
  if (!chunk || typeof chunk !== "object") return null;
  const c = chunk as Record<string, unknown>;

  // Tool call starting (deep-agent activity: read_file, write_file, ls, …).
  const calls = (Array.isArray(c.tool_calls) && c.tool_calls.length
    ? c.tool_calls
    : Array.isArray(c.tool_call_chunks)
      ? c.tool_call_chunks
      : []) as Record<string, unknown>[];
  for (const call of calls) {
    const name = typeof call.name === "string" ? call.name : undefined;
    if (name) return { tool: { name, arg: toolArg(call.args) } };
  }

  // Text token delta from content (string or text blocks). tool_use blocks → no text.
  const content = c.content;
  if (typeof content === "string" && content) return { text: content };
  if (Array.isArray(content)) {
    const text = content
      .map((p) =>
        p && typeof p === "object" && (p as Record<string, unknown>).type === "text"
          ? String((p as Record<string, unknown>).text ?? "")
          : typeof p === "string"
            ? p
            : "",
      )
      .join("");
    // A tool_use block inside content also signals activity.
    const toolUse = content.find(
      (p) => p && typeof p === "object" && (p as Record<string, unknown>).type === "tool_use",
    ) as Record<string, unknown> | undefined;
    if (text) return { text };
    if (toolUse && typeof toolUse.name === "string") {
      return { tool: { name: toolUse.name, arg: toolArg(toolUse.input) } };
    }
  }
  return null;
}

/**
 * Interpret one SSE record into a StreamPiece. DEFENSIVE: the Fleet/LangGraph runtime emits
 * `messages` (token tuples), `values` (full snapshots), `updates`, `error`, `end`. The `data`
 * payload may be JSON or plain text.
 */
export function interpretSSE(event: string, data: string): StreamPiece | null {
  const ev = (event || "message").toLowerCase();

  if (ev === "error") return { error: data || "Run error", done: false };
  if (ev === "end" || ev === "done" || ev === "complete" || ev === "[done]") return { done: true };

  const trimmed = data.trim();
  if (!trimmed || trimmed === "[DONE]") return trimmed === "[DONE]" ? { done: true } : null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Plain-text delta (some runtimes stream raw token text).
    return { text: trimmed };
  }

  // messages-tuple mode: token-level deltas + tool activity.
  if (ev === "messages" || ev === "messages-tuple" || ev.startsWith("messages/")) {
    return interpretMessageChunk(parsed);
  }

  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;

    // Explicit error payloads.
    if (o.error) {
      const e = o.error;
      return { error: typeof e === "string" ? e : (e as Record<string, unknown>)?.message?.toString() || "Run error" };
    }

    // Token-level delta keys.
    const delta =
      (typeof o.delta === "string" && o.delta) ||
      (typeof o.chunk === "string" && o.chunk) ||
      (typeof o.token === "string" && o.token) ||
      (typeof o.text === "string" && o.text && !o.messages && !o.content ? o.text : undefined);
    if (typeof delta === "string") return { text: delta };

    // OpenAI-style choices[].delta.content
    if (Array.isArray(o.choices)) {
      const piece = (o.choices as Record<string, unknown>[])
        .map((c) => {
          const d = (c?.delta ?? c?.message) as Record<string, unknown> | undefined;
          return d && typeof d.content === "string" ? d.content : "";
        })
        .join("");
      if (piece) return { text: piece };
    }
  }

  // `values` snapshots: surface workspace files (deep-agent outputs). Message text in
  // values is NOT diffed here (messages-tuple already streams it) to avoid double-counting.
  if (ev === "values") {
    if (parsed && typeof parsed === "object") {
      const f = (parsed as Record<string, unknown>).files;
      if (f && typeof f === "object") {
        return { files: f as Record<string, { content?: string; type?: string }> };
      }
    }
    return null;
  }

  // Fallback snapshot diffing for runtimes that only emit cumulative message arrays.
  const snapSource =
    parsed && typeof parsed === "object" && "values" in (parsed as object)
      ? (parsed as Record<string, unknown>).values
      : parsed;
  const snap = lastAiContent(snapSource);
  if (typeof snap === "string") {
    if (snap.length >= __snapshotLen) {
      const inc = snap.slice(__snapshotLen);
      __snapshotLen = snap.length;
      return inc ? { text: inc } : null;
    }
    __snapshotLen = snap.length;
    return { text: snap, snapshot: true };
  }

  return null;
}
