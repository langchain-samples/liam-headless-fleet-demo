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
    // Drop TOOL/function messages entirely — their content is a raw tool RESULT
    // (file contents, find_tools definition dumps, etc.), not conversation. Rendering
    // them floods the chat with JSON/blobs; tool activity is shown as step chips instead.
    if (role === "tool") return;
    const content = coerceContent(o.content ?? o.text ?? o.data);
    // Skip empty system noise but keep anything with text.
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

/**
 * Smooths chunky/bursty LLM streams into a fluid typewriter reveal. The model
 * often emits the whole answer in a handful of large chunks within ~1s; rather
 * than painting those at once, we queue the text and reveal it a few characters
 * per animation frame so it visibly types out. `onText` gets the revealed text.
 */
export function createSmoothStreamer(onText: (full: string) => void) {
  let target = ""; // everything received so far
  let shown = 0; // chars revealed
  let timer: ReturnType<typeof setInterval> | null = null;
  let draining = false; // true once the stream ended; reveal the rest, then stop
  let onDrained: (() => void) | null = null;

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const tick = () => {
    if (shown >= target.length) {
      stopTimer();
      if (draining && onDrained) {
        const cb = onDrained;
        onDrained = null;
        cb();
      }
      return;
    }
    // Reveal a steady ~3 chars/frame, scaling up only when far behind so we never
    // lag badly on huge bursts. At ~60fps this types ~180 chars/sec — readable yet brisk.
    const remaining = target.length - shown;
    const step = Math.max(3, Math.min(remaining, Math.ceil(remaining / 20)));
    shown += step;
    onText(target.slice(0, shown));
  };

  const ensureTimer = () => {
    if (!timer) timer = setInterval(tick, 16); // ~60fps
  };

  return {
    /** Queue more streamed text. */
    push(chunk: string) {
      target += chunk;
      ensureTimer();
    },
    /** Replace the whole target (for snapshot-style updates). */
    set(full: string) {
      target = full;
      if (shown > target.length) shown = target.length;
      ensureTimer();
    },
    /**
     * The stream ended — keep typing out the remaining buffered text at the normal
     * pace, then resolve. This is what makes a fully-buffered reply still animate.
     */
    drain(): Promise<void> {
      draining = true;
      if (shown >= target.length) return Promise.resolve();
      ensureTimer();
      return new Promise<void>((resolve) => {
        onDrained = resolve;
      });
    },
    /** Reveal everything immediately and stop (final safety). */
    finish() {
      stopTimer();
      shown = target.length;
      onText(target);
    },
    /** Stop without revealing the rest (call on abort/unmount). */
    cancel() {
      stopTimer();
      onDrained = null;
    },
    get value() {
      return target.slice(0, shown);
    },
  };
}

/** Humanize a deep-agent tool step for a status chip. */
export function humanizeTool(name: string, arg?: string): string {
  const base = (() => {
    switch (name) {
      case "read_file": return "Reading";
      case "write_file": return "Writing";
      case "edit_file": return "Editing";
      case "ls":
      case "list_files": return "Browsing files";
      case "glob":
      case "grep": return "Searching files";
      case "find_tools": return "Finding tools";
      case "write_todos": return "Planning";
      case "enter_agent_generator_mode": return "Designing the agent";
      case "exit_agent_generator_mode": return "Finalizing the agent";
      case "message_user": return "Asking a question";
      case "task": return "Delegating to a subagent";
      case "tavily_web_search":
      case "exa_web_search":
      case "web_search": return "Searching the web";
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
  /** Tool steps extracted from a `values` snapshot (complete args, e.g. file paths). */
  tools?: { name: string; arg?: string }[];
  /** A single tool call surfaced live from the `messages-tuple` stream (at call start). */
  tool?: { name: string; id?: string };
  /** Workspace files from a `values` snapshot (deep-agent file outputs). */
  files?: Record<string, { content?: string; type?: string }>;
  /** HITL interrupt requests surfaced mid-stream from a `values` snapshot's `__interrupt__`. */
  interrupts?: ParsedInterrupt[];
}

/* --------------------------- HITL interrupts --------------------------- */

/** A human-in-the-loop request parsed from a thread's `interrupts` payload. */
export interface ParsedInterrupt {
  /** The interrupt id (used to key the resume Command). */
  interruptId: string;
  /** Tool that triggered the pause, e.g. "message_user". */
  actionName: string;
  /** Human-readable description from the action request. */
  description?: string;
  /** Clarifying questions, when the action is message_user. */
  questions: string[];
  /** Suggested answers per question (parallel to questions; may be empty). */
  suggestedAnswers: string[][];
  /** Allowed decisions for this action, e.g. ["respond"] or ["approve","reject"]. */
  allowedDecisions: string[];
}

/**
 * Extract HITL interrupt requests from a thread's `interrupts` object.
 * Shape: { [interruptId]: [ { value: { action_requests:[...], review_configs:[...] } } ] }
 */
export function parseInterrupts(interrupts: unknown): ParsedInterrupt[] {
  if (!interrupts || typeof interrupts !== "object") return [];
  const out: ParsedInterrupt[] = [];
  for (const [interruptId, entries] of Object.entries(interrupts as Record<string, unknown>)) {
    out.push(...parseInterruptEntries(interruptId, entries));
  }
  return out;
}

/**
 * Parse the `__interrupt__` array that arrives inside a streamed `values` snapshot
 * (shape: `[{ value: { action_requests, review_configs } }, ...]`). Surfaced live so the
 * panel appears the instant the agent pauses, not only after the run settles.
 */
export function parseStreamInterrupt(interruptArray: unknown): ParsedInterrupt[] {
  if (!Array.isArray(interruptArray)) return [];
  // Use a stable key; the resume Command targets the active interrupt regardless of id.
  return parseInterruptEntries("__stream__", interruptArray);
}

/** Shared body: turn one interrupt's entries into ParsedInterrupt[]. */
function parseInterruptEntries(interruptId: string, entries: unknown): ParsedInterrupt[] {
  const out: ParsedInterrupt[] = [];
  {
    const list = Array.isArray(entries) ? entries : [entries];
    for (const entry of list) {
      const value = (entry as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
      if (!value) continue;
      const requests = Array.isArray(value.action_requests) ? value.action_requests : [];
      const configs = Array.isArray(value.review_configs) ? value.review_configs : [];
      for (const req of requests as Record<string, unknown>[]) {
        const name = String(req.name ?? (req.args as Record<string, unknown>)?.name ?? "action");
        const args = (req.args ?? {}) as Record<string, unknown>;
        const cfg = (configs as Record<string, unknown>[]).find(
          (c) => c.action_name === name,
        ) as Record<string, unknown> | undefined;
        out.push({
          interruptId,
          actionName: name,
          description: typeof req.description === "string" ? req.description : undefined,
          questions: Array.isArray(args.questions) ? (args.questions as string[]) : [],
          suggestedAnswers: Array.isArray(args.suggested_answers)
            ? (args.suggested_answers as string[][])
            : [],
          allowedDecisions: Array.isArray(cfg?.allowed_decisions)
            ? (cfg!.allowed_decisions as string[])
            : ["respond"],
        });
      }
    }
  }
  return out;
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

  // Ignore TOOL/function messages entirely — their content is a tool RESULT (file
  // contents, find_tools definition dumps, etc.), never assistant text. Surfacing
  // those would dump raw JSON/blobs into the chat bubble. Tool activity is shown
  // separately as steps. Only AI/assistant chunks produce displayable text below.
  const kind = String((c.type ?? c.role ?? "")).toLowerCase();
  if (kind === "tool" || kind === "toolmessage" || kind === "toolmessagechunk" || kind === "function") {
    return null;
  }

  // 1) Text token delta — the visible assistant reply.
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
    if (text) return { text };
  }

  // 2) Tool call START — surface activity LIVE the moment a tool is invoked, so the
  // user sees progress during the (often long) tool-heavy phase instead of a frozen
  // bubble. The first chunk of a tool call carries the tool `name` + `id`; subsequent
  // `input_json_delta` chunks (same id, no name) stream the args and are ignored here.
  // The richer label with the filename still comes from `values` snapshots later.
  const named = (arr: unknown): { name: string; id?: string } | null => {
    if (!Array.isArray(arr)) return null;
    for (const p of arr) {
      if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        if (typeof o.name === "string" && o.name) {
          return { name: o.name, id: typeof o.id === "string" ? o.id : undefined };
        }
      }
    }
    return null;
  };
  const tool = named(c.tool_call_chunks) ?? (Array.isArray(content) ? named(content) : null);
  if (tool) return { tool };

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
      const v = parsed as Record<string, unknown>;
      const out: StreamPiece = {};
      if (v.files && typeof v.files === "object") {
        out.files = v.files as Record<string, { content?: string; type?: string }>;
      }
      // Extract tool steps with COMPLETE args (file paths, etc.) from the latest AI
      // message — values snapshots carry full tool_calls, unlike streamed chunks.
      const msgs = Array.isArray(v.messages) ? (v.messages as Record<string, unknown>[]) : [];
      const lastAi = [...msgs].reverse().find((m) => m?.type === "ai");
      const calls = Array.isArray(lastAi?.tool_calls) ? (lastAi!.tool_calls as Record<string, unknown>[]) : [];
      const tools = calls
        .filter((tc) => typeof tc.name === "string")
        .map((tc) => ({ name: tc.name as string, arg: toolArg(tc.args) }));
      if (tools.length) out.tools = tools;
      // Surface a HITL pause the instant it streams in (don't wait for run settle).
      if (v.__interrupt__) {
        const parsed = parseStreamInterrupt(v.__interrupt__);
        if (parsed.length) out.interrupts = parsed;
      }
      if (out.files || out.tools || out.interrupts) return out;
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
